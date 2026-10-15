"""
Shared helpers for the static environment prop scripts (art/blender/props_*.py).

Builds on lib_toon (house toon material + sprite camera). Everything here is
plain geometry/material plumbing; the actual models live in the props_*.py
scripts, each of which exposes a BUILDERS dict {group_name: build_fn}.

Run a prop script headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/blender/props_tutorial.py -- [key ...]
(no keys = build everything in that script). Sprites land in public/assets/sprites/props/.
Afterwards run `node art/tools/build-manifest.mjs` from the project root.

Conventions: metres, x = east, y = north, z = up; prop origin (0,0,0) = footprint
centre on the ground (= sprite anchor); front faces -Y (towards the camera).
"""
import bpy, bmesh, math, random, os, sys
from mathutils import Vector, Matrix, Euler

ART = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else \
    '/Users/liamliam/Documents/sneaky sasquatch/sneaky-sasquatch/art/blender'
if ART not in sys.path:
    sys.path.append(ART)
import lib_toon as T

ROOT = os.path.abspath(os.path.join(ART, '..', '..'))
OUT_DIR = os.path.join(ROOT, 'public', 'assets', 'sprites', 'props')
FONT_PATH = os.path.join(ROOT, 'public', 'assets', 'fonts', 'BreeSerif-Regular.ttf')

FRONT = (0, -1, 0)
TOP = (0, 0, 1)
RIGHT = (1, 0, 0)
LEFT = (-1, 0, 0)

COS = math.cos(math.radians(T.PITCH_DEG))   # vertical foreshortening (0.616)
SIN = math.sin(math.radians(T.PITCH_DEG))   # ground foreshortening (0.788)


# ------------------------------------------------------------------ colour --
def lin_to_srgb(c):
    c = max(0.0, min(1.0, c))
    return c * 12.92 if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def rgb_hex(r, g, b):
    return '#%02x%02x%02x' % tuple(int(round(max(0, min(1, v)) * 255)) for v in (r, g, b))


def shade_factor(n, shade=T.SHADE):
    d = max(0.0, min(1.0, Vector(n).normalized().dot(T.LIGHT_DIR)))
    return 1.0 - shade + shade * d


def comp(hexc, n=FRONT, shade=T.SHADE):
    """Base colour that renders as `hexc` on a face with normal n (undo the toon shading)."""
    f = shade_factor(n, shade)
    r, g, b = T.hex_rgb(hexc)
    return rgb_hex(*[lin_to_srgb(T.srgb_to_lin(c) / f) for c in (r, g, b)])


def tint(hexc, k):
    """Multiply a colour's brightness by k (in sRGB space, clamped)."""
    r, g, b = T.hex_rgb(hexc)
    return rgb_hex(r * k, g * k, b * k)


def mix(h1, h2, t):
    a, b = T.hex_rgb(h1), T.hex_rgb(h2)
    return rgb_hex(*[x + (y - x) * t for x, y in zip(a, b)])


# --------------------------------------------------------------- materials --
_MATS = {}


def reset():
    T.reset_scene()
    for m in list(bpy.data.materials):
        if m.users == 0:
            bpy.data.materials.remove(m)
    for f in list(bpy.data.fonts):
        if f.users == 0:
            bpy.data.fonts.remove(f)
    _MATS.clear()


def mat(hexc, n=None, shade=T.SHADE):
    """Toon material. If n is given, the colour is compensated so that a face with
    normal n renders exactly as hexc (use the colour sampled from the reference)."""
    base = comp(hexc, n, shade) if n is not None else hexc
    key = (base, round(shade, 3))
    m = _MATS.get(key)
    if m is not None and m.name in bpy.data.materials:
        return m
    name = 'p_%s_%d' % (base.lstrip('#'), int(shade * 100))
    m = T.toon_material(name, base, shade)
    _MATS[key] = m
    return m


def setm(obj, m):
    T.set_material(obj, m)
    return obj


def paint(obj, default, top=None, front=None, side=None, back=None, bottom=None, left=None, right=None,
          top_thresh=0.6):
    """Assign materials per face by normal direction (world space)."""
    slots = []

    def idx(m):
        if m not in slots:
            slots.append(m)
        return slots.index(m)

    me = obj.data
    mw = obj.matrix_world.to_3x3()
    assign = []
    for p in me.polygons:
        n = (mw @ p.normal).normalized()
        m = default
        if n.z > top_thresh:
            m = top or default
        elif n.z < -top_thresh:
            m = bottom or default
        elif n.y < -0.5:
            m = front or default
        elif n.y > 0.5:
            m = back or default
        else:
            if n.x > 0:
                m = right or side or default
            else:
                m = left or side or default
        assign.append(idx(m))
    me.materials.clear()
    for m in slots:
        me.materials.append(m)
    for p, i in zip(me.polygons, assign):
        p.material_index = i
    return obj


# ------------------------------------------------------------------ meshes --
def bm_obj(name, bm, recalc=True):
    if recalc:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return T.bm_to_obj(name, bm)


def boxmm(name, x0, x1, y0, y1, z0, z1, m=None):
    o = T.box(name, (x1 - x0, y1 - y0, z1 - z0), ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    if m:
        setm(o, m)
    return o


def box(name, size, loc, m=None, rot=None):
    o = T.box(name, size, (0, 0, 0))
    if rot:
        o.rotation_euler = Euler(rot)
    o.location = loc
    T.apply_transforms(o)
    if m:
        setm(o, m)
    return o


def prism(name, pts, y0=0.0, y1=0.1, m=None):
    """Polygon pts [(x,z),...] in the XZ plane, extruded from y0 (front) to y1 (back)."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, y0, z)) for x, z in pts]
    f = bm.faces.new(vs)
    bm.normal_update()
    if f.normal.y > 0:
        f.normal_flip()
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    nv = [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]
    for v in nv:
        v.co.y = y1
    o = bm_obj(name, bm)
    if m:
        setm(o, m)
    return o


def slab(name, pts, z0=0.0, z1=0.1, m=None):
    """Polygon pts [(x,y),...] in the XY plane, extruded from z0 to z1."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, z0)) for x, y in pts]
    f = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]:
        v.co.z = z1
    o = bm_obj(name, bm)
    if m:
        setm(o, m)
    return o


def plane_poly(name, pts3, m=None):
    """Single (possibly concave) polygon from 3D points; normal follows the point order (CCW = front)."""
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in pts3]
    bm.faces.new(vs)
    o = bm_obj(name, bm, recalc=False)
    if m:
        setm(o, m)
    return o


def solid_poly(name, pts3, thickness, normal, m=None):
    """3D polygon (planar) extruded by thickness along -normal (so the given side stays the surface)."""
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in pts3]
    f = bm.faces.new(vs)
    bm.normal_update()
    n = Vector(normal).normalized()
    if f.normal.dot(n) < 0:
        f.normal_flip()
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]:
        v.co -= n * thickness
    o = bm_obj(name, bm)
    if m:
        setm(o, m)
    return o


def rrect(w, h, r, segs=4, cx=0.0, cz=0.0):
    """Rounded rectangle outline (CCW) as [(x,z)]."""
    pts = []
    r = min(r, w / 2, h / 2)
    for (ox, oz, a0) in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180),
                         (w / 2 - r, -h / 2 + r, 270)):
        for i in range(segs + 1):
            a = math.radians(a0 + 90 * i / segs)
            pts.append((cx + ox + r * math.cos(a), cz + oz + r * math.sin(a)))
    return pts


def arch(w, h, r, t, segs=5, cx=0.0):
    """Inverted-U band (bed head/foot boards, hoops) as a polygon [(x,z)] standing on z=0."""
    def path(ww, hh, rr):
        pts = [(-ww / 2, 0.0)]
        for i in range(segs + 1):
            a = math.radians(180 - 90 * i / segs)
            pts.append((-ww / 2 + rr + rr * math.cos(a), hh - rr + rr * math.sin(a)))
        for i in range(segs + 1):
            a = math.radians(90 - 90 * i / segs)
            pts.append((ww / 2 - rr + rr * math.cos(a), hh - rr + rr * math.sin(a)))
        pts.append((ww / 2, 0.0))
        return pts
    outer = path(w, h, r)
    inner = path(w - 2 * t, h - t, max(0.01, r - t))
    return [(x + cx, z) for x, z in outer + inner[::-1]]


def spiral(rx, rz, turns=2.2, width=0.12, n=60, cx=0.0, cz=0.0, a0=0.0):
    """Spiral line (tree rings) as a closed band polygon [(x,z)]; radii are fractions of rx/rz."""
    outer, inner = [], []
    for i in range(n + 1):
        t = i / n
        a = a0 + t * turns * math.tau
        r = 0.12 + 0.70 * t
        w = width * (0.5 + 0.5 * t)
        for lst, rr in ((outer, r + w / 2), (inner, max(0.02, r - w / 2))):
            lst.append((cx + rx * rr * math.cos(a), cz + rz * rr * math.sin(a)))
    return outer + inner[::-1]


def ellipse(rx, rz, n=16, cx=0.0, cz=0.0, a0=0.0):
    return [(cx + rx * math.cos(a0 + i / n * math.tau), cz + rz * math.sin(a0 + i / n * math.tau)) for i in range(n)]


def cyl(name, r, depth, segs=10, loc=(0, 0, 0), axis='Z', r2=None, m=None, rz=None):
    """Cylinder/cone from loc along +axis. rz: ellipse radius in the other direction (scales one axis)."""
    r2 = r if r2 is None else r2
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r2, depth=depth)
    for v in bm.verts:
        v.co.z += depth / 2
        if rz is not None:
            v.co.y *= rz / r
    if axis == 'Y':
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Euler((-math.pi / 2, 0, 0)).to_matrix())
    elif axis == 'X':
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Euler((0, math.pi / 2, 0)).to_matrix())
    elif axis == '-Y':
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Euler((math.pi / 2, 0, 0)).to_matrix())
    for v in bm.verts:
        v.co += Vector(loc)
    o = bm_obj(name, bm)
    if m:
        setm(o, m)
    return o


def beam(name, p0, p1, w, d, m=None, up=(0, 1, 0)):
    """Box of section w (x-ish) by d from p0 to p1 (local z along the beam, local y kept near `up`)."""
    p0, p1 = Vector(p0), Vector(p1)
    L = (p1 - p0).length
    zax = (p1 - p0).normalized()
    yax = Vector(up) - zax * Vector(up).dot(zax)
    if yax.length < 1e-4:
        yax = Vector((1, 0, 0)) - zax * zax.x
    yax.normalize()
    xax = yax.cross(zax)
    o = T.box(name, (w, d, L), (0, 0, L / 2))
    R = Matrix((xax, yax, zax)).transposed().to_4x4()
    o.matrix_world = Matrix.Translation(p0) @ R
    T.apply_transforms(o)
    if m:
        setm(o, m)
    return o


def tube(name, p0, p1, r, segs=8, m=None, r1=None):
    o = T.limb(name, p0, p1, r, r1 if r1 is not None else r, segs)
    T.apply_transforms(o)
    if m:
        setm(o, m)
    return o


def rock(name, size, seed=0, subdiv=1, jag=0.25, flat_bottom=0.0, loc=(0, 0, 0), m=None, squash_top=0.0):
    """Faceted rock: jittered icosphere scaled to size (x,y,z full extents), bottom cut at z=0."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    for v in bm.verts:
        d = v.co.normalized()
        v.co = d * (1 + (rnd.random() - 0.5) * jag)
    # scale to size, sit on ground
    sx, sy, sz = size[0] / 2, size[1] / 2, size[2]
    for v in bm.verts:
        z = v.co.z
        v.co.x *= sx
        v.co.y *= sy
        v.co.z = (z + 1 - flat_bottom) / (2 - flat_bottom) * sz
        if squash_top and v.co.z > sz * 0.7:
            v.co.z = sz * 0.7 + (v.co.z - sz * 0.7) * (1 - squash_top)
    for v in bm.verts:
        if v.co.z < 0:
            v.co.z = 0
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.005)
    # drop degenerate faces at the bottom
    for v in bm.verts:
        v.co += Vector(loc)
    o = bm_obj(name, bm)
    if m:
        setm(o, m)
    return o


def join(objs, name):
    objs = [o for o in objs if o is not None]
    if len(objs) == 1:
        objs[0].name = name
        return objs[0]
    return T.join(objs, name)


def xform(o, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    o.location = loc
    o.rotation_euler = Euler(rot)
    o.scale = scale
    T.apply_transforms(o)
    return o


def rotate_objs(objs, rz, pivot=(0, 0, 0)):
    """Rotate objects about the vertical axis through pivot (radians), baking transforms."""
    R = Matrix.Rotation(rz, 4, 'Z')
    P = Matrix.Translation(Vector(pivot))
    for o in objs:
        o.matrix_world = P @ R @ P.inverted() @ o.matrix_world
        T.apply_transforms(o)
    return objs


def duplicate(o, name=None):
    c = o.copy()
    c.data = o.data.copy()
    c.name = name or (o.name + '.dup')
    bpy.context.scene.collection.objects.link(c)
    return c


def loft(name, rings, close_top=True, close_bottom=True):
    """rings: list of lists of 3D points (same count, CCW seen from +z). Builds a closed tube."""
    bm = bmesh.new()
    vr = [[bm.verts.new(p) for p in ring] for ring in rings]
    n = len(rings[0])
    for a, b in zip(vr, vr[1:]):
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    if close_bottom:
        bm.faces.new(vr[0][::-1])
    if close_top:
        bm.faces.new(vr[-1])
    return bm_obj(name, bm)


def catmull(pts, sub=4):
    """Catmull-Rom subdivision of a polyline (list of Vectors)."""
    if len(pts) < 3:
        return pts
    out = []
    P_ = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    for i in range(1, len(P_) - 2):
        p0, p1, p2, p3 = P_[i - 1], P_[i], P_[i + 1], P_[i + 2]
        for k in range(sub):
            t = k / sub
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
                              (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t))
    out.append(pts[-1])
    return out


def ground_root(name, path, r0, r1=0.02, h_ratio=0.55, segs=6, m=None):
    """Half-tube lying on the ground along a polyline path [(x,y)], tapering r0 -> r1."""
    pts = catmull([Vector((p[0], p[1], 0)) for p in path], 4)
    rings = []
    L = sum((b - a).length for a, b in zip(pts, pts[1:]))
    acc = 0.0
    for i, p in enumerate(pts):
        if i > 0:
            acc += (p - pts[i - 1]).length
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        side = Vector((-d.y, d.x, 0))
        r = r0 + (r1 - r0) * (acc / L)
        ring = []
        for k in range(segs + 1):
            a = math.pi * k / segs
            ring.append(p + side * (math.cos(a) * r) + Vector((0, 0, math.sin(a) * r * h_ratio)))
        rings.append(ring)
    bm = bmesh.new()
    vr = [[bm.verts.new(q) for q in ring] for ring in rings]
    for a, b in zip(vr, vr[1:]):
        for k in range(segs):
            bm.faces.new((a[k], a[k + 1], b[k + 1], b[k]))
    bm.faces.new(vr[0])
    bm.faces.new(vr[-1][::-1])
    o = bm_obj(name, bm)
    if m:
        setm(o, m)
    return o


# -------------------------------------------------------------------- text --
def text_mesh(name, text, size=0.3, depth=0.02, align='CENTER', valign='CENTER', bold=0.0, res=5,
              font=FONT_PATH, stretch_z=1.0, loc=(0, 0, 0), m=None, spacing=1.0):
    """Text as a mesh standing upright in the XZ plane facing -Y (front at y=loc.y-depth)."""
    fnt = bpy.data.fonts.load(font, check_existing=True)
    cu = bpy.data.curves.new(name + '_c', 'FONT')
    cu.body = text
    cu.font = fnt
    cu.size = size
    cu.extrude = depth / 2
    cu.offset = bold
    cu.resolution_u = res
    cu.align_x = align
    cu.align_y = valign
    cu.space_character = spacing
    ob = bpy.data.objects.new(name + '_t', cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.curves.remove(cu)
    o = T.new_obj(name, me)
    T.flat(o)
    # stand up: local +Z (text normal) -> -Y, local +Y (text up) -> +Z
    o.rotation_euler = Euler((math.pi / 2, 0, 0))
    o.scale = (1, stretch_z, 1)     # local y becomes world z after the rotation
    o.location = (loc[0], loc[1] - depth / 2, loc[2])
    T.apply_transforms(o)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.0005)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(o.data)
    bm.free()
    T.flat(o)
    if m:
        setm(o, m)
    return o


def bounds(objs):
    pts = T.world_verts(objs)
    xs, ys, zs = [p.x for p in pts], [p.y for p in pts], [p.z for p in pts]
    return (min(xs), max(xs)), (min(ys), max(ys)), (min(zs), max(zs))


# ------------------------------------------------------------------ render --
def render(key, objs, meta=None, pad=4):
    objs = [o for o in objs if o is not None]
    path = os.path.join(OUT_DIR, key + '.png')
    info = T.render_prop(objs, path, pad=pad, meta=meta)
    print('RENDERED', key, info['w'], 'x', info['h'])
    return info


def run(builders, argv=None):
    """builders: {name: fn}; fn() -> list of (key, [objs], meta) to render."""
    argv = argv if argv is not None else (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    want = set(argv)
    done = []
    for name, fn in builders.items():
        if want and name not in want:
            continue
        reset()
        outs = fn()
        for key, objs, meta in outs:
            render(key, objs, meta)
            done.append(key)
    print('DONE', ' '.join(done))
    return done


# ------------------------------------------------------------- gable moss --
def smooth_noise(rnd, n_terms=3, amp=1.0):
    terms = [(rnd.uniform(0.6, 2.8) * (i + 1), rnd.uniform(0, math.tau), amp / (i + 1)) for i in range(n_terms)]
    return lambda u: sum(a * math.sin(f * u * math.tau / 2 + ph) for f, ph, a in terms)


def _interp(tab, u):
    for (u0, v0), (u1, v1) in zip(tab, tab[1:]):
        if u0 <= u <= u1:
            f = (u - u0) / (u1 - u0) if u1 > u0 else 0
            f = 0.5 - 0.5 * math.cos(f * math.pi)
            return v0 + (v1 - v0) * f
    return tab[-1][1]


def gable_moss(ridge, k, rh, y0, y1, prof, inset, moss_hex, edge_hex, seed=1, thick=0.12, lift=0.10, droop=1.0,
               blades=0, blade_hex='#4aa747', blade_h=(0.14, 0.26)):
    """Moss blanket on a symmetric gable roof (ridge along y at x=0, top surface z = ridge - |x|*k,
    half width rh, from y0 (front) to y1). prof/inset: {-1: [(u, v)], 1: [...]} front recession (m,
    negative = overhang that droops) and eave inset (fraction of rh) along u in 0..1."""
    rnd = random.Random(seed)
    objs = []
    nl = math.sqrt(1 + k * k)
    for sx in (-1, 1):
        nf, ne, nb = smooth_noise(rnd, 3, 0.02), smooth_noise(rnd, 3, 0.015), smooth_noise(rnd, 3, 0.03)
        pts2 = []
        N = 36
        for i in range(N + 1):
            u = i / N
            pts2.append((-0.03 + u * 1.03 if i < N else 1.0 - _interp(inset[sx], 0), y0 + _interp(prof[sx], u) + nf(u)))
        Mn = 20
        for i in range(1, Mn):
            v = i / Mn
            pts2.append((1.0 - _interp(inset[sx], v) - ne(v) * 0.5, y0 + (y1 - y0) * v))
        for i in range(N + 1):
            u = 1 - i / N
            pts2.append((-0.03 + u * 1.03, y1 - max(0.0, nb(u)) - 0.01))
        pts3 = []
        for s_, t in pts2:
            x = sx * s_ * rh
            z = ridge - abs(x) * k if s_ >= 0 else ridge + abs(x) * k
            pts3.append(Vector((x, t, z + 0.01)))
        if sx < 0:
            pts3 = pts3[::-1]
        n = Vector((sx * k, 0, 1)) / nl
        moss = solid_poly('Moss', [tuple(p) for p in pts3], thick, n)
        for v in moss.data.vertices:
            v.co += n * lift
            if v.co.y < y0:
                v.co.z -= (y0 - v.co.y) * droop
        paint(moss, mat(edge_hex, FRONT), top=mat(moss_hex, (-sx * 0 - 0.69, 0, 0.72)), top_thresh=0.45)
        objs.append(moss)
        for i in range(blades):
            s_ = rnd.uniform(0.15, 0.85)
            t = rnd.uniform(y0 + 0.35, y1 - 0.15)
            x = sx * s_ * rh
            base = Vector((x, t, ridge - abs(x) * k + lift + 0.05))
            h = rnd.uniform(*blade_h)
            tip = base + Vector((rnd.uniform(-0.04, 0.04), 0, h))
            bl = tube('Blade', base, tip, 0.024, 3, mat(blade_hex, FRONT), 0.0)
            objs.append(bl)
    return objs
