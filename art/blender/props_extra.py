"""
Bridge, RVs, Raccoon-shop interior pieces, rug, lantern.

  Blender -b --factory-startup -P art/blender/props_extra.py -- [bridge rvs shop_shelf shop_floor rug lantern]
Refs: inside t0129.6 (bridge), inside i_0293 / i_0300 (teal motorhome), i_0264 / i_0267 (white /
yellow trailers), tutorial t246.5 (shop interior, zoom 1.6), inside i_0493 (ranger-station rug).
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
ST = 1 / P.COS


# ============================================================== bridge ======
BR = dict(deck='#a06e3b', seam='#8f6234', fascia='#825d33', railTop='#e29e55', rail='#c5894c', post='#c5894d')


def arch_z(x, half, rise, base):
    u = max(-1.0, min(1.0, x / half))
    return base + rise * (1 - u * u)


def bridge_parts():
    L, Wd = 3.7, 2.9                # deck length (x) and width (y)
    half = L / 2
    rise, base = 0.85, 0.12
    t = 0.22                        # deck thickness
    objs = []
    n = 16
    xs = [-half + L * i / n for i in range(n + 1)]
    # deck as an arched slab: profile in XZ extruded along y
    top = [(x, arch_z(x, half, rise, base)) for x in xs]
    bot = [(x, arch_z(x, half, rise, base) - t) for x in xs[::-1]]
    poly = [(x, max(0.0, z)) for x, z in bot[::-1]] + [(x, z) for x, z in top[::-1]]
    deck = P.prism('Deck', poly, -Wd / 2, Wd / 2)
    P.paint(deck, M(BR['fascia']), top=M(BR['deck'], TOP), side=M(BR['fascia'], (1, 0, 0)), top_thresh=0.3)
    objs.append(deck)
    # plank seams on the deck (lines along y)
    for i in range(1, 12):
        x = -half + L * i / 12
        z = arch_z(x, half, rise, base)
        sl = (arch_z(x + 0.01, half, rise, base) - arch_z(x - 0.01, half, rise, base)) / 0.02
        a = math.atan(sl)
        sm = P.box('Seam', (0.018, Wd - 0.02, 0.01), (x, 0, z + 0.003), rot=(0, -a, 0))
        P.setm(sm, M(BR['seam'], TOP))
        objs.append(sm)
    # railings (front and back): 3 posts + arched top bar
    for yr in (-Wd / 2 + 0.12, Wd / 2 - 0.12):
        for px in (-1.42, 0.0, 1.42):
            zb = arch_z(px, half, rise, base)
            p_ = P.boxmm('Post', px - 0.10, px + 0.10, yr - 0.08, yr + 0.08, zb - 0.05, zb + 0.78)
            P.paint(p_, M(BR['post']), top=M(BR['railTop'], TOP))
            objs.append(p_)
        rail_top = [(x, arch_z(x, half * 1.02, rise, base) + 0.92) for x in [-half * 0.97 + 2 * half * 0.97 * i / n for i in range(n + 1)]]
        poly = [(x, z - 0.17) for x, z in rail_top] + [(x, z) for x, z in rail_top[::-1]]
        r = P.prism('Rail', poly, yr - 0.13, yr + 0.13)
        P.paint(r, M(BR['rail']), top=M(BR['railTop'], TOP), side=M(BR['rail'], (1, 0, 0)), top_thresh=0.3)
        objs.append(r)
    return objs


def build_bridge():
    a = bridge_parts()
    b = bridge_parts()
    P.rotate_objs(b, math.radians(90))
    return [('bridge_wood', a, {'footprint': [3.7, 2.9], 'blocksSight': False, 'walkable': True,
                                'note': 'deck runs along x (crossing a N-S river) as in t0129.6; railings block y'}),
            ('bridge_wood_ns', b, {'footprint': [2.9, 3.7], 'blocksSight': False, 'walkable': True,
                                   'note': 'same bridge rotated: deck runs along y, railings on the E/W sides'})]


# ================================================================= RVs ======
RV = {
    'teal': dict(roof='#79e7da', side='#63b3b0', stripe='#d3d3d3', door='#73d6d3', doorStripe='#f6f6f6',
                 vent='#63b3b0', end='#4f9592'),
    'white': dict(roof='#fffdfe', side='#d4d4d4', stripe=None, door='#f0f0f0', doorStripe=None,
                  vent='#e4e4e4', end='#bdbdbd'),
    'yellow': dict(roof='#f8c15c', side='#ddaf51', stripe='#d3d3d5', door='#faca5c', doorStripe='#f6f6f4',
                   vent='#efbb58', end='#c49a45'),
}


def rv_window(objs, x0, x1, z0, z1, y, split=True):
    fr = P.prism('WinFrame', P.rrect(x1 - x0, z1 - z0, 0.07, 3, (x0 + x1) / 2, (z0 + z1) / 2), y - 0.03, y + 0.01,
                 M('#5f6366'))
    objs.append(fr)
    gi = 0.06
    gx0, gx1, gz0, gz1 = x0 + gi, x1 - gi, z0 + gi, z1 - gi
    zb = gz0 + (gz1 - gz0) * 0.3
    objs.append(P.boxmm('Glass', gx0, gx1, y - 0.04, y - 0.03, zb, gz1, M('#9adfe6')))
    objs.append(P.boxmm('GlassLow', gx0, gx1, y - 0.04, y - 0.03, gz0, zb, M('#86b4bd')))
    if split:
        xm = (x0 + x1) / 2
        objs.append(P.boxmm('Mullion', xm - 0.025, xm + 0.025, y - 0.05, y - 0.03, z0 + 0.03, z1 - 0.03, M('#5f6366')))


def wheel(objs, x, yfront, r=0.39):
    """Tire whose outer face sits at yfront (cylinder axis along +y, 0.3 m wide)."""
    t = P.cyl('Tire', r, 0.30, 16, (x, yfront, r), axis='Y')
    P.paint(t, M('#383838'), top=M('#2c2c2c', TOP))
    objs.append(t)
    objs.append(P.cyl('Hub', r * 0.55, 0.02, 16, (x, yfront - 0.015, r), axis='Y', m=M('#999999')))
    objs.append(P.cyl('HubIn', r * 0.36, 0.02, 16, (x, yfront - 0.03, r), axis='Y', m=M('#d6d6d6')))


def body_profile(L, z0, zt, front_cab=False, rb=0.25, rt=0.08):
    """XZ outline of the RV body (CCW): rounded bottom corners; motorhome gets a sloped windshield at +x."""
    pts = []
    hl = L / 2
    # bottom-left corner
    for i in range(4):
        a = math.radians(180 + 90 * i / 3)
        pts.append((-hl + rb + rb * math.cos(a), z0 + rb + rb * math.sin(a)))
    for i in range(4):
        a = math.radians(270 + 90 * i / 3)
        pts.append((hl - rb + rb * math.cos(a), z0 + rb + rb * math.sin(a)))
    if front_cab:
        pts += [(hl, 1.95), (hl - 0.10, 2.15), (hl - 0.62, zt - 0.10), (hl - 0.78, zt)]
    else:
        pts += [(hl, zt - rt), (hl - rt, zt)]
    for i in range(4):
        a = math.radians(90 + 90 * i / 3)
        pts.append((-hl + rt + rt * math.cos(a), zt - rt + rt * math.sin(a)))
    return pts


def build_rv(kind):
    C = RV[kind]
    motor = kind == 'teal'
    if motor:
        L, D, z0, zt = 8.3, 1.72, 0.40, 3.16
    else:
        L, D, z0, zt = 3.36, 1.57, 0.41, 3.19
    hl, hd = L / 2, D / 2
    yf = -hd
    objs = []
    body = P.prism('Body', body_profile(L, z0, zt, motor), yf, hd)
    P.paint(body, M(C['side']), top=M(C['roof'], TOP), side=M(C['end'], (1, 0, 0)), left=M(C['end'], (-1, 0, 0)),
            top_thresh=0.5)
    objs.append(body)
    if motor:
        # windshield glass on the sloped cab face
        nrm = Vector((math.cos(math.radians(40)), 0, math.sin(math.radians(40))))
        ws = [(hl - 0.14, yf + 0.10, 2.22), (hl - 0.14, hd - 0.10, 2.22), (hl - 0.60, hd - 0.10, zt - 0.14),
              (hl - 0.60, yf + 0.10, zt - 0.14)]
        ws = [tuple(Vector(p) + nrm * 0.012) for p in ws]
        objs.append(P.solid_poly('Windshield', ws, 0.01, nrm, M('#cfeef0', nrm)))
    # stripe
    if C['stripe']:
        sz0, sz1 = (1.12, 1.57) if motor else (1.41, 1.82)
        objs.append(P.boxmm('Stripe', -hl + 0.02, hl - (0.02 if not motor else 0.05), yf - 0.012, yf + 0.02, sz0, sz1,
                            M(C['stripe'])))
    # windows / door
    if motor:
        wz0, wz1 = 1.89, 2.91
        wins = [(0.5, 1.75), (5.14, 6.38), (6.75, 7.62)]
        door = (3.85, 4.72)
        wheels = [1.93, 3.07, 7.26]
    else:
        wz0, wz1 = 1.98, 2.97
        wins = [(0.21, 1.0), (2.3, 3.13)]
        door = (1.28, 2.10)
        wheels = [0.70, 2.64]
    for a_, b_ in wins:
        rv_window(objs, -hl + a_, -hl + b_, wz0, wz1, yf)
    dx0, dx1 = -hl + door[0], -hl + door[1]
    dp = P.boxmm('Door', dx0, dx1, yf - 0.02, yf + 0.01, z0 + 0.12, wz1 + 0.05, M(C['door']))
    objs.append(dp)
    if C['doorStripe']:
        objs.append(P.boxmm('DoorStripe', dx0, dx1, yf - 0.03, yf - 0.02, sz0, sz1, M(C['doorStripe'])))
    rv_window(objs, dx0 + 0.13, dx1 - 0.13, wz0 + 0.12, wz1 - 0.06, yf - 0.02, split=False)
    objs.append(P.boxmm('DoorHandle', dx1 - 0.22, dx1 - 0.08, yf - 0.06, yf - 0.02, (sz0 + sz1) / 2 + 0.15 if C['stripe'] else 1.6,
                        ((sz0 + sz1) / 2 + 0.24) if C['stripe'] else 1.69, M('#6a6a6a')))
    step = P.boxmm('Step', dx0 - 0.02, dx1 + 0.02, yf - 0.25, yf, 0.18, 0.30)
    P.paint(step, M('#9a9899'), top=M('#bcbcbc', TOP))
    objs.append(step)
    # wheels + arches
    for w in wheels:
        x = -hl + w
        wheel(objs, x, yf - 0.06)
    # roof vent
    vx = 1.3 if motor else 0.05
    vent = P.cyl('Vent', 0.30, 0.07, 18, (vx, 0.0, zt), rz=0.27)
    P.paint(vent, M(P.tint(C['vent'], 0.92)), top=M(C['vent'], TOP))
    objs.append(vent)
    # marker / tail lights
    for (x, z) in ((-hl + 0.15, 0.80), (hl - 0.12, 0.80)):
        objs.append(P.boxmm('Marker', x - 0.06, x + 0.06, yf - 0.02, yf + 0.01, z - 0.04, z + 0.04, M('#f38a1e')))
    if motor:
        for z in (1.15, 2.2):
            objs.append(P.boxmm('Tail', -hl - 0.02, -hl + 0.02, yf + 0.02, yf + 0.18, z, z + 0.45, M('#d23b40')))
    else:
        hz = 1.31 if kind == 'white' else 1.47
        objs.append(P.boxmm('Hitch', -hl - 0.40, -hl, -0.08, 0.08, hz, hz + 0.15, M('#42433e')))
    meta = {'footprint': [L, D], 'blocksSight': True,
            'note': ('motorhome, cab/windshield at +x, door on the -y side' if motor else
                     'camper trailer, hitch at -x, door on the -y side')}
    return [('rv_' + kind, objs, meta)]


def build_rvs():
    return build_rv('teal') + build_rv('white') + build_rv('yellow')


# ========================================================== shop shelf ======
def build_shop_shelf():
    """Raccoon Shop display counter: pale plank top on three log stumps with dark price plaques
    (prices are drawn by the game). t246.5 (shop zoom 1.6)."""
    W, Dp, ztop = 4.17, 0.69, 0.85
    objs = []
    top = P.boxmm('Top', -W / 2, W / 2, -Dp / 2, Dp / 2, ztop - 0.10, ztop)
    P.paint(top, M('#bd9b5e'), top=M('#e7c77a', TOP))
    objs.append(top)
    for i in range(3):
        cx = (i - 1) * 1.38
        lg = P.cyl('Log', 0.62, ztop - 0.10, 14, (cx, 0.0, 0.0), rz=0.25)
        P.paint(lg, M('#69482e', FRONT, 0.12), top=M('#7a5535', TOP))
        objs.append(lg)
        pl = P.boxmm('Plaque', cx - 0.58, cx + 0.58, -0.27, -0.24, 0.30, ztop - 0.14, M('#453528'))
        objs.append(pl)
    return [('shop_shelf', objs, {'footprint': [4.2, 0.7], 'blocksSight': False,
                                  'plaques': [{'centre_m': [(i - 1) * 1.38, -0.27, (0.30 + 0.71) / 2], 'w': 1.16,
                                               'h': 0.41} for i in range(3)]})]


# =========================================================== shop floor ======
def build_shop_floor(seed=6):
    """Round hollow-trunk room: sandy floor disc + curved wall around the back and sides (front open)."""
    rnd = random.Random(seed)
    R, Rw, H = 4.9, 5.3, 2.5
    objs = []
    floor = P.slab('Floor', [(math.cos(i / 48 * math.tau) * R, math.sin(i / 48 * math.tau) * R) for i in range(48)],
                   0.0, 0.02, M('#b98a4c', TOP))
    objs.append(floor)
    for i in range(26):
        a = rnd.uniform(0, math.tau)
        r = math.sqrt(rnd.random()) * (R - 0.4)
        objs.append(P.slab('Speck', P.ellipse(rnd.uniform(0.04, 0.09), rnd.uniform(0.03, 0.06), 6,
                                              math.cos(a) * r, math.sin(a) * r), 0.02, 0.025, M('#a67a40', TOP)))
    a0, a1 = math.radians(-28), math.radians(208)
    n = 40
    inner, outer = [], []
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        u = (a - a0) / (a1 - a0)
        taper = min(1.0, min(u, 1 - u) / 0.12)
        h = 1.0 + (H - 1.0) * (0.5 - 0.5 * math.cos(taper * math.pi))
        inner.append((math.cos(a) * R, math.sin(a) * R, h))
        outer.append((math.cos(a) * Rw, math.sin(a) * Rw, h))
    bm = bmesh.new()
    vi_b = [bm.verts.new((x, y, 0.0)) for x, y, h in inner]
    vi_t = [bm.verts.new((x, y, h)) for x, y, h in inner]
    vo_b = [bm.verts.new((x, y, 0.0)) for x, y, h in outer]
    vo_t = [bm.verts.new((x, y, h)) for x, y, h in outer]
    for i in range(n):
        bm.faces.new((vi_b[i], vi_t[i], vi_t[i + 1], vi_b[i + 1]))
        bm.faces.new((vi_t[i], vo_t[i], vo_t[i + 1], vi_t[i + 1]))
        bm.faces.new((vo_b[i + 1], vo_t[i + 1], vo_t[i], vo_b[i]))
    for e in (0, n):
        bm.faces.new((vi_b[e], vo_b[e], vo_t[e], vi_t[e]))
    wall = P.bm_obj('Wall', bm)
    me = wall.data
    mats = [M('#7d5735', (0, 1, 0)), M('#8a5638', TOP), M('#5e3d26')]
    for m in mats:
        me.materials.append(m)
    for p in me.polygons:
        c = p.center
        if p.normal.z > 0.5:
            p.material_index = 1
        elif Vector((c.x, c.y, 0)).normalized().dot(Vector((p.normal.x, p.normal.y, 0))) < 0:
            p.material_index = 0     # inner face (normal points to the centre)
        else:
            p.material_index = 2
    objs.append(wall)
    # vertical grooves on the inner face
    for i in range(22):
        a = a0 + (a1 - a0) * (i + 0.5) / 22 + rnd.uniform(-0.03, 0.03)
        u = (a - a0) / (a1 - a0)
        taper = min(1.0, min(u, 1 - u) / 0.12)
        h = 1.0 + (H - 1.0) * (0.5 - 0.5 * math.cos(taper * math.pi))
        p0 = (math.cos(a) * (R - 0.01), math.sin(a) * (R - 0.01), 0.15)
        p1 = (math.cos(a) * (R - 0.01), math.sin(a) * (R - 0.01), h * rnd.uniform(0.55, 0.85))
        objs.append(P.beam('Groove', p0, p1, 0.05, 0.01, M('#6a482b', (0, 1, 0)), up=(-math.cos(a), -math.sin(a), 0)))
    return [('shop_interior_floor', objs, {'footprint': [10.6, 10.6], 'blocksSight': False, 'decal': True,
                                           'note': 'floor disc r=4.9 m; wall ring r 4.9-5.3, 2.5 m tall, open to the '
                                                   'south (camera side); colliders: ring arc from -28 to 208 deg'})]


# ================================================================= rug ======
def build_rug():
    """Ranger-station red rug: darker border, lighter field (i_0493)."""
    W, Dp, b = 3.8, 1.85, 0.13
    objs = [P.boxmm('RugBorder', -W / 2, W / 2, -Dp / 2, Dp / 2, 0.0, 0.012, M('#a23c49', TOP)),
            P.boxmm('RugField', -W / 2 + b, W / 2 - b, -Dp / 2 + b, Dp / 2 - b, 0.012, 0.016, M('#ba4653', TOP))]
    return [('rug_red', objs, {'footprint': [3.8, 1.85], 'blocksSight': False, 'decal': True})]


# ============================================================= lantern ======
def build_lantern():
    """Camp lantern (shop interior t246.5): dark green-grey frame, glowing yellow glass."""
    dark, mid = '#2f3533', '#3a403f'
    objs = []
    base = P.cyl('Base', 0.14, 0.09, 12, (0, 0, 0))
    P.paint(base, M(dark), top=M(mid, TOP))
    objs.append(base)
    glass = P.cyl('Glass', 0.11, 0.30, 12, (0, 0, 0.09), m=P.mat('#f6e27a', None, 0.08))
    objs.append(glass)
    objs.append(P.cyl('Flame', 0.035, 0.10, 8, (0, -0.0, 0.17), r2=0.0, m=P.mat('#fff6c0', None, 0.0)))
    for i in range(4):
        a = (i + 0.5) / 4 * math.tau
        x, y = math.cos(a) * 0.115, math.sin(a) * 0.115
        objs.append(P.boxmm('Bar', x - 0.012, x + 0.012, y - 0.012, y + 0.012, 0.09, 0.39, M(dark)))
    for z, rot in ((0.20, 30), (0.28, -30)):
        cr = P.box('Cross', (0.24, 0.015, 0.025), (0, -0.115, z), rot=(0, math.radians(rot), 0))
        P.setm(cr, M(dark))
        objs.append(cr)
    cap = P.cyl('Cap', 0.15, 0.10, 12, (0, 0, 0.39), r2=0.06)
    P.paint(cap, M(dark), top=M(mid, TOP), top_thresh=0.4)
    objs.append(cap)
    objs.append(P.cyl('Top', 0.05, 0.05, 10, (0, 0, 0.49), m=M(mid)))
    h = P.prism('Handle', P.arch(0.22, 0.14, 0.07, 0.025, 4), -0.012, 0.012)
    P.xform(h, loc=(0, 0, 0.50))
    P.setm(h, M(dark))
    objs.append(h)
    return [('lantern', objs, {'footprint': [0.3, 0.3], 'blocksSight': False})]


BUILDERS = {
    'bridge': build_bridge,
    'rvs': build_rvs,
    'shop_shelf': build_shop_shelf,
    'shop_floor': build_shop_floor,
    'rug': build_rug,
    'lantern': build_lantern,
}

if __name__ == '__main__':
    P.run(BUILDERS)
