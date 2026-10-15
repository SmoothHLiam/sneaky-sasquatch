"""
Tutorial-area props: the sasquatch's cabin (+ roof / interior layers), bed,
wood stove, the Raccoon Shop tree, the "Campsites" signboard and the yellow
swing gate.

  Blender -b --factory-startup -P art/blender/props_tutorial.py -- [group ...]
Groups: cabin bed stove shop_tree wood_sign gate
"""
import bpy, bmesh, math, random, os, sys
from mathutils import Vector, Euler, Matrix

ART = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else \
    '/Users/liamliam/Documents/sneaky sasquatch/sneaky-sasquatch/art/blender'
if ART not in sys.path:
    sys.path.append(ART)
import importlib
import lib_toon as T
import props_lib as P
importlib.reload(T); importlib.reload(P)

FRONT, TOP = P.FRONT, P.TOP


# ============================================================== cabin =======
# measured on t030.0 (1 still px == 1 sprite px at 200 ppm)
CAB = dict(
    W=3.27, D=2.8,             # wall footprint (outer)
    post=0.22,                 # corner post section
    wall_h=3.0,                # top of the front-wall planks
    ridge=4.95, roof_hw=1.96,  # roof top at the ridge / half width incl. overhang
    roof_t=0.28,               # roof slab thickness (vertical)
    ov_f=0.25, ov_b=0.25,      # roof overhang front / back
    cut=0.32,                  # wall height in the cut-away interior view
)
CC = dict(
    plank='#906339', plank2='#8a5f34', plank3='#966a3d', seam='#765131', gap='#47321f', lip='#a8763f',
    beam='#71532d', verge='#614425', roofTop='#7c5632', fascia='#5a3e22',
    moss='#338539', mossEdge='#2c7233', mossBlade='#4aa747',
    door='#b07e37', door2='#a07032', doorFrame='#5e4426', lintel='#73512f', handle='#454128',
    glass='#91ab91', winFrame='#5e4527', winBoard='#71532d',
    # interior (t208.0)
    floor='#96693f', floor2='#8e613a', iwall='#87613a', iwall2='#90643d', igap='#402d1c',
    rim='#654d2b', cutTop='#ae7b47', cutFront='#7b5733',
    picFrame='#5b4f44', sky='#5ba7c1', mtn='#606669', snow='#dddcdd',
)


def roof_z(x, under=False):
    """Roof top (or underside) height at |x|."""
    c = CAB
    k = 0.975                                   # tan(44 deg)
    z = c['ridge'] - abs(x) * k
    return z - c['roof_t'] if under else z


def smooth_noise(rnd, n_terms=4, amp=1.0):
    terms = [(rnd.uniform(0.6, 2.8) * (i + 1), rnd.uniform(0, math.tau), amp / (i + 1)) for i in range(n_terms)]
    return lambda u: sum(a * math.sin(f * u * math.tau / 2 + ph) for f, ph, a in terms)


def plank_rows(name, x0, x1, z0, z1, yfront, rnd, row_h=0.22, seam=0.025, depth=0.04, tilt=0.8,
               colors=None, clip=None):
    """Horizontal planks covering [x0,x1]x[z0,z1] with their front at yfront.
    clip(z) -> half width limit (for gables)."""
    colors = colors or [CC['plank']] * 4 + [CC['plank2'], CC['plank3']]
    objs = []
    z = z0
    i = 0
    while z < z1 - 0.02:
        za, zb = z + seam / 2, min(z + row_h - seam / 2, z1)
        col = rnd.choice(colors)
        a = math.radians(rnd.uniform(-tilt, tilt)) if not clip else 0.0
        if clip:
            ha, hb = clip(za), clip(zb)
            if hb <= 0.02:
                break
            pts = [(-ha, za), (ha, za), (hb, zb), (-hb, zb)]
        else:
            pts = [(x0, za), (x1, za), (x1, zb), (x0, zb)]
        cx = (x0 + x1) / 2
        cz = (za + zb) / 2
        pts = [(cx + (px - cx) * math.cos(a) - (pz - cz) * math.sin(a),
                cz + (px - cx) * math.sin(a) + (pz - cz) * math.cos(a)) for px, pz in pts]
        yo = yfront - rnd.uniform(0, 0.006)
        o = P.prism('%s%d' % (name, i), pts, yo, yo + depth)
        P.paint(o, P.mat(col, FRONT), top=P.mat(P.tint(col, 1.08), TOP))
        objs.append(o)
        z += row_h
        i += 1
    return objs


def wedge(name, x0, x1, z, h0, h1, y, col, n=FRONT):
    """Thin dark sliver (crack / missing board) in front of the planks."""
    pts = [(x0, z - h0 / 2), (x1, z - h1 / 2), (x1, z + h1 / 2), (x0, z + h0 / 2)]
    return P.prism(name, pts, y - 0.004, y + 0.002, P.mat(col, n))


def build_cabin_parts(seed=3):
    c, C = CAB, CC
    rnd = random.Random(seed)
    hw, hd = c['W'] / 2, c['D'] / 2
    yf = -hd                       # front wall plane
    ps = c['post']
    M = lambda h, n=FRONT: P.mat(h, n)
    parts = dict(walls=[], roof=[], interior=[], ifront=[], door_open=[])
    W_ = parts['walls']

    # ---- wall shell (sides/back are edge-on / hidden, but keep silhouettes honest)
    shell = P.boxmm('Shell', -hw + 0.02, hw - 0.02, yf + 0.03, hd - 0.02, 0, c['wall_h'])
    P.paint(shell, M(C['seam']), top=M(C['beam'], TOP))
    W_.append(shell)
    # ---- front wall planks between the posts (sill at the bottom)
    W_ += plank_rows('Plank', -hw + ps - 0.02, hw - ps + 0.02, 0.40, c['wall_h'], yf, rnd)
    sill = P.boxmm('Sill', -hw + ps - 0.01, hw - ps + 0.01, yf - 0.012, yf + 0.15, 0, 0.40)
    P.paint(sill, M(C['beam']), top=M(P.tint(C['beam'], 1.1), TOP))
    W_.append(sill)
    for sx in (-1, 1):
        x0, x1 = (-hw, -hw + ps) if sx < 0 else (hw - ps, hw)
        post = P.boxmm('Post', x0, x1, yf - 0.03, yf + ps - 0.03, 0, roof_z(hw, under=True) + 0.05)
        P.paint(post, M(C['beam']), top=M(P.tint(C['beam'], 1.15), TOP))
        W_.append(post)
    # ---- tie beam + gable
    tie_z0, tie_z1 = c['wall_h'], c['wall_h'] + 0.4
    tie = P.boxmm('Tie', -hw + 0.1, hw - 0.1, yf - 0.02, yf + 0.12, tie_z0, tie_z1)
    P.paint(tie, M(C['beam']), top=M(P.tint(C['beam'], 1.1), TOP))
    W_.append(tie)
    under = lambda z: (c['ridge'] - c['roof_t'] - z) / 0.975
    gable_back = P.prism('GableBack', [(-under(tie_z1), tie_z1), (under(tie_z1), tie_z1), (0, c['ridge'] - c['roof_t'])],
                         yf + 0.03, yf + 0.2, M(C['seam']))
    W_.append(gable_back)
    W_ += plank_rows('GPlank', 0, 0, tie_z1, c['ridge'] - c['roof_t'], yf, rnd, clip=under)

    # ---- window (boarded up)
    wx0, wx1, wz0, wz1 = -1.11, -0.285, 0.65, 2.23
    fr = 0.085
    yw = yf - 0.035
    glass = P.boxmm('Glass', wx0 + fr, wx1 - fr, yf - 0.012, yf + 0.01, wz0 + fr, wz1 - fr, M(C['glass']))
    W_.append(glass)
    for (x0, x1, z0, z1) in ((wx0, wx1, wz1 - fr - 0.04, wz1 + 0.02), (wx0, wx1, wz0, wz0 + fr),
                             (wx0, wx0 + fr, wz0, wz1), (wx1 - fr, wx1, wz0, wz1),
                             ((wx0 + wx1) / 2 - 0.03, (wx0 + wx1) / 2 + 0.03, wz0, wz1),
                             (wx0, wx1, (wz0 + wz1) / 2 - 0.03, (wz0 + wz1) / 2 + 0.03)):
        f = P.boxmm('WinFrame', x0, x1, yw, yf + 0.01, z0, z1)
        P.paint(f, M(C['winFrame']), top=M(P.tint(C['winFrame'], 1.15), TOP))
        W_.append(f)
    for i, (cz, ang, ln, wd, dx) in enumerate(((1.86, 4, 1.10, 0.30, 0.0), (1.44, -7, 1.02, 0.25, 0.03),
                                                (1.02, 3, 1.08, 0.30, -0.02))):
        b = P.box('WinBoard%d' % i, (ln, 0.05, wd), ((wx0 + wx1) / 2 + dx, yw - 0.035, cz), rot=(0, math.radians(-ang), 0))
        P.paint(b, M(C['winBoard']), top=M(P.tint(C['winBoard'], 1.2), TOP))
        W_.append(b)
        # nails
        for nx in (-ln / 2 + 0.08, ln / 2 - 0.08):
            a = math.radians(ang)
            W_.append(P.boxmm('Nail', (wx0 + wx1) / 2 + dx + nx * math.cos(a) - 0.015, (wx0 + wx1) / 2 + dx + nx * math.cos(a) + 0.015,
                              yw - 0.075, yw - 0.055, cz + nx * math.sin(a) - 0.02, cz + nx * math.sin(a) + 0.02,
                              M('#3a2c1e')))

    # ---- door
    dx0, dx1, dz1 = 0.085, 0.985, 2.02
    yd = yf - 0.03
    for i in range(4):
        x0 = dx0 + (dx1 - dx0) * i / 4
        x1 = dx0 + (dx1 - dx0) * (i + 1) / 4
        leaf = P.boxmm('DoorPlank%d' % i, x0, x1, yd, yf + 0.02, 0, dz1, M(C['door'] if i % 2 == 0 else C['door2']))
        W_.append(leaf)
    for (x0, x1) in ((dx0 - 0.125, dx0), (dx1, dx1 + 0.125)):
        j = P.boxmm('Jamb', x0, x1, yf - 0.06, yf + 0.02, 0, dz1 + 0.02)
        P.paint(j, M(C['doorFrame']), top=M(P.tint(C['doorFrame'], 1.15), TOP))
        W_.append(j)
    lin = P.boxmm('Lintel', dx0 - 0.16, dx1 + 0.16, yf - 0.075, yf + 0.02, dz1, dz1 + 0.25)
    P.paint(lin, M(C['lintel']), top=M(P.tint(C['lintel'], 1.15), TOP))
    W_.append(lin)
    W_.append(P.boxmm('Handle', 0.895, 0.935, yd - 0.05, yd, 0.74, 1.22, M(C['handle'])))

    # ---- damage: missing boards / cracks
    W_.append(wedge('Hole1', -1.42, -0.80, 2.62, 0.20, 0.13, yf - 0.006, C['gap']))
    W_.append(wedge('Hole1lip', -1.42, -0.80, 2.50, 0.035, 0.03, yf - 0.008, C['lip']))
    W_.append(wedge('Hole2', 1.27, 1.42, 1.11, 0.27, 0.27, yf - 0.006, C['gap']))
    W_.append(wedge('Hole2lip', 1.27, 1.42, 0.98, 0.03, 0.03, yf - 0.008, C['lip']))
    for i, (x0, x1, z, h0, h1) in enumerate(((-1.4, -0.75, 1.88, 0.0, 0.05), (0.45, 1.40, 2.85, 0.05, 0.0),
                                             (-1.40, -0.35, 0.36 + 0.4, 0.0, 0.04), (1.12, 1.42, 2.30, 0.04, 0.0),
                                             (-0.4, 0.45, 3.68, 0.0, 0.045), (-0.9, -0.2, 3.95, 0.035, 0.0))):
        W_.append(wedge('Crack%d' % i, x0, x1, z, h0, h1, yf - 0.007, C['gap']))

    # ---- roof slabs (front face = verge board, top = boards under the moss)
    R_ = parts['roof']
    y0r, y1r = yf - c['ov_f'], hd + c['ov_b']
    rh = c['roof_hw']
    for sx in (-1, 1):
        pts = [(0, c['ridge']), (sx * rh, roof_z(rh)), (sx * rh, roof_z(rh, True)), (0, c['ridge'] - c['roof_t'])]
        if sx > 0:
            pts = pts[::-1]
        s = P.prism('RoofSlab', pts, y0r, y1r)
        P.paint(s, M(C['fascia'], (sx, 0, 0)), front=M(C['verge']), top=M(C['roofTop'], (sx * 0.69, 0, 0.72)),
                side=M(C['fascia'], (sx, 0, 0)))
        R_.append(s)
    # ---- moss blanket with ragged edges (front recession profile measured on t030.0)
    rnd_m = random.Random(seed + 10)
    k = 0.975
    nrm_len = math.sqrt(1 + k * k)
    PROF = {-1: [(0, .30), (.25, .30), (.30, .22), (.35, -.03), (.45, -.06), (.6, -.04), (.70, -.06), (.78, .06),
                 (.86, .08), (.92, -.02), (1.0, -.04)],
            1: [(0, .22), (.12, .30), (.2, .45), (.35, .52), (.46, .42), (.53, .0), (.62, -.04), (.75, -.02),
                (.85, .02), (.95, -.03), (1.0, -.05)]}
    INSET = {-1: [(0, -.02), (.5, -.01), (.55, .17), (.64, .17), (.68, -.01), (1.0, 0.0)],
             1: [(0, -.02), (.14, .0), (.22, .11), (.5, .12), (.8, .10), (1.0, .08)]}

    def interp(tab, u):
        for (u0, v0), (u1, v1) in zip(tab, tab[1:]):
            if u0 <= u <= u1:
                f = (u - u0) / (u1 - u0) if u1 > u0 else 0
                f = 0.5 - 0.5 * math.cos(f * math.pi)
                return v0 + (v1 - v0) * f
        return tab[-1][1]

    for sx in (-1, 1):
        nf = smooth_noise(rnd_m, 3, 0.025)
        ne = smooth_noise(rnd_m, 3, 0.02)
        nb = smooth_noise(rnd_m, 3, 0.04)
        pts2 = []          # (s, t) with s = |x|/rh, t = y
        N = 40
        for i in range(N + 1):                      # front edge, ridge -> eave
            u = i / N
            rec = interp(PROF[sx], u) + nf(u)
            pts2.append((-0.03 + u * 1.03 if i < N else 1.0 - interp(INSET[sx], 0) , y0r + rec))
        M_ = 24
        for i in range(1, M_):                      # eave edge, front -> back
            v = i / M_
            pts2.append((1.0 - interp(INSET[sx], v) - ne(v) * 0.5, y0r + (y1r - y0r) * v))
        for i in range(N + 1):                      # back edge, eave -> ridge
            u = 1 - i / N
            pts2.append((-0.03 + u * 1.03, y1r - max(0.0, nb(u)) - 0.01))
        pts3 = []
        for s_, t in pts2:
            x = sx * s_ * rh
            pts3.append(Vector((x, t, roof_z(x) + 0.012 if s_ >= 0 else c['ridge'] + 0.012 + abs(x) * k)))
        if sx < 0:
            pts3 = pts3[::-1]
        n = Vector((sx * k, 0, 1)) / nrm_len
        moss = P.solid_poly('Moss', [tuple(p) for p in pts3], 0.15, n)
        for v in moss.data.vertices:
            v.co += n * 0.13
            if v.co.y < y0r:                 # overhang droops over the verge
                v.co.z -= (y0r - v.co.y) * 1.0
        P.paint(moss, P.mat(C['mossEdge'], FRONT), top=P.mat(C['moss'], (-0.69, 0, 0.72)), top_thresh=0.55)
        R_.append(moss)
        # grass blades on the moss
        for i in range(16):
            s_ = rnd_m.uniform(0.12, 0.9)
            t = rnd_m.uniform(y0r + 0.5, y1r - 0.2)
            x = sx * s_ * rh
            base = Vector((x, t, roof_z(x) + 0.2))
            for j in range(rnd_m.randint(1, 3)):
                h = rnd_m.uniform(0.16, 0.32)
                tip = base + Vector((rnd_m.uniform(-0.06, 0.06) + j * 0.04, rnd_m.uniform(-0.03, 0.03), h))
                bl = P.tube('Blade', base + Vector((j * 0.05, 0, -0.05)), tip, 0.028, segs=3, r1=0.0)
                P.setm(bl, P.mat(C['mossBlade'], FRONT))
                R_.append(bl)

    # ================= interior (roof off): floor, back wall, cut side walls
    I_ = parts['interior']
    ib = hd - 0.25                                # inner face of the back wall
    fl = P.boxmm('Floor', -hw, hw, yf, hd, 0, 0.04, M(P.tint(C['floor'], 0.86), TOP))
    I_.append(fl)
    nb_ = 7
    for i in range(nb_):
        x0 = -hw + ps + (2 * hw - 2 * ps) * i / nb_
        x1 = -hw + ps + (2 * hw - 2 * ps) * (i + 1) / nb_
        b = P.boxmm('FloorBoard%d' % i, x0 + 0.006, x1 - 0.006, yf + 0.2, ib, 0.04, 0.05,
                    M(C['floor'] if i % 3 else C['floor2'], TOP))
        I_.append(b)
    bw = P.boxmm('BackWall', -hw, hw, ib, hd, 0, c['wall_h'])
    P.paint(bw, M(C['igap']), top=M(C['rim'], TOP))
    I_.append(bw)
    ip = plank_rows('IPlank', -hw + ps, hw - ps, 0.05, c['wall_h'] - 0.05, ib - 0.04, random.Random(seed + 5),
                    row_h=0.25, seam=0.03, colors=[C['iwall'], C['iwall2'], C['iwall2']], tilt=1.2)
    I_ += ip
    for i, (x0, x1, z, h0, h1) in enumerate(((-1.42, -0.85, 2.45, 0.16, 0.12), (-1.4, 0.2, 2.75, 0.05, 0.0),
                                             (-0.2, 1.42, 2.20, 0.0, 0.06), (-0.9, 0.1, 0.88, 0.04, 0.0),
                                             (0.6, 1.42, 1.70, 0.05, 0.02), (-1.42, -0.6, 1.62, 0.0, 0.045))):
        I_.append(wedge('ICrack%d' % i, x0, x1, z, h0, h1, ib - 0.046, C['igap']))
    for sx in (-1, 1):
        x0, x1 = (-hw, -hw + ps) if sx < 0 else (hw - ps, hw)
        cp = P.boxmm('BackPost', x0, x1, ib - 0.02, hd, 0, c['wall_h'] + 0.02)
        P.paint(cp, M(C['rim']), top=M(C['rim'], TOP))
        I_.append(cp)
        sw = P.boxmm('SideCut', x0, x1, yf + 0.25, ib - 0.02, 0, c['cut'])
        P.paint(sw, M(C['cutFront']), top=M(C['cutTop'], TOP))
        I_.append(sw)
    # picture on the back wall (tilted)
    pic = []
    pc = Vector((-0.05, ib - 0.07, 1.30))
    pw, ph_ = 0.90, 0.88
    pic.append(P.prism('PicFrame', P.rrect(pw, ph_, 0.01, 1), -0.03, 0.0, M(C['picFrame'])))
    pic.append(P.prism('PicSky', P.rrect(pw - 0.12, ph_ - 0.14, 0.0, 1), -0.04, -0.03, M(C['sky'])))
    mt = [(-0.38, -0.12), (-0.22, 0.12), (-0.12, 0.02), (0.02, 0.24), (0.16, 0.04), (0.25, 0.14), (0.38, -0.08), (0.38, -0.2), (-0.38, -0.2)]
    pic.append(P.prism('PicMtn', mt, -0.05, -0.04, M(C['mtn'])))
    for (cx, cz, w_) in ((-0.22, 0.12, 0.07), (0.02, 0.24, 0.09), (0.25, 0.14, 0.07)):
        pic.append(P.prism('PicSnow', [(cx - w_, cz - w_ * 1.1), (cx, cz), (cx + w_, cz - w_ * 1.1)], -0.06, -0.05, M(C['snow'])))
    pic.append(P.prism('PicGround', [(-0.38, -0.36), (0.38, -0.36), (0.38, -0.2), (-0.38, -0.2)], -0.06, -0.05, M(C['snow'])))
    for o in pic:
        P.xform(o, rot=(0, math.radians(-10), 0), scale=(1, 1, 1.3))
        o.location = pc
        T.apply_transforms(o)
    I_ += pic
    # ---- front wall cut low (separate layer so actors inside sort behind it)
    F_ = parts['ifront']
    for (x0, x1) in ((-hw, dx0 - 0.02), (dx1 + 0.02, hw)):
        fw = P.boxmm('FrontCut', x0, x1, yf, yf + 0.25, 0, c['cut'])
        P.paint(fw, M(C['cutFront']), top=M(C['cutTop'], TOP))
        F_.append(fw)
    F_.append(P.boxmm('Threshold', dx0 - 0.02, dx1 + 0.02, yf, yf + 0.25, 0, 0.06, M(C['cutTop'], TOP)))
    # ---- open door (hinged on the left jamb, swung ~20 deg into the room; interior lighting)
    D_ = parts['door_open']
    dw = dx1 - dx0
    for i in range(4):
        D_.append(P.boxmm('ODoor%d' % i, dw * i / 4, dw * (i + 1) / 4, 0, 0.05, 0.02, dz1 - 0.02,
                          M('#9f7237' if i % 2 == 0 else '#906433')))
    D_.append(P.boxmm('OHandle', dw - 0.10, dw - 0.06, -0.05, 0.0, 0.74, 1.22, M(C['handle'])))
    P.rotate_objs(D_, math.radians(20))
    for o in D_:
        o.location = (dx0, yf + 0.06, 0)
        T.apply_transforms(o)
    return parts


def build_cabin():
    parts = build_cabin_parts()
    walls, roof = parts['walls'], parts['roof']
    c = CAB
    fp = {'footprint': [c['W'], c['D']], 'blocksSight': True}
    return [
        ('cabin', walls + roof, fp),
        ('cabin_roof', roof, {'footprint': [c['W'], c['D']], 'layer': 'roof'}),
        ('cabin_interior', parts['interior'], {'footprint': [c['W'], c['D']], 'layer': 'interior'}),
        ('cabin_interior_front', parts['ifront'], {'footprint': [c['W'], 0.25], 'layer': 'interior_front',
                                                   'sortY': -c['D'] / 2}),
        ('cabin_door_open', parts['door_open'], {'layer': 'door', 'sortY': -c['D'] / 2 + 0.5}),
    ]


# ================================================================ bed ======
def build_bed():
    """Metal-frame single bed, long axis N-S (headboard at +y). t208.0."""
    W, L = 0.85, 1.50
    M = lambda h, n=FRONT: P.mat(h, n)
    frame, dark = '#4a4039', '#3d342d'
    objs = []
    t = 0.075
    for y, h in ((L / 2 - t, 0.80), (-L / 2, 0.72)):
        a = P.prism('Board', P.arch(W, h, 0.17, t, 5), y, y + t)
        P.paint(a, M(frame), top=M(P.tint(frame, 1.25), TOP))
        objs.append(a)
    # side rails
    for sx in (-1, 1):
        objs.append(P.boxmm('Rail', sx * W / 2 - (t if sx > 0 else 0), sx * W / 2 + (0 if sx > 0 else t),
                            -L / 2 + t, L / 2 - t, 0.20, 0.27, M(dark)))
    mat_w = W - 2 * t - 0.01
    matt = P.boxmm('Mattress', -mat_w / 2, mat_w / 2, -L / 2 + t + 0.01, L / 2 - t, 0.22, 0.46)
    P.paint(matt, M('#b6b6bb'), top=M('#dbdadf', TOP))
    objs.append(matt)
    pil = P.rock('Pillow', (0.56, 0.36, 0.14), seed=2, subdiv=2, jag=0.0, loc=(0, L / 2 - 0.30, 0.45))
    P.setm(pil, M('#c4c3c8', TOP))
    objs.append(pil)
    yb0, yb1 = -L / 2 + t - 0.02, -0.04
    blanket = P.boxmm('Blanket', -mat_w / 2 - 0.02, mat_w / 2 + 0.02, yb0, yb1, 0.40, 0.495)
    P.paint(blanket, M('#73d85f'), top=M('#76e160', TOP), side=M('#66c955', (1, 0, 0)))
    objs.append(blanket)
    fold = P.boxmm('Fold', -mat_w / 2 - 0.025, mat_w / 2 + 0.025, yb1 - 0.02, yb1 + 0.22, 0.40, 0.51)
    P.paint(fold, M('#53a948'), top=M('#5cb750', TOP))
    objs.append(fold)
    return [('bed', objs, {'footprint': [W, L], 'blocksSight': False})]


# ========================================================== wood stove ======
def build_stove():
    """Cabin wood stove: dark iron box on legs with a pipe rising to ~3 m. t208.0."""
    M = lambda h, n=FRONT: P.mat(h, n)
    body, pipe = '#5f5f55', '#383933'
    objs = []
    w, d, z0, z1 = 0.56, 0.56, 0.16, 0.95
    b = P.boxmm('Body', -w / 2, w / 2, -d / 2, d / 2, z0, z1)
    P.paint(b, M(body), top=M('#6c6c62', TOP), side=M('#56564d', (1, 0, 0)))
    objs.append(b)
    top = P.boxmm('Top', -w / 2 - 0.03, w / 2 + 0.03, -d / 2 - 0.03, d / 2 + 0.03, z1, z1 + 0.05)
    P.paint(top, M('#4a4a43'), top=M('#55554d', TOP))
    objs.append(top)
    door = P.boxmm('Door', -0.17, 0.17, -d / 2 - 0.02, -d / 2, 0.30, 0.66, M('#3e3e38'))
    objs.append(door)
    objs.append(P.boxmm('Knob', 0.10, 0.14, -d / 2 - 0.05, -d / 2 - 0.02, 0.46, 0.50, M('#8a8a80')))
    for sx in (-1, 1):
        for sy in (-1, 1):
            objs.append(P.boxmm('Leg', sx * (w / 2 - 0.02) - 0.03, sx * (w / 2 - 0.02) + 0.03,
                                sy * (d / 2 - 0.02) - 0.03, sy * (d / 2 - 0.02) + 0.03, 0, z0, M('#2e2e2a')))
    px, py, ph = -0.08, d / 2 - 0.15, 3.35
    pp = P.cyl('Pipe', 0.15, ph - z1, 14, (px, py, z1 + 0.05), m=M(pipe))
    objs.append(pp)
    rim = P.cyl('PipeRim', 0.16, 0.08, 14, (px, py, ph - 0.03))
    P.paint(rim, M('#3a3b35'), top=M('#4c4d46', TOP))
    objs.append(rim)
    hole = P.cyl('PipeHole', 0.105, 0.012, 14, (px, py, ph + 0.05), m=M('#1c1c19', TOP))
    objs.append(hole)
    return [('wood_stove', objs, {'footprint': [0.6, 0.6], 'blocksSight': False})]


# =========================================================== shop tree ======
SHOP = dict(trunk='#75582e', door='#4b3422', door2='#422f1e', knob='#af861d', glass='#969e8f',
            frame='#5e4527', mull='#4d3720', pipe='#4a4a4a', cap='#818181', beam='#5d4426',
            board='#93673a', ink='#412e1b', hook='#5b5b5b')


def raccoon_icon(name, cx, y, cz, scale, m_ink, m_board, stretch):
    """Raccoon face glyph (designed in screen units, stretched vertically by `stretch`)."""
    objs = []

    def poly(nm, pts, y0, y1, m):
        pts = [(cx + px * scale, cz + pz * scale * stretch) for px, pz in pts]
        objs.append(P.prism(nm, pts, y0, y1, m))
    for sx in (-1, 1):
        ear = [(sx * 0.40, 0.44), (sx * 0.14, 0.30), (sx * 0.34, 0.15), (sx * 0.39, 0.18)]
        if sx < 0:
            ear = ear[::-1]
        poly('Ear', ear, y - 0.01, y + 0.001, m_ink)
        # mask lobe: circle + tail towards the nose
        lobe = []
        for i in range(14):
            a = math.radians(-60 + 300 * i / 13) if sx > 0 else math.radians(240 - 300 * i / 13)
            lobe.append((sx * 0.23 + 0.2 * math.cos(a), -0.02 + 0.16 * math.sin(a)))
        lobe.append((sx * 0.07, -0.30))
        if sx < 0:
            lobe = lobe[::-1]
        poly('Lobe', lobe, y - 0.01, y + 0.001, m_ink)
        poly('Eye', P.ellipse(0.075, 0.065, 12, sx * 0.22, 0.02), y - 0.016, y - 0.005, m_board)
    poly('Nose', P.ellipse(0.10, 0.06, 12, 0, -0.17), y - 0.016, y - 0.005, m_ink)
    return objs


def build_shop_tree(seed=11):
    S = SHOP
    rnd = random.Random(seed)
    M = lambda h, n=FRONT, sh=T.SHADE: P.mat(h, n, sh)
    objs = []
    # ---- trunk: lofted 18-gon with a flared base and gentle irregularity
    segs = 18
    prof = [(0.0, 1.12), (0.12, 1.09), (0.3, 1.05), (0.6, 1.0), (1.2, 0.95), (2.0, 0.91), (3.5, 0.88), (6.0, 0.84),
            (9.0, 0.80), (12.0, 0.76)]
    jit = [rnd.uniform(-0.035, 0.035) for _ in range(segs)]
    rings = []
    for z, r in prof:
        ring = []
        for i in range(segs):
            a = -math.pi / 2 + (i + 0.5) / segs * math.tau      # a facet faces -Y
            rr = r * (1 + jit[i] + (0.025 if i % 2 else -0.015))
            if z < 1.0:   # flare to the sides (not the front, where the door is)
                rr *= 1 + 0.28 * abs(math.cos(a)) ** 2 * ((1.0 - z) / 1.0) ** 2
            ring.append((math.cos(a) * rr, math.sin(a) * rr, z))
        rings.append(ring)
    trunk = P.loft('Trunk', rings)
    P.paint(trunk, M(S['trunk'], FRONT, 0.12), top=M('#5a4022', TOP))
    objs.append(trunk)
    # ---- roots
    mroot = M(S['trunk'], TOP)
    for path, r0 in (([(-0.45, -0.55), (-0.95, -1.0), (-1.2, -1.55), (-1.55, -2.2), (-1.85, -2.7), (-2.25, -3.2)], 0.50),
                     ([(0.45, -0.6), (0.95, -0.95), (1.3, -1.3), (1.75, -1.65), (2.2, -1.9)], 0.45),
                     ([(-0.45, -0.05), (-1.2, -0.05), (-1.6, 0.12), (-2.05, 0.2)], 0.42),
                     ([(0.5, -0.15), (1.25, -0.2), (1.7, -0.05), (2.15, 0.05)], 0.40),
                     ([(0.5, 0.55), (1.0, 0.95), (1.45, 1.2)], 0.36)):
        objs.append(P.ground_root('Root', path, r0, 0.11, 0.42, 8, mroot))
    # ---- door (two dark planks in a dark recess) on the front facet
    yfr = -1.12 * math.cos(math.pi / segs) - 0.03
    objs.append(P.prism('DoorL', [(-0.345, 0), (-0.02, 0), (-0.02, 1.22), (-0.345, 1.18)], yfr - 0.05, yfr, M(S['door'])))
    objs.append(P.prism('DoorR', [(0.0, 0), (0.335, 0), (0.335, 1.20), (0.0, 1.24)], yfr - 0.045, yfr, M(S['door2'])))
    knob = P.cyl('Knob', 0.045, 0.04, 10, (0.25, yfr - 0.045, 0.53), axis='-Y', m=M(S['knob']))
    objs.append(knob)
    # ---- round window
    wz, wy = 2.80, -0.93 - 0.06
    rx, rz = 0.44, 0.57
    ring_o = P.ellipse(rx, rz, 24, 0, wz)
    ring_i = P.ellipse(rx - 0.08, rz - 0.09, 24, 0, wz)
    fr = P.prism('WinFrame', ring_o, wy - 0.06, wy + 0.25)
    P.paint(fr, M(S['frame']), top=M(P.tint(S['frame'], 1.2), TOP))
    objs.append(fr)
    objs.append(P.prism('WinGlass', ring_i, wy - 0.075, wy - 0.06, M(S['glass'])))
    objs.append(P.boxmm('MullV', -0.03, 0.03, wy - 0.10, wy - 0.07, wz - rz + 0.08, wz + rz - 0.08, M(S['mull'])))
    objs.append(P.boxmm('MullH', -rx + 0.06, rx - 0.06, wy - 0.10, wy - 0.07, wz - 0.03, wz + 0.03, M(S['mull'])))
    # ---- chimney stove-pipe out of the upper-left of the trunk
    mp = M(S['pipe'], FRONT, 0.15)
    pts = [Vector((-0.45, -0.45, 2.55)), Vector((-0.95, -0.62, 2.95)), Vector((-1.25, -0.66, 3.9)),
           Vector((-1.55, -0.66, 5.2)), Vector((-1.72, -0.64, 6.6))]
    for a, b in zip(pts, pts[1:]):
        objs.append(P.tube('Pipe', a, b, 0.19, 12, mp))
    for p in pts[1:-1]:
        j = T.ico('PipeJoint', 0.19, 2, loc=p)
        P.setm(j, mp)
        objs.append(j)
    cap = P.tube('PipeCap', pts[-1] + Vector((0, 0, -0.05)), pts[-1] + Vector((-0.02, 0, 0.30)), 0.30, 12, None, 0.05)
    P.setm(cap, M(S['cap'], TOP))
    objs.append(cap)
    # ---- hanging sign
    ys = -0.80
    st = 1 / P.COS
    beam = P.prism('Beam', [(0.45, 2.74), (2.48, 2.72), (2.50, 3.06), (1.65, 3.04), (1.52, 2.96), (1.40, 3.06), (0.45, 3.08)],
                   ys - 0.10, ys + 0.12)
    P.paint(beam, M(S['beam']), top=M('#8a6238', TOP))
    objs.append(beam)
    mb, mt = M(S['board']), M('#b48249', TOP)
    up = P.prism('BoardUp', [(1.08, 1.50), (2.24, 1.52), (2.36, 1.62), (2.35, 2.50), (2.26, 2.62), (1.10, 2.60), (1.08, 2.45)],
                 ys - 0.06, ys + 0.04)
    P.paint(up, mb, top=mt)
    lo = P.prism('BoardLo', [(1.05, 0.56), (2.30, 0.56), (2.34, 0.66), (2.33, 1.40), (1.18, 1.42), (1.05, 1.30)],
                 ys - 0.06, ys + 0.04)
    P.paint(lo, mb, top=mt)
    objs += [up, lo]
    mh = M(S['hook'])
    for hx in (1.42, 2.02):
        objs.append(P.boxmm('Hook', hx - 0.05, hx + 0.05, ys - 0.03, ys + 0.02, 2.58, 2.76, mh))
        objs.append(P.boxmm('Hook', hx - 0.05, hx + 0.05, ys - 0.03, ys + 0.02, 1.36, 1.56, mh))
    objs += raccoon_icon('Raccoon', 1.72, ys - 0.06, 2.06, 0.73, M(S['ink']), mb, st)
    txt = P.text_mesh('ShopText', 'SHOP', size=0.50, depth=0.012, bold=0.006, stretch_z=st,
                      loc=(0, 0, 0), m=M(S['ink']))
    P.xform(txt, loc=(1.70, ys - 0.06, 1.0), rot=(0, math.radians(3), 0))
    objs.append(txt)
    return [('shop_tree', objs, {'footprint': [2.2, 2.2], 'blocksSight': True,
                                 'note': 'trunk ~2.2 m wide at the base; roots are walkable decoration'})]


# ========================================================== wood sign ======
SIGN = dict(board='#966f31', boardTop='#a58936', boardEnd='#8a6229', post='#5e4527', postTop='#86633b',
            text='#e2e2e0')


def arrow_parts(L=0.30, H=0.24, t=0.05, head=0.12):
    """Right-pointing chevron arrow as two outlines (shaft, head) in screen units, centred at 0."""
    shaft = [(-L / 2, -t / 2), (L / 2 - t * 0.9, -t / 2), (L / 2 - t * 0.9, t / 2), (-L / 2, t / 2)]
    hd = [(L / 2, 0), (L / 2 - head, H / 2), (L / 2 - head - t * 1.1, H / 2), (L / 2 - t * 1.25, 0),
          (L / 2 - head - t * 1.1, -H / 2), (L / 2 - head, -H / 2)]
    return [shaft, hd[::-1]]


def build_wood_sign(text=None, key='wood_sign', posts=(-0.99, 0.99), board_w=3.17, board_h=1.11, zc=1.98,
                    roll=-6.3, post_top=2.92, xoff=0.07, ):
    """Signboard on two posts (t056.0). The board is rolled ~5 deg (right end lower) like the original.
    Text (if any) is baked as white Bree Serif; the blank version reports the text frame in its json."""
    S = SIGN
    M = lambda h, n=FRONT: P.mat(h, n)
    objs = []
    for px, lean in zip(posts, (2.0, -2.5)):
        p_ = P.boxmm('Post', -0.10, 0.10, 0.0, 0.18, 0, post_top)
        P.paint(p_, M(S['post']), top=M(S['postTop'], TOP))
        P.xform(p_, loc=(px, 0, 0), rot=(0, math.radians(lean), 0))
        objs.append(p_)
    yb0, yb1 = -0.12, 0.0
    hw, hh = board_w / 2, board_h / 2
    board = P.boxmm('Board', -hw, hw, yb0, yb1, -hh, hh)
    P.paint(board, M(S['board']), top=M(S['boardTop'], TOP), side=M(S['boardEnd'], (1, 0, 0)))
    parts = [board]
    st = 1 / P.COS
    tx = None
    if text:
        t = P.text_mesh('SignText', text, size=0.43, depth=0.01, bold=0.0, align='LEFT', valign='BOTTOM',
                        stretch_z=st, loc=(-hw + 0.24, yb0, -0.21), m=M(S['text']), spacing=1.06)
        parts.append(t)
        for i, ap in enumerate(arrow_parts()):
            parts.append(P.prism('Arrow%d' % i, [(hw - 0.36 + x, -0.06 + z * st) for x, z in ap], yb0 - 0.012, yb0,
                                 M(S['text'])))
    for o in parts:
        P.xform(o, rot=(0, math.radians(-roll), 0))
        o.location = (xoff, 0, zc)
        T.apply_transforms(o)
    objs += parts
    meta = {'footprint': [2.2, 0.3], 'blocksSight': False,
            'board': {'w': board_w, 'h': board_h, 'centre_m': [xoff, yb0, zc], 'roll_deg': roll,
                      'note': 'screen roll: text baseline rotates clockwise by ~%.1f deg' % abs(roll)}}
    return [(key, objs, meta)]


def build_wood_signs():
    return build_wood_sign(None, 'wood_sign') + []


def build_wood_sign_campsites():
    return build_wood_sign('Campsites', 'wood_sign_campsites')


# ================================================================ gate ======
GATE = dict(post='#373830', postTop='#5f5f53', slabTop='#a19f86', slabFront='#747661',
            armTop='#dee428', armFront='#afbf21', hinge='#a7ae2a')


def gate_post(objs, M, G):
    slab = P.boxmm('Slab', -0.215, 0.215, -0.205, 0.205, 0, 0.10)
    P.paint(slab, M(G['slabFront']), top=M(G['slabTop'], TOP))
    objs.append(slab)
    post = P.cyl('Post', 0.15, 1.66, 14, (0, 0, 0.10))
    P.paint(post, M(G['post']), top=M(G['postTop'], TOP))
    objs.append(post)
    cap = T.ico('PostCap', 1.0, 2, scale=(0.15, 0.15, 0.06), loc=(0, 0, 1.76))
    P.paint(cap, M(G['post']), top=M(G['postTop'], TOP), top_thresh=0.5)
    objs.append(cap)


def gate_arm(G, M):
    arm = []
    a = P.boxmm('Arm', 0.17, 3.60, -0.05, 0.05, 1.24, 1.42)
    P.paint(a, M(G['armFront']), top=M(G['armTop'], TOP))
    arm.append(a)
    u = P.boxmm('Upright', 0.17, 0.32, -0.05, 0.05, 0.30, 1.30)
    P.paint(u, M(G['armFront']), top=M(G['armTop'], TOP))
    arm.append(u)
    br = P.box("Brace", (2.13, 0.14, 0.13), (1.275, 0.0, 0.875), rot=(0, math.radians(-23.5), 0))
    P.paint(br, M(G['armFront']), top=M(G['armTop'], TOP))
    arm.append(br)
    for hz in (0.48, 1.18):
        arm.append(P.boxmm('Hinge', 0.12, 0.19, -0.04, 0.04, hz, hz + 0.08, M(G['hinge'])))
    return arm


def build_gate():
    G = GATE
    M = lambda h, n=FRONT: P.mat(h, n)
    out = []
    objs = []
    gate_post(objs, M, G)
    arm = gate_arm(G, M)
    out.append(('gate', objs + arm, {'footprint': [0.45, 0.45], 'blocksSight': False,
                                      'note': 'north post + arm swung OPEN along +x (3.6 m)'}))
    arm2 = gate_arm(G, M)
    P.rotate_objs(arm2, math.radians(-90))
    out.append(('gate_closed', objs + arm2, {'footprint': [0.45, 0.45], 'blocksSight': False,
                                              'note': 'arm swung CLOSED towards -y (3.6 m) onto gate_post'}))
    post2 = []
    gate_post(post2, M, G)
    out.append(('gate_post', post2, {'footprint': [0.45, 0.45], 'blocksSight': False}))
    return out


BUILDERS = {
    'cabin': build_cabin,
    'bed': build_bed,
    'stove': build_stove,
    'shop_tree': build_shop_tree,
    'wood_sign': build_wood_signs,
    'wood_sign_campsites': build_wood_sign_campsites,
    'gate': build_gate,
}

if __name__ == '__main__':
    P.run(BUILDERS)
