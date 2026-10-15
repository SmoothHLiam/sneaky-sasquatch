"""
Race-track structures (outside-park video): ENTRANCE / start-finish gantries, start lights, bleachers,
the "2 1 3" podium, the RACE TRACK monument sign (+ its green CAMPGROUND twin), tiki torches, red / white
tyre stacks, guard rail, traffic cone and a tileable box hedge.

  Blender -b --factory-startup -P art/blender/props_racetrack.py -- [group ...]
Groups: gantry start_lights bleachers podium monument tiki tyres guard_rail cone hedge

Refs (videos/outside park 1.mov, 1 still px == 1 sprite px when walking; the circuit frames are driving
frames zoomed out ~0.67-0.80 -> every size there was divided by that zoom, calibrated on the gantry which
is the same 9.06 m structure as the ENTRANCE gantry measured at zoom 1):
  ENTRANCE gantry t228-252 (o25), start gantry t269-270 / t384-385 (o27, o29), start lights t384 (o29),
  bleachers t236-240 / t262-264 (o26), podium t413-417 (o30), RACE TRACK sign + tiki torches t050-055
  (o04), CAMPGROUND sign t004-006 (o01), tyre stacks t384, guard rail t240 / t262, cones t236 / t264,
  hedges t252 / t436.
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
LEFTN, RIGHTN, BACKN = (-1, 0, 0), (1, 0, 0), (0, 1, 0)


def boxp(name, x0, x1, y0, y1, z0, z1, front, top=None, side=None, left=None, back=None, bottom=None):
    o = P.boxmm(name, x0, x1, y0, y1, z0, z1)
    P.paint(o, M(front), top=M(top or front, TOP), side=M(side or front, RIGHTN),
            left=M(left or side or front, LEFTN), back=M(back or front, BACKN),
            bottom=M(bottom or front, (0, 0, -1)))
    return o


def flat(name, pts, y, col, depth=0.01):
    """Flat graphic polygon [(x, z)] on a plane facing -y (front at y - depth)."""
    return P.prism(name, pts[::-1], y - depth, y, M(col))


def fit_text(name, text, x0, x1, z0, z1, y, col, bold=0.0, font=None, keep_aspect=True):
    kw = {} if font is None else {'font': font}
    t = P.text_mesh(name, text, size=0.4, depth=0.01, bold=bold, stretch_z=ST, loc=(0, 0, 0), m=M(col), **kw)
    (a, b), _, (c, d) = P.bounds([t])
    sx, sz = (x1 - x0) / (b - a), (z1 - z0) / (d - c)
    if keep_aspect:
        sx = sz = min(sx, sz)
    P.xform(t, scale=(sx, 1, sz))
    (a, b), _, (c, d) = P.bounds([t])
    P.xform(t, loc=((x0 + x1) / 2 - (a + b) / 2, y, (z0 + z1) / 2 - (c + d) / 2))
    return t


# ================================================================== gantry ===
GT = dict(red='#9f333e', redEdge='#d24656', beam='#49524f', beamF='#3a4140', steel='#2b2b2b', steelTop='#3c3c3c',
          text='#f0dede', chkW='#e8e8e8', chkB='#2a2a2a', pole='#3a3a3a')
GD = dict(W=9.06, H=1.30, z0=4.32, tw=0.67, tx=3.875, beamW=8.42)


def chequered_flag(cx, cz, y, mirror=1, s=1.0):
    """One chequered flag on a tilted pole (screen units, stretched like the original pictograms)."""
    o = []
    ang = math.radians(28) * mirror
    ca, sa = math.cos(ang), math.sin(ang)

    def tr(px, pz):            # rotate in screen space then stretch z
        rx, rz = px * ca - pz * sa, px * sa + pz * ca
        return (cx + rx * s, cz + rz * s * ST)
    # pole from bottom (0,-0.30) to top (0, 0.22)
    pw = 0.022
    o.append(flat('FPole', [tr(-pw, -0.30), tr(pw, -0.30), tr(pw, 0.22), tr(-pw, 0.22)], y, GT['pole']))
    fw, fh = 0.30, 0.18
    nx, nz = 4, 2
    for i in range(nx):
        for j in range(nz):
            x0 = -mirror * pw - mirror * fw * i / nx
            x1 = -mirror * pw - mirror * fw * (i + 1) / nx
            z0 = 0.22 - fh * (j + 1) / nz
            z1 = 0.22 - fh * j / nz
            col = GT['chkB'] if (i + j) % 2 == 0 else GT['chkW']
            o.append(flat('FChk', [tr(x0, z0), tr(x1, z0), tr(x1, z1), tr(x0, z1)], y - 0.004, col, 0.006))
    return o


def flag_pair(cx, cz, y, s=1.0):
    return chequered_flag(cx - 0.10 * s, cz, y, 1, s) + chequered_flag(cx + 0.10 * s, cz, y, -1, s)


def lattice_tower(cx, h, w=0.67, bar=0.07, step=0.62, d=0.24):
    """Open square lattice tower (4 corner posts + X bracing on the front and back faces)."""
    o = []
    hw = w / 2
    hd = d / 2
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = cx + sx * (hw - bar / 2), sy * (hd - bar / 2)
            o.append(boxp('TPost', x - bar / 2, x + bar / 2, y - bar / 2, y + bar / 2, 0, h, GT['steel'], GT['steelTop']))
    n = max(1, int(round(h / step)))
    st = h / n
    for sy in (-1, 1):
        y = sy * (hd - bar / 2)
        for k in range(n):
            z0, z1 = k * st, (k + 1) * st
            for (xa, za, xb, zb) in ((cx - hw + bar, z0, cx + hw - bar, z1), (cx + hw - bar, z0, cx - hw + bar, z1)):
                b = P.beam('TBrace', (xa, y, za), (xb, y, zb), 0.055, 0.04, up=(0, -1, 0))
                P.paint(b, M(GT['steel']), top=M(GT['steelTop'], TOP))
                o.append(b)
            if sy < 0:
                o.append(boxp('TRing', cx - hw, cx + hw, -hd, hd, z1 - 0.025, z1 + 0.025, GT['steel'], GT['steelTop']))
    return o


def gantry_objs(text=None, flags_x=(-1.79, 1.79)):
    c = GD
    o = []
    hw = c['W'] / 2
    z0, z1 = c['z0'], c['z0'] + c['H']
    for sx in (-1, 1):
        o += lattice_tower(sx * c['tx'], z1 - 0.14)
    # dark beam on top/behind + red banner board in front of the towers (t252: dark band 0.36 deep)
    o.append(boxp('Beam', -c['beamW'] / 2, c['beamW'] / 2, -0.20, 0.16, z1 - 0.14, z1 + 0.06, GT['beamF'], GT['beam']))
    o.append(boxp('Banner', -hw, hw, -0.26, -0.18, z0, z1, GT['red'], GT['redEdge'], '#8a2c36'))
    o.append(P.boxmm('BannerEdge', -hw, hw, -0.265, -0.26, z1 - 0.05, z1, M(GT['redEdge'])))
    zc = (z0 + z1) / 2
    yb = -0.265
    if text:
        o.append(fit_text('BText', text, -0.97, 0.97, zc - 0.23, zc + 0.23, yb, GT['text']))
    for fx in flags_x:
        o += flag_pair(fx, zc - 0.07, yb - 0.002, 1.35)
    return o


def build_gantry():
    c = GD
    towers = [[-c['tx'], 0.0], [c['tx'], 0.0]]
    meta = {'footprint': [c['W'], 0.5], 'blocksSight': False, 'height': round(c['z0'] + c['H'] + 0.06, 2),
            'towers': towers, 'tower_size': [c['tw'], 0.24], 'clear_span': round(2 * c['tx'] - c['tw'], 2),
            'note': 'walk/drive-through gantry: collide with the two tower footprints only (x = +-3.875); '
                    'banner underside 4.32 m. Lattice is open (ground shows through).'}
    out = [('entrance_gantry', gantry_objs('ENTRANCE'), dict(meta))]
    m2 = dict(meta)
    m2['note'] = 'start/finish gantry over the start straight (same 9.06 m structure, two crossed-flag pairs, no ' \
                 'text); the chequered line on the road is a ground decal'
    out.append(('start_gantry', gantry_objs(None, (-1.78, 1.80)), m2))
    return out


# ============================================================ start lights ===
SL = dict(housing='#333333', top='#505050', side='#2a2a2a', pole='#3e3e3e', poleTop='#555555', bezel='#262626',
          hood='#545354', red='#5c2a2f', green='#6fe948', greenHi='#9cf27a')


def build_start_lights():
    """Start-light pole (t384 crop at zoom 0.70): 0.13 pole, 1.46 x 0.25 x 1.28 housing at 2.94 m, three
    lamps per row - top row dark red (off), bottom row bright green (on)."""
    o = []
    H0, H1 = 3.04, 4.22
    o.append(boxp('Pole', -0.065, 0.065, -0.065, 0.065, 0, H0 + 0.1, SL['pole'], SL['poleTop']))
    o.append(boxp('Housing', -0.73, 0.73, -0.125, 0.125, H0, H1, SL['housing'], SL['top'], SL['side']))
    yf = -0.125
    for x in (-0.47, 0.0, 0.47):
        for zc, col in ((3.84, SL['red']), (3.33, SL['green'])):
            o.append(P.cyl('Bezel', 0.16, 0.02, 20, (x, yf + 0.0, zc), axis='-Y', rz=0.16 * ST, m=M(SL['bezel'])))
            hood = [(x + 0.17 * math.cos(math.radians(a)), zc + 0.17 * ST * math.sin(math.radians(a)))
                    for a in range(0, 181, 15)]
            hood += [(x + 0.135 * math.cos(math.radians(a)), zc + 0.135 * ST * math.sin(math.radians(a)))
                     for a in range(180, -1, -15)]
            o.append(P.prism('Hood', hood[::-1], yf - 0.06, yf - 0.02, M(SL['hood'])))
            o.append(P.cyl('Lens', 0.12, 0.02, 20, (x, yf - 0.02, zc - 0.02), axis='-Y', rz=0.12 * ST,
                           m=P.mat(col, None, 0.0)))
    # the cylinder helper scales y for rz; for -Y axis cylinders the stretch lands on z after rotation
    return [('start_lights', o, {'footprint': [0.3, 0.3], 'blocksSight': False, 'height': H1,
                                 'housing_m': {'w': 1.46, 'z0': H0, 'z1': H1},
                                 'lamps': {'red_off_z': 3.84, 'green_on_z': 3.33, 'x': [-0.47, 0.0, 0.47]},
                                 'note': 'one pole either side of the grid; housing centred on the pole'})]


# =============================================================== bleachers ===
BL = dict(plank='#f7d37f', gap='#dcbb74', fascia='#f7d37f', fasciaLo='#c49c5f', steel='#424242', steelTop='#555555')


def bleacher_objs(L, bay=3.5):
    """Raised plank deck on a dark steel truss (t240 / t262): 1.62 deep, deck top 2.3 m, X-braced bays."""
    o = []
    hl, d = L / 2, 1.62
    hd = d / 2
    zt = 2.30
    # plank deck: 5 planks running along x with dark gaps
    n = 6
    pw = d / n
    for i in range(n):
        y0, y1 = -hd + i * pw + 0.04, -hd + (i + 1) * pw - 0.04
        o.append(boxp('Plank', -hl, hl, y0, y1, zt - 0.08, zt, BL['plank'], BL['plank'], '#e0bd70'))
    o.append(boxp('Under', -hl, hl, -hd, hd, zt - 0.12, zt - 0.06, BL['gap'], BL['gap']))
    o.append(boxp('Fascia', -hl, hl, -hd - 0.05, -hd + 0.03, zt - 0.40, zt - 0.02, BL['fascia'], BL['plank']))
    o.append(boxp('FasciaLo', -hl, hl, -hd - 0.05, -hd + 0.03, zt - 0.58, zt - 0.40, BL['fasciaLo'], BL['fasciaLo']))
    # truss
    nb = max(1, int(round(L / bay)))
    xs = [-hl + 0.08 + (L - 0.16) * i / nb for i in range(nb + 1)]
    zb = zt - 0.58
    for y in (-hd + 0.06, hd - 0.06):
        for x in xs:
            o.append(boxp('Leg', x - 0.05, x + 0.05, y - 0.05, y + 0.05, 0, zb, BL['steel'], BL['steelTop']))
        o.append(boxp('TopBeam', -hl + 0.03, hl - 0.03, y - 0.05, y + 0.05, zb - 0.10, zb, BL['steel'], BL['steelTop']))
        o.append(boxp('LowBeam', -hl + 0.03, hl - 0.03, y - 0.04, y + 0.04, 0.10, 0.18, BL['steel'], BL['steelTop']))
        for a, b in zip(xs, xs[1:]):
            for (xa, za, xb, zb_) in ((a, 0.18, b, zb - 0.1), (b, 0.18, a, zb - 0.1)):
                br = P.beam('Brace', (xa, y, za), (xb, y, zb_), 0.07, 0.04, up=(0, -1, 0))
                P.paint(br, M(BL['steel']), top=M(BL['steelTop'], TOP))
                o.append(br)
    for x in xs:
        o.append(boxp('Cross', x - 0.04, x + 0.04, -hd + 0.06, hd - 0.06, zb - 0.10, zb, BL['steel'], BL['steelTop']))
    return o


def build_bleachers():
    out = []
    for key, L in (('bleachers_long', 14.0), ('bleachers_short', 7.0)):
        out.append((key, bleacher_objs(L), {
            'footprint': [L, 1.62], 'blocksSight': False, 'height': 2.3, 'deck_z': 2.3,
            'legs_note': 'steel legs every ~3.5 m front and back; walk-under is blocked by the X braces',
            'note': 'spectators stand on the deck (deck top 2.3 m: screen offset -(2.3*0.616*200)=-283 px). '
                    'Length: short ~7 m (notes: "about 5 SH"), long 14 m is a guess (east ends never on screen)'}))
    return out


# ================================================================== podium ===
PD = dict(top='#e7e7e7', front='#b9b9b9', side='#a8a8a8', num='#6d6d6d')


def build_podium():
    """White 3-step podium "2 1 3" (t415): blocks 1.55 / 1.78 / 1.55 wide, 1.46 deep, 0.73 / 1.38 / 0.73 tall."""
    o = []
    D = 1.46
    hd = D / 2
    blocks = [('2', -2.43, -0.89, 0.73), ('1', -0.89, 0.89, 1.38), ('3', 0.89, 2.44, 0.73)]
    for lab, x0, x1, h in blocks:
        o.append(boxp('Block' + lab, x0, x1, -hd, hd, 0, h, PD['front'], PD['top'], PD['side']))
        zc = 0.27 if h < 1 else 0.86
        o.append(fit_text('Num' + lab, lab, (x0 + x1) / 2 - 0.3, (x0 + x1) / 2 + 0.3, zc - 0.24, zc + 0.24, -hd - 0.001,
                          PD['num'], bold=0.012))
    meta = {'footprint': [4.87, 1.46], 'blocksSight': False, 'height': 1.38,
            'steps': {'2': {'x': -1.66, 'top_z': 0.73}, '1': {'x': 0.0, 'top_z': 1.38}, '3': {'x': 1.665, 'top_z': 0.73}},
            'note': 'step x = block centre from the anchor; winners stand at y=0 on top'}
    return [('podium_123', o, meta)]


# ========================================================= monument signs ===
MS = dict(post='#5d4426', postTop='#86633b', frame='#5c4128', frameTop='#86633d', red='#a53844', green='#337340',
          text='#e6e6e6', bolt='#6a6a6a')


def monument_objs(panel, label, icon):
    """Wooden-framed monument sign with an arched top (t052 crop / t005): posts at +-2.0 m, 3.65 x 1.79 board
    (bottom 1.03 m), semicircular arch on top (stretched x1/cos so it reads round), white Bree Serif label."""
    o = []
    for px in (-2.0, 2.0):
        o.append(boxp('Post', px - 0.115, px + 0.115, -0.12, 0.12, 0, 2.76, MS['post'], MS['postTop']))
    z0, z1 = 1.03, 2.82
    hw = 1.825
    yf = -0.06
    # frame (dark) + arch outline polygon
    ax_r, az_r = 0.895, 1.34
    outer = [(-hw, z0), (hw, z0), (hw, z1)]
    outer += [(ax_r * math.cos(math.radians(a)), z1 + az_r * math.sin(math.radians(a))) for a in range(0, 181, 6)]
    outer += [(-hw, z1)]
    frame = P.prism('Frame', outer[::-1], yf, yf + 0.12)
    P.paint(frame, M(MS['frame']), top=M(MS['frameTop'], TOP), side=M('#4e3720', RIGHTN), top_thresh=0.3)
    o.append(frame)
    # light top rim along the arch (the wood's top face reads as a lighter band in the reference)
    rim = [(ax_r * math.cos(math.radians(a)), z1 + az_r * math.sin(math.radians(a))) for a in range(0, 181, 6)]
    rim_in = [(0.835 * math.cos(math.radians(a)), z1 + 1.25 * math.sin(math.radians(a))) for a in range(180, -1, -6)]
    o.append(flat('ArchRim', rim + rim_in, yf - 0.001, MS['frameTop'], 0.004))
    for (a, b) in ((-hw, -ax_r), (ax_r, hw)):
        o.append(flat('TopRim', [(a, z1 - 0.06), (b, z1 - 0.06), (b, z1), (a, z1)], yf - 0.001, MS['frameTop'], 0.004))
    inner = [(-hw + 0.17, z0 + 0.12), (hw - 0.17, z0 + 0.12), (hw - 0.17, z1 - 0.16)]
    inner += [(0.725 * math.cos(math.radians(a)), z1 - 0.16 + 1.30 * math.sin(math.radians(a))) for a in range(0, 181, 6)]
    inner += [(-hw + 0.17, z1 - 0.16)]
    o.append(flat('Panel', inner, yf - 0.002, panel, 0.006))
    for px in (-1.93, 1.93):
        for zb in (z0 + 0.12, z1 - 0.35):
            o.append(P.boxmm('Bolt', px - 0.07, px + 0.07, -0.02, 0.02, zb, zb + 0.16, M(MS['bolt'])))
    o.append(fit_text('Label', label, -1.30, 1.30, 1.60, 2.04, yf - 0.009, MS['text'], bold=0.0))
    o += icon(0.0, z1 + 0.38, yf - 0.009)
    return o


def race_flags_icon(cx, cz, y):
    """Two crossed chequered flags (white squares) on white poles, inside the arch (screen units, x1/cos)."""
    o = []
    k = 1.5
    for mirror in (1, -1):
        ang = math.radians(24) * mirror
        ca, sa = math.cos(ang), math.sin(ang)

        def tr(px, pz):
            rx, rz = (px * ca - pz * sa) * k, (px * sa + pz * ca) * k
            return (cx + rx, cz + rz * ST)
        o.append(flat('IPole', [tr(-0.03, -0.36), tr(0.03, -0.36), tr(0.03, 0.10), tr(-0.03, 0.10)], y, MS['text']))
        for i in range(4):
            for j in range(2):
                if (i + j) % 2:
                    continue
                x0 = -mirror * (0.03 + 0.085 * i)
                x1 = -mirror * (0.03 + 0.085 * (i + 1))
                z0, z1 = 0.10 - 0.085 * (j + 1), 0.10 - 0.085 * j
                o.append(flat('IChk', [tr(x0, z0), tr(x1, z0), tr(x1, z1), tr(x0, z1)], y, MS['text']))
    return o


def tent_icon(cx, cz, y):
    """White tent triangle with a green door triangle and a ground line (t005), screen units x1/cos."""
    Z = lambda sz: cz + sz * ST
    o = [flat('Tent', [(cx - 0.36, Z(-0.24)), (cx + 0.36, Z(-0.24)), (cx, Z(0.30))], y, MS['text'])]
    o.append(flat('TentDoor', [(cx - 0.16, Z(-0.24)), (cx + 0.16, Z(-0.24)), (cx, Z(0.02))], y - 0.002, MS['green'],
                  0.004))
    o.append(flat('TentBase', [(cx - 0.47, Z(-0.30)), (cx + 0.47, Z(-0.30)), (cx + 0.47, Z(-0.25)),
                               (cx - 0.47, Z(-0.25))], y, MS['text']))
    return o


def build_monument():
    meta = {'footprint': [4.25, 0.3], 'blocksSight': False, 'height': 4.16, 'posts': [[-2.0, 0.0], [2.0, 0.0]],
            'note': 'collide with the two posts (0.23 x 0.24); the board is 1.03-2.82 m up'}
    return [('race_track_sign', monument_objs(MS['red'], 'RACE TRACK', race_flags_icon), dict(meta)),
            ('sign_campground_green', monument_objs(MS['green'], 'CAMPGROUND', tent_icon), dict(meta))]


# ============================================================== tiki torch ===
def build_tiki():
    """Bamboo-ish torch pole with a yellow flame ribbon near the top, on a pile of grey rocks (t052 crop)."""
    o = []
    rnd = random.Random(3)
    for i, (x, y, s) in enumerate(((-0.12, 0.05, 0.42), (0.16, -0.02, 0.36), (0.0, 0.16, 0.30))):
        r = P.rock('Rock', (s * 1.4, s, s * 0.55), seed=10 + i, subdiv=1, jag=0.2, loc=(x, y, 0))
        P.paint(r, M('#6e6e6e'), top=M('#808080', TOP), top_thresh=0.5)
        o.append(r)
    pole = P.cyl('Pole', 0.055, 1.95, 8, (0.0, 0.0, 0.0), r2=0.05)
    P.paint(pole, M('#8a5a30'), top=M('#a8743c', TOP), side=M('#6e4626', RIGHTN))
    o.append(pole)
    fl = [(0.045, 1.80), (0.15, 1.73), (0.10, 1.68), (0.17, 1.60), (0.09, 1.57), (0.15, 1.47), (0.045, 1.52)]
    o.append(P.prism('Flame', [(x, (z - 1.6) * 1.15 + 1.6) for x, z in fl][::-1], -0.07, -0.02, M('#f0c820')))
    o.append(P.prism('Wrap', [(-0.06, 1.66), (0.05, 1.66), (0.05, 1.82), (-0.06, 1.82)][::-1], -0.075, 0.06,
                     M('#f0c820')))
    o.append(P.prism('WrapShade', [(0.0, 1.60), (0.12, 1.55), (0.06, 1.48), (0.0, 1.52)][::-1], -0.072, -0.06,
                     M('#d8a818')))
    return [('tiki_torch', o, {'footprint': [0.5, 0.4], 'blocksSight': False, 'height': 1.95})]


# ============================================================== tyre stacks ===
TY = {'red': dict(side='#e2404f', top='#ee4657', groove='#b8303e', hole='#c13949', holeIn='#9c2c38'),
      'white': dict(side='#dcdcdc', top='#efefef', groove='#bdbdbd', hole='#bababa', holeIn='#9a9a9a')}


def tyre_objs(c):
    """Six stacked tyres, outer r 0.345, 1.03 m tall, hole r 0.17 (t384 crop at zoom 0.70)."""
    o = []
    R, r, H, n = 0.345, 0.17, 1.03, 6
    h = H / n
    for i in range(n):
        z = i * h
        t = P.cyl('Tyre', R, h - 0.012, 22, (0, 0, z + 0.006))
        P.paint(t, M(c['side']), top=M(c['top'], TOP), top_thresh=0.6)
        o.append(t)
        o.append(P.cyl('Groove', R - 0.015, 0.012, 22, (0, 0, z), m=M(c['groove'])))
    o.append(P.cyl('Hole', r, 0.004, 18, (0, 0, H - 0.002), m=M(c['hole'], TOP)))
    o.append(P.cyl('HoleIn', r * 0.8, 0.004, 18, (0, r * 0.15, H + 0.001), m=M(c['holeIn'], TOP)))
    return o


def build_tyres():
    meta = lambda col: {'footprint': [0.7, 0.7], 'blocksSight': False, 'height': 1.03,
                        'note': 'barrier lines alternate red/white stacks every 1.4 m along the line (t384)'}
    return [('tyre_stack_red', tyre_objs(TY['red']), meta('red')),
            ('tyre_stack_white', tyre_objs(TY['white']), meta('white'))]


# ============================================================== guard rail ===
GR = dict(dark='#949494', light='#b1b1b1', cap='#a2a2a2', post='#525252', postTop='#6b6b6b', back='#7e7e7e')


def build_guard_rail():
    """Steel guard rail (t240): one 1.91 m bay along x, post at x = -L/2 in front of the rail, rail band
    z 0.25-1.35 with light/dark corrugation stripes. Tile bays every 1.91 m; cap the run with guard_rail_post."""
    L = 1.91
    o = []
    z0, z1 = 0.25, 1.35
    o.append(boxp('Rail', -L / 2, L / 2, -0.02, 0.08, z0, z1, GR['dark'], GR['cap'], GR['back']))
    nb = 6
    hb = (z1 - z0) / nb
    for i in range(nb):
        if i % 2 == 1:
            o.append(P.boxmm('Stripe', -L / 2, L / 2, -0.026, -0.02, z0 + i * hb, z0 + (i + 1) * hb, M(GR['light'])))
    post = boxp('Post', -L / 2 - 0.075, -L / 2 + 0.075, -0.17, -0.03, 0, 1.45, GR['post'], GR['postTop'])
    o.append(post)
    post2 = boxp('Post', -0.075, 0.075, -0.17, -0.03, 0, 1.45, GR['post'], GR['postTop'])
    return [('guard_rail', o, {'footprint': [L, 0.25], 'blocksSight': False, 'height': 1.45, 'tile_x': L,
                               'note': 'post at x=-L/2; tile bays every 1.91 m along x and cap with guard_rail_post'}),
            ('guard_rail_post', [post2], {'footprint': [0.15, 0.15], 'blocksSight': False, 'height': 1.45})]


# ================================================================== cones ===
def build_cone():
    """Orange traffic cone (t236): 0.48 square base, cone to 0.66 m."""
    o = [boxp('Base', -0.24, 0.24, -0.24, 0.24, 0, 0.05, '#c85a1c', '#e07030', '#b8501a')]
    c = P.cyl('Cone', 0.19, 0.60, 14, (0, 0, 0.05), r2=0.035)
    P.paint(c, M('#d56523'), top=M('#e87a35', TOP), side=M('#c35a1e', RIGHTN), left=M('#e06c28', LEFTN), top_thresh=0.3)
    o.append(c)
    o.append(P.cyl('Tip', 0.035, 0.02, 10, (0, 0, 0.65), m=M('#e87a35', TOP)))
    return [('traffic_cone', o, {'footprint': [0.48, 0.48], 'blocksSight': False, 'height': 0.67})]


# ================================================================== hedge ===
def build_hedge():
    """Box hedge segment (t436 / t252): 2.0 m along x, 0.75 deep, 1.5 tall, bumpy top edges. Tileable."""
    L, D, H = 2.0, 0.75, 1.5
    o = []
    rnd = random.Random(5)
    body = P.boxmm('Hedge', -L / 2, L / 2, -D / 2, D / 2, 0, H - 0.06)
    P.paint(body, M('#2f802f'), top=M('#388e35', TOP), side=M('#2a742a', RIGHTN), left=M('#2f802f', LEFTN))
    o.append(body)
    n = 9
    for edge, yy in (('F', -D / 2 + 0.05), ('B', D / 2 - 0.08)):
        for i in range(n):
            x = -L / 2 + (i + 0.5) * L / n + rnd.uniform(-0.03, 0.03)
            b = T.ico('Bump', 1.0, 1, scale=(L / n * 0.62, 0.10, 0.08), loc=(x, yy, H - 0.06))
            P.paint(b, M('#2f802f'), top=M('#388e35', TOP), top_thresh=0.45)
            o.append(b)
    top = P.boxmm('HedgeTop', -L / 2, L / 2, -D / 2 + 0.05, D / 2 - 0.05, H - 0.10, H, M('#388e35', TOP))
    o.append(top)
    for i in range(10):
        x, z = rnd.uniform(-L / 2 + 0.1, L / 2 - 0.1), rnd.uniform(0.25, H - 0.35)
        o.append(P.prism('Leafy', [(x - 0.07, z), (x + 0.07, z), (x, z + 0.10)], -D / 2 - 0.006, -D / 2, M('#2a742a')))
    return [('hedge', o, {'footprint': [L, D], 'blocksSight': True, 'height': H, 'tile_x': L,
                          'note': '1.5 m box hedge (blocks sight like a wall); tile every 2.0 m along x'})]


BUILDERS = {
    'gantry': build_gantry,
    'start_lights': build_start_lights,
    'bleachers': build_bleachers,
    'podium': build_podium,
    'monument': build_monument,
    'tiki': build_tiki,
    'tyres': build_tyres,
    'guard_rail': build_guard_rail,
    'cone': build_cone,
    'hedge': build_hedge,
}

if __name__ == '__main__':
    P.run(BUILDERS)
