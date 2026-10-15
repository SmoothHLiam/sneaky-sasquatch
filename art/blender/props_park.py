"""
Park / RV-park / station-yard props: payphone, power pole (+ LOST DOG poster), fire hydrant, white car,
boombox + its stand, "Exit ->" sign, cliff chunks + cave mouth, and the teal RV cut-away interior
(+ front wall layer, open door, Duck Hat item).

  Blender -b --factory-startup -P art/blender/props_park.py -- [group ...]
Groups: payphone power_pole hydrant car boombox sign_exit cliff cave rv_interior duck_hat

Refs (more inside park.mov, zoom 1.0 unless noted): payphone + hydrant f_450.5 (t0431 close-up),
power pole / poster / Exit sign f_827 (t0825 close-up), car f_658, boombox t0288 + f_293.5,
cliff + cave f_370 (t0380), RV interior f_299.5 / f_300.6 (zoom 1.4) / t0303 (zoom 1.96).
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
import props_extra as PX
importlib.reload(T); importlib.reload(P); importlib.reload(PX)

FRONT, TOP = P.FRONT, P.TOP
M = lambda h, n=FRONT, sh=T.SHADE: P.mat(h, n, sh)
ST = 1 / P.COS
LEFTN, RIGHTN = (-1, 0, 0), (1, 0, 0)


def boxp(name, x0, x1, y0, y1, z0, z1, front, top=None, side=None, left=None, back=None):
    o = P.boxmm(name, x0, x1, y0, y1, z0, z1)
    P.paint(o, M(front), top=M(top or front, TOP), side=M(side or front, RIGHTN),
            left=M(left or side or front, LEFTN), back=M(back or front, (0, 1, 0)))
    return o


def cylp(name, r, h, segs, loc, side, top, axis='Z', r2=None, rz=None, sh=0.12):
    o = P.cyl(name, r, h, segs, loc, axis=axis, r2=r2, rz=rz)
    P.paint(o, M(side, FRONT, sh), top=M(top, TOP), top_thresh=0.5)
    return o


def shift(objs, dx=0.0, dy=0.0, dz=0.0):
    for o in objs:
        o.location = (dx, dy, dz)
        T.apply_transforms(o)
    return objs


def top_round_rect(w, h, r, segs=4, cx=0.0, z0=0.0):
    pts = [(cx - w / 2, z0), (cx + w / 2, z0)]
    for i in range(segs + 1):
        a = math.radians(90 * i / segs)
        pts.append((cx + w / 2 - r + r * math.cos(a), z0 + h - r + r * math.sin(a)))
    for i in range(segs + 1):
        a = math.radians(90 + 90 * i / segs)
        pts.append((cx - w / 2 + r + r * math.cos(a), z0 + h - r + r * math.sin(a)))
    return pts


def text_fit(name, s, w, h, cx, y, cz, col, bold=0.004, align='CENTER'):
    """Bree Serif text scaled to a w x h (screen-true, i.e. h already x1/cos52) box centred at (cx, cz)."""
    t = P.text_mesh(name, s, size=0.4, depth=0.01, bold=bold, stretch_z=ST, loc=(0, 0, 0), m=M(col))
    (a, b), _, (c, d) = P.bounds([t])
    P.xform(t, scale=(w / (b - a), 1, h / (d - c)))
    (a, b), _, (c, d) = P.bounds([t])
    P.xform(t, loc=(cx - (a + b) / 2, y, cz - (c + d) / 2))
    return t


# ================================================================ payphone ===
def build_payphone():
    """Blue-hooded payphone on a post, on a grey concrete slab with a tan path border (f_450.5)."""
    o = []
    SW, SD, SH = 2.05, 1.18, 0.12
    o.append(P.boxmm('Border', -SW / 2 - 0.18, SW / 2 + 0.18, -SD / 2 - 0.18, SD / 2 + 0.18, 0.0, 0.01, M('#d09342', TOP)))
    o.append(P.boxmm('BorderIn', -SW / 2 - 0.10, SW / 2 + 0.10, -SD / 2 - 0.10, SD / 2 + 0.10, 0.01, 0.012, M('#c58948', TOP)))
    o.append(boxp('Slab', -SW / 2, SW / 2, -SD / 2, SD / 2, 0, SH, '#615e5f', '#736e70', '#5a5758'))
    # U-shaped foot plate + post
    zp = SH
    o.append(boxp('Plate', -0.27, 0.27, -0.15, 0.15, zp, zp + 0.05, '#888888', '#a0a09c'))
    o.append(boxp('PlateIn', -0.17, 0.17, -0.13, 0.15, zp + 0.05, zp + 0.052, '#736e70', '#736e70'))
    o.append(boxp('Post', -0.06, 0.06, -0.05, 0.07, zp, 0.92, '#666666', '#777777', '#555555'))
    # hood: open-front box, rounded top corners
    HW, HD, z0, z1 = 0.74, 0.34, 0.88, 2.55
    yf, yb = -HD / 2, HD / 2
    shell_o = top_round_rect(HW, z1 - z0, 0.12, 4, 0, z0)
    shell_i = top_round_rect(HW - 0.12, z1 - z0 - 0.10, 0.07, 4, 0, z0 + 0.04)
    back = P.prism('HoodBack', shell_o, yb - 0.04, yb)
    P.paint(back, M('#316c88'), top=M('#489bd8', TOP), top_thresh=0.4)
    o.append(back)
    # side walls + roof (outer ring minus inner), extruded over the depth
    sides = P.prism('HoodRing', [(x, z) for x, z in shell_o], yf, yb - 0.04)
    # carve: simply place the inner panel slightly behind the front face to read as an open booth
    P.paint(sides, M('#316c88'), top=M('#489bd8', TOP), side=M('#2c6079', RIGHTN), top_thresh=0.4)
    o.append(sides)
    inner = P.prism('HoodIn', shell_i, yf - 0.004, yf)
    P.setm(inner, M('#3e7ea9'))
    o.append(inner)
    yi = yf - 0.006
    o.append(P.boxmm('Lip', -HW / 2, HW / 2, yf - 0.01, yf, z0, z0 + 0.10, M('#3e7ea9')))
    o.append(P.boxmm('Header', -HW / 2 + 0.04, HW / 2 - 0.04, yi - 0.01, yi, 2.17, 2.46, M('#c7c7c7')))
    o.append(text_fit('PhoneTxt', 'Phone', 0.46, 0.21, 0, yi - 0.012, 2.315, '#2f6f9a', bold=0.006))
    # phone body + keypad + display + handset
    o.append(P.boxmm('Phone', -0.21, 0.21, yi - 0.06, yi, 1.20, 2.14, M('#868686')))
    o.append(P.boxmm('Display', 0.00, 0.17, yi - 0.07, yi - 0.06, 1.86, 1.95, M('#3f3f3f')))
    for r_ in range(4):
        for c_ in range(3):
            x = 0.03 + c_ * 0.055
            z = 1.76 - r_ * 0.085
            o.append(P.boxmm('Key', x - 0.02, x + 0.02, yi - 0.075, yi - 0.06, z - 0.03, z + 0.03, M('#bdbdbd')))
    o.append(P.boxmm('CoinSlot', -0.17, -0.07, yi - 0.07, yi - 0.06, 1.93, 1.99, M('#4f8fc8')))
    o.append(P.boxmm('Hook', -0.17, -0.10, yi - 0.09, yi - 0.06, 1.78, 1.88, M('#bdbdbd')))
    hs = [Vector((-0.13, yi - 0.10, 1.84)), Vector((-0.16, yi - 0.10, 1.62)), Vector((-0.12, yi - 0.10, 1.36))]
    for a, b in zip(hs, hs[1:]):
        o.append(P.tube('Handset', a, b, 0.045, 8, M('#2b2b2b')))
    for p in (hs[0], hs[-1]):
        ear = T.ico('HandsetEnd', 0.065, 1, loc=tuple(p))
        P.setm(ear, M('#2b2b2b'))
        o.append(ear)
    cord = [Vector((-0.12, yi - 0.09, 1.36)), Vector((-0.24, yi - 0.08, 1.28)), Vector((-0.26, yi - 0.07, 1.62)),
            Vector((-0.24, yi - 0.07, 1.95))]
    for a, b in zip(cord, cord[1:]):
        o.append(P.tube('Cord', a, b, 0.012, 5, M('#8ea8bb')))
    return [('payphone', o, {'footprint': [0.8, 0.4], 'blocksSight': False, 'height': 2.55,
                             'slab': {'w': SW, 'd': SD, 'h': SH, 'note': 'walkable step; tan border 0.18 m is a decal'},
                             'use_spot_m': [0, -0.8], 'note': 'booth centred on the slab; player stands south of it'})]


# ============================================================== power pole ===
POLE = dict(r=0.23, h=8.41, arm_x=(-0.46, -0.23), arm_y=(-1.22, 0.86), arm_z=(7.90, 8.26), ins_y=(0.48, -0.99))


def pole_parts():
    o = []
    r, h = POLE['r'], POLE['h']
    o.append(cylp('Pole', r, h, 16, (0, 0, 0), '#594523', '#835e2e', sh=0.10))
    (ax0, ax1), (ay0, ay1), (az0, az1) = POLE['arm_x'], POLE['arm_y'], POLE['arm_z']
    o.append(boxp('Arm', ax0, ax1, ay0, ay1, az0, az1, '#48381c', '#71522a', '#4f3c20'))
    for i, yi in enumerate(POLE['ins_y']):
        xc = (ax0 + ax1) / 2
        o.append(P.cyl('InsNeck', 0.035, 0.08, 10, (xc, yi, az1), m=M('#313030')))
        cap = P.cyl('InsCap', 0.11, 0.13, 14, (xc, yi, az1 + 0.08), r2=0.10)
        P.paint(cap, M('#b6b6b6', FRONT, 0.10), top=M('#e3e3e3', TOP), top_thresh=0.5)
        o.append(cap)
        dome = T.ico('InsDome', 0.10, 2, scale=(1, 1, 0.55), loc=(xc, yi, az1 + 0.21))
        P.paint(dome, M('#d6d6d6'), top=M('#e3e3e3', TOP), top_thresh=0.3)
        o.append(dome)
    return o


def poster_parts(zc=1.365, r=None):
    """LOST DOG poster wrapped on the pole's front (t0825 / f_827): 0.41 m wide, z 0.85..1.88."""
    r = (r or POLE['r']) + 0.008
    o = []
    hw = 0.205
    z0, z1 = zc - 0.515, zc + 0.515

    def wrap(name, u0, u1, za, zb, col, dr=0.0, segs=8):
        rr = r + dr
        bm = bmesh.new()
        vs_o, vs_i = [], []
        for i in range(segs + 1):
            a = (u0 + (u1 - u0) * i / segs) / rr
            vs_o.append((bm.verts.new((rr * math.sin(a), -rr * math.cos(a), za)), bm.verts.new((rr * math.sin(a), -rr * math.cos(a), zb))))
        for (a0, b0), (a1, b1) in zip(vs_o, vs_o[1:]):
            bm.faces.new((a0, a1, b1, b0))
        ob = P.bm_obj(name, bm, recalc=False)      # winding gives outward (-y-ish) normals
        P.setm(ob, M(col))
        return ob

    o.append(wrap('Sheet', -hw, hw, z0, z1, '#eae9e5', 0.0, 10))
    o.append(wrap('Title', -hw + 0.04, hw - 0.04, z1 - 0.20, z1 - 0.11, '#db4447', 0.004, 8))
    o.append(wrap('Photo', -hw + 0.05, hw - 0.05, z0 + 0.36, z1 - 0.24, '#c4c3c3', 0.004, 8))
    for i in range(3):
        zz = z0 + 0.10 + i * 0.085
        o.append(wrap('Line', -hw + 0.05, hw - 0.05, zz, zz + 0.035, '#444444', 0.004, 8))
    # dog face (Boston terrier): black head with white blaze/muzzle, ears
    rr = r + 0.008
    zf = (z0 + 0.36 + z1 - 0.24) / 2

    def flat(name, pts, col, d=0.0):
        ob = P.prism(name, pts, -rr - d - 0.004, -rr - d + 0.002, M(col))
        return ob
    head = [(-0.07, zf + 0.11), (-0.035, zf + 0.06), (0.035, zf + 0.06), (0.07, zf + 0.11), (0.075, zf - 0.03),
            (0.05, zf - 0.13), (-0.05, zf - 0.13), (-0.075, zf - 0.03)]
    o.append(flat('DogHead', head, '#272524'))
    blaze = [(-0.015, zf + 0.05), (0.015, zf + 0.05), (0.035, zf - 0.06), (0.045, zf - 0.12), (-0.045, zf - 0.12),
             (-0.035, zf - 0.06)]
    o.append(flat('DogBlaze', blaze, '#e1d6d6', 0.003))
    o.append(flat('DogNose', P.ellipse(0.018, 0.016, 8, 0, zf - 0.06), '#272524', 0.006))
    return o


def build_power_pole():
    meta = {'footprint': [0.5, 0.5], 'blocksSight': False, 'height': 8.6,
            'wires_m': [[round((POLE['arm_x'][0] + POLE['arm_x'][1]) / 2, 3), y, 8.57] for y in POLE['ins_y']],
            'note': 'cross-arm runs N-S on the pole west side; wires_m = insulator tops [x, y, z] from the anchor '
                    '(screen offset px = (x*200, -(y*0.788 + z*0.616)*200))'}
    out = [('power_pole', pole_parts(), meta),
           ('power_pole_poster', pole_parts() + poster_parts(), dict(meta, poster={'z0': 0.85, 'z1': 1.88}))]
    return out


def build_poster():
    return [('lost_dog_poster', poster_parts(), {'footprint': [0.0, 0.0], 'blocksSight': False, 'decal': True,
                                                 'z0': 0.85, 'z1': 1.88, 'sortY': -0.25,
                                                 'note': 'origin = power-pole axis on the ground; draw just in front of power_pole'})]


# ============================================================ fire hydrant ===
def build_hydrant():
    """Red fire hydrant 1.09 m (f_450.5): base flange, body, mid rim, side nozzles, cap + dome."""
    o = []
    red, redT, redL = '#913334', '#b33f3f', '#c74746'
    o.append(cylp('Base', 0.20, 0.10, 16, (0, 0, 0), red, redT))
    o.append(cylp('Body', 0.155, 0.85, 16, (0, 0, 0.10), red, redT))
    o.append(cylp('Rim', 0.18, 0.07, 16, (0, 0, 0.66), red, redT))
    o.append(cylp('Cap', 0.17, 0.10, 16, (0, 0, 0.95), '#983534', redT))
    dome = T.ico('Dome', 0.15, 2, scale=(1, 1, 0.9), loc=(0, 0, 1.05))
    for v in dome.data.vertices:
        if v.co.z < 1.05:
            v.co.z = 1.05
    P.paint(dome, M('#983534'), top=M(redL, TOP), top_thresh=0.45)
    o.append(dome)
    o.append(cylp('Nut', 0.045, 0.08, 6, (0, 0, 1.26), '#983534', redL))
    for sx in (-1, 1):
        n = P.cyl('Nozzle', 0.075, 0.10, 12, (0, 0, 0), axis='X')
        P.xform(n, loc=(sx * 0.15 if sx > 0 else -0.25, 0, 0.84))
        P.paint(n, M(red), top=M(redT, TOP), side=M(redT, RIGHTN), left=M(redT, LEFTN))
        o.append(n)
    fn = P.cyl('FrontNozzle', 0.07, 0.08, 12, (0, -0.15, 0.52), axis='-Y')
    P.paint(fn, M(redT), top=M(redT, TOP))
    o.append(fn)
    for ob in o:        # measured top is 1.09 m once the 0.2 m base radius is accounted for
        P.xform(ob, scale=(1, 1, 0.81))
    return [('fire_hydrant', o, {'footprint': [0.4, 0.4], 'blocksSight': False, 'height': 1.09})]


# =============================================================== white car ===
def build_car():
    """White 3-box sedan facing east (parking lot f_658, zoom 1.0): 3.1 x 1.1 m footprint, hood 0.94, roof 1.64.
    (Screen-true like everything else: the stills show deep hood/roof top faces and a tall glasshouse.)"""
    o = []
    L, W = 3.0, 1.10
    hl, hw = L / 2, W / 2
    white, side, bump, glass, olive = '#e8e8e8', '#c0c0c0', '#787878', '#9fb8b5', '#b6b492'
    prof = [(-hl, 0.30), (-hl + 0.05, 0.26), (hl - 0.06, 0.26), (hl, 0.30), (hl, 0.88), (hl - 0.06, 0.94),
            (-hl + 0.06, 0.94), (-hl, 0.88)]
    body = P.prism('Body', prof, -hw, hw)
    P.paint(body, M(side), top=M(white, TOP), side=M('#b5b5b5', RIGHTN), left=M('#b0b0b0', LEFTN), top_thresh=0.5)
    o.append(body)
    o.append(P.boxmm('BumperF', hl - 0.10, hl + 0.06, -hw - 0.02, hw, 0.26, 0.49, M(bump)))
    o.append(P.boxmm('BumperR', -hl - 0.06, -hl + 0.10, -hw - 0.02, hw, 0.26, 0.49, M(bump)))
    o.append(P.boxmm('Sill', -0.95, 0.75, -hw - 0.01, -hw, 0.26, 0.34, M('#a9a9a9')))
    o.append(P.boxmm('DoorLine', -0.13, -0.11, -hw - 0.012, -hw, 0.34, 0.94, M('#a3a3a3')))
    for x in (-0.66, 0.10):
        o.append(P.boxmm('Handle', x - 0.08, x + 0.08, -hw - 0.025, -hw, 0.74, 0.78, M('#666666')))
    # glasshouse: belt 0.94..1.09 trim, windows to 1.56, roof 1.64; windshield + rear window sloped
    cab = [(-1.08, 0.94), (0.66, 0.94), (0.28, 1.64), (-0.80, 1.64)]
    c = P.prism('Cabin', cab, -hw + 0.02, hw - 0.02)
    P.paint(c, M(glass), top=M(white, TOP), side=M(olive, (0.8, 0, 0.6)), left=M(olive, (-0.8, 0, 0.6)), top_thresh=0.5)
    o.append(c)
    o.append(P.boxmm('Belt', -1.05, 0.62, -hw + 0.008, -hw + 0.02, 0.94, 1.09, M('#bfc0c0')))
    o.append(P.boxmm('RoofTrim', -0.80, 0.28, -hw + 0.008, -hw + 0.02, 1.56, 1.64, M('#c0c0c0')))
    for (x0, x1) in ((-0.84, -0.76), (-0.25, -0.18), (0.22, 0.30)):
        o.append(P.boxmm('Pillar', x0, x1, -hw + 0.006, -hw + 0.02, 1.09, 1.58, M('#e7e8e8')))
    for x in (-0.99, 0.76):
        t = P.cyl('Tire', 0.30, 0.22, 16, (x, -hw - 0.02, 0.30), axis='Y')
        P.paint(t, M('#444444'), top=M('#3a3a3a', TOP))
        o.append(t)
        o.append(P.cyl('Hub', 0.18, 0.02, 14, (x, -hw - 0.03, 0.30), axis='Y', m=M('#5a5a5a')))
        o.append(P.cyl('HubC', 0.09, 0.02, 12, (x, -hw - 0.04, 0.30), axis='Y', m=M('#7a7a7a')))
    o.append(P.boxmm('Tail', -hl - 0.03, -hl + 0.02, -hw + 0.02, -hw + 0.24, 0.55, 0.80, M('#c94444')))
    o.append(P.boxmm('TailLo', -hl - 0.07, -hl + 0.06, -hw - 0.03, -hw + 0.10, 0.30, 0.37, M('#e8962e')))
    o.append(P.boxmm('Head', hl - 0.02, hl + 0.03, -hw + 0.02, -hw + 0.24, 0.55, 0.78, M('#e9f6f8')))
    o.append(P.boxmm('Indic', hl - 0.06, hl + 0.07, -hw - 0.03, -hw + 0.06, 0.30, 0.44, M('#f0a020')))
    return [('car_white', o, {'footprint': [3.1, 1.15], 'blocksSight': True, 'height': 1.64,
                              'note': 'parked facing east (front at +x)'})]


# ================================================================ boombox ===
def boombox_parts(z=0.0):
    o = []
    W, D, H = 0.41, 0.14, 0.34
    yf = -D / 2
    body = P.prism('Radio', top_round_rect(W, H, 0.07, 4, 0, z), yf, D / 2)
    P.paint(body, M('#ca4849'), top=M('#fe5656', TOP), side=M('#b23f40', RIGHTN), top_thresh=0.4)
    o.append(body)
    o.append(P.boxmm('Dial', -0.17, 0.0, yf - 0.01, yf, z + 0.20, z + 0.26, M('#c7c6c5')))
    o.append(P.boxmm('Needle', -0.12, -0.105, yf - 0.014, yf - 0.01, z + 0.195, z + 0.265, M('#d89c00')))
    for x in (-0.135, -0.05):
        o.append(P.cyl('Knob', 0.035, 0.03, 12, (x, yf, z + 0.10), axis='-Y', m=M('#d89c00')))
        o.append(P.cyl('KnobTop', 0.028, 0.032, 12, (x, yf, z + 0.11), axis='-Y', m=M('#fdc324')))
    o.append(P.cyl('Speaker', 0.085, 0.012, 18, (0.09, yf, z + 0.155), axis='-Y', rz=0.095 * 1.0, m=M('#9a3438')))
    o.append(P.cyl('SpeakerIn', 0.065, 0.016, 18, (0.09, yf, z + 0.155), axis='-Y', m=M('#8a2f33')))
    o.append(P.tube('Antenna', Vector((-0.15, 0.0, z + H - 0.03)), Vector((0.20, 0.02, z + H + 0.30)), 0.012, 6, M('#eae9ea')))
    return o


def build_boombox():
    """Red boombox (t0288) and the small wooden stand it sits on at RV site D (f_293.5)."""
    stand = []
    SW, SD, SH = 0.67, 0.66, 0.77
    stand.append(boxp('Top', -SW / 2, SW / 2, -SD / 2, SD / 2, SH - 0.11, SH, '#bb9256', '#edc775', '#a8834c'))
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * (SW / 2 - 0.13), sy * (SD / 2 - 0.12)
            stand.append(boxp('Leg', x - 0.05, x + 0.05, y - 0.05, y + 0.05, 0, SH - 0.11, '#bb9256', '#c9a065', '#a8834c'))
    radio = boombox_parts(0.0)
    radio_on = boombox_parts(SH)
    shift(radio_on, 0.0, 0.06)
    return [('boombox', radio, {'footprint': [0.41, 0.14], 'blocksSight': False, 'height': 0.64,
                                'note': 'radio alone; sits on boombox_post at restZ 0.77 (y offset +0.06)'}),
            ('boombox_post', stand, {'footprint': [0.67, 0.66], 'blocksSight': False, 'topZ': SH}),
            ('boombox_on_post', stand + radio_on, {'footprint': [0.67, 0.66], 'blocksSight': False,
                                                   'note': 'stand + radio combined (site D)'})]


# =============================================================== Exit sign ===
def arrow_parts(L=0.30, H=0.24, t=0.05, head=0.12):
    shaft = [(-L / 2, -t / 2), (L / 2 - t * 0.9, -t / 2), (L / 2 - t * 0.9, t / 2), (-L / 2, t / 2)]
    hd = [(L / 2, 0), (L / 2 - head, H / 2), (L / 2 - head - t * 1.1, H / 2), (L / 2 - t * 1.25, 0),
          (L / 2 - head - t * 1.1, -H / 2), (L / 2 - head, -H / 2)]
    return [shaft, hd[::-1]]


def build_sign_exit():
    """Level "Exit ->" board on two posts by the station parking lot (f_827)."""
    o = []
    for x in (-1.245, 1.245):
        o.append(boxp('Post', x - 0.10, x + 0.10, 0.0, 0.20, 0, 3.31, '#624727', '#85582e'))
    bz0, bz1 = 1.97, 3.00
    o.append(boxp('Board', -1.59, 1.59, -0.12, 0.0, bz0, bz1, '#805e28', '#996e2f', '#74551f'))
    zc = (bz0 + bz1) / 2
    t = P.text_mesh('ExitText', 'Exit', size=0.43, depth=0.01, align='LEFT', valign='CENTER', stretch_z=ST,
                    loc=(-1.37, -0.12, zc), m=M('#c2c0bf'), spacing=1.04)
    o.append(t)
    for i, ap in enumerate(arrow_parts(0.30, 0.26, 0.055, 0.13)):
        o.append(P.prism('Arrow%d' % i, [(1.23 + x, zc + z * ST) for x, z in ap], -0.132, -0.12, M('#c2c0bf')))
    return [('sign_exit', o, {'footprint': [2.7, 0.3], 'blocksSight': False, 'height': 3.31,
                              'board': {'centre_m': [0, -0.12, round(zc, 3)], 'w': 3.18, 'h': 1.03}})]


# ==================================================================== cliff ===
CL = dict(top='#857e7e', f1='#6d6869', f2='#666162', f3='#615e5f', side='#5a5657', sideL='#6e696a', black='#0f0f0f',
          floor='#6d4b28', floorD='#422f21', dirt='#946734')


def rock_block(name, pts, yf, ch, back, rnd, fronts):
    """Angular rock block: XZ polygon lofted from a chamfered front (top edge pulled back by ch -> light
    facet) to the back plane."""
    zs = [z for _, z in pts]
    zc = (min(zs) + max(zs)) / 2
    xc = sum(x for x, _ in pts) / len(pts)
    front = [(x + (xc - x) * 0.08, yf, z - (ch if z > zc else 0.0)) for x, z in pts]
    mid = [(x, yf + ch * 0.9, z) for x, z in pts]
    rear = [(x, back, z) for x, z in pts]
    o = P.loft(name, [front, mid, rear])
    P.paint(o, M(rnd.choice(fronts)), top=M(CL['top'], (0, -0.5, 0.85)), side=M(CL['side'], RIGHTN),
            left=M(CL['sideL'], LEFTN), top_thresh=0.35)
    rz = math.radians(rnd.uniform(-16, 16))
    P.rotate_objs([o], rz, pivot=(xc, yf, 0))
    return o


def cliff_parts(seed, W=6.0, H=7.2, gap=None):
    """Tileable cliff chunk along x in [-W/2, W/2] (f_370): columns of stacked angular blocks whose
    chamfered tops read as the light facets, a plateau slab behind, boulders at the foot.
    gap=(x0, x1, zt) leaves an arched opening (cave)."""
    rnd = random.Random(seed)
    o = []
    fronts = [CL['f1'], CL['f2'], CL['f3'], CL['f1'], CL['sideL']]
    if gap:
        o.append(boxp('PlateauL', -W / 2, gap[0], 0.3, 2.5, 0, H - 0.4, CL['f3'], CL['top'], CL['side']))
        o.append(boxp('PlateauR', gap[1], W / 2, 0.3, 2.5, 0, H - 0.4, CL['f3'], CL['top'], CL['side']))
        o.append(boxp('PlateauM', gap[0], gap[1], 0.3, 2.5, gap[2], H - 0.4, CL['f3'], CL['top'], CL['side']))
    else:
        o.append(boxp('Plateau', -W / 2, W / 2, 0.3, 2.5, 0, H - 0.4, CL['f3'], CL['top'], CL['side']))
    x = -W / 2
    while x < W / 2 - 0.05:
        w = min(rnd.uniform(0.75, 1.5), W / 2 - x)
        if W / 2 - x - w < 0.3:
            w = W / 2 - x
        x0, x1 = x, x + w
        x = x1
        if gap and x1 > gap[0] and x0 < gap[1]:
            segs = []
            if x0 < gap[0]:
                segs.append((x0, gap[0], 0.0))
            if x1 > gap[1]:
                segs.append((gap[1], x1, 0.0))
            ga, gb = max(x0, gap[0]), min(x1, gap[1])
            u = abs((ga + gb) / 2 - (gap[0] + gap[1]) / 2) / ((gap[1] - gap[0]) / 2)
            segs.append((ga, gb, gap[2] - 0.9 * u * u + rnd.uniform(-0.15, 0.15)))
        else:
            segs = [(x0, x1, 0.0)]
        for (a, b, zb) in segs:
            if b - a < 0.05:
                continue
            htop = H - rnd.uniform(0.0, 1.2)
            n = rnd.randint(3, 5)
            cuts = sorted(rnd.uniform(zb + 0.8, htop - 0.8) for _ in range(n - 1)) if htop - zb > 2.0 else []
            levels = [zb] + cuts + [htop]
            yf = -rnd.uniform(0.35, 0.8)
            for i, (z0, z1) in enumerate(zip(levels, levels[1:])):
                tl, tr = z1 - rnd.uniform(0, 0.8), z1 - rnd.uniform(0, 0.8)
                mid = a + (b - a) * rnd.uniform(0.25, 0.75)
                jx = rnd.uniform(-0.15, 0.15) if zb == 0.0 or i > 0 else 0.0
                aa, bb = (a + jx, b + jx) if not gap else (a, b)
                pts = [(aa, z0), (bb, z0), (bb, tr), (mid + jx, z1), (aa, tl)]
                ch = rnd.uniform(0.35, 0.85)
                o.append(rock_block('Block', pts, yf, ch, 0.9, rnd, fronts))
                yf = min(0.2, yf + rnd.uniform(0.0, 0.40))
    for i in range(rnd.randint(2, 4)):
        bx = rnd.uniform(-W / 2 + 0.4, W / 2 - 0.4)
        if gap and gap[0] - 0.5 < bx < gap[1] + 0.5:
            continue
        rk = P.rock('Boulder', (rnd.uniform(0.6, 1.1), rnd.uniform(0.5, 0.8), rnd.uniform(0.4, 0.8)), seed=rnd.randint(0, 999),
                    subdiv=1, jag=0.3, loc=(bx, -0.95 - rnd.uniform(0, 0.25), 0))
        P.paint(rk, M(CL['f1']), top=M(CL['top'], TOP), top_thresh=0.5)
        o.append(rk)
    return o


def build_cliff():
    out = []
    for key, seed in (('cliff_rocks_a', 21), ('cliff_rocks_b', 37)):
        out.append((key, cliff_parts(seed), {'footprint': [6.0, 1.4], 'blocksSight': True, 'tile_x': 6.0, 'height': 7.2,
                                             'note': 'tile chunks along x every 6 m; collision band y -0.8..0.6'}))
    return out


def build_cave():
    """Cave mouth (f_370): cliff chunk with a ~2.3 m wide, ~3.6 m tall dark opening and the cave floor inside."""
    gap = (-1.15, 1.15, 3.5)
    o = cliff_parts(53, gap=gap)
    # recess: brown floor fading into the dark, black back wall
    gx0, gx1, gz = gap
    o.append(P.prism('Dark', [(gx0, 0.0), (gx1, 0.0), (gx1, gz + 0.5), (gx0, gz + 0.5)], 0.75, 2.5, M(CL['black'])))
    o.append(P.slab('CaveFloor', [(gx0, -0.9), (gx1, -0.9), (gx1, 0.0), (gx0, 0.0)], 0.0, 0.03, M(CL['floor'], TOP)))
    o.append(P.slab('CaveFloorD', [(gx0, 0.0), (gx1, 0.0), (gx1, 0.75), (gx0, 0.75)], 0.0, 0.03, M(CL['floorD'], TOP)))
    return [('cave_mouth', o, {'footprint': [6.0, 1.4], 'blocksSight': True, 'tile_x': 6.0, 'height': 7.2,
                               'entrance': {'x0': gap[0], 'x1': gap[1], 'y': -0.6},
                               'note': 'walk-in trigger at the opening; colliders = the two cliff parts either side'})]


# ========================================================== teal RV interior ===
RVI = dict(L=8.3, D=1.72, z0=0.40, zt=3.16, wall=0.14, back=0.11, floor=0.80, cut_w=1.30, cut_e=0.80,
           door=(-0.30, 0.57), cab_x=2.46)


def clip_poly(pts, axis, val, keep_ge):
    """Sutherland-Hodgman clip of an XZ polygon against x (axis 0) or z (axis 1) = val."""
    out = []
    n = len(pts)
    inside = (lambda p: p[axis] >= val) if keep_ge else (lambda p: p[axis] <= val)
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        ia, ib = inside(a), inside(b)
        if ia:
            out.append(a)
        if ia != ib:
            t = (val - a[axis]) / (b[axis] - a[axis])
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return out


def body_piece(name, x0, x1, ztop, y0, y1, C, front_cab=True, top_col=None):
    L, z0, zt = RVI['L'], RVI['z0'], RVI['zt']
    pts = PX.body_profile(L, z0, zt, front_cab)
    pts = clip_poly(pts, 0, x0, True)
    pts = clip_poly(pts, 0, x1, False)
    pts = clip_poly(pts, 1, ztop, False)
    o = P.prism(name, pts, y0, y1)
    P.paint(o, M(C['side']), top=M(top_col or C['roof'], TOP), side=M(C['end'], RIGHTN), left=M(C['end'], LEFTN),
            top_thresh=0.5)
    return o


def rv_interior_parts():
    C = PX.RV['teal']
    L, Dp, z0, zt = RVI['L'], RVI['D'], RVI['z0'], RVI['zt']
    hl, hd = L / 2, Dp / 2
    yf, wt, bt, zf = -hd, RVI['wall'], RVI['back'], RVI['floor']
    cab = RVI['cab_x']
    dx0, dx1 = RVI['door']
    inner, front, door = [], [], []
    wall_in, rim = '#5cabb2', '#70dbdc'
    # ---- floor + back wall + diagonal-cut west wall
    inner.append(boxp('Floor', -hl + 0.12, cab, yf + 0.05, hd - bt, z0, zf, '#4c4c4c', '#5d5d5d'))
    bw = body_piece('BackWall', -hl, cab + 0.02, zt, hd - bt, hd, C, top_col=rim)
    P.paint(bw, M(wall_in), top=M(rim, TOP), side=M(C['end'], RIGHTN), left=M(C['end'], LEFTN), top_thresh=0.5)
    inner.append(bw)
    ww = [(yf, z0 + 0.25), (hd, z0 + 0.25), (hd, zt - 0.08), (yf, RVI['cut_w'])]
    bm = bmesh.new()
    vs = [bm.verts.new((-hl + 0.02, y, z)) for y, z in ww]
    f = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]:
        v.co.x = -hl + 0.02 + 0.15
    west = P.bm_obj('WestWall', bm)
    P.paint(west, M(wall_in), top=M(rim, (0, -0.5, 1)), side=M(wall_in, RIGHTN), left=M(C['end'], LEFTN), top_thresh=0.35)
    inner.append(west)
    # ---- back-wall windows with grey curtains (x from f_299.5)
    yw = hd - bt
    for (gx0, gx1) in ((-3.165, -2.51), (0.38, 1.03)):
        cx = (gx0 + gx1) / 2
        inner.append(P.boxmm('WinGlass', gx0, gx1, yw - 0.01, yw, 1.99, 2.79, M('#76bf94')))
        inner.append(P.boxmm('WinGlassLo', gx0, gx1, yw - 0.012, yw - 0.01, 1.99, 2.10, M('#73b390')))
        inner.append(P.boxmm('WinMull', cx - 0.016, cx + 0.016, yw - 0.02, yw - 0.01, 1.99, 2.79, M('#666666')))
        inner.append(boxp('WinSill', gx0 - 0.05, gx1 + 0.05, yw - 0.05, yw, 1.86, 1.97, '#666666', '#7f97a1'))
        inner.append(boxp('Rod', gx0 - 0.40, gx1 + 0.40, yw - 0.06, yw - 0.03, 2.80, 2.87, '#c7c7c7', '#d8d8d8'))
        for sx in (-1, 1):
            xo = gx0 - 0.34 if sx < 0 else gx1 + 0.34
            xi = gx0 + 0.02 if sx < 0 else gx1 - 0.02
            pts = [(xo, 1.84), (xo, 2.82), (xi, 2.82), (xi - sx * 0.02, 2.40), (xo + sx * 0.0 + (0.20 if sx < 0 else -0.20), 2.12),
                   (xo + (0.12 if sx < 0 else -0.12), 1.84)]
            if sx > 0:
                pts = pts[::-1]
            cu = P.prism('Curtain', pts, yw - 0.07, yw - 0.03, M('#8b8b8b'))
            inner.append(cu)
            tb = (xo + (0.17 if sx < 0 else -0.17))
            inner.append(P.boxmm('Tie', tb - 0.12, tb + 0.12, yw - 0.08, yw - 0.07, 2.08, 2.14, M('#bdbdbd')))
    # ---- double bed (west end, spans the width, head north)
    bx0, bx1 = -3.95, -2.43
    wood, woodT = '#865c32', '#a3703a'
    hb = P.prism('Headboard', top_round_rect(bx1 - bx0, 1.76 - zf, 0.12, 4, (bx0 + bx1) / 2, zf), hd - bt - 0.09, hd - bt)
    P.paint(hb, M(wood), top=M(woodT, TOP), top_thresh=0.4)
    inner.append(hb)
    fb = P.prism('Footboard', top_round_rect(bx1 - bx0, 1.38 - zf, 0.10, 4, (bx0 + bx1) / 2, zf), -0.66, -0.57)
    P.paint(fb, M('#885c32'), top=M(woodT, TOP), top_thresh=0.4)
    inner.append(fb)
    inner.append(boxp('Mattress', bx0 + 0.04, bx1 - 0.04, -0.57, hd - bt - 0.09, zf, zf + 0.45, '#d8d8d8', '#e7e7e7'))
    for px in (bx0 + 0.40, bx1 - 0.40):
        pil = P.rock('Pillow', (0.60, 0.28, 0.14), seed=int(px * 10) % 97, subdiv=2, jag=0.0,
                     loc=(px, hd - bt - 0.25, zf + 0.42))
        P.setm(pil, M('#c7c7c7', TOP))
        inner.append(pil)
    inner.append(boxp('Blanket', bx0 + 0.02, bx1 - 0.02, -0.575, 0.22, zf + 0.12, zf + 0.50, '#5fb7c0', '#6bcad4'))
    inner.append(boxp('Fold', bx0 + 0.015, bx1 - 0.015, 0.20, 0.38, zf + 0.30, zf + 0.52, '#589ba9', '#589ba9'))
    # ---- table (hat sits here)
    tx0, tx1, ty0, ty1, tz = -2.04, -0.68, 0.28, hd - bt, 1.85
    inner.append(boxp('TableTop', tx0, tx1, ty0, ty1, tz - 0.14, tz, '#bb9354', '#edc775', '#a8844b'))
    for x in (tx0 + 0.10, tx1 - 0.10):
        for y in (ty0 + 0.08, ty1 - 0.08):
            inner.append(boxp('TLeg', x - 0.05, x + 0.05, y - 0.05, y + 0.05, zf, tz - 0.14, '#c8a46a', '#c8a46a'))
    # ---- kitchen counter + sink, fridge
    kx0, kx1, ky0, kz = -0.29, 1.54, 0.23, 1.64
    inner.append(boxp('Counter', kx0 + 0.02, kx1 - 0.02, ky0 + 0.03, hd - bt, zf, kz - 0.08, '#cb9f5b', '#cb9f5b', '#b48c4f'))
    inner.append(boxp('CounterTop', kx0, kx1, ky0, hd - bt, kz - 0.08, kz, '#885932', '#9c6939', '#7a502d'))
    dw = (kx1 - kx0 - 0.16) / 4
    for i in range(4):
        a = kx0 + 0.07 + i * dw + (0.02 if i >= 2 else 0)
        inner.append(P.boxmm('KDoor', a + 0.01, a + dw - 0.01, ky0 + 0.018, ky0 + 0.03, zf + 0.08, kz - 0.16, M('#b9884a')))
        kx = a + dw - 0.09 if i % 2 == 0 else a + 0.09
        inner.append(P.cyl('KKnob', 0.022, 0.02, 8, (kx, ky0 + 0.018, kz - 0.30), axis='-Y', m=M('#865d2f')))
    sx = 1.06
    inner.append(boxp('Sink', sx - 0.27, sx + 0.27, 0.30, hd - bt - 0.04, kz, kz + 0.12, '#e7e7e7', '#e7e7e7', '#d0d0d0'))
    inner.append(P.slab('Basin', P.rrect(0.40, 0.17, 0.05, 3, sx, 0.47), kz + 0.12, kz + 0.124, M('#bfbfbf', TOP)))
    inner.append(P.slab('Drain', P.ellipse(0.035, 0.025, 10, sx, 0.45), kz + 0.124, kz + 0.127, M('#8a8a8a', TOP)))
    inner.append(boxp('Faucet', sx - 0.025, sx + 0.025, 0.60, 0.65, kz + 0.12, kz + 0.28, '#999999', '#b0b0b0'))
    inner.append(boxp('Spout', sx - 0.02, sx + 0.02, 0.52, 0.65, kz + 0.24, kz + 0.28, '#999999', '#b0b0b0'))
    for dxk in (-0.13, 0.13):
        inner.append(P.cyl('Tap', 0.03, 0.06, 10, (sx + dxk, 0.62, kz + 0.12), m=M('#6f6f6f')))
    fx0, fx1, fz = 1.55, 2.455, 2.66
    fr = P.prism('Fridge', top_round_rect(fx1 - fx0, fz - zf, 0.06, 3, (fx0 + fx1) / 2, zf), ky0, hd - bt)
    P.paint(fr, M('#cdcdcd'), top=M('#e7e7e7', TOP), side=M('#b5b5b5', RIGHTN), top_thresh=0.3)
    inner.append(fr)
    inner.append(P.boxmm('FridgeSplit', fx0 + 0.01, fx1 - 0.01, ky0 - 0.008, ky0, fz - 0.42, fz - 0.37, M('#a1a1a1')))
    inner.append(P.boxmm('FridgeBase', fx0 + 0.01, fx1 - 0.01, ky0 - 0.008, ky0, zf, zf + 0.07, M('#8b8b8b')))
    inner.append(P.boxmm('FridgeHandle', fx1 - 0.10, fx1 - 0.06, ky0 - 0.05, ky0, 1.55, 2.0, M('#6f6f6f')))
    # ---- cab section (not cut): body, roof, windshield, side window, stripe, wheel, lights
    inner.append(body_piece('Cab', cab, hl, zt, yf, hd, C))
    nrm = Vector((math.cos(math.radians(40)), 0, math.sin(math.radians(40))))
    ws = [(hl - 0.14, yf + 0.10, 2.22), (hl - 0.14, hd - 0.10, 2.22), (hl - 0.60, hd - 0.10, zt - 0.14),
          (hl - 0.60, yf + 0.10, zt - 0.14)]
    ws = [tuple(Vector(p) + nrm * 0.012) for p in ws]
    inner.append(P.solid_poly('Windshield', ws, 0.01, nrm, M('#cfeef0', nrm)))
    inner.append(P.boxmm('CabStripe', cab, hl - 0.05, yf - 0.012, yf + 0.02, 1.12, 1.57, M(C['stripe'])))
    PX.rv_window(inner, -hl + 6.75, -hl + 7.62, 1.89, 2.91, yf)
    PX.wheel(inner, -hl + 7.26, yf - 0.06)
    inner.append(P.boxmm('Marker', hl - 0.18, hl - 0.06, yf - 0.02, yf + 0.01, 0.76, 0.84, M('#f38a1e')))
    # ---- front layer: cut south wall (high along the bed, floor-level east of the door), wheels, step
    front.append(body_piece('FrontW', -hl, dx0, RVI['cut_w'], yf, yf + wt, C, top_col=rim))
    front.append(body_piece('FrontE', dx1, cab + 0.02, RVI['cut_e'], yf, yf + wt, C, top_col=rim))
    front.append(body_piece('FrontD', dx0, dx1, 0.62, yf, yf + wt, C, top_col=rim))
    for o in front:
        P.paint(o, M(C['side']), top=M(rim, TOP), side=M(C['end'], RIGHTN), left=M(C['end'], LEFTN), top_thresh=0.5)
    for w in (1.93, 3.07):
        PX.wheel(front, -hl + w, yf - 0.06)
    step = P.boxmm('Step', dx0 - 0.02, dx1 + 0.02, yf - 0.25, yf, 0.18, 0.30)
    P.paint(step, M('#9a9899'), top=M('#bcbcbc', TOP))
    front.append(step)
    front.append(P.boxmm('MarkerW', -hl + 0.09, -hl + 0.21, yf - 0.02, yf + 0.01, 0.76, 0.84, M('#f38a1e')))
    for z in (0.62, 1.0):
        front.append(P.boxmm('Tail', -hl - 0.02, -hl + 0.02, yf + 0.02, yf + 0.14, z, z + 0.25, M('#d23b40')))
    # ---- open door: hinged on the doorway's west edge, swung out to the south-west (~137 deg)
    dw_ = dx1 - dx0
    d_ = [P.boxmm('Door', 0.0, dw_, -0.03, 0.0, z0 + 0.12, 2.96, M(C['door'])),
          P.boxmm('DoorStripe', 0.0, dw_, -0.04, -0.03, 1.12, 1.57, M(C['doorStripe']))]
    fr_ = P.prism('DWinFrame', P.rrect(dw_ - 0.26, 0.85, 0.07, 3, dw_ / 2, 2.40), -0.07, -0.03, M('#5f6366'))
    d_.append(fr_)
    d_.append(P.boxmm('DGlass', 0.19, dw_ - 0.19, -0.08, -0.07, 2.04, 2.76, M('#879eaa')))
    d_.append(P.boxmm('DHandle', 0.08, 0.22, -0.07, -0.04, 1.60, 1.68, M('#6a6a6a')))
    # the open leaf shows its inner face to the camera: repeat window + stripe there (as in f_299.5)
    d_.append(P.boxmm('DStripeIn', 0.0, dw_, 0.0, 0.01, 1.12, 1.57, M(C['doorStripe'], (0, 1, 0))))
    d_.append(P.prism('DWinFrameIn', P.rrect(dw_ - 0.26, 0.85, 0.07, 3, dw_ / 2, 2.40), 0.0, 0.04, M('#5f6366', (0, 1, 0))))
    d_.append(P.boxmm('DGlassIn', 0.19, dw_ - 0.19, 0.04, 0.05, 2.04, 2.76, M('#879eaa', (0, 1, 0))))
    P.rotate_objs(d_, math.radians(-137))
    shift(d_, dx0, yf)
    door = d_
    return inner, front, door


def build_rv_interior():
    inner, front, door = rv_interior_parts()
    hd = RVI['D'] / 2
    base = {'footprint': [RVI['L'], RVI['D']], 'anchor_note': 'same anchor as rv_teal (footprint centre)'}
    floor_rect = {'x0': -RVI['L'] / 2 + 0.15, 'x1': RVI['cab_x'], 'y0': -hd + RVI['wall'], 'y1': hd - RVI['back']}
    return [
        ('rv_teal_interior', inner, dict(base, layer='interior', floorZ=RVI['floor'], walk=floor_rect,
                                         furniture={'bed': [-3.19, 0.05], 'table': [-1.36, 0.47], 'counter': [0.625, 0.47],
                                                    'fridge': [2.0, 0.47]},
                                         hat_spot_m=[-1.25, 0.50, 1.85],
                                         door={'x0': RVI['door'][0], 'x1': RVI['door'][1], 'y': -hd},
                                         note='roof off over the living area (x < 2.46); cab kept; back wall full height, '
                                              'west wall cut diagonally; floor at z 0.80')),
        ('rv_teal_front', front, dict(base, layer='interior_front', sortY=-hd,
                                      note='cut south wall (1.30 m along the bed, floor level east of the door) + wheels; '
                                           'draw over actors inside')),
        ('rv_teal_door_open', door, dict(base, layer='door', sortY=-hd - 0.45,
                                         note='door swung out ~137 deg on the doorway west edge (x -0.30)')),
    ]


def build_duck_hat():
    """The Duck Hat: oversized red cap lying on the RV table (f_299.5): crown + visor pointing south-west."""
    o = []
    cr = T.ico('Crown', 1.0, 3, scale=(0.29, 0.26, 0.24), loc=(0, 0, 0))
    for v in cr.data.vertices:
        if v.co.z < 0:
            v.co.z = 0.0
    P.paint(cr, M('#ca4849'), top=M('#fe5555', TOP), top_thresh=0.35)
    o.append(cr)
    o.append(T.ico('Button', 0.035, 1, loc=(0, 0, 0.235)))
    P.setm(o[-1], M('#ca4849', TOP))
    pts = [(math.cos(math.radians(a)) * 0.22, math.sin(math.radians(a)) * 0.24) for a in range(90, 271, 15)]
    vz = 0.035
    v = P.slab('Visor', [(x - 0.22, y) for x, y in pts], 0.0, vz)
    P.paint(v, M('#b23f40'), top=M('#ca4849', TOP), top_thresh=0.5)
    P.rotate_objs([v], math.radians(35))
    o.append(v)
    shift(o, 0, 0, 1.85)
    meta = {'footprint': [0.6, 0.55], 'blocksSight': False, 'pickup': True, 'restZ': 1.85,
            'rvOffset_m': [-1.25, 0.50],
            'note': 'rendered resting on the RV table (1.85 m up; origin = floor point below it). Place at '
                    'rv_teal anchor + rvOffset_m and sort just after rv_teal_interior'}
    return [('duck_hat_item', o, meta)]


BUILDERS = {
    'payphone': build_payphone,
    'power_pole': build_power_pole,
    'poster': build_poster,
    'hydrant': build_hydrant,
    'car': build_car,
    'boombox': build_boombox,
    'sign_exit': build_sign_exit,
    'cliff': build_cliff,
    'cave': build_cave,
    'rv_interior': build_rv_interior,
    'duck_hat': build_duck_hat,
}

if __name__ == '__main__':
    P.run(BUILDERS)
