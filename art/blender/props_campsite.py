"""
Campsite props: campsite letter posts, fire pit, firewood pile, cooler, picnic
table, tents, bear-proof food box, parking/trash pad, trash can, picnic
blanket, beach umbrella, camp chair.

  Blender -b --factory-startup -P art/blender/props_campsite.py -- [group ...]
Groups: camp_sign firepit firewood cooler picnic_table tents foodbox pad trash_can blanket umbrella camp_chair
All measurements come from the tutorial / inside-park stills (1 still px == 1 sprite px).
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
M = lambda h, n=FRONT, sh=T.SHADE: P.mat(h, n, sh)
ST = 1 / P.COS          # vertical stretch for flat graphics so they read undistorted on screen

WOOD = dict(bark='#75582e', end='#af7d3b', ring='#9c6834')


def log_y(name, x, y0, y1, z, rx, rz, segs=8, ring=True, seed=0, bark=None):
    """Log lying along +y from y0 (front end, rings visible) to y1, centre height z."""
    o = P.cyl(name, rx, y1 - y0, segs, (x, y0, z), axis='Y', rz=rz)
    P.paint(o, M(bark or WOOD['bark'], TOP), front=M(WOOD['end']), back=M(WOOD['end']))
    out = [o]
    if ring:
        sp = P.spiral(rx * 0.92, rz * 0.92, 2.0, 0.16, 50, x, z, a0=seed * 1.7)
        out.append(P.prism(name + 'Ring', sp, y0 - 0.006, y0 + 0.001, M(WOOD['ring'])))
    return out


# =========================================================== camp sign ======
def build_camp_signs():
    post_c, post_top = '#5d4426', '#86633b'
    out = []
    for letter in (None, 'A', 'B', 'C', 'D'):
        objs = []
        p_ = P.boxmm('Post', -0.085, 0.085, -0.085, 0.085, 0, 2.36)
        P.paint(p_, M(post_c), top=M(post_top, TOP))
        objs.append(p_)
        zc = 1.77
        y0 = -0.17
        outer = [(x, zc + z * ST) for x, z in P.rrect(0.675, 0.51, 0.085, 5)]
        fr = P.prism('Plaque', outer, y0, y0 + 0.09)
        P.paint(fr, M('#d6d6d4'), top=M('#fbfbfb', TOP), side=M('#c8c8c6', (1, 0, 0)))
        objs.append(fr)
        inner = [(x, zc - 0.012 + z * ST) for x, z in P.rrect(0.535, 0.385, 0.05, 5)]
        objs.append(P.prism('Panel', inner, y0 - 0.006, y0 + 0.02, M('#316c28')))
        if letter:
            t = P.text_mesh('Letter', letter, size=0.42, depth=0.01, bold=0.004, stretch_z=ST,
                            loc=(0.0, y0 - 0.006, zc - 0.012), m=M('#e9e9e7'))
            objs.append(t)
        key = 'camp_sign' if letter is None else 'camp_sign_' + letter.lower()
        out.append((key, objs, {'footprint': [0.3, 0.3], 'blocksSight': False,
                                'plaque': {'centre_m': [0, y0, zc], 'w': 0.675, 'h_screen_m': 0.51}}))
    return out


# ============================================================= firepit ======
ROCK_GREYS = ['#c9c9c9', '#acadac', '#8c8c8e', '#c1c1c1', '#9a9a9b', '#d2d2d2']


def firepit_parts(seed=4, n=13, R=0.44, ry_scale=0.95):
    rnd = random.Random(seed)
    objs = []
    ash = P.slab('Ash', P.ellipse(R - 0.02, (R - 0.02) * ry_scale, 20), 0.0, 0.02)
    P.setm(ash, M('#57584a', TOP))
    objs.append(ash)
    for i in range(n):
        a = i / n * math.tau + rnd.uniform(-0.08, 0.08)
        x, y = math.cos(a) * R, math.sin(a) * R * ry_scale
        s = rnd.uniform(0.27, 0.33)
        r = P.rock('PitRock', (s, s * 0.95, rnd.uniform(0.19, 0.25)), seed=seed * 31 + i, subdiv=2, jag=0.10,
                   loc=(x, y, 0), flat_bottom=0.4)
        P.setm(r, M(ROCK_GREYS[(i * 5 + seed) % len(ROCK_GREYS)], TOP))
        objs.append(r)
    return objs


def firepit_logs():
    objs = []
    objs += log_y('LogB', 0.02, -0.26, 0.24, 0.12, 0.115, 0.13, seed=1)
    lx = P.cyl('LogA', 0.12, 0.62, 8, (-0.32, 0.06, 0.25), axis='X', rz=0.13)
    P.paint(lx, M(WOOD['bark'], TOP), side=M(WOOD['end'], (-1, 0, 0)))
    objs.append(lx)
    return objs


def flames(scale=1.0, z0=0.18):
    """Flat camera-facing flame tongues (yellow core + orange outer)."""
    objs = []
    for (cx, h, w, col, yo) in ((0.0, 0.62, 0.30, '#f3b008', 0.0), (-0.09, 0.42, 0.18, '#f3b008', 0.01),
                                (0.10, 0.48, 0.18, '#f3b008', 0.01), (0.0, 0.40, 0.18, '#f4e206', -0.02),
                                (-0.05, 0.28, 0.10, '#f4e206', -0.03)):
        pts = [(cx - w / 2, 0), (cx - w * 0.35, h * 0.45), (cx - w * 0.1, h * 0.75), (cx + w * 0.02, h),
               (cx + w * 0.2, h * 0.62), (cx + w / 2, h * 0.3), (cx + w * 0.4, 0)]
        pts = [(x * scale, z0 + z * scale * ST) for x, z in pts]
        objs.append(P.prism('Flame', pts, -0.05 + yo, -0.04 + yo, P.mat(col, None, 0.0)))
    return objs


def build_firepit():
    base = firepit_parts() + firepit_logs()
    lit = firepit_parts() + firepit_logs() + flames()
    meta = {'footprint': [1.15, 1.1], 'blocksSight': False}
    return [('firepit', base, meta), ('firepit_lit', lit, dict(meta, note='flames baked in'))]


def build_bbq_grill():
    """Campsite D: fire ring with flames under a black metal grate on legs."""
    objs = firepit_parts(seed=9) + firepit_logs() + flames(0.9, 0.16)
    g = '#2e2e2e'
    W, D, H = 0.86, 0.50, 0.62
    for sx in (-1, 1):
        for sy in (-1, 1):
            objs.append(P.boxmm('GLeg', sx * W / 2 - 0.02, sx * W / 2 + 0.02, sy * D / 2 - 0.02, sy * D / 2 + 0.02, 0, H,
                                M(g)))
    frame = []
    for (x0, x1, y0, y1) in ((-W / 2, W / 2, -D / 2 - 0.02, -D / 2 + 0.02), (-W / 2, W / 2, D / 2 - 0.02, D / 2 + 0.02),
                             (-W / 2 - 0.02, -W / 2 + 0.02, -D / 2, D / 2), (W / 2 - 0.02, W / 2 + 0.02, -D / 2, D / 2)):
        frame.append(P.boxmm('GFrame', x0, x1, y0, y1, H - 0.04, H, M(g, TOP)))
    nb = 11
    for i in range(nb):
        x = -W / 2 + W * (i + 0.5) / nb
        frame.append(P.boxmm('GBar', x - 0.012, x + 0.012, -D / 2, D / 2, H - 0.035, H - 0.005, M('#3a3a3a', TOP)))
    for j in range(3):
        y = -D / 2 + D * (j + 1) / 4
        frame.append(P.boxmm('GBarY', -W / 2, W / 2, y - 0.01, y + 0.01, H - 0.035, H - 0.01, M('#3a3a3a', TOP)))
    objs += frame
    return [('bbq_grill', objs, {'footprint': [1.15, 1.1], 'blocksSight': False})]


# ============================================================ firewood ======
def build_firewood(seed=5):
    rnd = random.Random(seed)
    objs = []
    rx, rz = 0.122, 0.165
    sp = 0.2375
    L = 0.66
    rows = [6, 5, 4, 3]
    for r, n in enumerate(rows):
        z = rz + r * 0.285
        for i in range(n):
            x = (i - (n - 1) / 2) * sp + rnd.uniform(-0.01, 0.01)
            y0 = -L / 2 + rnd.uniform(-0.03, 0.03)
            objs += log_y('Log%d_%d' % (r, i), x, y0, y0 + L, z, rx, rz, 8, True, seed=r * 7 + i)
    return [('firewood', objs, {'footprint': [1.45, 0.7], 'blocksSight': False})]


# ============================================================== cooler ======
COOL = dict(body='#67c1b7', lid='#e7e7e9', lip='#bebebf', latch='#9d9e9d', latchTop='#d0d0d0',
            handle='#eaeaea', handleF='#c0bdbf', inner='#7de0d4', water='#63b3b0', ice='#d4ecea')


def cooler_body(open_=False):
    C = COOL
    W, D, H = 0.77, 0.45, 0.49
    objs = []
    prof = []
    r = 0.07
    prof += [(-W / 2, H)]
    for i in range(5):
        a = math.radians(180 + 90 * i / 4)
        prof.append((-W / 2 + r + r * math.cos(a), r + r * math.sin(a)))
    for i in range(5):
        a = math.radians(270 + 90 * i / 4)
        prof.append((W / 2 - r + r * math.cos(a), r + r * math.sin(a)))
    prof.append((W / 2, H))
    body = P.prism('CoolerBody', prof, -D / 2, D / 2)
    P.paint(body, M(C['body']), top=M(C['inner'], TOP))
    objs.append(body)
    if open_:
        # cavity: inner walls + water + ice
        t = 0.05
        water = P.boxmm('Water', -W / 2 + t, W / 2 - t, -D / 2 + t, D / 2 - t, H - 0.10, H + 0.001, M(C['water'], TOP))
        objs.append(water)
        inner_back = P.boxmm('InnerBack', -W / 2 + t, W / 2 - t, D / 2 - t - 0.002, D / 2 - t, H - 0.10, H + 0.002,
                             M('#5aa59f'))
        objs.append(inner_back)
        for (x0, x1, y0, y1) in ((-W / 2, W / 2, -D / 2, -D / 2 + t), (-W / 2, W / 2, D / 2 - t, D / 2),
                                 (-W / 2, -W / 2 + t, -D / 2, D / 2), (W / 2 - t, W / 2, -D / 2, D / 2)):
            objs.append(P.boxmm('Rim', x0, x1, y0, y1, H - 0.002, H + 0.012, M(C['inner'], TOP)))
        rnd = random.Random(3)
        for i in range(11):
            x = rnd.uniform(-W / 2 + 0.1, W / 2 - 0.1)
            y = rnd.uniform(-D / 2 + 0.09, D / 2 - 0.09)
            ic = P.rock('Ice', (0.08, 0.07, 0.05), seed=40 + i, subdiv=1, jag=0.15, loc=(x, y, H - 0.03))
            P.setm(ic, M(C['ice'], TOP))
            objs.append(ic)
    return objs, W, D, H


def cooler_lid(W, D, H):
    C = COOL
    objs = []
    lid = P.boxmm('Lid', -W / 2 - 0.015, W / 2 + 0.015, -D / 2 - 0.015, D / 2 + 0.01, H, H + 0.09)
    P.paint(lid, M(C['lip']), top=M(C['lid'], TOP))
    objs.append(lid)
    latch = P.boxmm('Latch', -0.08, 0.08, -D / 2 - 0.035, -D / 2 - 0.01, H - 0.06, H + 0.05)
    P.paint(latch, M(C['latch']), top=M(C['latchTop'], TOP))
    objs.append(latch)
    return objs


def cooler_handle(W, D, H):
    C = COOL
    objs = []
    hz0 = H + 0.03
    for sx in (-1, 1):
        x = sx * (W / 2 + 0.045)
        objs.append(P.boxmm('HPivot', x - 0.02, x + 0.02, -0.06, -0.02, H - 0.08, hz0 + 0.03, M(C['handleF'])))
        arm = P.box('HArm', (0.04, 0.34, 0.035), (x, 0.11, hz0 + 0.07), rot=(math.radians(14), 0, 0))
        P.paint(arm, M(C['handleF']), top=M(C['handle'], TOP))
        objs.append(arm)
    bar = P.boxmm('HBar', -W / 2 - 0.065, W / 2 + 0.065, 0.25, 0.30, hz0 + 0.09, hz0 + 0.13)
    P.paint(bar, M(C['handleF']), top=M(C['handle'], TOP))
    objs.append(bar)
    return objs


def build_cooler():
    objs, W, D, H = cooler_body(False)
    closed = objs + cooler_lid(W, D, H) + cooler_handle(W, D, H)
    o2, W, D, H = cooler_body(True)
    lid = cooler_lid(W, D, H)
    # hinge at the back top edge, open ~105 deg so the lid stands up behind the box
    hinge = Vector((0, D / 2 + 0.01, H))
    Rm = Matrix.Translation(hinge) @ Matrix.Rotation(math.radians(-105), 4, 'X') @ Matrix.Translation(-hinge)
    for o in lid:
        o.matrix_world = Rm @ o.matrix_world
        T.apply_transforms(o)
    # side handles hanging down
    for sx in (-1, 1):
        x = sx * (W / 2 + 0.03)
        h = P.prism('SideHandle', P.arch(0.30, 0.16, 0.05, 0.035, 3), 0, 0.04)
        P.xform(h, rot=(0, 0, math.radians(90)))
        h.location = (x, 0, H - 0.18)
        T.apply_transforms(h)
        P.paint(h, M(COOL['handleF']), top=M(COOL['handle'], TOP))
        o2.append(h)
    open_ = o2 + lid
    meta = {'footprint': [0.8, 0.5], 'blocksSight': False}
    return [('cooler', closed, meta), ('cooler_open', open_, meta)]


# ======================================================== picnic table ======
PT = dict(top='#9d6f3b', front='#825d35', frame='#684b2b', grain='#8e6236')


def picnic_parts(seed=2):
    rnd = random.Random(seed)
    objs = []
    hl = 0.655                 # half length (y)
    ztb, ztt = 0.66, 0.78       # table top bottom/top
    zbb, zbt = 0.335, 0.435     # bench
    tw = 0.885
    nbd = 3
    for i in range(nbd):
        x0 = -tw / 2 + tw * i / nbd
        x1 = -tw / 2 + tw * (i + 1) / nbd
        b = P.boxmm('TopBoard', x0 + 0.004, x1 - 0.004, -hl, hl, ztb, ztt)
        P.paint(b, M(PT['front']), top=M(PT['top'], TOP))
        objs.append(b)
        for g in range(2):
            gx = rnd.uniform(x0 + 0.05, x1 - 0.05)
            gy0 = rnd.uniform(-hl + 0.1, 0.0)
            objs.append(P.boxmm('Grain', gx - 0.006, gx + 0.006, gy0, gy0 + rnd.uniform(0.25, 0.6), ztt, ztt + 0.002,
                                M(PT['grain'], TOP)))
    objs.append(P.boxmm('TopUnder', -tw / 2 + 0.02, tw / 2 - 0.02, -hl + 0.02, hl - 0.02, ztb - 0.001, ztb + 0.01,
                        M('#3a2a18')))
    for sx in (-1, 1):
        x0, x1 = sorted((sx * 0.503, sx * 0.858))
        b = P.boxmm('Bench', x0, x1, -hl, hl, zbb, zbt)
        P.paint(b, M('#835c33'), top=M(PT['top'], TOP))
        objs.append(b)
    for yf in (-0.60, 0.60):
        objs.append(P.boxmm('TopRail', -tw / 2 + 0.03, tw / 2 - 0.03, yf - 0.05, yf + 0.05, ztb - 0.12, ztb, M(PT['frame'])))
        objs.append(P.boxmm('SeatRail', -0.87, 0.87, yf - 0.05, yf + 0.05, zbb - 0.10, zbb, M(PT['frame'])))
        for sx in (-1, 1):
            p0 = Vector((sx * 0.16, yf, ztb - 0.06))
            p1 = Vector((sx * 0.50, yf - 0.06 if yf < 0 else yf + 0.06, 0.0))
            objs.append(P.beam('Leg', p0, p1, 0.10, 0.09, M(PT['frame'])))
    return objs


def build_picnic_table():
    a = picnic_parts()
    b = picnic_parts()
    P.rotate_objs(b, math.radians(90))
    return [('picnic_table', a, {'footprint': [1.75, 1.35], 'blocksSight': False,
                                 'note': 'long axis N-S (benches on the east/west sides) as in every still'}),
            ('picnic_table_ew', b, {'footprint': [1.35, 1.75], 'blocksSight': False})]


# =============================================================== tents ======
TENTS = {
    'green': dict(roof='#2c7a3c', flap='#225a2d', inside='#0c1c0f', dark='#050806'),
    'orange': dict(roof='#c1643b', flap='#9e5233', inside='#622f24', dark='#47271a'),
    'blue': dict(roof='#3c7c9f', flap='#336982', inside='#213c42', dark='#15282e'),
}


def build_tent(colour):
    C = TENTS[colour]
    W, D, H = 2.0, 1.28, 1.90
    hw, hd = W / 2, D / 2
    n = 10
    p_exp = 1.3
    prof = [(hw * (1 - i / n), H * (i / n) ** p_exp) for i in range(n + 1)]       # (|x|, z) from eave to ridge
    objs = []
    left_n = (-0.88, 0, 0.47)
    m_roof = M(C['roof'], left_n)
    for sx in (-1, 1):
        bm = bmesh.new()
        rows = []
        for y in (-hd, hd):
            rows.append([bm.verts.new((sx * ax, y, z)) for ax, z in prof])
        for i in range(n):
            f = bm.faces.new((rows[0][i], rows[0][i + 1], rows[1][i + 1], rows[1][i]))
        bm.normal_update()
        for f in bm.faces:
            if f.normal.z < 0:
                f.normal_flip()
        o = T.bm_to_obj('Roof', bm)
        P.setm(o, m_roof)
        objs.append(o)
    # gables (front + back) as flat curved triangles
    gable = [(-ax, z) for ax, z in prof] + [(ax, z) for ax, z in prof[::-1]][1:]
    gable = [(-hw, 0.0)] + [(-ax, z) for ax, z in prof[1:]] + [(ax, z) for ax, z in prof[::-1][1:-1]] + [(hw, 0.0)]
    front = P.prism('FrontGable', gable, -hd - 0.004, -hd + 0.03, M(C['flap']))
    objs.append(front)
    back = P.prism('BackGable', gable, hd - 0.03, hd, M(C['flap']))
    objs.append(back)
    # door opening (curved), dark interior: upper part shows the back wall, lower part the floor shadow
    ow, Hd = 0.43, H * 0.99
    xw = lambda z: ow * (1 - z / Hd) ** 0.85
    zs = H * 0.47

    def band(z0, z1, k=10):
        zs_ = [z0 + (z1 - z0) * i / k for i in range(k + 1)]
        left = [(-xw(z), z) for z in zs_]
        right = [(xw(z), z) for z in zs_[::-1]]
        pts = left + right
        return [p for i, p in enumerate(pts) if i == 0 or (abs(p[0] - pts[i - 1][0]) > 1e-5 or abs(p[1] - pts[i - 1][1]) > 1e-5)]
    up = band(zs, Hd)
    up = up[:len(up) // 2] + up[len(up) // 2 + 1:] if abs(up[len(up) // 2][0]) < 1e-6 else up
    objs.append(P.prism('DoorUp', up, -hd - 0.010, -hd - 0.004, M(C['inside'])))
    objs.append(P.prism('DoorLo', band(0.0, zs), -hd - 0.010, -hd - 0.004, M(C['dark'])))
    # corner pegs leaning outwards
    for sx in (-1, 1):
        for sy in (-1, 1):
            b = Vector((sx * (hw + 0.02), sy * (hd + 0.02), 0.0))
            tip = b + Vector((sx * 0.12, sy * 0.05, 0.36))
            objs.append(P.tube('Peg', b, tip, 0.032, 6, M('#5e5e5e')))
    return [('tent_' + colour, objs, {'footprint': [2.0, 1.3], 'blocksSight': True,
                                       'note': 'ridge tent, ridge N-S, door faces -y'})]


def build_tents():
    out = []
    for c in ('green', 'orange', 'blue'):
        out += build_tent(c)
    return out


# ============================================================= foodbox ======
def build_foodbox():
    """Bear-proof steel food locker (no clear reference in the stills - styled to match)."""
    body, top, dark, handle = '#7e8582', '#9aa19e', '#5f6663', '#3e4442'
    W, D, H = 1.30, 0.70, 0.95
    objs = []
    b = P.boxmm('Box', -W / 2, W / 2, -D / 2, D / 2, 0, H)
    P.paint(b, M(body), top=M(top, TOP), side=M(dark, (1, 0, 0)))
    objs.append(b)
    lid = P.boxmm('Lid', -W / 2 - 0.03, W / 2 + 0.03, -D / 2 - 0.03, D / 2 + 0.03, H, H + 0.07)
    P.paint(lid, M(dark), top=M(top, TOP))
    objs.append(lid)
    # door panels
    for sx in (-1, 1):
        x0, x1 = sorted((sx * 0.04, sx * (W / 2 - 0.08)))
        pnl = P.boxmm('Panel', x0, x1, -D / 2 - 0.015, -D / 2, 0.10, H - 0.10)
        P.paint(pnl, M('#858c89'), top=M(top, TOP))
        objs.append(pnl)
        for zz in (0.18, H - 0.18):
            for xx in (x0 + 0.05, x1 - 0.05):
                objs.append(P.boxmm('Rivet', xx - 0.015, xx + 0.015, -D / 2 - 0.03, -D / 2 - 0.015, zz - 0.015, zz + 0.015,
                                    M('#b5bbb8')))
    objs.append(P.boxmm('Latch', -0.12, 0.12, -D / 2 - 0.05, -D / 2 - 0.015, H - 0.32, H - 0.22, M(handle)))
    objs.append(P.boxmm('LatchBar', -0.025, 0.025, -D / 2 - 0.06, -D / 2 - 0.02, H - 0.44, H - 0.20, M(handle)))
    for sx in (-1, 1):
        objs.append(P.boxmm('Foot', sx * (W / 2 - 0.12) - 0.08, sx * (W / 2 - 0.12) + 0.08, -D / 2 + 0.05, D / 2 - 0.05,
                            -0.0, 0.04, M(handle)))
    return [('foodbox', objs, {'footprint': [1.36, 0.76], 'blocksSight': False})]


# ========================================================= trash / pad ======
def build_pad():
    """Concrete pad with a tan dirt border (trash can / campsite pad). t0025.0."""
    objs = []
    border = P.slab('Border', P.rrect(2.45, 1.61, 0.14, 4, 0, 0.0), 0.0, 0.012)
    P.setm(border, M('#c0884b', TOP))
    objs.append(border)
    slab = P.boxmm('Slab', -1.04, 1.04, -0.60, 0.54, 0.0, 0.22)
    P.paint(slab, M('#5f5b5c'), top=M('#736f6c', TOP))
    objs.append(slab)
    return [('parking_pad', objs, {'footprint': [2.45, 1.61], 'blocksSight': False, 'decal': True,
                                   'note': 'slab raised 0.22 m; trash_can sits at its centre'})]


def build_trash_can():
    """Ribbed grey metal can with lid + handle (t0025.0 / t0157.0)."""
    objs = []
    rx, ry, h = 0.32, 0.215, 1.15
    segs = 24
    bm = bmesh.new()
    rings = []
    for z, sc in ((0.0, 0.94), (0.06, 0.96), (h - 0.05, 1.0), (h, 1.0)):
        ring = []
        for i in range(segs):
            a = -math.pi / 2 + (i + 0.5) / segs * math.tau
            rr = sc * (1.0 if i % 2 == 0 else 0.955)
            ring.append(bm.verts.new((math.cos(a) * rx * rr, math.sin(a) * ry * rr, z)))
        rings.append(ring)
    for ra, rb in zip(rings, rings[1:]):
        for i in range(segs):
            bm.faces.new((ra[i], ra[(i + 1) % segs], rb[(i + 1) % segs], rb[i]))
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])
    can = P.bm_obj('Can', bm)
    lt, dk = M('#ababab', FRONT, 0.10), M('#959595', FRONT, 0.10)
    me = can.data
    me.materials.append(lt)
    me.materials.append(dk)
    for p in me.polygons:
        p.material_index = 0
        if abs(p.normal.z) < 0.5:
            # rib index from the angle of the face centre
            c = p.center
            a = math.atan2(c.y / ry, c.x / rx) + math.pi / 2
            idx = int(round(a / math.tau * segs - 0.5)) % segs
            p.material_index = idx % 2
    objs.append(can)
    band = P.cyl('Band', rx * 1.02, 0.07, 24, (0, 0, 0.16), rz=ry * 1.02)
    P.paint(band, M('#9c9c9c', FRONT, 0.1), top=M('#b8b8b8', TOP))
    objs.append(band)
    lid = P.cyl('LidRim', rx * 1.07, 0.08, 24, (0, 0, h - 0.01), rz=ry * 1.07)
    P.paint(lid, M('#d3d3d3', FRONT, 0.1), top=M('#e5e5e5', TOP))
    objs.append(lid)
    dome = T.ico('LidDome', 1.0, 2, scale=(rx * 0.98, ry * 0.98, 0.07), loc=(0, 0, h + 0.07))
    P.paint(dome, M('#e5e5e5', TOP, 0.1), top=M('#e5e5e5', TOP, 0.1), top_thresh=0.3)
    objs.append(dome)
    hd = P.prism('LidHandle', P.arch(0.20, 0.09, 0.03, 0.03, 3), -0.02, 0.02)
    P.xform(hd, loc=(0, 0.0, h + 0.10))
    P.paint(hd, M('#acacac', FRONT, 0.1), top=M('#c4c4c4', TOP))
    objs.append(hd)
    return [('trash_can', objs, {'footprint': [0.66, 0.45], 'blocksSight': False})]


# ============================================================= blanket ======
def build_blanket():
    """Red/white checkered picnic blanket, 6 x 7 checks, long axis N-S (i_0069 / i_0129)."""
    objs = []
    cols, rows = 6, 7
    cw, cd = 0.236, 0.30
    for i in range(cols):
        for j in range(rows):
            x0 = (i - cols / 2) * cw
            y0 = (j - rows / 2) * cd
            red = (i + j) % 2 == 0
            objs.append(P.boxmm('Check', x0, x0 + cw, y0, y0 + cd, 0.0, 0.015,
                                M('#c43c48' if red else '#e4e2e2', TOP)))
    return [('blanket', objs, {'footprint': [1.42, 2.1], 'blocksSight': False, 'decal': True})]


# ============================================================ umbrella ======
def build_umbrella():
    """Beach umbrella, 8 alternating teal/white panels (i_0069)."""
    objs = []
    R, zr, za = 1.0, 2.88, 3.68
    n = 8
    for i in range(n):
        a0 = (i - 0.5) / n * math.tau - math.pi / 2
        a1 = (i + 0.5) / n * math.tau - math.pi / 2
        p0 = (math.cos(a0) * R, math.sin(a0) * R, zr)
        p1 = (math.cos(a1) * R, math.sin(a1) * R, zr)
        teal = i % 2 == 0
        col = '#75dfd1' if teal else '#eef0ee'
        f = P.solid_poly('Panel', [p0, p1, (0, 0, za)], 0.02, (0, 0, 1))
        P.setm(f, M(col, (math.cos((a0 + a1) / 2) * 0.6, math.sin((a0 + a1) / 2) * 0.6, 0.8)))
        objs.append(f)
        # rim band
        rim = P.solid_poly('Rim', [p0, p1, (p1[0], p1[1], zr - 0.08), (p0[0], p0[1], zr - 0.08)], 0.01,
                           (math.cos((a0 + a1) / 2), math.sin((a0 + a1) / 2), 0))
        P.setm(rim, M('#5fadac' if teal else '#d0d0cf'))
        objs.append(rim)
    objs.append(P.cyl('Pole', 0.035, za, 8, (0, 0, 0), m=M('#73562f')))
    objs.append(P.cyl('Finial', 0.05, 0.12, 8, (0, 0, za - 0.01), r2=0.02, m=M('#755630')))
    return [('umbrella', objs, {'footprint': [0.15, 0.15], 'blocksSight': False, 'canopy_d': 2.0})]


# ========================================================== camp chair ======
def chair_parts():
    seat, back, leg = '#74d4d2', '#5da2a9', '#74572f'
    W, Dp = 0.50, 0.46
    objs = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            objs.append(P.boxmm('CLeg', sx * (W / 2 - 0.03) - 0.025, sx * (W / 2 - 0.03) + 0.025,
                                sy * (Dp / 2 - 0.03) - 0.025, sy * (Dp / 2 - 0.03) + 0.025, 0, 0.36, M(leg)))
    s = P.boxmm('Seat', -W / 2, W / 2, -Dp / 2, Dp / 2, 0.36, 0.44)
    P.paint(s, M('#72d5d1'), top=M(seat, TOP))
    objs.append(s)
    for sx in (-1, 1):
        objs.append(P.boxmm('BackPost', sx * (W / 2 - 0.03) - 0.025, sx * (W / 2 - 0.03) + 0.025, Dp / 2 - 0.06, Dp / 2 - 0.01,
                            0.44, 0.64, M(leg)))
    b = P.boxmm('Back', -W / 2, W / 2, Dp / 2 - 0.07, Dp / 2, 0.64, 0.92)
    P.paint(b, M(back, (0, 1, 0)), top=M('#78d1d1', TOP), front=M('#6cc6c4'))
    objs.append(b)
    return objs


def build_camp_chair():
    out = []
    for key, rz in (('camp_chair', 0), ('camp_chair_e', 90), ('camp_chair_w', -90), ('camp_chair_n', 180)):
        objs = chair_parts()
        if rz:
            P.rotate_objs(objs, math.radians(rz))
        out.append((key, objs, {'footprint': [0.5, 0.5], 'blocksSight': False,
                                'facing': {'camp_chair': 'south', 'camp_chair_e': 'east', 'camp_chair_w': 'west',
                                           'camp_chair_n': 'north'}[key]}))
    return out


BUILDERS = {
    'camp_sign': build_camp_signs,
    'firepit': build_firepit,
    'bbq_grill': build_bbq_grill,
    'firewood': build_firewood,
    'cooler': build_cooler,
    'picnic_table': build_picnic_table,
    'tents': build_tents,
    'foodbox': build_foodbox,
    'pad': build_pad,
    'trash_can': build_trash_can,
    'blanket': build_blanket,
    'umbrella': build_umbrella,
    'camp_chair': build_camp_chair,
}

if __name__ == '__main__':
    P.run(BUILDERS)
