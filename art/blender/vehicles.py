"""
Vehicles (outside-park §4) -> 9-direction sprite atlases, one key per look.

    Blender -b --factory-startup -P art/blender/vehicles.py -- [key ...]        # render atlases
    Blender -b --factory-startup -P art/blender/vehicles.py -- --view <key> <yawDeg> <out.png> [zoom]
    node art/tools/build-manifest.mjs

Output: public/assets/sprites/chars/<key>.png + .json (same multi-atlas format as the
characters, frames `idle_<dir>_0`, dir 0 = front facing the camera (south) ... dir 8 =
facing north; the game mirrors 9..15). Anchor = vehicle centre on the ground. meta.sas
also carries `footprint` [length, width] (m), `height` (m) and, for the kart, `seat`.

Model frame: the vehicle faces -Y (south) at dir 0. Builders work in (s, x, z):
s = metres forward from the centre (world y = -s), x = world x, z = up.

Lighting: vehicles use their own toon light (from the east and above, stronger than the
characters' lib_toon light) because that is what the original's vehicles show: a side
facing south renders at ~0.80 of the top colour, a side facing south-east ~0.90
(sampled from the bus, red pickup and cyan pickup). Colours given to vmat() are the
colour the TOP faces render with (sampled from the stills).
"""
import bpy, bmesh, math, os, sys, json
from mathutils import Vector, Matrix, Euler

ART = '/Users/liamliam/Documents/sneaky sasquatch/sneaky-sasquatch/art/blender'
if ART not in sys.path:
    sys.path.append(ART)
import importlib
import lib_toon as T
import atlas as A

ROOT = T.ROOT if os.path.isdir(os.path.join(T.ROOT, 'public')) else os.path.abspath(os.path.join(ART, '..', '..'))
CHARS = os.path.join(ROOT, 'public', 'assets', 'sprites', 'chars')
FONT = os.path.join(ROOT, 'public', 'assets', 'fonts', 'BreeSerif-Regular.ttf')
TMP = os.environ.get('VEH_TMP', '/tmp/sas_vehicles')

VLIGHT = Vector((0.5, 0.0, 0.866)).normalized()
VSHADE = 0.23
TOPF = 1 - VSHADE + VSHADE * VLIGHT.z          # shading factor of an upward face
SIDEF = 1 - VSHADE                              # a face the light does not reach (S / W / N sides)


# ------------------------------------------------------------- materials ----
def _lin(c):
    return T.srgb_to_lin(c)


def _srgb(c):
    c = max(0.0, min(1.0, c))
    return c * 12.92 if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


_MATS = {}


def vmat(hexc, ref='top', shade=VSHADE, flat=False):
    """Unlit toon material. `hexc` is the colour a face renders with: ref='top' (upward
    face), 'side' (a south/west facing side), or None (raw base colour).
    flat=True: no shading at all (lamps, decals that should stay one colour)."""
    key = (hexc, ref, shade, flat)
    m = _MATS.get(key)
    if m is not None and m.name in bpy.data.materials:
        return m
    r, g, b = T.hex_rgb(hexc)
    f = 1.0 if flat or ref is None else (TOPF if ref == 'top' else SIDEF)
    base = tuple(_lin(c) / f for c in (r, g, b)) + (1.0,)
    m = bpy.data.materials.new('veh_%s_%s_%d' % (hexc.lstrip('#'), ref or 'raw', len(_MATS)))
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    emit = nt.nodes.new('ShaderNodeEmission')
    if flat:
        emit.inputs['Color'].default_value = base
    else:
        geo = nt.nodes.new('ShaderNodeNewGeometry')
        dot = nt.nodes.new('ShaderNodeVectorMath'); dot.operation = 'DOT_PRODUCT'
        dot.inputs[1].default_value = tuple(VLIGHT)
        clamp = nt.nodes.new('ShaderNodeClamp')
        lerp = nt.nodes.new('ShaderNodeMapRange')
        lerp.inputs['From Min'].default_value = 0.0
        lerp.inputs['From Max'].default_value = 1.0
        lerp.inputs['To Min'].default_value = 1.0 - shade
        lerp.inputs['To Max'].default_value = 1.0
        mul = nt.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'
        mul.inputs['Factor'].default_value = 1.0
        mul.inputs[6].default_value = base
        comb = nt.nodes.new('ShaderNodeCombineColor')
        nt.links.new(geo.outputs['Normal'], dot.inputs[0])
        nt.links.new(dot.outputs['Value'], clamp.inputs['Value'])
        nt.links.new(clamp.outputs['Result'], lerp.inputs['Value'])
        for i in range(3):
            nt.links.new(lerp.outputs['Result'], comb.inputs[i])
        nt.links.new(comb.outputs['Color'], mul.inputs[7])
        nt.links.new(mul.outputs[2], emit.inputs['Color'])
    emit.inputs['Strength'].default_value = 1.0
    nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])
    _MATS[key] = m
    return m


def shade_hex(hexc, k):
    r, g, b = T.hex_rgb(hexc)
    return '#%02x%02x%02x' % tuple(int(round(max(0, min(1, v * k)) * 255)) for v in (r, g, b))


# -------------------------------------------------------------- geometry ----
PARTS = []          # every object built for the current vehicle


def W(p):
    """(s, x, z) model coords -> world Vector (x, -s, z)."""
    return Vector((p[1], -p[0], p[2]))


def _obj(name, bm, m, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    for p in me.polygons:
        p.use_smooth = smooth
    if m is not None:
        me.materials.append(m)
    PARTS.append(o)
    return o


def loft(name, sections, m, cap=True, mats=None):
    """Connect cross-sections (each a closed loop of (s,x,z) points, same count) with quads.
    mats: optional dict {('side', i_section, j_edge) | 'cap0' | 'cap1': material} overrides."""
    bm = bmesh.new()
    rings = [[bm.verts.new(W(p)) for p in sec] for sec in sections]
    n = len(sections[0])
    faces = []
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        for j in range(n):
            f = bm.faces.new((a[j], a[(j + 1) % n], b[(j + 1) % n], b[j]))
            faces.append((('side', i, j), f))
    if cap:
        faces.append(('cap0', bm.faces.new(rings[0])))
        faces.append(('cap1', bm.faces.new(rings[-1][::-1])))
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    slots = [m]
    if mats:
        for k, f in faces:
            mm = mats.get(k)
            if mm is None and isinstance(k, tuple):
                mm = mats.get(('side', '*', k[2])) or mats.get(('side', k[1], '*'))
            if mm is not None and f.is_valid:
                if mm not in slots:
                    slots.append(mm)
                f.material_index = slots.index(mm)
    o = _obj(name, bm, None)
    for s in slots:
        o.data.materials.append(s)
    return o


def rect(s0, s1, x0, x1, z):
    """closed loop in a horizontal plane (for vertical prisms use loft of two of these)."""
    return [(s0, x0, z), (s0, x1, z), (s1, x1, z), (s1, x0, z)]


def block_faces(s0, s1, w, z0, z1, wt=None, ft=0.0, bt=0.0, xc=0.0):
    """Corner lists (p00, p10, p11, p01) of a block()'s faces, for panel(): u runs -x -> +x on
    front/back/top and rear -> front on the sides, v runs bottom -> top (top: rear -> front)."""
    wt = w if wt is None else wt
    return {
        'front': [(s1, xc - w, z0), (s1, xc + w, z0), (s1 - ft, xc + wt, z1), (s1 - ft, xc - wt, z1)],
        'back': [(s0, xc - w, z0), (s0, xc + w, z0), (s0 + bt, xc + wt, z1), (s0 + bt, xc - wt, z1)],
        'left': [(s0, xc + w, z0), (s1, xc + w, z0), (s1 - ft, xc + wt, z1), (s0 + bt, xc + wt, z1)],
        'right': [(s0, xc - w, z0), (s1, xc - w, z0), (s1 - ft, xc - wt, z1), (s0 + bt, xc - wt, z1)],
        'top': [(s0 + bt, xc - wt, z1), (s0 + bt, xc + wt, z1), (s1 - ft, xc + wt, z1), (s1 - ft, xc - wt, z1)],
        'center': ((s0 + s1) / 2, xc, (z0 + z1) / 2),
    }


def block(name, m, s0, s1, w, z0, z1, wt=None, ft=0.0, bt=0.0, xc=0.0, mats=None, bevel=0.0):
    """Box from s0 (rear) to s1 (front), half-width w, z0..z1. Top face may be narrower
    (wt = top half-width) and pulled in at the front (ft) / back (bt) for sloped faces.
    Face keys for `mats`: 'top', 'bottom', 'front', 'back', 'left' (+x), 'right' (-x).
    bevel: chamfer every edge by this much (the original's softened low-poly bodies)."""
    wt = w if wt is None else wt
    B = [(s0, xc - w, z0), (s0, xc + w, z0), (s1, xc + w, z0), (s1, xc - w, z0)]
    Tq = [(s0 + bt, xc - wt, z1), (s0 + bt, xc + wt, z1), (s1 - ft, xc + wt, z1), (s1 - ft, xc - wt, z1)]
    bm = bmesh.new()
    vb = [bm.verts.new(W(p)) for p in B]
    vt = [bm.verts.new(W(p)) for p in Tq]
    fk = {
        'bottom': bm.faces.new(vb[::-1]),
        'top': bm.faces.new(vt),
        'back': bm.faces.new((vb[0], vb[1], vt[1], vt[0])),
        'left': bm.faces.new((vb[1], vb[2], vt[2], vt[1])),
        'front': bm.faces.new((vb[2], vb[3], vt[3], vt[2])),
        'right': bm.faces.new((vb[3], vb[0], vt[0], vt[3])),
    }
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    slots = [m]
    for k, f in fk.items():
        mm = (mats or {}).get(k)
        if mm is not None:
            if mm not in slots:
                slots.append(mm)
            f.material_index = slots.index(mm)
    if bevel:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=1, affect='EDGES', clamp_overlap=True)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    o = _obj(name, bm, None)
    for s in slots:
        o.data.materials.append(s)
    return o


def quad(name, pts, m, off=0.004, center=None):
    """Flat quad/polygon (s,x,z points), nudged `off` metres along its normal, away from `center`."""
    bm = bmesh.new()
    vs = [bm.verts.new(W(p)) for p in pts]
    f = bm.faces.new(vs)
    bm.normal_update()
    nrm = f.normal.copy()
    if center is not None:
        c = sum((v.co for v in vs), Vector()) / len(vs)
        if nrm.dot(c - W(center)) < 0:
            nrm = -nrm
            f.normal_flip()
    for v in vs:
        v.co += nrm * off
    return _obj(name, bm, m)


def lerp3(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def bilerp(c, u, v):
    """c = 4 corners in order p00, p10, p11, p01 ; u along p00->p10, v along p00->p01."""
    a = lerp3(c[0], c[1], u)
    b = lerp3(c[3], c[2], u)
    return lerp3(a, b, v)


def panel(name, corners, m, u0=0.1, u1=0.9, v0=0.1, v1=0.9, off=0.005, center=(0, 0, 0.5)):
    """Sub-rectangle (in face parameter space) of a quad face, e.g. a window or a stripe."""
    pts = [bilerp(corners, u0, v0), bilerp(corners, u1, v0), bilerp(corners, u1, v1), bilerp(corners, u0, v1)]
    return quad(name, pts, m, off, center)


def cyl(name, m, p0, p1, r, segs=10, r1=None):
    """Cylinder between two (s,x,z) points."""
    r1 = r if r1 is None else r1
    a, b = W(p0), W(p1)
    d = (b - a)
    L = d.length
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r1, depth=L)
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    bmesh.ops.rotate(bm, verts=bm.verts[:], cent=(0, 0, 0), matrix=q.to_matrix())
    for v in bm.verts:
        v.co += (a + b) / 2
    return _obj(name, bm, m)


def wheel(name, s, x, r, w, tire, hub, segs=12, tread=0, hub_r=0.55, z=None):
    """Wheel centred at (s, x, r) with its axle along x; hub disc on the outer side.
    tread>0 gives the knobbly gear outline of off-road tyres."""
    z = r if z is None else z
    side = 1 if x >= 0 else -1
    bm = bmesh.new()
    n = segs * (2 if tread else 1)
    ring0, ring1 = [], []
    for i in range(n):
        a = i / n * math.tau
        rr = r * (1 - tread if (tread and i % 2) else 1)
        p = Vector((0, math.cos(a) * rr, math.sin(a) * rr))
        ring0.append(bm.verts.new(Vector((x - w / 2, -s, z)) + p))
        ring1.append(bm.verts.new(Vector((x + w / 2, -s, z)) + p))
    for i in range(n):
        bm.faces.new((ring0[i], ring0[(i + 1) % n], ring1[(i + 1) % n], ring1[i]))
    bm.faces.new(ring0[::-1])
    bm.faces.new(ring1)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    t = _obj(name, bm, tire)
    # hub disc
    bm = bmesh.new()
    hr = r * hub_r
    xs = x + side * (w / 2 + 0.004)
    vs = [bm.verts.new((xs, -s + math.cos(a) * hr, z + math.sin(a) * hr)) for a in [i / 10 * math.tau for i in range(10)]]
    bm.faces.new(vs)
    h = _obj(name + '_hub', bm, hub)
    return t, h


def disc_flat(name, s, x, z, rs, rx, m, segs=16, normal='z', off=0.0):
    """Ellipse in the horizontal plane (normal z) or in a side plane (normal x)."""
    bm = bmesh.new()
    vs = []
    for i in range(segs):
        a = i / segs * math.tau
        if normal == 'z':
            vs.append(bm.verts.new(W((s + math.cos(a) * rs, x + math.sin(a) * rx, z + off))))
        else:
            vs.append(bm.verts.new(W((s + math.cos(a) * rs, x + off, z + math.sin(a) * rx))))
    bm.faces.new(vs)
    return _obj(name, bm, m)


def text_mesh(name, txt, size, m, s, x, z, rot_z=0.0, bold=0.0):
    """Text lying flat on a horizontal surface (top of the glyphs toward the vehicle's rear)."""
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = txt
    if os.path.exists(FONT):
        cu.font = bpy.data.fonts.load(FONT, check_existing=True)
    cu.size = size
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.offset = bold
    ob = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.ops.object.convert(target='MESH')
    ob = bpy.context.view_layer.objects.active
    # text lies in XY reading along +x with its top toward +y (north): upright on screen when
    # the vehicle faces the camera, like the race-car roundels in o29 / o28
    ob.rotation_euler = (0, 0, rot_z)
    ob.location = W((s, x, z))
    ob.data.materials.clear()
    ob.data.materials.append(m)
    PARTS.append(ob)
    return ob


# ----------------------------------------------------------- common bits ----
GLASS = '#a9c7c4'
GLASS_DARK = '#7f9a99'
TIRE = '#424242'
HUB = '#6e6e70'
HEAD = '#d4fdf8'       # headlight glass
AMBER = '#f5a71a'
TAIL = '#c0363f'
CHROME = '#bcbcbc'
DARK = '#2e2e2e'


def lights_front(s, w, z0, z1, x_in=None, amber=True, size=0.16):
    """Headlights (+ amber indicators) on a front face at s, |x| up to w."""
    x_in = w - size if x_in is None else x_in
    for sg in (-1, 1):
        quad('head', [(s, sg * x_in, z0), (s, sg * w, z0), (s, sg * w, z1), (s, sg * x_in, z1)], vmat(HEAD, flat=True),
             off=0.006, center=(s - 1, sg * x_in, z0))
        if amber:
            xa = x_in - 0.06
            quad('ind', [(s, sg * xa, z0), (s, sg * x_in, z0), (s, sg * x_in, z1), (s, sg * xa, z1)], vmat(AMBER, flat=True),
                 off=0.006, center=(s - 1, sg * x_in, z0))


def lights_rear(s, w, z0, z1, wl=0.12, amber_h=0.35):
    for sg in (-1, 1):
        za = z0 + (z1 - z0) * amber_h
        quad('tail', [(s, sg * (w - wl), za), (s, sg * w, za), (s, sg * w, z1), (s, sg * (w - wl), z1)], vmat(TAIL, flat=True),
             off=0.006, center=(s + 1, sg * w, z0))
        quad('tailA', [(s, sg * (w - wl), z0), (s, sg * w, z0), (s, sg * w, za), (s, sg * (w - wl), za)], vmat(AMBER, flat=True),
             off=0.006, center=(s + 1, sg * w, z0))


def mirrors(s, w, z, m, length=0.12):
    for sg in (-1, 1):
        bm_box('mirror', m, s - 0.06, s + 0.02, sg * w, sg * (w + length), z - 0.035, z + 0.035)


def bm_box(name, m, s0, s1, x0, x1, z0, z1):
    xa, xb = min(x0, x1), max(x0, x1)
    return block(name, m, s0, s1, (xb - xa) / 2, z0, z1, xc=(xa + xb) / 2)


# ================================================================ KART ======
KART = dict(L=1.62, W=1.22, seat_s=-0.30, seat_z=0.24, wheel_s=-0.01, wheel_z=0.55)


def build_kart(col='#6ce9d9', seat='#a6a6a6', with_seat=True):
    body = vmat(col)
    dark = vmat('#5a5a5a')
    tire = vmat(TIRE)
    hub = vmat('#6a6a6a')
    grey = vmat(seat)
    greyD = vmat(shade_hex(seat, 0.82))
    L, Wd = KART['L'], KART['W']
    hl, hw = L / 2, Wd / 2
    # floor pan (dark) between the pods
    block('floor', dark, -0.62, 0.42, 0.40, 0.07, 0.11)
    # front bumper: a thick crescent across the nose, its ends swept back toward the front wheels
    n = 10
    outer, inner = [], []
    for i in range(n + 1):
        t = 2 * i / n - 1                     # -1 .. 1 across the width
        outer.append((hl - 0.17 * t ** 2, hw * t))
    for i in range(n + 1)[::-1]:
        t = 2 * i / n - 1
        inner.append((hl - 0.20 - 0.13 * t ** 2, (hw - 0.05) * t))
    loop = outer + inner
    loft('bumperF', [[(s, x, 0.07) for s, x in loop], [(s, x, 0.21) for s, x in loop]], body)
    # nose spine: from the bumper back to the steering column, rising
    loft('nose', [
        [(hl - 0.10, -0.17, 0.10), (hl - 0.10, 0.17, 0.10), (hl - 0.14, 0.15, 0.24), (hl - 0.14, -0.15, 0.24)],
        [(0.04, -0.15, 0.10), (0.04, 0.15, 0.10), (0.08, 0.13, 0.37), (0.08, -0.13, 0.37)],
    ], body)
    # side pods
    for sg in (-1, 1):
        xo, xi = sg * hw, sg * (hw - 0.25)
        x0, x1 = min(xo, xi), max(xo, xi)
        block('pod', body, -0.66, 0.30, (x1 - x0) / 2, 0.10, 0.32, wt=(x1 - x0) / 2 - 0.025, ft=0.09, bt=0.04,
              xc=(x0 + x1) / 2)
    # rear bumper plate
    block('bumperR', body, -hl, -hl + 0.18, hw - 0.10, 0.11, 0.24, wt=hw - 0.14, bt=0.05)
    # wheels (mostly tucked under the pods / bumpers)
    for s in (0.38, -0.56):
        for sg in (-1, 1):
            wheel('wheel', s, sg * (hw - 0.07), 0.15, 0.17, tire, hub, segs=10)
    # steering column + wheel
    cyl('column', dark, (0.14, 0.0, 0.30), (0.03, 0.0, 0.49), 0.025, segs=6)
    sw_c = Vector((KART['wheel_s'], 0.0, KART['wheel_z']))
    ring = []
    for i in range(12):
        a = i / 12 * math.tau
        # wheel plane tilted: normal points back/up toward the driver
        u = Vector((0, math.cos(a), 0))
        v = Vector((math.sin(a) * 0.42, 0, math.sin(a) * 0.906))
        ring.append(tuple(sw_c + (u + v) * 0.16))
    for i in range(12):
        a, b = ring[i], ring[(i + 1) % 12]
        cyl('swheel', vmat('#4a4a4a'), a, b, 0.022, segs=5)
    cyl('spoke', vmat('#4a4a4a'), tuple(sw_c), ring[0], 0.018, segs=4)
    cyl('spoke', vmat('#4a4a4a'), tuple(sw_c), ring[6], 0.018, segs=4)
    cyl('spoke', vmat('#4a4a4a'), tuple(sw_c), ring[9], 0.018, segs=4)
    if with_seat:
        build_kart_seat(grey, greyD)
    return dict(footprint=[round(L, 2), round(Wd, 2)], height=0.80,
                seat=dict(back=-KART['seat_s'], height=KART['seat_z']))


def plate(name, m, outline, origin, recline_deg, thick, mats=None):
    """A flat panel: outline [(x, h)] drawn in a plane that leans back by recline_deg from
    vertical, through origin (s, z); extruded `thick` metres backwards."""
    r = math.radians(recline_deg)
    up = (-math.sin(r), math.cos(r))          # (ds, dz)
    nb = (-math.cos(r), -math.sin(r))         # backwards normal
    s0, z0 = origin
    front = [(s0 + up[0] * h, x, z0 + up[1] * h) for x, h in outline]
    back = [(s + nb[0] * thick, x, z + nb[1] * thick) for s, x, z in front]
    return loft(name, [front, back], m, mats=mats)


def build_kart_seat(grey, greyD):
    ss, sz = KART['seat_s'], KART['seat_z']
    # cushion
    block('seat', grey, ss - 0.17, ss + 0.17, 0.21, 0.11, sz, wt=0.20, ft=0.03)
    # tall bucket back with a rounded top, leaning back 14 deg
    outline = [(-0.23, 0.0), (0.23, 0.0), (0.24, 0.42), (0.21, 0.58), (0.13, 0.66), (0.0, 0.68), (-0.13, 0.66),
               (-0.21, 0.58), (-0.24, 0.42)]
    plate('seatback', grey, outline, (ss - 0.15, sz - 0.04), 11, 0.08)
    # bucket wings at the sides of the back
    for sg in (-1, 1):
        loft('wing', [
            [(ss - 0.17, sg * 0.20, sz - 0.02), (ss - 0.17, sg * 0.25, sz - 0.02), (ss + 0.10, sg * 0.25, sz - 0.02),
             (ss + 0.10, sg * 0.20, sz - 0.02)],
            [(ss - 0.24, sg * 0.21, sz + 0.34), (ss - 0.24, sg * 0.25, sz + 0.34), (ss - 0.14, sg * 0.25, sz + 0.12),
             (ss - 0.14, sg * 0.21, sz + 0.12)],
        ], greyD)


# ================================================================ CARS ======
SKIRT = '#5c6162'
TRIM = '#8e8e8e'


def glassm():
    return vmat(GLASS, ref='side')


def handles(s_list, x, z, sg):
    for s in s_list:
        quad('handle', [(s - 0.07, x, z - 0.015), (s + 0.07, x, z - 0.015), (s + 0.07, x, z + 0.015),
                        (s - 0.07, x, z + 0.015)], vmat('#4c4c4c', ref='side'), off=0.008, center=(s, 0, z))


def head_tail(L, hw, z0, zb, ft, bt, wt, head_v=(0.50, 0.82), tail_v=(0.50, 0.85), amber_front=True, head_u=0.20,
              tail_u=0.17):
    """head/indicator lamps on the lower body's front face, tail lamps on its back face"""
    F = block_faces(-L / 2, L / 2, hw, z0, zb, wt, ft, bt)
    c = F['center']
    head = vmat(HEAD, flat=True)
    amb = vmat(AMBER, flat=True)
    tail = vmat(TAIL, flat=True)
    for u0, u1, a0, a1 in ((0.03, 0.03 + head_u, 0.03 + head_u, 0.08 + head_u), (0.97 - head_u, 0.97, 0.92 - head_u, 0.97 - head_u)):
        panel('head', F['front'], head, u0, u1, head_v[0], head_v[1], off=0.006, center=c)
        if amber_front:
            panel('ind', F['front'], amb, a0, a1, head_v[0], head_v[1], off=0.006, center=c)
    for u0, u1 in ((0.03, 0.03 + tail_u), (0.97 - tail_u, 0.97)):
        vm = tail_v[0] + (tail_v[1] - tail_v[0]) * 0.35
        panel('tail', F['back'], tail, u0, u1, vm, tail_v[1], off=0.006, center=c)
        panel('tailA', F['back'], amb, u0, u1, tail_v[0], vm, off=0.006, center=c)


def side_prism(name, m, profile, x0, x1, bevel=0.0, segs=1, mats=None, shoulder=0.0):
    """Extrude a side profile [(s, z), ...] (closed polygon) across x from x0 to x1.
    shoulder: big chamfer along the edges between the sides and the upward faces (rounded body).
    mats: {'top': m, 'side': m} overrides by face normal (top = mostly upward faces)."""
    bm = bmesh.new()
    va = [bm.verts.new(W((s_, x0, z_))) for s_, z_ in profile]
    vb = [bm.verts.new(W((s_, x1, z_))) for s_, z_ in profile]
    n = len(profile)
    bm.faces.new(va)
    bm.faces.new(vb[::-1])
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((va[i], va[j], vb[j], vb[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    if shoulder:
        bm.normal_update()
        sh = []
        for e in bm.edges:
            fs = e.link_faces
            if len(fs) == 2:
                a, b = fs[0].normal, fs[1].normal
                if (abs(a.x) > 0.9 and b.z > 0.3) or (abs(b.x) > 0.9 and a.z > 0.3):
                    sh.append(e)
        bmesh.ops.bevel(bm, geom=sh, offset=shoulder, segments=2, profile=0.6, affect='EDGES', clamp_overlap=True)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    if bevel:
        edges = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > 0.35]
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=segs, affect='EDGES', clamp_overlap=True)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    slots = [m]
    if mats:
        bm.normal_update()
        for f in bm.faces:
            k = 'top' if f.normal.z > 0.55 else 'side'
            mm = mats.get(k)
            if mm is not None:
                if mm not in slots:
                    slots.append(mm)
                f.material_index = slots.index(mm)
    o = _obj(name, bm, None)
    for sl in slots:
        o.data.materials.append(sl)
    return o


def arches_bottom(s_from, s_to, z0, wheels, ra, zc, n=8):
    """Bottom edge from s_from (rear) to s_to (front) at height z0, cut by a semicircular
    wheel arch of radius ra around (s_w, zc) for every wheel."""
    pts = [(s_from, z0)]
    for sw in sorted(wheels):
        th0 = math.asin(max(-1.0, min(1.0, (z0 - zc) / ra)))
        for i in range(n + 1):
            th = (math.pi - th0) + (2 * th0 - math.pi) * i / n
            pts.append((sw + ra * math.cos(th), zc + ra * math.sin(th)))
    pts.append((s_to, z0))
    return pts


def lamp(name, m, s, x0, x1, z0, z1, toward=-1):
    """flat lamp facing +s (toward=1, front) or -s (toward=-1, rear) at s"""
    quad(name, [(s, x0, z0), (s, x1, z0), (s, x1, z1), (s, x0, z1)], m, off=0.0)


def car(body, style='B', L=2.56, Wd=1.29, z0=0.22, zb=0.71, zr=1.21, cab=(-0.84, 0.47), ws=0.22, rw=0.15,
        cw_in=0.0, roof_in=0.01, shoulder=0.0, wheel_r=0.25, wheels=(0.80, -0.78), trim=None, spoiler=False,
        number=None, num_bg='#f4f4f4', num_fg='#262626', side_split=0.5, mirror=True, nose=0.06, tail=0.05,
        hood_drop=0.0, deck_drop=0.0):
    """Generic car. Lower body = side profile with wheel arches (optionally with rounded
    shoulders), greenhouse block with inset glass. cab = (rear-window base, windshield base).
    style 'B' = the small boxy sedan (lime/purple/magenta/blue traffic cars, race cars):
    big square head lamps at the top of a tall front face; style 'A' = the big rounded
    sedan (yellow/black): lamps low in the nose, separate bumpers."""
    hl, hw = L / 2, Wd / 2
    bodyM = vmat(body)
    top = [(hl, z0 + 0.03), (hl + 0.01, zb - hood_drop - 0.06), (hl - nose, zb - hood_drop), (hl - nose - 0.25, zb),
           (-hl + tail + 0.25, zb), (-hl + tail, zb - deck_drop), (-hl - 0.01, zb - deck_drop - 0.06),
           (-hl, z0 + 0.03)]
    prof = top + arches_bottom(-hl + 0.06, hl - 0.06, z0, wheels, wheel_r + 0.05, wheel_r)
    side_prism('body', bodyM, prof, -hw, hw, bevel=0.03, shoulder=shoulder)
    block('under', vmat(SKIRT), -hl + 0.15, hl - 0.15, hw - 0.10, 0.12, z0 + 0.12)
    if trim:
        trimM = vmat(trim)
        block('bumperF', trimM, hl - 0.04, hl + 0.05, hw + 0.004, 0.14, z0 + 0.10, bevel=0.015)
        block('bumperR', trimM, -hl - 0.05, -hl + 0.04, hw + 0.004, 0.14, z0 + 0.10, bevel=0.015)
    # greenhouse
    c0, c1 = cab
    cw = hw - cw_in
    wr = cw - roof_in
    zc = zb - 0.01
    block('cabin', bodyM, c0, c1, cw, zc, zr, wt=wr, ft=ws, bt=rw, bevel=0.025)
    F = block_faces(c0, c1, cw, zc, zr, wr, ws, rw)
    g = glassm()
    panel('windshield', F['front'], g, 0.05, 0.95, 0.10, 0.88, center=F['center'])
    panel('rearwin', F['back'], g, 0.06, 0.94, 0.12, 0.86, center=F['center'])
    for sd in ('left', 'right'):
        if side_split:
            panel('win', F[sd], g, 0.05, side_split - 0.025, 0.12, 0.86, center=F['center'])
            panel('win', F[sd], g, side_split + 0.025, 0.95, 0.12, 0.86, center=F['center'])
        else:
            panel('win', F[sd], g, 0.06, 0.94, 0.12, 0.86, center=F['center'])
    # lamps
    head, amb, tl = vmat(HEAD, flat=True), vmat(AMBER, flat=True), vmat(TAIL, flat=True)
    sf, sr = hl + 0.012, -hl - 0.012
    for sg in (-1, 1):
        if style == 'B':
            lamp('head', head, sf + 0.004, sg * (hw - 0.015), sg * (hw - 0.25), zb - 0.30, zb - 0.07)
            lamp('tail', tl, sr - 0.004, sg * (hw - 0.015), sg * (hw - 0.21), z0 + 0.12, z0 + 0.33)
            lamp('tailA', amb, sr - 0.004, sg * (hw - 0.015), sg * (hw - 0.21), z0 + 0.06, z0 + 0.12)
        else:
            lamp('head', head, sf + 0.004, sg * (hw - 0.06), sg * (hw - 0.24), z0 + 0.14, z0 + 0.30)
            lamp('ind', amb, sf + 0.004, sg * (hw - 0.02), sg * (hw - 0.06), z0 + 0.14, z0 + 0.30)
            lamp('tail', tl, sr - 0.004, sg * (hw - 0.03), sg * (hw - 0.17), z0 + 0.20, z0 + 0.40)
            lamp('tailA', amb, sr - 0.004, sg * (hw - 0.03), sg * (hw - 0.17), z0 + 0.14, z0 + 0.20)
        handles([c1 - 0.25, (c0 + c1) / 2 - 0.12], sg * (hw + 0.002), zb - 0.12, sg)
        if mirror:
            bm_box('mirror', bodyM, c1 - 0.10, c1 - 0.02, sg * cw, sg * (cw + 0.12), zb + 0.03, zb + 0.10)
    tire, hub = vmat(TIRE), vmat(HUB)
    for s_ in wheels:
        for sg in (-1, 1):
            wheel('wheel', s_, sg * (hw - 0.105), wheel_r, 0.19, tire, hub, segs=12)
    if spoiler:
        dk = vmat('#2a2a2a')
        block('wing', dk, -hl + 0.02, -hl + 0.24, hw - 0.02, zb + 0.16, zb + 0.21)
        for sg in (-1, 1):
            bm_box('strut', dk, -hl + 0.10, -hl + 0.17, sg * (hw - 0.22), sg * (hw - 0.28), zb - 0.02, zb + 0.17)
    if number is not None:
        # racing roundel on the hood (white disc + number)
        sh = (c1 + hl) / 2 - 0.02
        disc_flat('roundel', sh, 0, zb + 0.004, 0.31, 0.34, vmat(num_bg), segs=24)
        text_mesh('num', str(number), 0.50, vmat(num_fg), sh, 0.0, zb + 0.009, bold=0.0)
    return dict(footprint=[round(L + 0.1, 2), Wd], height=zr)


# style B: the small boxy sedan seen most in traffic (lime t22, purple t38, lot magenta/blue o14)
def sedan_small(body, **kw):
    return car(body, **kw)


# style A: the big rounded sedan (yellow t511, black o02, teal dealership o38)
def sedan_big(body, **kw):
    a = dict(style='A', L=3.04, Wd=1.30, z0=0.32, zb=0.96, zr=1.49, cab=(-0.92, 0.80), ws=0.36, rw=0.28,
             cw_in=0.07, roof_in=0.05, shoulder=0.12, wheel_r=0.25, wheels=(0.86, -0.92), trim='#7b7b7b',
             nose=0.10, tail=0.06, hood_drop=0.08, deck_drop=0.04)
    a.update(kw)
    return car(body, **a)


def compact(body, **kw):
    """2-box hatchback version of the small car (car_compact_* keys)"""
    a = dict(L=2.40, zr=1.26, cab=(-1.12, 0.38), ws=0.24, rw=0.06, wheels=(0.74, -0.72), side_split=0.56)
    a.update(kw)
    return car(body, **a)


def race_car(body, number, **kw):
    info = car(body, number=number, **kw)
    # second roundel on the roof, read from behind (o28)
    c0, c1 = -0.84, 0.47
    sr = (c0 + 0.15 + c1 - 0.22) / 2
    disc_flat('roofroundel', sr, 0, 1.21 + 0.004, 0.30, 0.32, vmat('#f4f4f4'), segs=24)
    text_mesh('roofnum', str(number), 0.46, vmat('#262626'), sr, 0.0, 1.21 + 0.009, bold=0.0)
    return info


# ---------------------------------------------------------------- pickup ----
def pickup(body, trim='#8a8a8a', marker=AMBER, L=3.60, Wd=1.56, interior='#7a7a7a', floor='#5c5c5c'):
    """Pickup (red o02 side view, cyan o15, grey o19 back view, white o22 front view)."""
    hl, hw = L / 2, Wd / 2
    bodyM = vmat(body)
    z0, zb, zr = 0.33, 0.92, 1.44
    wr_, wf_ = -0.78, 1.10          # wheel stations
    r = 0.30
    s_cab0 = -0.44
    # front body: hood + cab base, front wheel arch, rounded shoulders
    top = [(hl, z0 + 0.03), (hl + 0.01, zb - 0.10), (hl - 0.07, zb - 0.02), (hl - 0.30, zb), (s_cab0, zb),
           (s_cab0, z0 + 0.03)]
    prof = top + arches_bottom(s_cab0, hl - 0.05, z0, [wf_], r + 0.05, r)
    side_prism('hood', bodyM, prof, -hw, hw, bevel=0.03, shoulder=0.15)
    block('under', vmat(SKIRT), -hl + 0.15, hl - 0.15, hw - 0.10, 0.16, z0 + 0.10)
    # cab
    cw = hw - 0.10
    wr = cw - 0.06
    block('cab', bodyM, s_cab0, 0.74, cw, zb - 0.02, zr, wt=wr, ft=0.30, bt=0.04, bevel=0.03)
    F = block_faces(s_cab0, 0.74, cw, zb - 0.02, zr, wr, 0.30, 0.04)
    g = glassm()
    panel('windshield', F['front'], g, 0.05, 0.95, 0.08, 0.88, center=F['center'])
    panel('rearwin', F['back'], g, 0.10, 0.90, 0.22, 0.84, center=F['center'])
    for sd in ('left', 'right'):
        panel('win', F[sd], g, 0.07, 0.90, 0.10, 0.86, center=F['center'])
    # bed: floor, side walls with the rear wheel arch (body outside, grey inside), front wall, tailgate
    inner, flo = vmat(interior), vmat(floor)
    bz1 = zb + 0.02
    s0, s1 = -hl, s_cab0 - 0.03
    t = 0.07
    block('bedfloor', flo, s0 + t, s1 - t, hw - t, z0 + 0.05, zb - 0.32)
    for sg in (-1, 1):
        wall_top = [(s1, bz1), (s0, bz1)]
        wprof = [(s1, z0 + 0.03)] + [(s1, bz1), (s0, bz1)] + [(s0, z0 + 0.03)][::-1]
        wprof = [(s1, bz1), (s0, bz1), (s0, z0 + 0.03)] + arches_bottom(s0 + 0.05, s1, z0, [wr_], r + 0.05, r)[1:]
        xo, xi = sg * hw, sg * (hw - t)
        side_prism('wall', bodyM, wprof, min(xo, xi), max(xo, xi), bevel=0.015)
        # grey inner face of the wall
        quad('wallin', [(s1 - 0.01, xi, zb - 0.32), (s0 + t, xi, zb - 0.32), (s0 + t, xi, bz1 - 0.02),
                        (s1 - 0.01, xi, bz1 - 0.02)], inner, off=0.003, center=(0, sg * hw, 0.8))
        bm_box('hump', inner, wr_ - 0.32, wr_ + 0.32, sg * (hw - t), sg * (hw - t - 0.17), zb - 0.32, zb - 0.18)
    block('wallF', bodyM, s1 - t, s1, hw - t, zb - 0.34, bz1, mats={'back': inner}, bevel=0.012)
    block('gate', bodyM, s0, s0 + t, hw - t + 0.001, z0 + 0.03, bz1, mats={'front': inner}, bevel=0.012)
    # bumpers + hitch
    trimM = vmat(trim)
    block('bumperF', trimM, hl - 0.04, hl + 0.06, hw + 0.005, 0.20, z0 + 0.13, bevel=0.015)
    block('bumperR', trimM, -hl - 0.06, -hl + 0.03, hw - 0.02, 0.20, z0 + 0.08, bevel=0.015)
    cyl('hitch', trimM, (-hl - 0.05, 0, 0.27), (-hl - 0.20, 0, 0.27), 0.03, segs=6)
    cyl('ball', trimM, (-hl - 0.20, 0, 0.27), (-hl - 0.20, 0, 0.34), 0.045, segs=8)
    # lamps
    head, amb, tl = vmat(HEAD, flat=True), vmat(marker, flat=True), vmat(TAIL, flat=True)
    for sg in (-1, 1):
        lamp('head', head, hl + 0.017, sg * (hw - 0.05), sg * (hw - 0.24), zb - 0.32, zb - 0.14)
        lamp('ind', amb, hl + 0.017, sg * (hw - 0.01), sg * (hw - 0.05), zb - 0.32, zb - 0.14)
        lamp('tail', tl, -hl - 0.004, sg * (hw - 0.015), sg * (hw - 0.17), bz1 - 0.30, bz1 - 0.05)
        lamp('tailA', amb, -hl - 0.004, sg * (hw - 0.015), sg * (hw - 0.17), bz1 - 0.38, bz1 - 0.30)
        bm_box('mirror', bodyM, 0.62, 0.70, sg * cw, sg * (cw + 0.14), zb + 0.04, zb + 0.13)
        handles([0.10], sg * (hw + 0.002), zb - 0.14, sg)
    tire, hub = vmat(TIRE), vmat(HUB)
    for s_ in (wf_, wr_):
        for sg in (-1, 1):
            wheel('wheel', s_, sg * (hw - 0.12), r, 0.22, tire, hub, segs=12)
    return dict(footprint=[round(L + 0.2, 2), Wd], height=zr)


# ------------------------------------------------------------------ jeeps ----
def spare_tire(s, x, z, r, w, tire, hub, tread=0.10):
    """Tyre standing on its edge with the axle along s (mounted on a rear door)."""
    bm = bmesh.new()
    n = 24
    ring0, ring1 = [], []
    for i in range(n):
        a = i / n * math.tau
        rr = r * (1 - tread if (tread and i % 2) else 1)
        ring0.append(bm.verts.new(W((s, x + math.cos(a) * rr, z + math.sin(a) * rr))))
        ring1.append(bm.verts.new(W((s - w, x + math.cos(a) * rr, z + math.sin(a) * rr))))
    for i in range(n):
        bm.faces.new((ring0[i], ring0[(i + 1) % n], ring1[(i + 1) % n], ring1[i]))
    bm.faces.new(ring0[::-1])
    bm.faces.new(ring1)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    _obj('spare', bm, tire)
    bm = bmesh.new()
    vs = [bm.verts.new(W((s - w - 0.004, x + math.cos(a) * r * 0.5, z + math.sin(a) * r * 0.5)))
          for a in [i / 10 * math.tau for i in range(10)]]
    bm.faces.new(vs)
    _obj('spare_hub', bm, hub)


def badge(s, x, z, size, m, m2=None):
    """Gold ranger shield lying on the hood (point toward the front)."""
    pts = [(0.0, -0.50), (0.32, -0.42), (0.50, -0.22), (0.50, 0.30), (0.25, 0.42), (0.0, 0.55), (-0.25, 0.42),
           (-0.50, 0.30), (-0.50, -0.22), (-0.32, -0.42)]
    # (u across, v along) -> shield with its point toward +s
    quad('badge', [(s - v * size, x + u * size, z) for u, v in pts], m, off=0.0)
    if m2:
        quad('badge2', [(s - v * size * 0.62, x + u * size * 0.62, z + 0.003) for u, v in pts], m2, off=0.0)


def jeep_ranger(body='#2e772a', side='#215121'):
    """Ranger SUV (o09, o22): dark green, darker sides, orange/grey light bar on the roof,
    gold badge on the hood, spare tyre on the back door, knobbly tyres, grey brush guard."""
    L, Wd = 3.02, 1.58
    hl, hw = L / 2, Wd / 2
    z0, zb, zr = 0.44, 1.02, 1.74
    r = 0.36
    wf_, wr_ = 0.92, -0.90
    top = vmat(body)
    sideM = vmat(side, ref='side')
    prof = [(hl, z0 + 0.03), (hl + 0.01, zb - 0.08), (hl - 0.05, zb), (-hl + 0.03, zb), (-hl, zb - 0.06),
            (-hl, z0 + 0.03)] + arches_bottom(-hl + 0.05, hl - 0.05, z0, [wr_, wf_], r + 0.07, r)
    side_prism('body', top, prof, -hw, hw, bevel=0.03, shoulder=0.05, mats={'side': sideM})
    block('under', vmat(SKIRT), -hl + 0.15, hl - 0.15, hw - 0.12, 0.20, z0 + 0.10)
    # cabin: long roof to the back
    c0, c1 = -hl + 0.02, 0.30
    cw = hw - 0.03
    wr = cw - 0.05
    cab_m = {'left': sideM, 'right': sideM, 'back': sideM}
    block('cabin', top, c0, c1, cw, zb - 0.01, zr, wt=wr, ft=0.26, bt=0.05, bevel=0.03, mats=cab_m)
    F = block_faces(c0, c1, cw, zb - 0.01, zr, wr, 0.26, 0.05)
    g = glassm()
    panel('windshield', F['front'], g, 0.05, 0.95, 0.10, 0.88, center=F['center'])
    panel('rearwin', F['back'], g, 0.10, 0.90, 0.22, 0.86, center=F['center'])
    for sd in ('left', 'right'):
        for u0, u1 in ((0.05, 0.34), (0.38, 0.64), (0.68, 0.94)):
            panel('win', F[sd], g, u0, u1, 0.14, 0.86, center=F['center'])
    # light bar across the roof, near the front
    orange, grey = vmat('#f39947'), vmat('#989898')
    sb = c1 - 0.26 - 0.30
    for x0, x1, m in ((-0.56, -0.17, orange), (-0.17, 0.17, grey), (0.17, 0.56, orange)):
        block('lightbar', m, sb - 0.13, sb + 0.13, (x1 - x0) / 2, zr - 0.01, zr + 0.13, xc=(x0 + x1) / 2, bevel=0.012)
    # gold badge on the hood
    badge((c1 + hl) / 2 + 0.04, 0.0, zb + 0.004, 0.50, vmat('#d3a33d'), vmat('#e2b64e'))
    # grey bumpers + brush guard
    trim = vmat('#8c8c8c')
    block('bumperF', trim, hl - 0.03, hl + 0.10, hw + 0.02, 0.24, z0 + 0.14, bevel=0.02)
    block('bumperR', trim, -hl - 0.08, -hl + 0.03, hw + 0.01, 0.24, z0 + 0.12, bevel=0.02)
    dark = vmat('#5e5e5e')
    for x in (-0.42, -0.18, 0.18, 0.42):
        cyl('guard', dark, (hl + 0.08, x, z0 + 0.12), (hl + 0.08, x, zb - 0.02), 0.03, segs=6)
    cyl('guardbar', dark, (hl + 0.08, -0.48, zb - 0.04), (hl + 0.08, 0.48, zb - 0.04), 0.03, segs=6)
    # lamps
    head, amb, tl = vmat(HEAD, flat=True), vmat(AMBER, flat=True), vmat(TAIL, flat=True)
    for sg in (-1, 1):
        lamp('head', head, hl + 0.018, sg * (hw - 0.07), sg * (hw - 0.27), zb - 0.30, zb - 0.12)
        lamp('ind', amb, hl + 0.018, sg * (hw - 0.02), sg * (hw - 0.07), zb - 0.30, zb - 0.12)
        lamp('tail', tl, -hl - 0.012, sg * (hw - 0.02), sg * (hw - 0.14), z0 + 0.22, zb - 0.06)
        lamp('tailA', amb, -hl - 0.012, sg * (hw - 0.02), sg * (hw - 0.14), z0 + 0.10, z0 + 0.22)
        bm_box('mirror', vmat('#d8d8d8'), c1 - 0.12, c1 - 0.04, sg * cw, sg * (cw + 0.13), zb + 0.05, zb + 0.15)
        handles([c1 - 0.30, c1 - 0.95], sg * (hw + 0.002), zb - 0.12, sg)
    tire, hub = vmat('#4a4a4a'), vmat('#727272')
    for s_ in (wf_, wr_):
        for sg in (-1, 1):
            wheel('wheel', s_, sg * (hw - 0.12), r, 0.26, tire, hub, segs=12, tread=0.08)
    spare_tire(-hl - 0.10, 0.22, z0 + 0.42, 0.34, 0.22, tire, hub)
    return dict(footprint=[round(L + 0.4, 2), Wd], height=zr + 0.13)


def jeep_open(body='#8e8c3a', side=None, cage='#5a5a5a'):
    """Open-top off-roader with a roll cage (olive t34 highway, black t512): flat hood, upright
    windscreen frame, grey seats, spare tyre on the tailgate, knobbly tyres."""
    L, Wd = 3.10, 1.52
    hl, hw = L / 2, Wd / 2
    z0, zb = 0.42, 0.98
    r = 0.34
    wf_, wr_ = 0.98, -0.92
    top = vmat(body)
    sideM = vmat(side or shade_hex(body, 0.98), ref='side') if side else None
    # tub: hood in front, open cockpit behind (walls), tail
    hood_prof = [(hl, z0 + 0.03), (hl + 0.01, zb - 0.06), (hl - 0.05, zb), (0.30, zb)] + \
        [(0.30, z0 + 0.03)] + arches_bottom(0.30, hl - 0.05, z0, [wf_], r + 0.07, r)[1:-1]
    side_prism('hood', top, hood_prof, -hw, hw, bevel=0.03, shoulder=0.04, mats={'side': sideM} if sideM else None)
    t = 0.08
    for sg in (-1, 1):
        wprof = [(0.30, zb - 0.06), (-hl, zb - 0.06), (-hl, z0 + 0.03)] + \
            arches_bottom(-hl + 0.04, 0.30, z0, [wr_], r + 0.07, r)[1:]
        xo, xi = sg * hw, sg * (hw - t)
        side_prism('tubwall', top, wprof, min(xo, xi), max(xo, xi), bevel=0.02)
    block('tail', top, -hl, -hl + t, hw - t + 0.001, z0 + 0.03, zb - 0.06, bevel=0.015)
    block('tubfloor', vmat('#4a4a4a'), -hl + t, 0.30, hw - t, z0 + 0.03, z0 + 0.22)
    block('under', vmat(SKIRT), -hl + 0.15, hl - 0.15, hw - 0.12, 0.20, z0 + 0.10)
    # seats
    seat, seatD = vmat('#7a7a7a'), vmat('#626262')
    for x in (-0.33, 0.33):
        block('seat', seat, -0.35, 0.05, 0.22, z0 + 0.22, z0 + 0.40, xc=x)
        plate('seatback', seatD, [(-0.21 + x, 0), (0.21 + x, 0), (0.20 + x, 0.55), (-0.20 + x, 0.55)],
              (-0.33, z0 + 0.36), 8, 0.08)
    block('rearseat', seat, -1.25, -0.75, hw - t - 0.02, z0 + 0.22, z0 + 0.42)
    # windscreen frame + glass
    cg = vmat(cage)
    ws_s, ws_top = 0.33, zb + 0.62
    for sg in (-1, 1):
        cyl('wsframe', top, (ws_s, sg * (hw - 0.05), zb - 0.02), (ws_s - 0.10, sg * (hw - 0.05), ws_top), 0.035, segs=6)
    cyl('wstop', top, (ws_s - 0.10, -(hw - 0.05), ws_top), (ws_s - 0.10, hw - 0.05, ws_top), 0.035, segs=6)
    quad('wsglass', [(ws_s, -(hw - 0.09), zb + 0.02), (ws_s, hw - 0.09, zb + 0.02), (ws_s - 0.095, hw - 0.09, ws_top - 0.04),
                     (ws_s - 0.095, -(hw - 0.09), ws_top - 0.04)], glassm(), off=0.0)
    # roll cage: two hoops + side rails to the windscreen
    hz = zb + 0.70
    for sh in (-0.42, -1.30):
        for sg in (-1, 1):
            cyl('hoop', cg, (sh, sg * (hw - 0.06), zb - 0.06), (sh, sg * (hw - 0.08), hz), 0.035, segs=6)
        cyl('hoopT', cg, (sh, -(hw - 0.08), hz), (sh, hw - 0.08, hz), 0.035, segs=6)
    for sg in (-1, 1):
        cyl('rail', cg, (ws_s - 0.10, sg * (hw - 0.06), ws_top), (-1.30, sg * (hw - 0.08), hz), 0.035, segs=6)
        cyl('diag', cg, (-1.30, sg * (hw - 0.08), hz), (-0.42, sg * (hw - 0.06), zb - 0.04), 0.03, segs=6)
    # bumpers, lamps, spare
    trim = vmat('#6e6e6e')
    block('bumperF', trim, hl - 0.03, hl + 0.09, hw + 0.03, 0.24, z0 + 0.13, bevel=0.02)
    block('bumperR', trim, -hl - 0.06, -hl + 0.02, hw + 0.01, 0.24, z0 + 0.11, bevel=0.02)
    head, amb, tl = vmat(HEAD, flat=True), vmat(AMBER, flat=True), vmat(TAIL, flat=True)
    for sg in (-1, 1):
        lamp('head', head, hl + 0.018, sg * (hw - 0.08), sg * (hw - 0.26), zb - 0.28, zb - 0.10)
        lamp('tail', tl, -hl - 0.004, sg * (hw - 0.02), sg * (hw - 0.12), z0 + 0.22, zb - 0.12)
        lamp('tailA', amb, -hl - 0.004, sg * (hw - 0.02), sg * (hw - 0.12), z0 + 0.12, z0 + 0.22)
    tire, hub = vmat('#4a4a4a'), vmat('#727272')
    for s_ in (wf_, wr_):
        for sg in (-1, 1):
            wheel('wheel', s_, sg * (hw - 0.11), r, 0.24, tire, hub, segs=12, tread=0.08)
    spare_tire(-hl - 0.08, 0.0, zb - 0.05, 0.33, 0.20, vmat('#7a7a7a'), vmat('#5a5a5a'), tread=0.0)
    return dict(footprint=[round(L + 0.35, 2), Wd], height=round(zb + 0.72, 2))


def van(body='#98923b', side=None):
    """Panel van (olive, highway t518): short sloping hood, tall box body, cab glass only."""
    L, Wd = 3.70, 1.62
    hl, hw = L / 2, Wd / 2
    z0, zb, zr = 0.36, 0.98, 2.12
    r = 0.31
    wf_, wr_ = 1.17, -1.15
    top = vmat(body)
    sideM = vmat(side, ref='side') if side else None
    prof = [(hl, z0 + 0.03), (hl + 0.01, zb - 0.10), (hl - 0.10, zb), (-hl, zb), (-hl, z0 + 0.03)] + \
        arches_bottom(-hl + 0.05, hl - 0.05, z0, [wr_, wf_], r + 0.05, r)[1:-1]
    side_prism('body', top, prof, -hw, hw, bevel=0.03, shoulder=0.03, mats={'side': sideM} if sideM else None)
    block('under', vmat(SKIRT), -hl + 0.15, hl - 0.15, hw - 0.12, 0.16, z0 + 0.10)
    s1 = hl - 0.48
    cw = hw - 0.01
    block('box', top, -hl, s1, cw, zb - 0.01, zr, wt=cw - 0.04, ft=0.42, bt=0.0, bevel=0.035)
    F = block_faces(-hl, s1, cw, zb - 0.01, zr, cw - 0.04, 0.42, 0.0)
    g = glassm()
    panel('windshield', F['front'], g, 0.05, 0.95, 0.12, 0.80, center=F['center'])
    for sd in ('left', 'right'):
        # cab door window only (front end of the side)
        panel('win', F[sd], g, 0.80, 0.94, 0.42, 0.80, center=F['center'])
        quad('doorline', [(s1 - 0.62, (1 if sd == 'left' else -1) * (cw + 0.004), zb + 0.02),
                          (s1 - 0.60, (1 if sd == 'left' else -1) * (cw + 0.004), zb + 0.02),
                          (s1 - 0.60, (1 if sd == 'left' else -1) * (cw + 0.004 - 0.003), zr - 0.12),
                          (s1 - 0.62, (1 if sd == 'left' else -1) * (cw + 0.004 - 0.003), zr - 0.12)],
             vmat(shade_hex(body, 0.7), ref='side'), off=0.004, center=(0, 0, 1.2))
    # rear doors: split line + two small windows
    panel('rearwinL', F['back'], g, 0.10, 0.45, 0.60, 0.82, center=F['center'])
    panel('rearwinR', F['back'], g, 0.55, 0.90, 0.60, 0.82, center=F['center'])
    panel('split', F['back'], vmat(shade_hex(body, 0.7)), 0.495, 0.505, 0.02, 0.95, center=F['center'])
    trim = vmat('#7d7d7d')
    block('bumperF', trim, hl - 0.03, hl + 0.06, hw + 0.01, 0.20, z0 + 0.12, bevel=0.015)
    block('bumperR', trim, -hl - 0.06, -hl + 0.03, hw + 0.01, 0.20, z0 + 0.12, bevel=0.015)
    head, amb, tl = vmat(HEAD, flat=True), vmat(AMBER, flat=True), vmat(TAIL, flat=True)
    for sg in (-1, 1):
        lamp('head', head, hl + 0.018, sg * (hw - 0.06), sg * (hw - 0.24), zb - 0.30, zb - 0.14)
        lamp('ind', amb, hl + 0.018, sg * (hw - 0.02), sg * (hw - 0.06), zb - 0.30, zb - 0.14)
        lamp('tail', tl, -hl - 0.004, sg * (hw - 0.02), sg * (hw - 0.12), zb - 0.30, zb + 0.20)
        lamp('tailA', amb, -hl - 0.004, sg * (hw - 0.02), sg * (hw - 0.12), zb - 0.42, zb - 0.30)
        bm_box('mirror', top, s1 - 0.12, s1 - 0.04, sg * cw, sg * (cw + 0.14), zb + 0.30, zb + 0.42)
        handles([s1 - 0.40], sg * (hw + 0.002), zb - 0.10, sg)
    tire, hub = vmat(TIRE), vmat(HUB)
    for s_ in (wf_, wr_):
        for sg in (-1, 1):
            wheel('wheel', s_, sg * (hw - 0.12), r, 0.22, tire, hub, segs=12)
    return dict(footprint=[round(L + 0.12, 2), Wd], height=zr)


def box_truck(cab='#e6e6e6', box='#f2f2f2'):
    """Small white box truck: cab with a short hood, tall box behind on a dark chassis."""
    L, Wd = 5.30, 1.80
    hl, hw = L / 2, Wd / 2
    r = 0.38
    wf_, wr_ = 1.85, -1.45
    cabM, boxM = vmat(cab), vmat(box)
    dark = vmat('#4a4a4a')
    # chassis rails
    block('chassis', dark, -hl + 0.10, hl - 0.25, hw - 0.25, 0.30, 0.55)
    # cab: lower front with arch + cab body
    s_cab0 = hl - 1.55
    z0, zb, zr = 0.42, 1.10, 2.30
    prof = [(hl, z0 + 0.03), (hl + 0.01, zb - 0.10), (hl - 0.10, zb), (s_cab0, zb), (s_cab0, z0 + 0.03)] + \
        arches_bottom(s_cab0, hl - 0.05, z0, [wf_], r + 0.05, r)[1:-1]
    side_prism('cablow', cabM, prof, -hw, hw, bevel=0.03, shoulder=0.04)
    cw = hw - 0.03
    block('cab', cabM, s_cab0, hl - 0.40, cw, zb - 0.01, zr, wt=cw - 0.05, ft=0.30, bt=0.0, bevel=0.035)
    F = block_faces(s_cab0, hl - 0.40, cw, zb - 0.01, zr, cw - 0.05, 0.30, 0.0)
    g = glassm()
    panel('windshield', F['front'], g, 0.05, 0.95, 0.12, 0.85, center=F['center'])
    for sd in ('left', 'right'):
        panel('win', F[sd], g, 0.30, 0.92, 0.30, 0.85, center=F['center'])
    # box
    bs0, bs1 = -hl, s_cab0 - 0.06
    bz0, bz1 = 0.58, 2.80
    bw = hw + 0.04
    block('box', boxM, bs0, bs1, bw, bz0, bz1, bevel=0.03)
    Fb = block_faces(bs0, bs1, bw, bz0, bz1)
    lineM = vmat('#b9b9b9')
    panel('doorsplit', Fb['back'], lineM, 0.495, 0.505, 0.03, 0.97, center=Fb['center'])
    for u0 in (0.18, 0.80):
        panel('hinge', Fb['back'], vmat('#8a8a8a'), u0, u0 + 0.03, 0.60, 0.66, center=Fb['center'])
    for sd in ('left', 'right'):
        panel('stripe', Fb[sd], vmat('#c9cdcd', ref='side'), 0.02, 0.98, 0.04, 0.09, center=Fb['center'])
    # bumpers, lamps, skirts over the rear wheels
    trim = vmat('#8a8a8a')
    block('bumperF', trim, hl - 0.04, hl + 0.07, hw + 0.01, 0.22, z0 + 0.14, bevel=0.015)
    block('bumperR', dark, -hl - 0.06, -hl + 0.06, hw - 0.05, 0.30, 0.50)
    head, amb, tl = vmat(HEAD, flat=True), vmat(AMBER, flat=True), vmat(TAIL, flat=True)
    for sg in (-1, 1):
        lamp('head', head, hl + 0.018, sg * (hw - 0.07), sg * (hw - 0.27), zb - 0.32, zb - 0.14)
        lamp('ind', amb, hl + 0.018, sg * (hw - 0.02), sg * (hw - 0.07), zb - 0.32, zb - 0.14)
        lamp('tail', tl, -hl - 0.032, sg * (bw - 0.03), sg * (bw - 0.17), bz0 + 0.10, bz0 + 0.30)
        lamp('tailA', amb, -hl - 0.032, sg * (bw - 0.03), sg * (bw - 0.17), bz0 + 0.02, bz0 + 0.10)
        bm_box('mirror', dark, hl - 0.75, hl - 0.68, sg * cw, sg * (cw + 0.16), zb + 0.40, zb + 0.70)
    tire, hub = vmat(TIRE), vmat(HUB)
    for s_ in (wf_, wr_):
        for sg in (-1, 1):
            wheel('wheel', s_, sg * (hw - 0.14), r, 0.26 if s_ < 0 else 0.22, tire, hub, segs=12)
    return dict(footprint=[round(L + 0.14, 2), round(Wd + 0.08, 2)], height=bz1)


def bus(body='#e2e2e6', stripe='#384d8e', glass='#a7c2c6'):
    """City bus (o36, facing east): white, wide blue stripe under a dark-framed window band,
    two roof hatches, bi-fold front door + centre door on the right (-x) side, big wheels."""
    L, Wd = 7.00, 1.56
    hl, hw = L / 2, Wd / 2
    r = 0.40
    wf_, wr_ = 1.83, -1.70
    z0, zr = 0.14, 2.75
    bodyM = vmat(body)
    prof = [(hl, z0 + 0.02), (hl + 0.01, zr - 0.15), (hl - 0.06, zr), (-hl + 0.04, zr), (-hl, zr - 0.08),
            (-hl, z0 + 0.02)] + arches_bottom(-hl + 0.05, hl - 0.05, z0, [wr_, wf_], r + 0.16, r, n=10)[1:-1]
    side_prism('body', bodyM, prof, -hw, hw, bevel=0.035, shoulder=0.04)
    block('under', vmat('#373e38', ref='side'), -hl + 0.15, hl - 0.15, hw - 0.32, 0.10, 0.94)
    sideof = hw + 0.004

    def band(x, s0, s1, z0_, z1_, m, off=0.004):
        quad('band', [(s0, x, z0_), (s1, x, z0_), (s1, x, z1_), (s0, x, z1_)], m, off=off, center=(0.0, 0.0, 1.4))

    stripeM = vmat(stripe, ref='side')
    skirtM = vmat('#424242', ref='side')
    frame = vmat('#4f4f52', ref='side')
    doorM = vmat('#8d8d90', ref='side')
    g = vmat(glass, ref='side')
    wz0, wz1 = 1.16, 2.26

    def window(x, s0, s1):
        band(x, s0, s1, wz0, wz1, frame, off=0.006)
        band(x, s0 + 0.05, s1 - 0.05, wz0 + 0.06, wz1 - 0.06, g, off=0.009)
        band(x, s0 + 0.05, s1 - 0.05, wz1 - 0.30, wz1 - 0.27, frame, off=0.010)

    def door(x, s0, s1):
        band(x, s0, s1, z0 + 0.06, wz1, doorM, off=0.012)
        band(x, s0 + 0.05, (s0 + s1) / 2 - 0.02, z0 + 0.14, wz1 - 0.07, g, off=0.015)
        band(x, (s0 + s1) / 2 + 0.02, s1 - 0.05, z0 + 0.14, wz1 - 0.07, g, off=0.015)

    for sg in (-1, 1):
        x = sg * sideof
        # stripe + dark rub strip, broken by the wheel arches
        cuts = sorted([wr_, wf_])
        segs_ = [(-hl + 0.02, cuts[0] - 0.56), (cuts[0] + 0.56, cuts[1] - 0.56), (cuts[1] + 0.56, hl - 0.02)]
        for a_, b_ in segs_:
            band(x, a_, b_, 0.63, 1.06, stripeM)
            band(x, a_, b_, 0.45, 0.62, skirtM)
        for c_ in cuts:   # stripe continues as a thin band over the arch
            band(x, c_ - 0.56, c_ + 0.56, 0.99, 1.06, stripeM)
        if sg < 0:      # door side (right when facing forward)
            window(x, -hl + 0.28, -1.12)
            door(x, -1.04, -0.10)
            window(x, -0.02, 2.12)
            door(x, 2.24, hl - 0.10)
        else:
            window(x, -hl + 0.28, -1.12)
            window(x, -1.04, 0.95)
            window(x, 1.03, hl - 0.35)
        for s_ in (-hl + 0.7, -0.55, 1.10, hl - 0.55):
            band(x, s_ - 0.07, s_ + 0.07, 2.38, 2.45, vmat(AMBER, flat=True), off=0.008)
    # front: big windscreen, destination sign, lamps, bumper
    fs = hl + 0.012
    quad('ws', [(fs, -hw + 0.08, 1.16), (fs, hw - 0.08, 1.16), (fs, hw - 0.08, 2.22), (fs, -hw + 0.08, 2.22)],
         frame, off=0.0)
    quad('ws2', [(fs + 0.004, -hw + 0.13, 1.21), (fs + 0.004, hw - 0.13, 1.21), (fs + 0.004, hw - 0.13, 2.17),
                 (fs + 0.004, -hw + 0.13, 2.17)], g, off=0.0)
    quad('sign', [(fs, -hw + 0.18, 2.31), (fs, hw - 0.18, 2.31), (fs, hw - 0.18, 2.58), (fs, -hw + 0.18, 2.58)],
         vmat('#3a3a3c'), off=0.0)
    quad('signtxt', [(fs + 0.004, -hw + 0.30, 2.40), (fs + 0.004, hw - 0.30, 2.40), (fs + 0.004, hw - 0.30, 2.49),
                     (fs + 0.004, -hw + 0.30, 2.49)], vmat('#f2b33a', flat=True), off=0.0)
    quad('fstripe', [(fs, -hw + 0.02, 0.63), (fs, hw - 0.02, 0.63), (fs, hw - 0.02, 1.06), (fs, -hw + 0.02, 1.06)],
         stripeM, off=0.0)
    head, amb, tl = vmat(HEAD, flat=True), vmat(AMBER, flat=True), vmat(TAIL, flat=True)
    rs = -hl - 0.012
    for sg in (-1, 1):
        lamp('head', head, fs + 0.004, sg * (hw - 0.08), sg * (hw - 0.30), 0.44, 0.60)
        lamp('ind', amb, fs + 0.004, sg * (hw - 0.03), sg * (hw - 0.08), 0.44, 0.60)
        lamp('tail', tl, rs - 0.004, sg * (hw - 0.04), sg * (hw - 0.16), 1.10, 1.70)
        lamp('tailA', amb, rs - 0.004, sg * (hw - 0.04), sg * (hw - 0.16), 0.95, 1.10)
    quad('rwin', [(rs, -hw + 0.20, 1.80), (rs, hw - 0.20, 1.80), (rs, hw - 0.20, 2.35), (rs, -hw + 0.20, 2.35)], g, off=0.0)
    quad('rstripe', [(rs, -hw + 0.02, 0.63), (rs, hw - 0.02, 0.63), (rs, hw - 0.02, 1.06), (rs, -hw + 0.02, 1.06)],
         stripeM, off=0.0)
    trim = vmat('#5a5a5c')
    block('bumperF', trim, hl - 0.03, hl + 0.07, hw + 0.01, 0.14, 0.40, bevel=0.015)
    block('bumperR', trim, -hl - 0.07, -hl + 0.03, hw + 0.01, 0.14, 0.40, bevel=0.015)
    # roof hatches + mirrors
    hatch = vmat('#cfcfd3')
    for s_ in (-0.58, 1.83):
        block('hatch', hatch, s_ - 0.40, s_ + 0.40, 0.45, zr - 0.01, zr + 0.06, bevel=0.01)
    for sg in (-1, 1):
        cyl('mirrorarm', trim, (hl - 0.05, sg * hw, 2.20), (hl + 0.18, sg * (hw + 0.14), 2.05), 0.02, segs=5)
        bm_box('mirror', trim, hl + 0.12, hl + 0.20, sg * (hw + 0.10), sg * (hw + 0.18), 1.75, 2.08)
    tire, hub = vmat('#4f4f4f'), vmat('#6a6a6c')
    for s_ in (wf_, wr_):
        for sg in (-1, 1):
            wheel('wheel', s_, sg * (hw - 0.15), r, 0.28, tire, hub, segs=14)
    return dict(footprint=[round(L + 0.14, 2), Wd], height=zr + 0.06)


def sports(body='#9c3242'):
    """Low wedge sports car (dealership 2500, o38; black one in the Customs showroom)."""
    L, Wd = 3.70, 1.46
    hl, hw = L / 2, Wd / 2
    z0, r = 0.24, 0.26
    wf_, wr_ = 1.12, -1.10
    bodyM = vmat(body)
    # wedge profile: low nose, rising to a high tail, flat rear deck with a lip
    prof = [(hl, z0 + 0.04), (hl + 0.01, 0.44), (hl - 0.10, 0.52), (0.45, 0.70), (-hl + 0.30, 0.80),
            (-hl + 0.05, 0.84), (-hl, 0.78), (-hl, z0 + 0.03)] + \
        arches_bottom(-hl + 0.05, hl - 0.05, z0, [wr_, wf_], r + 0.05, r)[1:-1]
    side_prism('body', bodyM, prof, -hw, hw, bevel=0.03, shoulder=0.07)
    block('under', vmat('#4a4a4c'), -hl + 0.10, hl - 0.10, hw - 0.04, 0.12, z0 + 0.10)
    # greenhouse: raked windscreen, roof, long fastback rear glass down to the tail
    c0, c1 = -1.62, 0.66
    cw = hw - 0.08
    wr = cw - 0.10
    zc, zr = 0.68, 1.16
    block('cabin', bodyM, c0, c1, cw, zc, zr, wt=wr, ft=0.52, bt=0.86, bevel=0.025)
    F = block_faces(c0, c1, cw, zc, zr, wr, 0.52, 0.86)
    g = glassm()
    panel('windshield', F['front'], g, 0.06, 0.94, 0.12, 0.88, center=F['center'])
    panel('rearwin', F['back'], g, 0.08, 0.92, 0.12, 0.86, center=F['center'])
    for sd in ('left', 'right'):
        panel('win', F[sd], g, 0.10, 0.86, 0.14, 0.84, center=F['center'])
        sg = 1 if sd == 'left' else -1
        # side intake strakes
        for k in range(3):
            zz = 0.40 + k * 0.08
            quad('strake', [(-0.70, sg * (hw + 0.002), zz), (-0.20, sg * (hw + 0.002), zz),
                            (-0.20, sg * (hw + 0.002), zz + 0.035), (-0.70, sg * (hw + 0.002), zz + 0.035)],
                 vmat(shade_hex(body, 0.6), ref='side'), off=0.004, center=(0, 0, 0.5))
    head, amb, tl = vmat(HEAD, flat=True), vmat(AMBER, flat=True), vmat(TAIL, flat=True)
    for sg in (-1, 1):
        lamp('head', head, hl + 0.016, sg * (hw - 0.06), sg * (hw - 0.30), 0.34, 0.42)
        lamp('tail', tl, -hl - 0.012, sg * (hw - 0.03), sg * (hw - 0.40), 0.58, 0.72)
        lamp('tailA', amb, -hl - 0.012, sg * (hw - 0.03), sg * (hw - 0.40), 0.52, 0.58)
        bm_box('mirror', bodyM, c1 - 0.42, c1 - 0.34, sg * cw, sg * (cw + 0.12), zc + 0.04, zc + 0.11)
    # tall rear wing on two end plates
    block('wing', bodyM, -hl - 0.02, -hl + 0.26, hw - 0.02, 1.02, 1.08, bevel=0.01)
    for sg in (-1, 1):
        bm_box('endplate', bodyM, -hl - 0.02, -hl + 0.24, sg * (hw - 0.02), sg * (hw - 0.08), 0.80, 1.06)
    tire, hub = vmat(TIRE), vmat(HUB)
    for s_ in (wf_, wr_):
        for sg in (-1, 1):
            wheel('wheel', s_, sg * (hw - 0.11), r, 0.21, tire, hub, segs=12)
    return dict(footprint=[round(L + 0.04, 2), Wd], height=zr)


def motorcycle(body='#c03040'):
    """Red sport bike (dealership 50000, o39/o40)."""
    bodyM = vmat(body)
    blk, grey = vmat('#2c2c2c'), vmat('#8a8a8a')
    tire, hub = vmat('#3a3a3a'), vmat('#9a9a9a')
    r = 0.30
    for s_ in (0.68, -0.66):
        wheel('wheel', s_, 0.0, r, 0.13, tire, hub, segs=14, hub_r=0.5)
        wheel('wheelb', s_, -0.0001, r * 0.5, 0.135, hub, hub, segs=10, hub_r=0.01)
    # frame / engine
    block('engine', grey, -0.22, 0.32, 0.15, 0.28, 0.62, bevel=0.03)
    cyl('fork', grey, (0.68, 0.0, r), (0.48, 0.0, 0.95), 0.035, segs=6)
    cyl('swing', blk, (-0.66, 0.0, r), (-0.10, 0.0, 0.42), 0.04, segs=6)
    cyl('exhaust', grey, (-0.05, 0.12, 0.30), (-0.70, 0.13, 0.55), 0.05, segs=8)
    # fairing, tank, seat, tail
    loft('fairing', [
        [(0.30, -0.17, 0.50), (0.30, 0.17, 0.50), (0.30, 0.15, 0.92), (0.30, -0.15, 0.92)],
        [(0.78, -0.10, 0.48), (0.78, 0.10, 0.48), (0.66, 0.09, 0.98), (0.66, -0.09, 0.98)],
    ], bodyM)
    block('tank', bodyM, -0.05, 0.36, 0.16, 0.62, 0.88, wt=0.12, ft=0.04, bt=0.06, bevel=0.03)
    block('seat', blk, -0.48, -0.02, 0.13, 0.74, 0.84, wt=0.12, bevel=0.02)
    loft('tail', [
        [(-0.45, -0.13, 0.66), (-0.45, 0.13, 0.66), (-0.45, 0.12, 0.84), (-0.45, -0.12, 0.84)],
        [(-0.80, -0.05, 0.80), (-0.80, 0.05, 0.80), (-0.80, 0.05, 0.92), (-0.80, -0.05, 0.92)],
    ], bodyM)
    quad('screen', [(0.62, -0.09, 0.98), (0.62, 0.09, 0.98), (0.50, 0.07, 1.12), (0.50, -0.07, 1.12)], glassm(), off=0.0)
    lamp('head', vmat(HEAD, flat=True), 0.785, -0.07, 0.07, 0.62, 0.74)
    lamp('tail', vmat(TAIL, flat=True), -0.805, -0.045, 0.045, 0.82, 0.89)
    cyl('bars', blk, (0.50, -0.34, 0.98), (0.50, 0.34, 0.98), 0.025, segs=6)
    for sg in (-1, 1):
        cyl('grip', blk, (0.50, sg * 0.26, 0.98), (0.50, sg * 0.36, 0.98), 0.035, segs=6)
        bm_box('mirror', blk, 0.52, 0.56, sg * 0.20, sg * 0.30, 1.05, 1.10)
    return dict(footprint=[2.0, 0.72], height=1.12)


# ============================================================== registry =====
KEYS = {
    'kart': (build_kart, {}),
    'jeep_ranger': (jeep_ranger, {}),
    # big rounded sedan (yellow t511 side view, black o02 with a rear wing, teal dealership 250)
    'car_sedan_black': (sedan_big, dict(body='#343434', spoiler=True, trim='#2a2a2a')),
    'car_sedan_white': (sedan_big, dict(body='#e8e8e8')),
    'car_sedan_yellow': (sedan_big, dict(body='#afa044')),
    'car_sedan_orange': (sedan_big, dict(body='#d9772f')),
    'car_sedan_teal': (sedan_big, dict(body='#5cbcb7')),
    # small boxy sedan: the lime (t22) and purple (t38) traffic cars are this model
    'car_sedan_lime': (sedan_small, dict(body='#80da4f')),
    'car_sedan_purple': (sedan_small, dict(body='#443fa9')),
    'car_pickup_red': (pickup, dict(body='#a33640')),
    'car_pickup_grey': (pickup, dict(body='#898989')),
    'car_pickup_brown': (pickup, dict(body='#8a5a3a')),
    'car_pickup_cyan': (pickup, dict(body='#6cead9')),
    'car_pickup_white': (pickup, dict(body='#e8e8e8')),
    'car_pickup_olive': (pickup, dict(body='#cdc250', marker='#f5a000')),   # inside-park t0470 (top #cdc250, sides ~#9e9540)
    # the lot "compacts" (o14 magenta/blue) are the small sedan body; these keys use its 2-box version
    'car_compact_cyan': (compact, dict(body='#57c7d4')),
    'car_compact_magenta': (compact, dict(body='#c938bc')),
    'car_compact_blue': (compact, dict(body='#3f6d9b')),
    'car_sports_red': (sports, dict(body='#9c3242')),
    'car_sports_black': (sports, dict(body='#2e2e30')),
    'jeep_olive': (jeep_open, dict(body='#8e8c3a')),
    'jeep_black': (jeep_open, dict(body='#262626')),
    'van_olive': (van, dict(body='#98923b')),
    'truck_box_white': (box_truck, {}),
    'bus': (bus, {}),
    'race_car_pink': (race_car, dict(body='#c1797f', number=4)),
    'race_car_purple': (race_car, dict(body='#8f81c1', number=2)),
    'race_car_blue': (race_car, dict(body='#5fa8ba', number=77)),
    'motorcycle_red': (motorcycle, {}),
}


# ============================================================== render =======
def clear():
    T.reset_scene()
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.fonts):
        for d in list(coll):
            if d.users == 0:
                coll.remove(d)
    _MATS.clear()
    PARTS.clear()


def make_rig(parts):
    rig = bpy.data.objects.new('VehicleRig', None)
    bpy.context.scene.collection.objects.link(rig)
    for o in parts:
        o.parent = rig
    bpy.context.view_layer.update()
    return rig


def fit_cell(parts, dirs=9, pad=6, ppm=T.PPM):
    """Cell (w, h) and anchor that fit the model in every rendered direction, anchor centred in x."""
    pts = T.world_verts(parts)
    rmax = umax = 0.0
    umin = 0.0
    for d in range(dirs):
        R = Matrix.Rotation(math.radians(d * 22.5), 3, 'Z')
        for p in pts:
            r, u = T.project(R @ p)
            rmax = max(rmax, abs(r))
            umax = max(umax, u)
            umin = min(umin, u)
    w = int(math.ceil(rmax * ppm)) * 2 + pad * 2
    top = int(math.ceil(umax * ppm)) + pad
    bot = int(math.ceil(-umin * ppm)) + pad
    w += w % 2
    return (w, top + bot), (w // 2, top)


def render_key(key):
    fn, kw = KEYS[key]
    clear()
    info = fn(**kw)
    parts = [o for o in PARTS if o.type == 'MESH']
    rig = make_rig(parts)
    cell, anchor = fit_cell(parts)
    A.CHARS = CHARS
    A.render_atlas(key, rig, {'idle': {'frames': 1, 'fps': 1}}, cell=cell, anchor=anchor,
                   pose_fn=lambda *a: None, tmp=os.path.join(TMP, key))
    jp = os.path.join(CHARS, key + '.json')
    j = json.load(open(jp))
    j['meta']['sas']['footprint'] = info['footprint']
    j['meta']['sas']['height'] = info.get('height')
    for k in ('seat',):
        if k in info:
            j['meta']['sas'][k] = info[k]
    with open(jp, 'w') as f:
        json.dump(j, f)
    print('VEH', key, 'cell', cell, 'anchor', anchor, 'footprint', info['footprint'])


def view(key, yaw, out, zoom=1.0):
    """Single render at an arbitrary yaw (deg, 0 = facing south, 90 = facing east) and zoom."""
    fn, kw = KEYS[key]
    clear()
    fn(**kw)
    parts = [o for o in PARTS if o.type == 'MESH']
    rig = make_rig(parts)
    rig.rotation_euler = (0, 0, math.radians(yaw))
    bpy.context.view_layer.update()
    ppm = T.PPM * zoom
    w, h, anc = T.fit_sprite(parts, pad=4, ppm=ppm)
    T.render_to(out, w, h, anc, ppm)
    print('VIEW', key, 'size', w, h, 'anchor', round(anc[0], 1), round(anc[1], 1))


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if argv and argv[0] == '--view':
        view(argv[1], float(argv[2]), argv[3], float(argv[4]) if len(argv) > 4 else 1.0)
    else:
        for k in (argv or list(KEYS)):
            render_key(k)
