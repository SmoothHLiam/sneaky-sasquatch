"""
Campground structures: notice board (+maps), outhouse (+open door), secret cache chest,
RV Park / Lake signpost, yellow warning sign, rail fence.

  Blender -b --factory-startup -P art/blender/props_campground.py -- [notice_board outhouse cache_chest signpost warning_sign fence]
Refs: tutorial cut037.5 + t_0039 (notice board), inside t0078.0 (outhouse), inside i_0091 + t0093.3
(cache), t0250.0 (signpost), i_0409 (warning sign), outside o01 (fence).
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


def gable_slabs(ridge, k, rh, t, y0, y1, front_l, front_r, top_hex, side_hex):
    out = []
    for sx, fh in ((-1, front_l), (1, front_r)):
        pts = [(0, ridge), (sx * rh, ridge - rh * k), (sx * rh, ridge - rh * k - t), (0, ridge - t)]
        if sx > 0:
            pts = pts[::-1]
        s = P.prism('RoofSlab', pts, y0, y1)
        P.paint(s, M(side_hex, (sx, 0, 0)), front=M(fh), top=M(top_hex, (-0.62, 0, 0.78)), side=M(side_hex, (sx, 0, 0)))
        out.append(s)
    return out


# ======================================================== notice board ======
NB = dict(post='#75582e', block='#a0a29a', blockF='#7e807a', frame='#5d4426', frameTop='#86633d',
          cork='#6e563e', paper='#c8be65', ink='#a2944c', roofTop='#be3b49', fasciaL='#dd4353',
          fasciaR='#bc3c4b', moss='#338539', mossEdge='#2c7233')


def paper_piece(cx, cz, w, h, rot, seed, y):
    rnd = random.Random(seed)
    pts = [(-w / 2, -h / 2), (w / 2 - rnd.uniform(0, 0.04), -h / 2), (w / 2, -h / 2 + rnd.uniform(0.03, 0.08)),
           (w / 2 - rnd.uniform(0, 0.03), h / 2), (-w / 2 + rnd.uniform(0.04, 0.1), h / 2), (-w / 2, h / 2 - 0.05)]
    a = math.radians(rot)
    tr = lambda px, pz: (cx + px * math.cos(a) - pz * math.sin(a), cz + (px * math.sin(a) + pz * math.cos(a)) * ST)
    objs = [P.prism('Paper', [tr(*p) for p in pts], y - 0.012, y, M(NB['paper']))]
    # dashed trail lines + a little x marker
    for i in range(4):
        u = -w / 2 + 0.05 + i * (w - 0.1) / 4
        v = math.sin(i * 1.7 + seed) * h * 0.25
        seg = [(u, v - 0.01), (u + 0.05, v - 0.01), (u + 0.05, v + 0.01), (u, v + 0.01)]
        objs.append(P.prism('Dash', [tr(*p) for p in seg], y - 0.016, y - 0.012, M(NB['ink'])))
    return objs


def build_notice_board():
    out = []
    for maps in (False, True):
        objs = []
        for sx in (-1, 1):
            x = sx * 0.79
            blk = P.boxmm('Block', x - 0.20, x + 0.20, -0.15, 0.15, 0, 0.18)
            P.paint(blk, M(NB['blockF']), top=M(NB['block'], TOP))
            objs.append(blk)
            post = P.cyl('Post', 0.11, 2.6, 10, (x, 0, 0.18))
            P.paint(post, M(NB['post'], FRONT, 0.12), top=M(NB['frameTop'], TOP))
            objs.append(post)
        yb = -0.08
        frame = P.boxmm('Board', -0.69, 0.69, yb, yb + 0.08, 0.80, 2.03)
        P.paint(frame, M(NB['frame']), top=M(NB['frameTop'], TOP))
        objs.append(frame)
        cork = [(-0.48, 0.97), (-0.10, 0.95), (-0.06, 1.02), (0.18, 1.00), (0.20, 0.96), (0.47, 0.97), (0.49, 1.40),
                (0.46, 1.76), (0.10, 1.84), (0.06, 1.77), (-0.20, 1.80), (-0.46, 1.84), (-0.49, 1.45)]
        objs.append(P.prism('Cork', cork, yb - 0.008, yb, M(NB['cork'])))
        if maps:
            yp = yb - 0.008
            objs += paper_piece(-0.30, 1.66, 0.30, 0.20, 3, 1, yp)
            objs += paper_piece(0.26, 1.24, 0.30, 0.22, -4, 2, yp)
            objs += paper_piece(-0.22, 1.16, 0.26, 0.18, 6, 3, yp)
            objs += paper_piece(0.30, 1.64, 0.24, 0.17, -2, 4, yp)
        ridge, k, rh, t = 3.39, 0.78, 1.10, 0.20
        y0, y1 = -0.55, 0.22
        objs += gable_slabs(ridge, k, rh, t, y0, y1, NB['fasciaL'], NB['fasciaR'], NB['roofTop'], '#a83444')
        prof = {-1: [(0, .18), (.2, .22), (.35, .14), (.5, .22), (.65, .12), (.8, .06), (.92, -.02), (1, -.04)],
                1: [(0, .20), (.2, .30), (.4, .40), (.55, .36), (.7, .30), (.85, .28), (1, .22)]}
        inset = {-1: [(0, .02), (1, .03)], 1: [(0, .03), (.5, .06), (1, .05)]}
        objs += P.gable_moss(ridge, k, rh, y0, y1, prof, inset, NB['moss'], NB['mossEdge'], seed=5, thick=0.10,
                             lift=0.06, blades=7)
        key = 'notice_board_maps' if maps else 'notice_board'
        out.append((key, objs, {'footprint': [2.0, 0.4], 'blocksSight': False,
                                'note': 'posts on concrete blocks at x=+-0.79; roof 2.2 m wide'}))
    return out


# ============================================================ outhouse ======
OH = dict(wall='#75582e', plank='#6a4f29', line='#5a4223', jamb='#5d4426', lintel='#87623d', door='#b07e37',
          door2='#a8752f', moon='#47321f', roofL='#de4353', roofR='#f04557', fascia='#c43b4c')


def outhouse_parts(door_open=False):
    W, D, H = 1.38, 1.35, 2.25
    hw, hd = W / 2, D / 2
    yf = -hd
    objs = []
    shell = P.boxmm('Walls', -hw, hw, yf, hd, 0, H)
    P.paint(shell, M(OH['wall']), top=M(OH['wall'], TOP))
    objs.append(shell)
    # vertical plank seams on the front wall + gable
    for x in (-0.55, -0.41, 0.42, 0.56):
        objs.append(P.boxmm('Seam', x - 0.008, x + 0.008, yf - 0.006, yf, 0.0, H, M(OH['line'])))
    ridge, k, rh, t = 3.26, 1.0, 0.92, 0.22
    under = lambda z: (ridge - t - z) / k
    zc_ = ridge - t - hw * k
    gable = [(-hw, H), (hw, H), (hw, zc_), (0, ridge - t), (-hw, zc_)]
    objs.append(P.prism('Gable', gable, yf, yf + 0.1, M(OH['wall'])))
    for x in (-0.24, -0.08, 0.08, 0.24):
        top_z = ridge - t - abs(x) * k
        objs.append(P.boxmm('GSeam', x - 0.008, x + 0.008, yf - 0.006, yf, H - 0.1, top_z, M(OH['line'])))
    # door frame
    dx0, dx1, dz = -0.41, 0.39, 2.0
    for (x0, x1) in ((dx0 - 0.07, dx0), (dx1, dx1 + 0.07)):
        j = P.boxmm('Jamb', x0, x1, yf - 0.04, yf, 0, dz + 0.02)
        P.paint(j, M(OH['jamb']), top=M(OH['lintel'], TOP))
        objs.append(j)
    lin = P.boxmm('Lintel', dx0 - 0.09, dx1 + 0.09, yf - 0.06, yf, dz, dz + 0.13)
    P.paint(lin, M(OH['jamb']), top=M(OH['lintel'], TOP))
    objs.append(lin)
    door = []
    leaf = P.boxmm('Door', dx0, dx1, -0.04, 0.0, 0.0, dz)
    P.setm(leaf, M(OH['door']))
    door.append(leaf)
    # crescent moon cut-out
    cx, cz, r = -0.03, 1.40, 0.19
    moon = []
    for i in range(18):
        a = math.radians(60 + 250 * i / 17)
        moon.append((cx + math.cos(a) * r, cz + math.sin(a) * r * ST))
    for i in range(18):
        a = math.radians(290 - 210 * i / 17)
        moon.append((cx + 0.075 + math.cos(a) * r * 0.82, cz + 0.06 * ST + math.sin(a) * r * 0.82 * ST))
    door.append(P.prism('Moon', moon, -0.046, -0.04, M(OH['moon'])))
    door.append(P.boxmm('Knob', 0.27, 0.31, -0.07, -0.04, 0.95, 1.05, M('#47321f')))
    if door_open:
        P.rotate_objs(door, math.radians(120), pivot=(dx1, 0, 0))
        for o in door:
            o.location = (0, yf, 0)
            T.apply_transforms(o)
        objs.append(P.boxmm('DoorHole', dx0, dx1, yf - 0.002, yf + 0.3, 0, dz, M('#2a1e14')))
    else:
        for o in door:
            o.location = (0, yf - 0.002, 0)
            T.apply_transforms(o)
    objs += door
    y0, y1 = yf - 0.12, hd + 0.12
    for sx, col in ((-1, OH['roofL']), (1, OH['roofL'])):
        pts = [(0, ridge), (sx * rh, ridge - rh * k), (sx * rh, ridge - rh * k - t), (0, ridge - t)]
        if sx > 0:
            pts = pts[::-1]
        s = P.prism('Roof', pts, y0, y1)
        P.paint(s, M('#a83444', (sx, 0, 0)), front=M(OH['fascia']), top=M(OH['roofL'], (-0.7, 0, 0.7)),
                side=M('#a83444', (sx, 0, 0)))
        objs.append(s)
    return objs


def build_outhouse():
    meta = {'footprint': [1.4, 1.4], 'blocksSight': True, 'note': 'door on the -y face; player hides inside'}
    return [('outhouse', outhouse_parts(False), meta),
            ('outhouse_door_open', outhouse_parts(True), dict(meta, note='door swung open to the right'))]


# ========================================================= cache chest ======
def build_cache_chest():
    """Secret-cache chest: red box, lid with white ring + tree logo (i_0091 / t0093.3)."""
    W, D, H = 1.07, 0.55, 0.62
    objs = []
    body = P.boxmm('Chest', -W / 2, W / 2, -D / 2, D / 2, 0, H)
    P.paint(body, M('#b33946'), top=M('#f04356', TOP), side=M('#9e3340', (1, 0, 0)))
    objs.append(body)
    objs.append(P.boxmm('Panel', -W / 2 + 0.07, W / 2 - 0.07, -D / 2 - 0.012, -D / 2, 0.10, H - 0.16, M('#9e343e')))
    objs.append(P.boxmm('Strip', -W / 2 + 0.07, W / 2 - 0.07, -D / 2 - 0.014, -D / 2, 0.10, 0.13, M('#c34654')))
    lid = P.boxmm('Lid', -W / 2 - 0.01, W / 2 + 0.01, -D / 2 - 0.01, D / 2 + 0.01, H, H + 0.16)
    P.paint(lid, M('#bc3a4b'), top=M('#f04356', TOP))
    objs.append(lid)
    zt = H + 0.16
    objs.append(P.boxmm('Latch', -0.06, 0.06, -D / 2 - 0.035, -D / 2 - 0.01, H - 0.10, H + 0.06, M('#70716e')))
    for x in (-0.36, 0.36):
        objs.append(P.boxmm('Hinge', x - 0.07, x + 0.07, D / 2 - 0.02, D / 2 + 0.03, zt - 0.02, zt + 0.02,
                            M('#9a9a9a', TOP)))
    # logo on the lid top: white ring + tree
    ring_o = [(x, y + 0.02) for x, y in P.ellipse(0.24, 0.155, 28)]
    ring_i = [(x, y + 0.02) for x, y in P.ellipse(0.205, 0.125, 28)]
    ring = ring_o + [ring_o[0]] + [ring_i[0]] + ring_i[::-1]
    objs.append(P.slab('LogoRing', ring, zt, zt + 0.004, M('#e7e9e7', TOP)))
    tree = [(0.0, 0.14), (0.07, 0.075), (0.04, 0.075), (0.10, 0.0), (0.06, 0.0), (0.13, -0.07), (0.02, -0.07),
            (0.02, -0.11), (-0.02, -0.11), (-0.02, -0.07), (-0.13, -0.07), (-0.06, 0.0), (-0.10, 0.0), (-0.04, 0.075),
            (-0.07, 0.075)]
    objs.append(P.slab('LogoTree', [(x, y * 0.95 + 0.02) for x, y in tree], zt, zt + 0.005, M('#e7e9e7', TOP)))
    return [('cache_chest', objs, {'footprint': [1.1, 0.6], 'blocksSight': False})]


# ============================================================ signpost ======
def arrow_v(up=True, L=0.30, Wd=0.24, t=0.05, head=0.12):
    """Vertical chevron arrow outlines (screen units) centred at 0."""
    s = 1 if up else -1
    shaft = [(-t / 2, -L / 2 * s), (t / 2, -L / 2 * s), (t / 2, (L / 2 - t * 0.9) * s), (-t / 2, (L / 2 - t * 0.9) * s)]
    hd = [(0, L / 2 * s), (Wd / 2, (L / 2 - head) * s), (Wd / 2, (L / 2 - head - t * 1.1) * s), (0, (L / 2 - t * 1.25) * s),
          (-Wd / 2, (L / 2 - head - t * 1.1) * s), (-Wd / 2, (L / 2 - head) * s)]
    if not up:
        shaft, hd = shaft[::-1], hd[::-1]
    return [shaft, hd]


def build_signpost():
    """Two-board signpost "RV Park ^ / Lake v" (t0250.0); also a blank version."""
    out = []
    for text in (True, False):
        objs = []
        for x in (-1.25, 1.25):
            p_ = P.boxmm('Post', x - 0.10, x + 0.10, 0.0, 0.20, 0, 3.79)
            P.paint(p_, M('#75582e'), top=M('#a06e3b', TOP))
            objs.append(p_)
        for zc, label, up in ((3.11, 'RV Park', True), (1.84, 'Lake', False)):
            b = P.boxmm('Board', -1.59, 1.59, -0.12, 0.0, zc - 0.515, zc + 0.515)
            P.paint(b, M('#97702d'), top=M('#b28235', TOP), side=M('#8a6229', (1, 0, 0)))
            objs.append(b)
            if text:
                objs.append(P.text_mesh('SignText', label, size=0.43, depth=0.01, align='LEFT', valign='BOTTOM',
                                        stretch_z=ST, loc=(-1.36, -0.12, zc - 0.26), m=M('#e5e3e1'), spacing=1.04))
                for i, ap in enumerate(arrow_v(up)):
                    objs.append(P.prism('Arrow', [(1.22 + x, zc - 0.03 + z * ST) for x, z in ap], -0.132, -0.12,
                                        M('#e5e3e1')))
        key = 'signpost_rv_lake' if text else 'signpost_blank'
        out.append((key, objs, {'footprint': [2.7, 0.3], 'blocksSight': False,
                                'boards': [{'centre_m': [0, -0.12, 3.19], 'w': 3.18, 'h': 1.03},
                                           {'centre_m': [0, -0.12, 1.91], 'w': 3.18, 'h': 1.03}]}))
    return out


# ======================================================== warning sign ======
def build_warning_sign():
    """Yellow triangular warning sign with '!' on a grey post (i_0409)."""
    objs = []
    p_ = P.boxmm('Post', -0.09, 0.09, -0.09, 0.09, 0, 3.2)
    P.paint(p_, M('#565758'), top=M('#5f5d5b', TOP), side=M('#434344', (1, 0, 0)))
    objs.append(p_)
    # plate drawn to the measured screen outline (i_0409): an edge runs down the post, the corner points right
    tri = [(0.075, 3.32), (-0.25, 1.45), (0.40, 2.26)]
    cxz = (sum(p[0] for p in tri) / 3, sum(p[1] for p in tri) / 3)
    sc = lambda f: [(cxz[0] + (x - cxz[0]) * f, cxz[1] + (z - cxz[1]) * f) for x, z in tri]
    objs.append(P.prism('Border', sc(1.0)[::-1], -0.15, -0.10, M('#3a3a3a')))
    objs.append(P.prism('Yellow', sc(0.78)[::-1], -0.16, -0.15, M('#c1b338')))
    a = math.radians(12)
    rot = lambda px, pz: (cxz[0] + 0.03 + px * math.cos(a) + pz * math.sin(a) / ST, cxz[1] + 0.05 + (-px * math.sin(a) * ST + pz * math.cos(a)))
    ex = [(-0.035, 0.30), (0.035, 0.30), (0.02, -0.02), (-0.02, -0.02)]
    objs.append(P.prism('Mark', [rot(x, z) for x, z in ex], -0.17, -0.16, M('#2e2a2a')))
    objs.append(P.prism('Dot', [rot(x, z) for x, z in P.ellipse(0.032, 0.05, 8, 0, -0.10)], -0.17, -0.16, M('#2e2a2a')))
    return [('warning_sign', objs, {'footprint': [0.25, 0.25], 'blocksSight': False})]


# =============================================================== fence ======
def fence_post(x):
    p_ = P.cyl('FPost', 0.13, 1.42, 10, (x, 0, 0))
    P.paint(p_, M('#75582e', FRONT, 0.10), top=M('#a06e3b', TOP))
    return p_


def build_fence():
    """Rail fence (outside o01). `fence` is one tileable 2.13 m bay: post at x=-L/2, rails across;
    place bays end to end along x and cap the run with `fence_post`."""
    L = 2.13
    objs = [fence_post(-L / 2)]
    for z0, z1 in ((0.0, 0.20), (0.40, 0.61), (0.84, 1.06)):
        r = P.boxmm('Rail', -L / 2, L / 2, 0.02, 0.09, z0, z1)
        P.paint(r, M('#75582e'), top=M('#a16e3b', TOP))
        objs.append(r)
    return [('fence', objs, {'footprint': [2.13, 0.2], 'blocksSight': False, 'tile_x': 2.13}),
            ('fence_post', [fence_post(0)], {'footprint': [0.26, 0.26], 'blocksSight': False})]


BUILDERS = {
    'notice_board': build_notice_board,
    'outhouse': build_outhouse,
    'cache_chest': build_cache_chest,
    'signpost': build_signpost,
    'warning_sign': build_warning_sign,
    'fence': build_fence,
}

if __name__ == '__main__':
    P.run(BUILDERS)
