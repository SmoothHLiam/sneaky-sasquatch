"""
Race-track lot buildings (outside-park video): car dealership, GARAGE, Automotive CUSTOMS, LICENSING
office -- exterior + roof + cut-away interior layers like the cabin / ranger station -- plus their
interior furniture and the rooftop AC unit / vent.

  Blender -b --factory-startup -P art/blender/props_lot.py -- [group ...]
Groups: dealership dealer_furniture garage garage_furniture customs customs_furniture licensing roof_bits

Refs: your research/frames/outside-park + videos/outside park 1.mov (3024x1898, 1 still px == 1 sprite px
outdoors; interiors are shown zoomed ~1.55x, every interior size below was divided by that zoom).
  dealership  facade t058-062 / o05, east end + roof t070-076, interior t063 / t576-588 (o06, o38, o39)
  garage      t424-438 (o21/o22 front, roof), bay interior t440-444 (o31)
  customs     t424-450 (front, roof), showroom t446-450 (o32)
  licensing   t098-100, t221, t228, t248 (o15, o24, o25)

Building-local frame while modelling: x = 0 at the west outer wall face, y = 0 at the front (south)
facade plane, z up. Every layer of one building is shifted so the anchor is the centre of the outer
wall bounding box (footprint centre on the ground); json positions are metres relative to that anchor
(x east, y north), like the station.
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
BOLD_FONT = None


# =================================================================== helpers ===
def boxp(name, x0, x1, y0, y1, z0, z1, front, top=None, side=None, left=None, back=None, bottom=None):
    """Axis box painted per face with colours sampled from the reference (compensated)."""
    o = P.boxmm(name, x0, x1, y0, y1, z0, z1)
    P.paint(o, M(front), top=M(top or front, TOP), side=M(side or front, RIGHTN),
            left=M(left or side or front, LEFTN), back=M(back or front, BACKN),
            bottom=M(bottom or front, (0, 0, -1)))
    return o


def shift(objs, dx, dy, dz=0.0):
    for o in objs:
        o.location = (dx, dy, dz)
        T.apply_transforms(o)
    return objs


def place(objs, x, y, z=0.0, rz=0.0):
    if rz:
        P.rotate_objs(objs, rz)
    return shift(objs, x, y, z)


_GLASS = {}


def glass_mat(tint='#b3dbe6', transp=0.65):
    """Unlit see-through glass: emission `tint` blended (in linear space) over what is behind it.
    Defaults solved from o05: floor #313133 -> #748c94 and white plinth -> #cfe4ef through the glass."""
    key = (tint, round(transp, 3))
    m = _GLASS.get(key)
    try:
        if m is not None and m.name in bpy.data.materials:
            return m
    except ReferenceError:
        pass
    m = bpy.data.materials.new('glass_%s_%d' % (tint.lstrip('#'), int(transp * 100)))
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = T.hex_lin(tint)
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mx = nt.nodes.new('ShaderNodeMixShader')
    mx.inputs[0].default_value = transp
    nt.links.new(em.outputs[0], mx.inputs[1])
    nt.links.new(tr.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs[0])
    try:
        m.surface_render_method = 'BLENDED'
    except Exception:
        pass
    _GLASS[key] = m
    return m


def fit_text(name, text, x0, x1, z0, z1, y, col, bold=0.006, font=None, size=0.4, align='CENTER', depth=0.01,
             keep_aspect=False):
    """Text mesh scaled to fill the screen box [x0,x1]x[z0,z1] on a facade plane at y (front side)."""
    kw = {} if font is None else {'font': font}
    t = P.text_mesh(name, text, size=size, depth=depth, bold=bold, stretch_z=ST, loc=(0, 0, 0), m=M(col), **kw)
    (a, b), _, (c, d) = P.bounds([t])
    sx, sz = (x1 - x0) / (b - a), (z1 - z0) / (d - c)
    if keep_aspect:
        s = min(sx, sz)
        sx = sz = s
    P.xform(t, scale=(sx, 1, sz))
    (a, b), _, (c, d) = P.bounds([t])
    cx = (x0 + x1) / 2 if align == 'CENTER' else (x0 + (b - a) / 2 if align == 'LEFT' else x1 - (b - a) / 2)
    P.xform(t, loc=(cx - (a + b) / 2, y, (z0 + z1) / 2 - (c + d) / 2))
    return t


def chevron(name, cx, y, ztop, hw, din, dmid, dout, white='#fbfbfb', grey='#e4e4e4', depth=0.02):
    """The dealership logo: white chevron over a light-grey lower bevel band (t062 crop)."""
    w = P.prism(name + 'W', [(cx - hw, ztop), (cx, ztop - dmid), (cx + hw, ztop), (cx, ztop - din)][::-1],
                y - depth, y, M(white))
    g = P.prism(name + 'G', [(cx - hw, ztop), (cx, ztop - dout), (cx + hw, ztop), (cx, ztop - dmid)][::-1],
                y - depth * 0.6, y, M(grey))
    return [w, g]


def window(name, x0, x1, z0, z1, y, cols, transom, frame='#514f50', outer=0.09, top_bar=0.14, bar=0.055,
           glass=None, frame_depth=0.07, out=None):
    """Framed shop window on the facade plane y (frame protrudes to y - frame_depth); see-through glass."""
    out = [] if out is None else out
    fy0, fy1 = y - frame_depth, y + 0.02
    for (a, b, c, d) in ((x0, x1, z1 - top_bar, z1), (x0, x1, z0, z0 + outer), (x0, x0 + outer, z0, z1),
                         (x1 - outer, x1, z0, z1)):
        out.append(boxp(name + 'Frame', a, b, fy0, fy1, c, d, frame, P.tint(frame, 1.25)))
    w_in = (x1 - x0 - 2 * outer)
    for i in range(1, cols):
        xm = x0 + outer + w_in * i / cols
        out.append(boxp(name + 'Mull', xm - bar / 2, xm + bar / 2, fy0 + 0.02, fy1, z0, z1, frame, P.tint(frame, 1.25)))
    if transom:
        out.append(boxp(name + 'Transom', x0, x1, fy0 + 0.02, fy1, transom - bar / 2, transom + bar / 2, frame,
                        P.tint(frame, 1.25)))
    g = P.boxmm(name + 'Glass', x0 + outer * 0.5, x1 - outer * 0.5, y - 0.01, y, z0 + outer * 0.5, z1 - top_bar * 0.5)
    P.setm(g, glass or glass_mat())
    out.append(g)
    return out


def rrect_xy(x0, x1, y0, y1, r, segs=4):
    """Rounded rectangle outline in the XY plane (CCW)."""
    w, d = x1 - x0, y1 - y0
    return P.rrect(w, d, r, segs, (x0 + x1) / 2, (y0 + y1) / 2)


def front_round(x0, x1, y0, y1, r, segs=4):
    """XY outline (CCW) of a rectangle whose two front (y0) corners are rounded."""
    pts = []
    for i in range(segs + 1):                        # front-left corner
        a = math.radians(180 + 90 * i / segs)
        pts.append((x0 + r + r * math.cos(a), y0 + r + r * math.sin(a)))
    for i in range(segs + 1):                        # front-right corner
        a = math.radians(270 + 90 * i / segs)
        pts.append((x1 - r + r * math.cos(a), y0 + r + r * math.sin(a)))
    pts += [(x1, y1), (x0, y1)]
    return pts


def rel_fn(AX, AY):
    def rel(x, y):
        return [round(x - AX, 3), round(y - AY, 3)]

    def rect(x0, x1, y0, y1):
        return {'x0': round(x0 - AX, 3), 'x1': round(x1 - AX, 3), 'y0': round(y0 - AY, 3), 'y1': round(y1 - AY, 3)}
    return rel, rect


# ============================================================ roof bits ===
AC = dict(top='#a2bd9e', front='#8ea98b', side='#839e80', fan='#3b3b3b', fanRim='#2c2c2c', grille='#2f2f2f',
          slat='#3d3d3d', panel='#7c937a', base='#464646', line='#8aa287')


def ac_objs():
    """Rooftop condenser (t074 / t426): 1.4 x 0.66 x 1.0 sage box, black fan on top, grille + panel in front."""
    W, D, H, hb = 1.40, 0.66, 1.18, 0.15
    hw, hd = W / 2, D / 2
    o = []
    o.append(boxp('AcBase', -hw + 0.06, hw - 0.06, -hd + 0.05, hd - 0.03, 0, hb, AC['base'], AC['base']))
    o.append(boxp('AcBody', -hw, hw, -hd, hd, hb, H, AC['front'], AC['top'], AC['side']))
    # fan on the top (west half) + lines on the east half
    o.append(P.cyl('AcFanRim', 0.27, 0.012, 20, (-0.33, 0.0, H), m=M(AC['fanRim'], TOP), rz=0.2))
    o.append(P.cyl('AcFan', 0.24, 0.02, 20, (-0.33, 0.0, H), m=M(AC['fan'], TOP), rz=0.18))
    for a in range(4):
        ang = a * math.pi / 4
        b = P.box('AcBlade', (0.44, 0.012, 0.012), (-0.33, 0, H + 0.025), rot=(0, 0, ang))
        P.xform(b, scale=(1, 0.75, 1))
        P.setm(b, M('#555555', TOP))
        o.append(b)
    for i in range(3):
        y = -0.12 + i * 0.12
        o.append(P.boxmm('AcLine', 0.08, 0.60, y - 0.008, y + 0.008, H, H + 0.006, M(AC['line'], TOP)))
    # front: louvred grille (west), small service panel (east)
    yf = -hd
    o.append(P.boxmm('AcGrille', -0.62, -0.10, yf - 0.012, yf, hb + 0.10, H - 0.22, M(AC['grille'])))
    for i in range(9):
        z = hb + 0.14 + i * 0.075
        o.append(P.boxmm('AcSlat', -0.60, -0.12, yf - 0.02, yf - 0.01, z, z + 0.018, M(AC['slat'])))
    o.append(P.boxmm('AcPanel', 0.22, 0.58, yf - 0.012, yf, hb + 0.12, hb + 0.42, M(AC['panel'])))
    return o


VENT = dict(top='#cdcdcd', side='#a8a8a8', skirt='#d2d2d2', skirtS='#b9b7b6', neck='#929292', base='#4a4a4a')


def vent_objs():
    """Mushroom roof vent (t074): dark curb, neck, wide skirt, domed cap. ~0.95 wide, 1.05 tall."""
    o = []
    o.append(boxp('VBase', -0.33, 0.33, -0.22, 0.22, 0, 0.12, VENT['base'], '#5a5a5a'))
    o.append(P.cyl('VNeck', 0.22, 0.36, 18, (0, 0, 0.12), m=M(VENT['neck'])))
    sk = P.cyl('VSkirt', 0.48, 0.14, 22, (0, 0, 0.44), r2=0.34, rz=0.40)
    P.paint(sk, M(VENT['skirtS']), top=M(VENT['skirt'], TOP), top_thresh=0.35)
    o.append(sk)
    o.append(P.cyl('VBody', 0.30, 0.28, 18, (0, 0, 0.58), m=M(VENT['side']), rz=0.25))
    d = T.ico('VDome', 0.30, 2, scale=(1, 0.83, 0.6), loc=(0, 0, 0.86))
    for v in d.data.vertices:
        if v.co.z < 0.86:
            v.co.z = 0.86
    P.paint(d, M(VENT['side']), top=M(VENT['top'], TOP), top_thresh=0.55)
    o.append(d)
    return o


def build_roof_bits():
    return [('ac_unit', ac_objs(), {'footprint': [1.4, 0.66], 'blocksSight': False, 'height': 1.18,
                                    'note': 'rooftop condenser; also baked into the building roofs (json roofProps)'}),
            ('roof_vent', vent_objs(), {'footprint': [0.66, 0.44], 'blocksSight': False, 'height': 1.04,
                                        'note': 'mushroom roof vent; baked into the building roofs'})]


# ================================================================ dealership ===
DC = dict(
    white='#d9dce1', cornice='#b1b1b1', cap='#e7e7e7', roof='#687877', inner='#b1b1b1', frame='#514f50',
    red='#b13744', redTop='#c73e4e', doorFrame='#505050', handle='#c9d3d6',
    # interior (undimmed: the original darkens interiors ~0.78x with a slight blue tint -> game-side)
    floor='#313133', iwall='#dcdde4', rim='#b1b1b1', cutTop='#bdbdbd', cutFront='#9a9a9a',
    plinth='#e7e7e7', plinthFront='#b13744', dplinth='#38383a', dplinthFront='#1d1d1f',
    moto='#6e6a73', motoSide='#57545c', partition='#85848c', partTop='#9d9ca5', gframe='#66666e',
    gpane='#73899a',
)
DL = dict(
    W=22.71, D=9.01, t=0.2, wall=6.64, top=7.08, deck=6.75,
    win_z0=0.0, win_z1=5.50, transom=3.68, win_y=0.20,
    windows=[(0.95, 4.65, 3), (5.07, 8.77, 3), (9.19, 12.89, 3), (19.27, 21.77, 2)],
    red_x0=13.31, red_x1=18.81, red_y0=-0.23, red_y1=1.07,
    open_x0=13.74, open_x1=16.82, open_h=2.75,
    door_x0=14.81, door_x1=15.76, door_h=2.0,
    chev_cx=15.30, chev_top=5.88,
    cut=0.32, back_h=6.64,
    office_x0=18.30, office_y0=3.60, office_h=2.82, odoor_x0=20.40, odoor_x1=21.30,
)
DAX, DAY = DL['W'] / 2, DL['D'] / 2
# display plinths (building-local rects): light = white top / red front, dark = black, moto = round
PLINTHS = [
    dict(kind='light', x0=1.20, x1=5.50, y0=1.55, y1=3.65, h=0.18, price=500, vehicle='red sedan (price unconfirmed)'),
    dict(kind='light', x0=6.70, x1=11.13, y0=1.55, y1=3.65, h=0.18, price=250, vehicle='teal sedan'),
    dict(kind='light', x0=1.20, x1=5.50, y0=5.70, y1=8.00, h=0.18, price=350, vehicle='cyan pickup'),
    dict(kind='dark', x0=8.80, x1=13.27, y0=5.65, y1=8.45, h=0.29, price=2500, vehicle='red sports car'),
    dict(kind='round', cx=20.30, cy=7.40, r=1.05, h=0.10, price=50000, vehicle='red motorcycle'),
]
PLATES = [(500, 4.85, 1.40), (250, 10.47, 1.40), (350, 4.85, 5.45), (2500, 12.61, 5.50), (50000, 20.33, 6.15)]
DEALER_FURN = [('dealer_desk', 15.25, 2.70), ('potted_palm', 13.56, 2.80), ('potted_palm', 16.90, 2.80),
               ('potted_palm', 21.70, 8.40), ('brochure_stand', 19.35, 3.33), ('computer_desk', 17.20, 6.98),
               ('bench_red', 22.22, 2.40)]


def dealer_parts():
    c, C = DL, DC
    parts = dict(walls=[], roof=[], inside=[], interior=[], ifront=[], imid=[], door=[], door_open=[],
                 odoor=[], odoor_open=[])
    W_, R_ = parts['walls'], parts['roof']
    Wd, D, t = c['W'], c['D'], c['t']
    # ---------------- facade: wall pieces between the window openings
    z0w, z1w = c['win_z0'], c['win_z1']
    solid = [(0.0, 0.95), (4.65, 5.07), (8.77, 9.19), (12.89, c['red_x0']), (c['red_x1'], 19.27), (21.77, Wd)]
    for (a, b) in solid:
        W_.append(boxp('Pier', a, b, 0.0, t, 0, c['wall'], C['white'], C['cap']))
    # windows are recessed 0.2 m behind the pier faces (o05: frame bottoms sit 32 px above the pier bases)
    for (a, b, _) in c['windows']:
        W_.append(boxp('Lintel', a, b, 0.0, t, z1w - 0.01, c['wall'], C['white'], C['cap'], bottom=C['cornice']))
    for i, (a, b, cols) in enumerate(c['windows']):
        window('Win%d' % i, a, b, z0w, z1w, c['win_y'] + 0.06, cols, c['transom'], C['frame'], out=W_)
    # cornice band + parapet ring + roof deck
    for (a, b) in ((0.0, c['red_x0']), (c['red_x1'], Wd)):
        W_.append(boxp('Cornice', a, b, -0.02, t, c['wall'], c['top'], C['cornice'], C['cap']))
        R_.append(boxp('CapF', a, b, -0.02, t, c['top'] - 0.01, c['top'], C['cornice'], C['cap']))
    R_.append(boxp('ParN', 0.0, Wd, D - t, D, c['deck'], c['top'], C['inner'], C['cap'], back=C['white']))
    for (a, b) in ((0.0, t), (Wd - t, Wd)):
        R_.append(boxp('ParS', a, b, t, D - t, c['deck'], c['top'], C['inner'], C['cap']))
    R_.append(boxp('Deck', t, Wd - t, t, D - t, c['deck'] - 0.25, c['deck'], C['roof'], C['roof']))
    # shell behind (side + back walls, hidden mostly)
    W_.append(boxp('ShellW', 0.0, t, t, D, 0, c['wall'], C['white'], C['cap']))
    W_.append(boxp('ShellE', Wd - t, Wd, t, D, 0, c['wall'], C['white'], C['cap']))
    W_.append(boxp('ShellN', 0.0, Wd, D - t, D, 0, c['wall'], C['white'], C['cap']))
    # ---------------- red entrance portal (protrudes 0.23 m), door opening with a recessed glass door
    rx0, rx1, ry0, ry1 = c['red_x0'], c['red_x1'], c['red_y0'], c['red_y1']
    ox0, ox1, oh = c['open_x0'], c['open_x1'], c['open_h']
    for (a, b) in ((rx0, ox0), (ox1, rx1)):
        W_.append(boxp('RedLeg', a, b, ry0, t, 0, c['top'], C['red'], C['redTop']))
    W_.append(boxp('RedLintel', ox0, ox1, ry0, t, oh, c['top'], C['red'], C['redTop']))
    R_.append(boxp('RedTop', rx0, rx1, t, ry1, c['top'] - 0.25, c['top'], C['red'], C['redTop']))
    W_.append(boxp('RedSoffit', ox0, ox1, ry0, 0.0, oh - 0.02, oh, C['red'], C['redTop'], bottom='#8f2c37'))
    W_ += chevron('Chev', c['chev_cx'], ry0, c['chev_top'], 1.165, 0.83, 1.20, 1.59)
    # glass door section in the opening (facade plane y = 0.05)
    gy = 0.05
    fr = C['doorFrame']
    dx0, dx1, dh = c['door_x0'], c['door_x1'], c['door_h']
    for (a, b) in ((ox0, ox0 + 0.07), (ox1 - 0.07, ox1), (dx0 - 0.035, dx0 + 0.02), (dx1 - 0.02, dx1 + 0.035)):
        W_.append(boxp('DFrame', a, b, gy - 0.05, gy + 0.03, 0, oh, fr, P.tint(fr, 1.25)))
    for (a, b) in ((ox0, dx0), (dx1, ox1)):
        W_.append(boxp('DTransomS', a, b, gy - 0.05, gy + 0.03, dh - 0.03, dh + 0.03, fr, P.tint(fr, 1.25)))
    W_.append(boxp('DTransom', dx0, dx1, gy - 0.05, gy + 0.03, dh - 0.02, dh + 0.04, fr, P.tint(fr, 1.25)))
    W_.append(boxp('DBase', ox0, ox1, gy - 0.05, gy + 0.03, 0, 0.05, fr, P.tint(fr, 1.25)))
    for (a, b, z0_, z1_) in ((ox0 + 0.04, dx0, 0.03, oh - 0.02), (dx1, ox1 - 0.04, 0.03, oh - 0.02),
                             (dx0, dx1, dh, oh - 0.02)):
        g = P.boxmm('DGlass', a, b, gy - 0.005, gy, z0_, z1_)
        P.setm(g, glass_mat())
        W_.append(g)
    # door leaf (closed) + its own layer
    leaf = door_leaf('DLeaf', dx1 - dx0, dh, fr)
    W_ += [P.duplicate(o) for o in shift(leaf, dx0, gy - 0.06)]
    parts['door'] = leaf
    lo = door_leaf('DLeafO', dx1 - dx0, dh, fr)
    P.rotate_objs(lo, math.radians(-70))
    parts['door_open'] = shift(lo, dx0, gy - 0.06)
    # ---------------- rooftop AC + vent (t074)
    R_ += place(ac_objs(), 18.08, 1.95, c['deck'])
    R_ += place(vent_objs(), 18.05, 6.35, c['deck'])

    # ================= interior (roof off) =================
    I = parts['interior']
    I.append(boxp('Floor', 0.0, Wd, t, D, -0.02, 0.0, C['floor'], C['floor']))
    I.append(boxp('BackWall', 0.0, Wd, D - t, D, 0, c['back_h'], C['iwall'], C['rim']))
    I.append(boxp('BackRed', 8.24, 13.84, D - t - 0.02, D - t, 0, c['back_h'], C['red'], C['rim']))
    I += chevron('BChev', 11.04, D - t - 0.02, 3.04, 1.0, 0.71, 1.03, 1.36)
    for (a, b) in ((0.0, t), (Wd - t, Wd)):
        I.append(boxp('SideCut', a, b, t, D - t, 0, c['cut'], C['cutFront'], C['cutTop']))
    for p in PLINTHS:
        if p['kind'] == 'round':
            pl = P.cyl('Moto', p['r'], p['h'], 28, (p['cx'], p['cy'], 0), rz=p['r'] * 0.93)
            P.paint(pl, M(C['motoSide']), top=M(C['moto'], TOP), top_thresh=0.5)
        elif p['kind'] == 'dark':
            pl = boxp('PlinthD', p['x0'], p['x1'], p['y0'], p['y1'], 0, p['h'], C['dplinthFront'], C['dplinth'])
        else:
            pl = boxp('PlinthL', p['x0'], p['x1'], p['y0'], p['y1'], 0, p['h'], C['plinthFront'], C['plinth'])
        I.append(pl)
    parts['inside'] = list(I)          # what shows through the shop windows (plus furniture, office)
    # ---- office (NE): glass south wall with a door + thin west partition, full 2.82 m -> mid layer
    MID = parts['imid']
    ox0_, oy0, oH = c['office_x0'], c['office_y0'], c['office_h']
    MID.append(boxp('Partition', ox0_, ox0_ + 0.11, oy0, D - t, 0, oH, C['partition'], C['partTop']))
    gw0, gw1 = ox0_ + 0.11, Wd - t
    MID.append(boxp('GWTop', ox0_, gw1, oy0, oy0 + 0.15, oH - 0.12, oH, C['gframe'], P.tint(C['gframe'], 1.2)))
    MID.append(boxp('GWBase', gw0, gw1, oy0, oy0 + 0.15, 0, 0.06, C['gframe'], P.tint(C['gframe'], 1.2)))
    od0, od1 = c['odoor_x0'], c['odoor_x1']
    for xm in (gw0 + 0.03, 19.37, od0, od1, gw1 - 0.03):
        MID.append(boxp('GWMull', xm - 0.04, xm + 0.04, oy0, oy0 + 0.15, 0, oH, C['gframe'], P.tint(C['gframe'], 1.2)))
    MID.append(boxp('GWTransom', od0, od1, oy0, oy0 + 0.15, 2.05, 2.13, C['gframe'], P.tint(C['gframe'], 1.2)))
    for (a, b, z0_, z1_) in ((gw0, od0, 0.06, oH - 0.12), (od1, gw1, 0.06, oH - 0.12), (od0, od1, 2.13, oH - 0.12)):
        MID.append(P.boxmm('GWPane', a, b, oy0 + 0.06, oy0 + 0.08, z0_, z1_, M(C['gpane'])))
    oleaf = door_leaf('OLeaf', od1 - od0 - 0.08, 2.03, C['gframe'], glass=C['gpane'], handle=True)
    parts['odoor'] = shift(oleaf, od0 + 0.04, oy0 + 0.04)
    ol2 = door_leaf('OLeafO', od1 - od0 - 0.08, 2.03, C['gframe'], glass=C['gpane'], handle=True)
    P.rotate_objs(ol2, math.radians(-70))
    parts['odoor_open'] = shift(ol2, od0 + 0.04, oy0 + 0.02)
    # ---- front wall cut low (own sort layer): solid piers + red legs; windows leave a low sill
    F = parts['ifront']
    for (a, b) in solid:
        F.append(boxp('FrontCut', a, b, 0.0, t, 0, c['cut'], C['cutFront'], C['cutTop']))
    for (a, b, _) in c['windows']:
        F.append(boxp('SillCut', a, b, 0.0, t, 0, 0.12, C['cutFront'], C['cutTop']))
    for (a, b) in ((rx0, ox0), (ox1, rx1)):
        F.append(boxp('RedCut', a, b, ry0, t, 0, c['cut'], C['cutFront'], C['cutTop']))
    for (a, b) in ((ox0, dx0), (dx1, ox1)):
        F.append(boxp('DoorSideCut', a, b, 0.0, t, 0, 0.12, C['cutFront'], C['cutTop']))
    F.append(P.boxmm('Threshold', dx0, dx1, 0.0, t, 0, 0.03, M(C['cutTop'], TOP)))
    return parts


def door_leaf(name, w, h, frame, glass=None, handle=True):
    """Glass shop door leaf in its own frame: hinge edge at x=0, y=0, leaf along +x, 0.05 thick (front y<0)."""
    o = []
    f = 0.07
    for (a, b, c_, d) in ((0, f, 0, h), (w - f, w, 0, h), (0, w, h - f, h), (0, w, 0, 0.12)):
        o.append(boxp(name + 'F', a, b, -0.05, 0.0, c_, d, frame, P.tint(frame, 1.25)))
    g = P.boxmm(name + 'G', f, w - f, -0.03, -0.02, 0.12, h - f)
    P.setm(g, M(glass) if glass else glass_mat())
    o.append(g)
    if handle:
        o.append(P.boxmm(name + 'H', w - 0.16, w - 0.12, -0.09, -0.05, 0.85, 1.25, M(DC['handle'])))
    return o


# --------------------------------------------------------- dealer furniture ---
FC = dict(white='#e7e7e7', whiteS='#d4d4da', inner='#c6c6cc', red='#b13744', pot='#a75c49', potRim='#b86a55',
          soil='#4a3326', leaf='#2d6d30', leafL='#3d8a3e', leafD='#225324',
          wood='#6e5530', woodTop='#86683c', header='#5b4628', panel='#7a5d33', paper='#e8e8e8', paperG='#a5a5a5',
          ink='#6e6e6e', leg='#3a3a3a',
          cdesk='#c0394c', cdeskEnd='#b7b6c0', monitor='#222224', kb='#c9c6cf', mouse='#e6e6e6',
          bench='#c13a4e', benchTop='#cf4558', benchDark='#2a2a2c',
          plate='#161616', plateTop='#222222', gold='#b79431', coin='#b8962c', coinRim='#9a7b25', coinMark='#a5862a')


def desk_objs():
    """Reception counter (t063 / t576): white U top, red front with the chevron, rounded front corners.
    2.08 wide, front counter 0.45 deep + side returns to 0.95, 0.9 tall."""
    W, H = 2.08, 1.00
    hw = W / 2
    o = []
    y0, y1 = -0.47, -0.02
    body = P.slab('DeskBody', front_round(-hw, hw, y0, y1, 0.22, 5), 0.0, H - 0.07)
    P.paint(body, M(FC['red']), top=M(FC['white'], TOP), side=M('#9f313d', RIGHTN), left=M('#a3323e', LEFTN))
    o.append(body)
    top = P.slab('DeskTop', front_round(-hw - 0.02, hw + 0.02, y0 - 0.02, y1, 0.24, 5), H - 0.07, H)
    P.paint(top, M(FC['whiteS']), top=M(FC['white'], TOP))
    o.append(top)
    for sx in (-1, 1):
        a, b = (-hw, -hw + 0.36) if sx < 0 else (hw - 0.36, hw)
        o.append(boxp('Return', a, b, y1 - 0.02, 0.48, 0, H, FC['inner'], FC['white'], FC['whiteS'],
                      back=FC['white']))
    o.append(boxp('Inner', -hw + 0.36, hw - 0.36, y1 - 0.02, y1 + 0.02, 0, H - 0.2, FC['inner'], FC['inner']))
    o.append(boxp('Shelf', -hw + 0.36, hw - 0.36, y1, y1 + 0.42, H - 0.24, H - 0.20, FC['inner'], FC['whiteS']))
    o += chevron('DChev', 0.0, y0, 0.70, 0.40, 0.17, 0.23, 0.30)
    return o


def palm_objs(seed=4):
    """Potted palm (t063): terracotta pot 0.5 wide, 0.5 tall, 7 long fronds to ~1.4 m."""
    rnd = random.Random(seed)
    o = []
    pot = P.cyl('Pot', 0.25, 0.46, 18, (0, 0, 0), r2=0.30)
    P.paint(pot, M(FC['pot']), top=M(FC['soil'], TOP), top_thresh=0.6)
    o.append(pot)
    o.append(P.cyl('PotRim', 0.315, 0.07, 18, (0, 0, 0.42), m=M(FC['potRim'])))
    o.append(P.cyl('Soil', 0.27, 0.02, 16, (0, 0, 0.46), m=M(FC['soil'], TOP)))
    fronds = [(-150, 40), (-110, 62), (-75, 75), (-30, 58), (20, 64), (65, 72), (110, 48), (160, 38), (90, 82),
              (-90, 84)]
    for i, (az, el) in enumerate(fronds):
        a, e = math.radians(az + rnd.uniform(-8, 8)), math.radians(el)
        L = rnd.uniform(0.62, 0.85)
        base = Vector((0, 0, 0.47))
        d = Vector((math.cos(a) * math.cos(e) * 0.85, math.sin(a) * math.cos(e) * 0.55, math.sin(e)))
        mid = base + d * L * 0.6
        tip = base + d * L + Vector((0, 0, -0.25 * math.cos(e)))
        side = Vector((-math.sin(a), math.cos(a), 0)) * 0.07
        col = FC['leafL'] if i % 3 == 0 else (FC['leaf'] if i % 3 == 1 else FC['leafD'])
        bm = bmesh.new()
        vs = [bm.verts.new(p) for p in (base + side * 0.4, mid + side, tip, mid - side, base - side * 0.4)]
        bm.faces.new(vs)
        lf = P.bm_obj('Frond', bm, recalc=False)
        P.setm(lf, M(col, (0, -0.5, 0.85)))
        o.append(lf)
    return o


def brochure_objs():
    """Brochure / newspaper rack (t063 crop): wooden frame, 2 shelves of papers, header board. 0.7 x 0.42 x 1.3."""
    W, D = 0.70, 0.42
    hw, hd = W / 2, D / 2
    o = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * (hw - 0.04), sy * (hd - 0.04)
            o.append(P.boxmm('Leg', x - 0.025, x + 0.025, y - 0.025, y + 0.025, 0, 0.95, M(FC['leg'])))
    for z in (0.12, 0.60):
        o.append(boxp('Tray', -hw, hw, -hd, hd, z, z + 0.06, FC['wood'], FC['woodTop']))
        o.append(boxp('Lip', -hw, hw, -hd - 0.01, -hd + 0.03, z, z + 0.12, FC['wood'], FC['woodTop']))
    # paper stacks
    o.append(boxp('Stack1', -hw + 0.06, hw - 0.06, -hd + 0.05, hd - 0.05, 0.18, 0.44, '#9c9c9c', '#d8d8d8'))
    o.append(boxp('Stack2', -hw + 0.06, hw - 0.06, -hd + 0.05, hd - 0.05, 0.66, 0.86, '#9c9c9c', '#d8d8d8'))
    for z in (0.22, 0.28, 0.34, 0.40, 0.70, 0.76, 0.82):
        o.append(P.boxmm('Line', -hw + 0.06, hw - 0.06, -hd + 0.04, -hd + 0.05, z, z + 0.025, M('#c7c7c7')))
    # header board at the back + the front newspaper leaning on it
    o.append(boxp('Header', -hw * 0.75, hw * 0.75, hd - 0.08, hd, 0.86, 1.32, FC['header'], FC['woodTop']))
    o.append(P.boxmm('HeaderPanel', -hw * 0.5, hw * 0.5, hd - 0.09, hd - 0.08, 1.12, 1.26, M(FC['panel'])))
    pap = boxp('Paper', -hw + 0.04, hw - 0.04, -0.02, 0.0, 0.86, 1.18, FC['paper'], FC['paper'])
    P.xform(pap, rot=(math.radians(-14), 0, 0))
    pap.location = (0, 0.02, 0.06)
    T.apply_transforms(pap)
    o.append(pap)
    for (a, b, z0, z1) in ((-0.28, 0.28, 1.10, 1.15), (-0.28, -0.12, 0.92, 1.06)):
        g = P.boxmm('Print', a, b, -0.05, -0.04, z0, z1, M(FC['ink']))
        P.xform(g, rot=(math.radians(-14), 0, 0))
        g.location = (0, 0.02, 0.06)
        T.apply_transforms(g)
        o.append(g)
    for z in (0.94, 0.98, 1.02):
        g = P.boxmm('PrintL', -0.08, 0.28, -0.05, -0.04, z, z + 0.018, M(FC['ink']))
        P.xform(g, rot=(math.radians(-14), 0, 0))
        g.location = (0, 0.02, 0.06)
        T.apply_transforms(g)
        o.append(g)
    return o


def compdesk_objs():
    """Long red sales desk running N-S with two PCs (t582 / t588): 0.8 x 3.65 x 0.75, grey end panel."""
    W, L, H = 0.80, 3.65, 0.75
    hw, hl = W / 2, L / 2
    o = []
    o.append(boxp('CTop', -hw, hw, -hl, hl, H - 0.06, H, FC['cdesk'], FC['cdesk'], '#a9323f'))
    o.append(boxp('CEndS', -hw, hw, -hl, -hl + 0.06, 0, H - 0.06, FC['cdeskEnd'], FC['cdeskEnd']))
    o.append(boxp('CEndN', -hw, hw, hl - 0.06, hl, 0, H - 0.06, FC['cdeskEnd'], FC['cdeskEnd']))
    o.append(boxp('CPanel', -hw + 0.05, -hw + 0.10, -hl + 0.06, hl - 0.06, 0.1, H - 0.06, '#8f2c39', '#8f2c39'))
    for yc in (-0.75, 0.85):
        o.append(boxp('MonBase', -0.30, -0.12, yc - 0.12, yc + 0.12, H, H + 0.03, FC['monitor'], '#3a3a3c'))
        o.append(boxp('MonStem', -0.24, -0.19, yc - 0.03, yc + 0.03, H, H + 0.20, FC['monitor'], '#3a3a3c'))
        o.append(boxp('Monitor', -0.27, -0.21, yc - 0.30, yc + 0.30, H + 0.12, H + 0.55, FC['monitor'], '#3a3a3c',
                      '#2c2c2e'))
        o.append(boxp('Keyboard', 0.04, 0.22, yc - 0.24, yc + 0.24, H, H + 0.03, '#9d9aa3', FC['kb']))
        for k in range(6):
            yy = yc - 0.2 + k * 0.08
            o.append(P.boxmm('Keys', 0.07, 0.19, yy, yy + 0.04, H + 0.03, H + 0.035, M('#aeabb4', TOP)))
        o.append(P.cyl('Mouse', 0.04, 0.03, 10, (0.12, yc + 0.40, H), m=M(FC['mouse'], TOP), rz=0.055))
    return o


def bench_objs():
    """Red sofa against the east wall, facing west (t584): 0.55 x 2.0, seat 0.45, back on the east side."""
    W, L = 0.55, 2.0
    hw, hl = W / 2, L / 2
    o = []
    o.append(boxp('Seat', -hw, hw - 0.14, -hl, hl, 0.12, 0.45, FC['bench'], FC['benchTop'], '#a83445'))
    o.append(boxp('Back', hw - 0.14, hw, -hl, hl, 0.12, 0.88, FC['bench'], FC['benchTop'], '#a83445'))
    for y in (-hl + 0.06, hl - 0.06):
        for x in (-hw + 0.06, hw - 0.06):
            o.append(P.boxmm('BLeg', x - 0.03, x + 0.03, y - 0.03, y + 0.03, 0, 0.12, M(FC['benchDark'])))
    return o


def coin_objs(cx, y, cz, r):
    """Raccoon coin as a flat disc facing -y, stretched x1/cos so it reads round (gold face, darker rim)."""
    o = []
    o.append(P.cyl('CoinRim', r, 0.03, 24, (cx, y + 0.02, cz), axis='-Y', rz=r * ST, m=M(FC['coinRim'])))
    o.append(P.cyl('CoinFace', r * 0.92, 0.012, 24, (cx, y - 0.012, cz + r * 0.06), axis='-Y', rz=r * 0.92 * ST,
                   m=M(FC['coin'])))
    o.append(P.cyl('CoinIn', r * 0.62, 0.006, 20, (cx, y - 0.018, cz + r * 0.06), axis='-Y', rz=r * 0.62 * ST,
                   m=M(FC['coinMark'])))
    return o


def plate_objs(price):
    """Dark price plate (t578 crop): W x 0.05 x 0.72 stand, gold digits + raccoon coin."""
    txt = str(price)
    W = 1.30 if len(txt) <= 4 else 1.75
    H = 0.72
    o = [boxp('Plate', -W / 2, W / 2, -0.025, 0.025, 0, H, FC['plate'], FC['plateTop'])]
    zc = H * 0.50
    cr = 0.17
    tw = W - 2 * 0.13 - 2 * cr - 0.10
    t = fit_text('Price', txt, -W / 2 + 0.13, -W / 2 + 0.13 + tw, zc - 0.19, zc + 0.19, -0.026, FC['gold'], bold=0.012,
                 keep_aspect=True, align='LEFT')
    o.append(t)
    (a, b), _, _ = P.bounds([t])
    o += coin_objs(b + 0.07 + cr, -0.03, zc, cr)
    return o


def build_dealer_furniture():
    out = [
        ('dealer_desk', desk_objs(), {'footprint': [2.1, 1.0], 'blocksSight': False, 'height': 1.0,
                                      'note': 'reception counter, clerk stands north of it (inside the U)'}),
        ('potted_palm', palm_objs(), {'footprint': [0.6, 0.6], 'blocksSight': False, 'height': 1.35}),
        ('brochure_stand', brochure_objs(), {'footprint': [0.7, 0.42], 'blocksSight': False, 'height': 1.32}),
        ('computer_desk', compdesk_objs(), {'footprint': [0.8, 3.65], 'blocksSight': False, 'height': 1.3,
                                            'note': 'long axis N-S, monitors on the west half facing east'}),
        ('bench_red', bench_objs(), {'footprint': [0.55, 2.0], 'blocksSight': False, 'height': 0.88,
                                     'note': 'sofa facing west, back against an east wall'}),
    ]
    for price, _, _ in PLATES:
        W = 1.30 if len(str(price)) <= 4 else 1.75
        out.append(('price_plate_%d' % price, plate_objs(price),
                    {'footprint': [W, 0.1], 'blocksSight': False, 'height': 0.72,
                     'note': 'dark plate #161616, gold text #b79431 + coin; stands at the plinth front-right corner'}))
    return out


FURN_FN = {'dealer_desk': desk_objs, 'potted_palm': palm_objs, 'brochure_stand': brochure_objs,
           'computer_desk': compdesk_objs, 'bench_red': bench_objs}


def build_dealership():
    parts = dealer_parts()
    inside = parts.pop('inside')          # same objects as in parts['interior']
    for k in parts:
        shift(parts[k], -DAX, -DAY)
    # furniture + price plates are separate keys, but also baked into what shows through the glass
    furn = []
    for key, x, y in DEALER_FURN:
        furn += place(FURN_FN[key](), x, y)
    for price, x, y in PLATES:
        furn += place(plate_objs(price), x, y)
    shift(furn, -DAX, -DAY)
    see = inside + furn + [P.duplicate(o) for o in parts['imid']]
    c = DL
    rel, rect = rel_fn(DAX, DAY)
    Wd, D, t = c['W'], c['D'], c['t']
    base = {'footprint': [Wd, D], 'anchor_note': 'all dealership_* layers share this anchor (centre of the wall bbox)'}
    door = {'x0': rel(c['door_x0'], 0)[0], 'x1': rel(c['door_x1'], 0)[0], 'y': rel(0, 0)[1],
            'hinge': 'west jamb, opens outward (south)'}
    meta_ext = dict(base, blocksSight=True, layer='exterior', height=c['top'],
                    colliders=[rect(0, Wd, 0, D), rect(c['red_x0'], c['red_x1'], c['red_y0'], 0)],
                    door=door, roofProps=[{'key': 'ac_unit', 'pos': rel(18.08, 1.95), 'z': c['deck']},
                                          {'key': 'roof_vent', 'pos': rel(18.05, 6.35), 'z': c['deck']}],
                    note='22.7 m showroom: 3 big windows + red portal with the white chevron + 1 window east; '
                         'interior floor/plinths/furniture are baked in behind the see-through glass')
    solid = [(0.0, 0.95), (4.65, 5.07), (8.77, 9.19), (12.89, c['red_x0']), (c['red_x1'], 19.27), (21.77, Wd)]
    walls = [rect(a, b, 0, t) for (a, b) in solid] + \
            [rect(a, b, 0, t) for (a, b, _) in c['windows']] + \
            [rect(c['open_x0'], c['door_x0'], 0, t), rect(c['door_x1'], c['open_x1'], 0, t),
             rect(c['red_x0'], c['open_x0'], c['red_y0'], t), rect(c['open_x1'], c['red_x1'], c['red_y0'], t),
             rect(0, t, 0, D), rect(Wd - t, Wd, 0, D), rect(0, Wd, D - t, D),
             rect(c['office_x0'], c['office_x0'] + 0.11, c['office_y0'], D - t),
             rect(c['office_x0'], c['odoor_x0'], c['office_y0'], c['office_y0'] + 0.15),
             rect(c['odoor_x1'], Wd - t, c['office_y0'], c['office_y0'] + 0.15)]
    displays = []
    for p in PLINTHS:
        d = {'price': p['price'], 'vehicle': p['vehicle'], 'kind': p['kind'], 'h': p['h']}
        if p['kind'] == 'round':
            d.update(center=rel(p['cx'], p['cy']), r=p['r'])
        else:
            d.update(rect=rect(p['x0'], p['x1'], p['y0'], p['y1']), center=rel((p['x0'] + p['x1']) / 2,
                                                                               (p['y0'] + p['y1']) / 2))
        displays.append(d)
    plates = [{'key': 'price_plate_%d' % pr, 'price': pr, 'pos': rel(x, y)} for pr, x, y in PLATES]
    furniture = {}
    for key, x, y in DEALER_FURN:
        k = key
        n = 1
        while k in furniture:
            n += 1
            k = '%s#%d' % (key, n)
        furniture[k] = rel(x, y)
    meta_int = dict(base, layer='interior', walls=walls, cut_h=c['cut'],
                    rooms={'showroom': rect(t, Wd - t, t, D - t),
                           'office': rect(c['office_x0'] + 0.11, Wd - t, c['office_y0'] + 0.15, D - t)},
                    doors={'front': door,
                           'office': {'x0': rel(c['odoor_x0'], 0)[0], 'x1': rel(c['odoor_x1'], 0)[0],
                                      'y': rel(0, c['office_y0'])[1], 'hinge': 'west, swings south'}},
                    displays=displays, plates=plates, furniture=furniture,
                    note='floor + plinths (baked) + full-height back wall with the red chevron panel + cut side '
                         'walls. Original shows interiors ~1.55x zoomed and ~0.78x darker (game-side overlay).')
    return [
        ('dealership', parts['walls'] + parts['roof'] + see, meta_ext),
        ('dealership_roof', parts['roof'], dict(base, layer='roof', note='parapet + deck + AC + vent + red portal top')),
        ('dealership_interior', parts['interior'], meta_int),
        ('dealership_interior_mid', parts['imid'], dict(base, layer='interior_mid', sortY=rel(0, c['office_y0'])[1],
                                                         note='office glass wall (door gap) + west partition, 2.82 m')),
        ('dealership_interior_front', parts['ifront'], dict(base, layer='interior_front', sortY=rel(0, 0)[1],
                                                             note='front wall cut 0.32 m at piers, 0.12 m sills')),
        ('dealership_door', parts['door'], dict(base, layer='door', sortY=rel(0, 0)[1], note='glass door closed')),
        ('dealership_door_open', parts['door_open'], dict(base, layer='door', sortY=rel(0, -0.6)[1],
                                                          note='glass door swung 70 deg outward on the west jamb')),
        ('dealership_office_door', parts['odoor'], dict(base, layer='door', sortY=rel(0, c['office_y0'])[1])),
        ('dealership_office_door_open', parts['odoor_open'], dict(base, layer='door',
                                                                  sortY=rel(0, c['office_y0'] - 0.5)[1])),
    ]



# ======================================================= shared bits (lot) ===
FONT_SANS_BI = '/System/Library/Fonts/Supplemental/Arial Bold Italic.ttf'
FONT_BLACK = '/System/Library/Fonts/Supplemental/Arial Black.ttf'
FONT_ROUND = '/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf'
FONT_SCRIPT = '/System/Library/Fonts/Supplemental/Brush Script.ttf'


def facade(name, x0, x1, y0, y1, z1, openings, col, top=None, out=None, bottom=None):
    """Wall slab x0..x1 x y0..y1, z 0..z1 with rectangular openings [(a, b, c, d)] (x a..b, z c..d)."""
    out = [] if out is None else out
    cur = x0
    for (a, b, c_, d) in sorted(openings):
        if a > cur + 1e-4:
            out.append(boxp(name + 'Pier', cur, a, y0, y1, 0, z1, col, top))
        if c_ > 1e-4:
            out.append(boxp(name + 'Sill', a, b, y0, y1, 0, c_, col, top))
        if d < z1 - 1e-4:
            out.append(boxp(name + 'Lintel', a, b, y0, y1, d, z1, col, top, bottom=bottom or col))
        cur = b
    if x1 > cur + 1e-4:
        out.append(boxp(name + 'Pier', cur, x1, y0, y1, 0, z1, col, top))
    return out


def parapet_roof(name, x0, x1, y0, y1, top, deck, cap, inner, roof, out, t=0.2, front=True, outer=None):
    """Flat roof with a parapet ring (cap on top, inner faces visible on the north side)."""
    if front:
        out.append(boxp(name + 'CapS', x0, x1, y0, y0 + t, deck, top, inner, cap))
    out.append(boxp(name + 'ParN', x0, x1, y1 - t, y1, deck, top, inner, cap, back=outer or inner))
    for (a, b) in ((x0, x0 + t), (x1 - t, x1)):
        out.append(boxp(name + 'ParSide', a, b, y0 + t, y1 - t, deck, top, inner, cap))
    out.append(boxp(name + 'Deck', x0 + t, x1 - t, y0 + t, y1 - t, deck - 0.25, deck, roof, roof))
    return out


def stroke(name, pts, w, y, col, closed=False, depth=0.012):
    """Polyline [(x, z)] on a facade plane drawn as a band of width w (screen-ish metres)."""
    objs = []
    n = len(pts)
    segs = n if closed else n - 1
    for i in range(segs):
        a, b = Vector((pts[i][0], 0, pts[i][1])), Vector((pts[(i + 1) % n][0], 0, pts[(i + 1) % n][1]))
        d = (b - a)
        if d.length < 1e-5:
            continue
        nrm = Vector((-d.z, 0, d.x)).normalized() * (w / 2)
        ext = d.normalized() * (w / 2)
        q = [a - nrm - ext * 0.5, b - nrm + ext * 0.5, b + nrm + ext * 0.5, a + nrm - ext * 0.5]
        objs.append(P.prism(name, [(v.x, v.z) for v in q], y - depth, y, M(col)))
    return objs


def ellipse_pts(cx, cz, rx, rz, a0=0, a1=360, n=24):
    return [(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cz + rz * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def bricks(name, x0, x1, z0, z1, y, col, n, seed, w=0.22, h=0.09, out=None, ranges=None):
    """A few lighter brick marks scattered on a wall (pairs, like the reference); ranges = allowed x spans."""
    rnd = random.Random(seed)
    out = [] if out is None else out
    ranges = [r_ for r_ in (ranges or [(x0, x1)]) if r_[1] - r_[0] > 2 * w + 0.1]
    for i in range(n):
        a_, b_ = rnd.choice(ranges)
        x = rnd.uniform(a_, b_ - 2 * w)
        z = rnd.uniform(z0, z1 - h)
        for k in range(rnd.choice((1, 2, 2))):
            out.append(P.boxmm(name, x + k * (w + 0.03), x + k * (w + 0.03) + w, y - 0.006, y, z, z + h, M(col)))
        if rnd.random() < 0.5:
            out.append(P.boxmm(name, x + w * 0.5, x + w * 1.5, y - 0.006, y, z - h - 0.03, z - 0.03, M(col)))
    return out


# --------------------------------------------------------------- car lift ---
LIFT = dict(post='#e8404f', postTop='#f04557', postSide='#c43344', base='#d93a4a', arm='#f0b020', armTop='#f6c02c',
            armSide='#c88a18', pad='#2a2a2a', padTop='#3a3a3a', lamp='#f4f4f4')


def lift_objs(span=2.91, H=4.75):
    """Two-post car lift (t440): red posts 0.44 x 0.47 x 4.75 on base blocks, yellow swing arms with
    black pads on the floor. Posts at x = +-span/2 (centre to centre), drive-through along y."""
    o = []
    for sx in (-1, 1):
        x = sx * span / 2
        o.append(boxp('LBase', x - 0.26, x + 0.26, -0.40, 0.40, 0, 0.12, LIFT['base'], LIFT['postTop'], LIFT['postSide']))
        o.append(boxp('LPost', x - 0.22, x + 0.22, -0.235, 0.235, 0, H, LIFT['post'], LIFT['postTop'], LIFT['postSide']))
        o.append(boxp('LCarriage', x - 0.25 * sx - 0.10, x - 0.25 * sx + 0.10, -0.20, 0.20, 0.10, 0.75, LIFT['base'],
                      LIFT['postTop'], LIFT['postSide']))
        o.append(P.boxmm('LLamp', x - 0.05, x + 0.05, -0.245, -0.235, 1.30, 1.36, M(LIFT['lamp'])))
        o.append(P.boxmm('LLamp2', x - 0.04, x + 0.04, -0.245, -0.235, 1.18, 1.24, M('#c43344')))
        o.append(P.cyl('LHub', 0.13, 0.12, 12, (x - 0.30 * sx, 0, 0.10), m=M(LIFT['armTop'], TOP)))
        for sy in (-1, 1):
            a = math.radians(45) * sy
            dx, dy = -sx * math.cos(a), sy * math.sin(abs(a))
            p0 = Vector((x - 0.30 * sx, 0, 0.16))
            p1 = p0 + Vector((dx, dy, 0)) * 1.05
            arm = P.beam('LArm', p0, p1, 0.16, 0.10, up=(0, 0, 1))
            P.paint(arm, M(LIFT['arm']), top=M(LIFT['armTop'], TOP), side=M(LIFT['armSide'], RIGHTN))
            o.append(arm)
            pad = P.cyl('LPad', 0.12, 0.08, 14, (p1.x, p1.y, 0.12))
            P.paint(pad, M(LIFT['pad']), top=M(LIFT['padTop'], TOP), top_thresh=0.5)
            o.append(pad)
    return o


def jerrycan_objs():
    o = [boxp('Can', -0.17, 0.17, -0.12, 0.12, 0, 0.64, '#d23a48', '#e04a58', '#b8303e')]
    o.append(boxp('CanHandle', -0.10, 0.06, -0.03, 0.03, 0.64, 0.72, '#b8303e', '#e04a58'))
    spout = P.beam('Spout', (0.08, 0, 0.62), (0.20, 0, 0.78), 0.05, 0.05)
    P.setm(spout, M('#2a2a2a'))
    o.append(spout)
    return o


def pegboard_objs(x0, x1, z0, z1, y, seed=2):
    """Tan pegboard with a few tools (t440) on a wall plane y (front side = -y)."""
    rnd = random.Random(seed)
    o = [boxp('Peg', x0, x1, y - 0.04, y, z0, z1, '#b08a4c', '#c09a5a')]
    for i in range(int((x1 - x0) / 0.09)):
        for j in range(int((z1 - z0) / 0.12)):
            if rnd.random() < 0.55:
                x = x0 + 0.05 + i * 0.09
                z = z0 + 0.06 + j * 0.12
                o.append(P.boxmm('Hole', x, x + 0.02, y - 0.045, y - 0.04, z, z + 0.025, M('#7a5e30')))
    xs = x0 + 0.15
    while xs < x1 - 0.15:
        kind = rnd.choice(('wrench', 'screw', 'hammer', 'pliers', 'socket'))
        col = rnd.choice(('#3a3a3a', '#5a5a5a', '#c43344', '#e0a020', '#2f8a8a'))
        if kind == 'socket':
            o.append(P.boxmm('Rail', xs, xs + 0.42, y - 0.07, y - 0.04, z1 - 0.40, z1 - 0.36, M('#5a5a5a')))
            for k in range(5):
                o.append(P.boxmm('Sock', xs + 0.02 + k * 0.08, xs + 0.07 + k * 0.08, y - 0.08, y - 0.06, z1 - 0.36,
                                 z1 - 0.30, M('#8a8a8a')))
            xs += 0.50
            continue
        h = rnd.uniform(0.38, 0.62)
        zt = z1 - 0.12
        o.append(P.boxmm('Tool', xs, xs + 0.045, y - 0.07, y - 0.04, zt - h, zt, M(col)))
        if kind in ('hammer', 'wrench'):
            o.append(P.boxmm('ToolHead', xs - 0.06, xs + 0.10, y - 0.075, y - 0.04, zt - 0.08, zt, M('#3a3a3a')))
        if kind == 'pliers':
            o.append(P.boxmm('Tool2', xs + 0.06, xs + 0.105, y - 0.07, y - 0.04, zt - h, zt, M(col)))
        xs += rnd.uniform(0.14, 0.22)
    return o


def toolchest_objs(x0, x1, y1, d=0.6, h=1.13):
    o = [boxp('Chest', x0, x1, y1 - d, y1, 0.08, h, '#c8344a', '#3a3a3a', '#a82c3e')]
    for i in range(5):
        z = 0.25 + i * 0.17
        o.append(P.boxmm('Drawer', x0 + 0.08, x1 - 0.08, y1 - d - 0.012, y1 - d, z, z + 0.035, M('#f0f0f0')))
    for xx in (x0 + 0.08, x1 - 0.12):
        o.append(P.boxmm('Wheel', xx, xx + 0.05, y1 - d + 0.05, y1 - d + 0.12, 0, 0.08, M('#2a2a2a')))
    o.append(boxp('ChestTop', x0 - 0.02, x1 + 0.02, y1 - d - 0.02, y1, h, h + 0.04, '#2e2e2e', '#3a3a3a'))
    return o


def shelf_objs(x0, x1, y1, d=0.55, h=2.6, seed=5):
    """Grey steel shelving with cans / boxes / an engine block (t440, west wall)."""
    rnd = random.Random(seed)
    o = []
    for xx in (x0, x1 - 0.05):
        o.append(boxp('ShPost', xx, xx + 0.05, y1 - d, y1 - d + 0.05, 0, h, '#5a5a5a', '#6a6a6a'))
    for z in (0.12, 0.95, 1.75, h - 0.05):
        o.append(boxp('ShBoard', x0, x1, y1 - d, y1, z, z + 0.05, '#d8d8d8', '#ececec'))
    items = []
    for z in (0.17, 1.0, 1.8):
        xx = x0 + 0.12
        while xx < x1 - 0.35:
            kind = rnd.random()
            if kind < 0.45:
                r = rnd.uniform(0.09, 0.13)
                col = rnd.choice(('#e8a030', '#9aa0a0', '#4fb3a8', '#3a3a3a', '#c8c8c8'))
                c = P.cyl('ShCan', r, rnd.uniform(0.18, 0.3), 12, (xx + r, y1 - d / 2, z))
                P.paint(c, M(col), top=M(P.tint(col, 1.15), TOP))
                o.append(c)
                xx += 2 * r + 0.08
            elif kind < 0.75:
                w = rnd.uniform(0.3, 0.5)
                o.append(boxp('ShBox', xx, xx + w, y1 - d + 0.06, y1 - 0.05, z, z + rnd.uniform(0.25, 0.4),
                              '#d8b468', '#e6c47a'))
                xx += w + 0.08
            else:
                o.append(boxp('ShEngine', xx, xx + 0.42, y1 - d + 0.06, y1 - 0.05, z, z + 0.36, '#6a6a6a', '#808080'))
                o.append(P.cyl('ShEngC', 0.08, 0.02, 10, (xx + 0.21, y1 - d + 0.05, z + 0.18), axis='-Y',
                               m=M('#3a3a3a')))
                xx += 0.5
    return o


# ================================================================== garage ===
GC = dict(teal='#69c0b7', tealA='#63b3b0', brick='#78cdc4', cornice='#949494', cap='#b1b1b1', roof='#687877',
          bay='#474546', slat='#3d3b3c', frame='#2a2a2a', handle='#d6d6d6', red='#b03645', redTop='#c63e4d',
          white='#f2f2f2', aroof='#b1b1b1', afascia='#949494', base='#949494', aframe='#474747', aglass='#8ea6ae',
          note='#d5edf7', floor='#626262', floor2='#5a5a5a', iwall='#5fb3ae', cutTop='#a8a8a8', cutFront='#8c8c8c',
          header='#2b2b2b', stain='#555555')
GA = dict(W=10.0, D=6.05, t=0.2, wall=4.06, top=4.43, deck=4.11,
          door1=(0.62, 4.45), door2=(4.82, 8.65), door_h=3.52,
          ax0=10.0, ax1=12.55, ay0=1.84, awall=3.0, atop=3.30, aback=4.37, adoor=(10.77, 11.65), adoor_h=2.23,
          banner=(2.53, 7.28), banner_y=0.26, banner_z1=5.75, cut=0.32)
GAX, GAY = GA['ax1'] / 2, GA['D'] / 2
LIFTS_G = [(2.53, 2.50), (6.73, 2.50)]


def garage_parts():
    c, C = GA, GC
    parts = dict(walls=[], roof=[], interior=[], ifront=[], ifront_annex=[], adoor=[], adoor_open=[], inside=[])
    W_, R_ = parts['walls'], parts['roof']
    Wd, D, t = c['W'], c['D'], c['t']
    d1, d2, dh = c['door1'], c['door2'], c['door_h']
    # ---- main block: front wall with two bay openings, cornice, parapet roof, shell
    facade('GF', 0.0, Wd, 0.0, t, c['wall'], [(d1[0], d1[1], 0, dh), (d2[0], d2[1], 0, dh)], C['teal'], C['cap'],
           out=W_, bottom='#4e8f88')
    W_.append(boxp('GCornice', 0.0, Wd, -0.01, t, c['wall'], c['top'], C['cornice'], C['cap']))
    parapet_roof('G', 0.0, Wd, 0.0, D, c['top'], c['deck'], C['cap'], C['cornice'], C['roof'], R_, t=t, front=False)
    R_.append(boxp('GCapF', 0.0, Wd, -0.01, t, c['top'] - 0.01, c['top'], C['cornice'], C['cap']))
    for (a, b) in ((0.0, t), (Wd - t, Wd)):
        W_.append(boxp('GShell', a, b, t, D, 0, c['wall'], C['teal'], C['cap']))
    W_.append(boxp('GShellN', 0.0, Wd, D - t, D, 0, c['wall'], C['teal'], C['cap']))
    bricks('GBrick', 0.2, Wd - 0.2, 0.4, c['wall'] - 0.3, -0.001, C['brick'], 5, 3, out=W_,
           ranges=[(0.1, d1[0] - 0.1), (d2[1] + 0.1, Wd - 0.1)])
    # bay frames
    for (a, b) in (d1, d2):
        for (p, q, r_, s_) in ((a - 0.06, a + 0.02, 0, dh + 0.02), (b - 0.02, b + 0.06, 0, dh + 0.02),
                               (a - 0.06, b + 0.06, dh - 0.03, dh + 0.06)):
            W_.append(boxp('BayFrame', p, q, -0.03, t, r_, s_, C['frame'], '#3a3a3a'))
    # bay 1: closed roll-up door, slats
    W_.append(boxp('Roll', d1[0] + 0.02, d1[1] - 0.02, 0.10, 0.16, 0, dh - 0.03, C['bay'], C['bay']))
    for i in range(1, 14):
        z = i * dh / 14
        W_.append(P.boxmm('Slat', d1[0] + 0.02, d1[1] - 0.02, 0.095, 0.10, z - 0.012, z + 0.012, M(C['slat'])))
    hx = (d1[0] + d1[1]) / 2
    W_.append(P.boxmm('RollHandle', hx - 0.06, hx + 0.06, 0.08, 0.095, 0.30, 0.34, M(C['handle'])))
    # bay 2: open -> rolled door drum just inside the header
    W_.append(boxp('Drum', d2[0] + 0.02, d2[1] - 0.02, 0.18, 0.50, dh - 0.22, dh, C['header'], '#3a3a3a',
                   bottom=C['header']))
    # ---- GARAGE banner standing on the roof behind the front parapet (t438 crop)
    bx0, bx1 = c['banner']
    by0, by1 = c['banner_y'], c['banner_y'] + 0.22
    bz0, bz1 = c['deck'] - 0.05, c['banner_z1']
    rx, rz = 0.85, 1.38
    prof = [(bx0, bz0), (bx1, bz0)] + ellipse_pts(bx1 - rx, bz1 - rz, rx, rz, 0, 90, 12)[1:] + [(bx0, bz1)]
    ban = P.prism('Banner', prof, by0, by1)
    P.paint(ban, M(C['red']), top=M(C['redTop'], TOP), side=M('#9e3040', RIGHTN), top_thresh=0.2)
    R_.append(ban)
    # text + wrench (screen-measured in t438 crop: px -> m with 200 px/m, verticals / 0.616)
    by = by0 - 0.001
    R_.append(fit_text('GarageTxt', 'GARAGE', 3.44, 5.82, 4.74, 5.35, by, C['white'], bold=0.004, font=FONT_SANS_BI))
    zc = 5.06
    R_ += stroke('WrRing', ellipse_pts(2.93, zc, 0.215, 0.36, 0, 360, 24), 0.035, by, C['white'])
    R_ += stroke('WrHole', ellipse_pts(2.99, zc, 0.10, 0.17, 0, 360, 18), 0.035, by, C['white'])
    R_ += stroke('WrH1', [(3.10, zc + 0.30), (3.40, zc + 0.20)], 0.035, by, C['white'])
    R_ += stroke('WrH2', [(3.10, zc - 0.30), (3.40, zc - 0.18)], 0.035, by, C['white'])
    R_ += stroke('WrH3', [(5.86, zc + 0.21), (6.15, zc + 0.30)], 0.035, by, C['white'])
    R_ += stroke('WrH4', [(5.86, zc - 0.17), (6.10, zc - 0.17), (6.18, zc - 0.32)], 0.035, by, C['white'])
    jaw = ellipse_pts(6.50, zc + 0.04, 0.33, 0.55, 205, 500, 26)
    R_ += stroke('WrJaw', jaw, 0.035, by, C['white'])
    R_ += stroke('WrJaw2', [jaw[-1], (6.63, zc + 0.12), (6.48, zc + 0.10), (6.48, zc - 0.14), (6.66, zc - 0.20),
                            jaw[0]], 0.035, by, C['white'])
    # ---- rooftop AC + vents (t426 / t432)
    R_ += place(ac_objs(), 6.15, 2.05, c['deck'])
    R_ += place(vent_objs(), 1.38, 0.95, c['deck'])
    R_ += place(vent_objs(), 8.95, 3.60, c['deck'])
    # ---- annex (east, set back 1.84 m): teal wall, side door, grey fascia, light shed roof
    ax0, ax1, ay0 = c['ax0'], c['ax1'], c['ay0']
    ad = c['adoor']
    facade('AF', ax0, ax1, ay0, ay0 + t, c['awall'], [(ad[0], ad[1], 0, c['adoor_h'])], C['tealA'], C['cap'], out=W_)
    W_.append(boxp('ABase', ax0, ax1, ay0 - 0.02, ay0 + t, 0, 0.28, C['base'], C['base']))
    W_.append(boxp('AFascia', ax0, ax1, ay0 - 0.03, ay0 + t, c['awall'], c['atop'], C['afascia'], C['aroof']))
    bricks('ABrick', ax0 + 0.1, ax1 - 0.1, 0.5, c['awall'] - 0.3, ay0 - 0.001, '#72c4bd', 3, 7, out=W_,
           ranges=[(ax0 + 0.1, ad[0] - 0.1), (ad[1] + 0.1, ax1 - 0.1)])
    W_.append(boxp('AShellE', ax1 - t, ax1, ay0, D, 0, c['aback'], C['tealA'], C['aroof']))
    W_.append(boxp('AShellN', ax0, ax1, D - t, D, 0, c['aback'], C['tealA'], C['aroof']))
    sh = P.prism('AShed', [(ay0 - 0.03, c['atop']), (D, c['aback']), (D, c['aback'] - 0.2), (ay0 - 0.03, c['atop'] - 0.2)],
                 ax0 - 0.0, ax1)
    # prism() extrudes along y; build the shed as a slab instead: polygon in YZ extruded along x
    bpy.data.objects.remove(sh, do_unlink=True)
    bm = bmesh.new()
    pts = [(ay0 - 0.03, c['atop']), (D, c['aback']), (D, c['aback'] - 0.2), (ay0 - 0.03, c['atop'] - 0.2)]
    vs = [bm.verts.new((ax0, y, z)) for y, z in pts]
    f = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]:
        v.co.x = ax1
    shed = P.bm_obj('AShed', bm)
    P.paint(shed, M(C['afascia']), top=M(C['aroof'], (0, -0.25, 0.97)), top_thresh=0.5)
    R_.append(shed)
    # side door (closed) + frame
    for (p, q) in ((ad[0] - 0.06, ad[0]), (ad[1], ad[1] + 0.06)):
        W_.append(boxp('AJamb', p, q, ay0 - 0.04, ay0 + t, 0, c['adoor_h'] + 0.06, C['base'], C['cap']))
    W_.append(boxp('AHead', ad[0] - 0.06, ad[1] + 0.06, ay0 - 0.04, ay0 + t, c['adoor_h'], c['adoor_h'] + 0.06,
                   C['base'], C['cap']))
    leaf = side_door_leaf('ALeaf', ad[1] - ad[0], c['adoor_h'])
    W_ += [P.duplicate(o) for o in shift(leaf, ad[0], ay0 + 0.02)]
    parts['adoor'] = leaf
    lo = side_door_leaf('ALeafO', ad[1] - ad[0], c['adoor_h'])
    P.rotate_objs(lo, math.radians(-75))
    parts['adoor_open'] = shift(lo, ad[0], ay0 - 0.02)

    # ================= interior =================
    I = parts['interior']
    I.append(P.slab('GFloor', [(0, t), (Wd, t), (Wd, ay0 + t), (ax1, ay0 + t), (ax1, D), (0, D)], -0.02, 0.0,
                    M(C['floor'], TOP)))
    I.append(boxp('GBack', 0.0, ax1, D - t, D, 0, c['wall'], C['iwall'], C['cutTop']))
    bricks('IBrick', 0.3, ax1 - 0.3, 2.7, c['wall'] - 0.2, D - t - 0.001, '#6ec0ba', 6, 13, out=I)
    for (a, b, y0_, y1_) in ((0.0, t, t, D - t), (ax1 - t, ax1, ay0 + t, D - t), (Wd - t, Wd, t, ay0 + t)):
        I.append(boxp('GSideCut', a, b, y0_, y1_, 0, c['cut'], C['cutFront'], C['cutTop']))
    yb = D - t
    I += pegboard_objs(4.76, 6.03, 1.42, 2.55, yb, seed=2)
    I += pegboard_objs(6.15, 7.44, 1.42, 2.55, yb, seed=5)
    I += toolchest_objs(6.15, 7.44, yb)
    I += shelf_objs(0.35, 3.40, yb)
    I += place(jerrycan_objs(), 4.70, yb - 0.30)
    parts['inside'] = list(I)
    F = parts['ifront']
    for (a, b) in ((0.0, d1[0]), (d1[1], d2[0]), (d2[1], Wd)):
        F.append(boxp('GFrontCut', a, b, 0.0, t, 0, c['cut'], C['cutFront'], C['cutTop']))
    F.append(boxp('GRollCut', d1[0], d1[1], 0.05, 0.16, 0, c['cut'], C['bay'], '#5a5a5a'))
    F.append(P.boxmm('GThresh', d2[0], d2[1], 0.0, t, 0, 0.02, M(C['cutTop'], TOP)))
    FA = parts['ifront_annex']
    for (a, b) in ((ax0, ad[0]), (ad[1], ax1)):
        FA.append(boxp('AFrontCut', a, b, ay0, ay0 + t, 0, c['cut'], C['cutFront'], C['cutTop']))
    FA.append(P.boxmm('AThresh', ad[0], ad[1], ay0, ay0 + t, 0, 0.02, M(C['cutTop'], TOP)))
    return parts


def side_door_leaf(name, w, h):
    """Grey service door (t438 crop): dark frame, upper glass with a white note, small lower glass."""
    o = [boxp(name, 0, w, -0.05, 0.0, 0, h, GC['aframe'], '#5a5a5a')]
    o.append(P.boxmm(name + 'In', 0.08, w - 0.08, -0.055, -0.05, 0.95, h - 0.12, M('#7a7a7a')))
    o.append(P.boxmm(name + 'G', 0.12, w - 0.12, -0.06, -0.055, 1.0, h - 0.16, M(GC['aglass'])))
    o.append(P.boxmm(name + 'Note', 0.30, 0.48, -0.065, -0.06, 1.48, 1.72, M(GC['note'])))
    o.append(P.boxmm(name + 'In2', 0.08, w - 0.08, -0.055, -0.05, 0.22, 0.78, M('#7a7a7a')))
    o.append(P.boxmm(name + 'G2', 0.12, w - 0.12, -0.06, -0.055, 0.26, 0.74, M(GC['aglass'])))
    o.append(P.boxmm(name + 'H', w - 0.10, w - 0.06, -0.09, -0.05, 0.95, 1.25, M('#9a9a9a')))
    return o


def build_garage():
    parts = garage_parts()
    inside = parts.pop('inside')
    for k in parts:
        shift(parts[k], -GAX, -GAY)
    lifts = []
    for (x, y) in LIFTS_G:          # shortened so the posts stay under the roof deck in the exterior bake
        lifts += place(lift_objs(H=3.8), x - GAX, y - GAY)
    see = inside + lifts
    c = GA
    rel, rect = rel_fn(GAX, GAY)
    Wd, D, t = c['W'], c['D'], c['t']
    base = {'footprint': [c['ax1'], D], 'anchor_note': 'all garage_* layers share this anchor (centre of the wall bbox)'}
    meta_ext = dict(base, blocksSight=True, layer='exterior', height=c['banner_z1'],
                    colliders=[rect(0, Wd, 0, D), rect(c['ax0'], c['ax1'], c['ay0'], D)],
                    bays={'west': {'x0': rel(c['door1'][0], 0)[0], 'x1': rel(c['door1'][1], 0)[0], 'y': rel(0, 0)[1],
                                   'state': 'closed roll-up door'},
                          'east': {'x0': rel(c['door2'][0], 0)[0], 'x1': rel(c['door2'][1], 0)[0], 'y': rel(0, 0)[1],
                                   'state': 'open - the walk/drive-in entrance'}},
                    door={'x0': rel(c['adoor'][0], 0)[0], 'x1': rel(c['adoor'][1], 0)[0], 'y': rel(0, c['ay0'])[1],
                          'hinge': 'west jamb, opens outward', 'note': 'annex side door where the mechanic stands'},
                    roofProps=[{'key': 'ac_unit', 'pos': rel(6.15, 2.05), 'z': c['deck']},
                               {'key': 'roof_vent', 'pos': rel(1.38, 0.95), 'z': c['deck']},
                               {'key': 'roof_vent', 'pos': rel(8.95, 3.60), 'z': c['deck']}],
                    note='teal garage, 2 bays (west closed, east open showing the lift), red GARAGE wrench banner on '
                         'the roof, east annex set back 1.84 m with the side door and a light shed roof')
    walls = [rect(0, c['door1'][0], 0, t), rect(c['door1'][1], c['door2'][0], 0, t), rect(c['door2'][1], Wd, 0, t),
             rect(c['door1'][0], c['door1'][1], 0, t), rect(0, t, 0, D), rect(c['ax1'] - t, c['ax1'], c['ay0'], D),
             rect(Wd - t, Wd, 0, c['ay0'] + t), rect(0, c['ax1'], D - t, D),
             rect(c['ax0'], c['adoor'][0], c['ay0'], c['ay0'] + t), rect(c['adoor'][1], c['ax1'], c['ay0'], c['ay0'] + t)]
    furniture = {'car_lift': rel(*LIFTS_G[0]), 'car_lift#2': rel(*LIFTS_G[1]),
                 'atm': rel(10.55, D - t - 0.45), 'vending_machine': rel(11.65, D - t - 0.42)}
    meta_int = dict(base, layer='interior', walls=walls, cut_h=c['cut'],
                    rooms={'bay': rect(t, Wd - t, t, D - t), 'annex': rect(Wd - t, c['ax1'] - t, c['ay0'] + t, D - t)},
                    doors={'bay_east': {'x0': rel(c['door2'][0], 0)[0], 'x1': rel(c['door2'][1], 0)[0],
                                        'y': rel(0, 0)[1]},
                           'side': {'x0': rel(c['adoor'][0], 0)[0], 'x1': rel(c['adoor'][1], 0)[0],
                                    'y': rel(0, c['ay0'])[1]}},
                    furniture=furniture,
                    lifts=[{'key': 'car_lift', 'pos': rel(x, y), 'posts': [rect(x - 1.675, x - 1.235, y - 0.235, y + 0.235),
                                                                         rect(x + 1.235, x + 1.675, y - 0.235, y + 0.235)]}
                           for (x, y) in LIFTS_G],
                    note='floor with oil stains, teal back wall with pegboards / tool chest / shelving / jerry can '
                         '(baked). car_lift, atm, vending_machine (existing keys) are separate sprites. '
                         'Original: bay shown zoomed ~1.6x.')
    return [
        ('garage', parts['walls'] + parts['roof'] + see, meta_ext),
        ('garage_roof', parts['roof'], dict(base, layer='roof', note='main deck + parapet + banner + AC/vents + annex shed roof')),
        ('garage_interior', parts['interior'], meta_int),
        ('garage_interior_front', parts['ifront'], dict(base, layer='interior_front', sortY=rel(0, 0)[1],
                                                         note='front wall cut 0.32 m, closed west roll-up door cut, open east bay')),
        ('garage_interior_front_annex', parts['ifront_annex'], dict(base, layer='interior_front',
                                                                     sortY=rel(0, c['ay0'])[1],
                                                                     note='annex front wall cut, side-door gap')),
        ('garage_door', parts['adoor'], dict(base, layer='door', sortY=rel(0, c['ay0'])[1], note='side door closed')),
        ('garage_door_open', parts['adoor_open'], dict(base, layer='door', sortY=rel(0, c['ay0'] - 0.5)[1],
                                                       note='side door swung 75 deg outward on the west jamb')),
    ]


def build_garage_furniture():
    return [('car_lift', lift_objs(), {'footprint': [3.35, 0.5], 'blocksSight': False, 'height': 4.75,
                                       'posts': [[-1.455, 0.0], [1.455, 0.0]], 'post_size': [0.44, 0.47],
                                       'note': 'two red posts 2.91 m apart (centres), yellow arms + pads on the floor; '
                                               'cars drive through along y; collide with the posts only'}),
            ('jerry_can', jerrycan_objs(), {'footprint': [0.35, 0.25], 'blocksSight': False, 'height': 0.78})]


# ================================================================= customs ===
CC_ = dict(corr='#b3b3b3', rib='#c2c2c2', ribD='#a6a6a6', orange='#bd5a30', orangeHi='#f2753d', orangeLo='#a84e28',
           customs='#565656', customsTop='#7a7a7a', auto='#f07441', cap='#b1b1b1', cornice='#9c9c9c', roof='#687877',
           frame='#656766', header='#f1ecf0', floorA='#e9e9e9', floorB='#cbcbcb', bayFloor='#646464', stain='#555555',
           slat='#4b4b4b', slatL='#5c5c5c', wallW='#a9a9a9', cutTop='#d8d8d8', cutFront='#b5b5b5', mat='#c9bfb5',
           matB='#b5aba0', matTxt='#a39a90', desk='#6e6e6e', deskF='#555555', chair='#c8622e', chairTop='#d8743c',
           ottoman='#7a7a7a', ottomanS='#5f5f5f', bench='#d23a48')
CU = dict(W=13.06, D=6.2, t=0.2, wx1=5.59, wtop=5.44, wdeck=5.14, mtop=6.41, mcor=0.29, mdeck=6.11,
          bay=(0.87, 4.87), bay_h=3.49, win=(6.99, 11.67), win_h=3.49, transom=2.03, door=(8.87, 9.79),
          stripe=(4.22, 5.44), sign=(7.92, 10.74), cut=0.32)
CAX, CAY = CU['W'] / 2, CU['D'] / 2
CUST_FURN = [('customs_desk', 6.94, 4.53), ('armchair_orange', 6.07, 1.62), ('armchair_orange', 6.07, 0.68)]


def corrugated(name, x0, x1, z0, z1, y, out, step=0.13):
    """Vertical rib lines on a corrugated wall face at y."""
    x = x0 + step * 0.5
    i = 0
    while x < x1 - 0.02:
        col = CC_['rib'] if i % 2 == 0 else CC_['ribD']
        out.append(P.boxmm(name, x - 0.012, x + 0.012, y - 0.008, y, z0, z1, M(col)))
        x += step
        i += 1
    return out


def customs_parts():
    c, C = CU, CC_
    parts = dict(walls=[], roof=[], interior=[], ifront=[], door=[], door_open=[], inside=[])
    W_, R_ = parts['walls'], parts['roof']
    Wd, D, t, wx = c['W'], c['D'], c['t'], c['wx1']
    bay, win = c['bay'], c['win']
    # ---- west wing (bay) + main block (showroom)
    facade('WF', 0.0, wx, 0.0, t, c['wtop'], [(bay[0], bay[1], 0, c['bay_h'])], C['corr'], C['cap'], out=W_)
    facade('MF', wx, Wd, 0.0, t, c['mtop'] - c['mcor'], [(win[0], win[1], 0, c['win_h'])], C['corr'], C['cap'], out=W_)
    corrugated('Rib', 0.0, bay[0], 0, c['stripe'][0], 0.0, W_)
    corrugated('Rib', bay[1], wx, 0, c['stripe'][0], 0.0, W_)
    corrugated('Rib', bay[0], bay[1], c['bay_h'], c['stripe'][0], 0.0, W_)
    corrugated('Rib', wx, win[0], 0, c['mtop'] - c['mcor'], 0.0, W_)
    corrugated('Rib', win[1], Wd, 0, c['mtop'] - c['mcor'], 0.0, W_)
    corrugated('Rib', win[0], win[1], c['win_h'], c['mtop'] - c['mcor'], 0.0, W_)
    W_.append(boxp('MCornice', wx, Wd, -0.012, t, c['mtop'] - c['mcor'], c['mtop'], C['cornice'], C['cap']))
    # orange stripe (interrupted by the sign)
    z0s, z1s = c['stripe']
    for (a, b) in ((0.0, wx - 0.08), (wx + 0.08, c['sign'][0]), (c['sign'][1], Wd)):
        W_.append(boxp('Stripe', a, b, -0.06, 0.0, z0s, z1s, C['orange'], C['orangeHi']))
        W_.append(P.boxmm('StripeHi', a, b, -0.065, -0.06, z1s - 0.07, z1s, M(C['orangeHi'])))
        W_.append(P.boxmm('StripeLo', a, b, -0.065, -0.06, z0s, z0s + 0.05, M(C['orangeLo'])))
    W_.append(boxp('StripeSeam', wx - 0.08, wx + 0.08, -0.07, 0.0, z0s, z1s, C['orangeLo'], C['orangeHi']))
    # sign: "Automotive" script over "CUSTOMS"
    W_.append(fit_text('Auto', 'Automotive', 8.44, 10.24, 4.90, 5.38, -0.03, C['auto'], bold=0.01, font=FONT_SCRIPT))
    cu = fit_text('Customs', 'CUSTOMS', 8.07, 10.54, 4.17, 4.87, -0.02, C['customs'], bold=0.0, font=FONT_BLACK,
                  depth=0.08)
    P.paint(cu, M(C['customs']), top=M(C['customsTop'], TOP), side=M('#4a4a4a', RIGHTN))
    W_.append(cu)
    # roofs: wing (lower) + main
    parapet_roof('WR', 0.0, wx, 0.0, D, c['wtop'], c['wdeck'], C['cap'], C['cornice'], C['roof'], R_, t=t)
    parapet_roof('MR', wx, Wd, 0.0, D, c['mtop'], c['mdeck'], C['cap'], C['cornice'], C['roof'], R_, t=t)
    for (a, b) in ((0.0, t), (Wd - t, Wd)):
        W_.append(boxp('CShell', a, b, t, D, 0, c['wtop'], C['corr'], C['cap']))
    W_.append(boxp('CShellN', 0.0, Wd, D - t, D, 0, c['wtop'], C['corr'], C['cap']))
    W_.append(boxp('CShellM', wx, Wd, D - t, D, 0, c['mtop'], C['corr'], C['cap']))
    R_ += place(ac_objs(), 10.9, 3.0, c['mdeck'])
    R_ += place(vent_objs(), 7.2, 4.6, c['mdeck'])
    # bay opening: frame + white rolled door header
    for (p, q, r_, s_) in ((bay[0] - 0.05, bay[0] + 0.02, 0, c['bay_h']), (bay[1] - 0.02, bay[1] + 0.05, 0, c['bay_h']),
                           (bay[0] - 0.05, bay[1] + 0.05, c['bay_h'] - 0.02, c['bay_h'] + 0.05)):
        W_.append(boxp('CBayFrame', p, q, -0.02, t, r_, s_, C['frame'], '#7a7a7a'))
    W_.append(boxp('CDrum', bay[0] + 0.02, bay[1] - 0.02, 0.06, 0.40, c['bay_h'] - 0.34, c['bay_h'], C['header'],
                   '#ffffff', bottom='#d8d4d8'))
    # showroom window: 5 panes, transom, glass door in pane 3
    window('CWin', win[0], win[1], 0.0, c['win_h'], 0.12, 5, c['transom'], C['frame'], outer=0.07, top_bar=0.08,
           bar=0.07, out=W_)
    dx0, dx1 = c['door']
    W_.append(P.boxmm('CHandle', dx1 - 0.13, dx1 - 0.10, 0.02, 0.05, 0.85, 1.25, M('#e0e0e0')))

    # ================= interior =================
    I = parts['interior']
    yb = D - t
    I.append(boxp('WFloor', t, wx - 0.1, t, yb, -0.02, 0.0, C['bayFloor'], C['bayFloor']))
    rnd = random.Random(21)
    for i in range(10):
        x, y = rnd.uniform(0.6, wx - 0.6), rnd.uniform(0.5, yb - 0.5)
        I.append(P.cyl('Stain', rnd.uniform(0.12, 0.32), 0.004, 10, (x, y, 0.0), rz=rnd.uniform(0.08, 0.22),
                       m=M(C['stain'], TOP)))
    # chequered showroom floor (0.85 m squares)
    sq = 0.85
    I.append(boxp('MFloor', wx, Wd - t, t, yb, -0.02, 0.0, C['floorB'], C['floorB']))
    nx, ny = int(math.ceil((Wd - t - wx) / sq)), int(math.ceil((yb - t) / sq))
    for i in range(nx):
        for j in range(ny):
            if (i + j) % 2 == 0:
                a, b = wx + i * sq, min(wx + (i + 1) * sq, Wd - t)
                cc, d = t + j * sq, min(t + (j + 1) * sq, yb)
                I.append(P.boxmm('Chq', a, b, cc, d, 0.0, 0.003, M(C['floorA'], TOP)))
    # back walls: wing (plain), showroom (dark slat wall)
    I.append(boxp('WBack', 0.0, wx, yb, D, 0, c['wtop'] - 0.3, C['wallW'], C['cutTop']))
    I.append(boxp('MBack', wx, Wd, yb, D, 0, c['mtop'] - 0.3, C['slat'], C['cutTop']))
    for k in range(1, 22):
        z = k * 0.26
        if z < c['mtop'] - 0.35:
            I.append(P.boxmm('Slat', wx + 0.2, Wd - 0.2, yb - 0.004, yb, z - 0.015, z + 0.015, M(C['slatL'])))
    # wheel rack, picture, bench on the showroom back wall
    I.append(boxp('Rack', 8.20, 10.30, yb - 0.10, yb, 0.42, 0.50, '#3a3a3a', '#5a5a5a'))
    I.append(boxp('Rack2', 8.20, 10.30, yb - 0.10, yb, 1.62, 1.70, '#3a3a3a', '#5a5a5a'))
    for k, xc in enumerate((8.62, 9.25, 9.88)):
        zc_ = 1.05
        wh = [P.cyl('Wheel', 0.30, 0.10, 20, (xc, yb - 0.02, 0), axis='-Y', m=M('#cfcfd4')),
              P.cyl('WheelTyre', 0.33, 0.08, 20, (xc, yb + 0.0, 0), axis='-Y', m=M('#2a2a2a')),
              P.cyl('WheelHub', 0.08, 0.02, 10, (xc, yb - 0.12, 0), axis='-Y', m=M('#8a8a8f'))]
        for s_ in range(5):
            a = math.radians(90 + s_ * 72 + k * 15)
            sp = P.beam('Spoke', (xc, yb - 0.12, 0), (xc + 0.24 * math.cos(a), yb - 0.12, 0.24 * math.sin(a)),
                        0.04, 0.01, up=(0, -1, 0))
            P.setm(sp, M('#9a9aa0'))
            wh.append(sp)
        for w in wh:                      # stretched x1/cos so they read round on screen (like the original)
            P.xform(w, scale=(1, 1, ST))
            w.location = (0, 0, zc_)
            T.apply_transforms(w)
        I += wh
    I.append(boxp('Pic', 5.85, 7.85, yb - 0.05, yb, 1.75, 2.75, '#3a3a3a', '#4a4a4a'))
    I.append(P.boxmm('PicIn', 5.97, 7.73, yb - 0.06, yb - 0.05, 1.85, 2.65, M('#7f9a9a')))
    I.append(P.boxmm('PicCar', 6.25, 7.40, yb - 0.07, yb - 0.06, 2.0, 2.3, M('#c8344a')))
    I.append(boxp('CBench', 10.80, 12.50, yb - 0.40, yb, 0.85, 0.97, C['bench'], '#e04a58'))
    for xx in (11.0, 12.25):
        I.append(boxp('CBLeg', xx, xx + 0.06, yb - 0.30, yb - 0.24, 0, 0.85, '#2a2a2a', '#3a3a3a'))
    # floor mats + rug + ottoman (low, baked)
    def mat(name, x0, x1, y0, y1, txt=None):
        I.append(boxp(name, x0, x1, y0, y1, 0.0, 0.012, C['matB'], C['matB']))
        I.append(P.boxmm(name + 'In', x0 + 0.08, x1 - 0.08, y0 + 0.08, y1 - 0.08, 0.012, 0.016, M(C['mat'], TOP)))
    mat('AutoMat', 6.10, 7.66, 3.11, 3.78)
    tx = P.text_mesh('MatTxt', 'Automotive', size=0.3, depth=0.004, bold=0.01, font=FONT_SCRIPT, m=M(C['matTxt'], TOP))
    P.xform(tx, rot=(-math.pi / 2, 0, 0))
    (a, b), (cc, d), _ = P.bounds([tx])
    P.xform(tx, scale=(1.30 / (b - a), 0.40 / (d - cc), 1))
    (a, b), (cc, d), (e, f) = P.bounds([tx])
    P.xform(tx, loc=(6.88 - (a + b) / 2, 3.445 - (cc + d) / 2, 0.016 - e))
    I.append(tx)
    mat('Rug', 6.47, 7.62, 0.30, 2.35)
    mat('DoorMat', 8.54, 9.96, 0.40, 1.60)
    I.append(boxp('Ottoman', 6.70, 7.40, 1.0, 1.6, 0.12, 0.45, C['ottomanS'], C['ottoman']))
    for (xx, yy) in ((6.76, 1.05), (7.30, 1.05), (6.76, 1.50), (7.30, 1.50)):
        I.append(P.boxmm('OtLeg', xx, xx + 0.05, yy - 0.0, yy + 0.05, 0, 0.12, M('#3a3a3a')))
    I += place(jerrycan_objs(), 0.70, 1.30)
    # cut walls: west, east, wing/showroom partition
    for (a, b) in ((0.0, t), (Wd - t, Wd), (wx - 0.1, wx + 0.1)):
        I.append(boxp('CSideCut', a, b, t, yb, 0, c['cut'], C['cutFront'], C['cutTop']))
    parts['inside'] = list(I)
    F = parts['ifront']
    for (a, b) in ((0.0, bay[0]), (bay[1], win[0]), (win[1], Wd)):
        F.append(boxp('CFrontCut', a, b, 0.0, t, 0, c['cut'], C['cutFront'], C['cutTop']))
    for (a, b) in ((win[0], dx0), (dx1, win[1])):
        F.append(boxp('CWinCut', a, b, 0.0, t, 0, 0.10, C['frame'], '#8a8a8a'))
    F.append(P.boxmm('CBayThresh', bay[0], bay[1], 0.0, t, 0, 0.02, M(C['cutTop'], TOP)))
    F.append(P.boxmm('CDoorThresh', dx0, dx1, 0.0, t, 0, 0.02, M(C['cutTop'], TOP)))
    leaf = door_leaf('CLeaf', dx1 - dx0, c['transom'], C['frame'])
    W_ += [P.duplicate(o) for o in shift(leaf, dx0, 0.10)]
    parts['door'] = leaf
    lo = door_leaf('CLeafO', dx1 - dx0, c['transom'], C['frame'])
    P.rotate_objs(lo, math.radians(-70))
    parts['door_open'] = shift(lo, dx0, 0.06)
    return parts


def customs_desk_objs():
    """Grey sales desk with a PC and a paper (t448): 2.4 x 0.74 x 0.78."""
    W, Dp, H = 2.40, 0.74, 0.78
    hw, hd = W / 2, Dp / 2
    o = [boxp('Desk', -hw, hw, -hd, hd, 0, H - 0.05, CC_['deskF'], CC_['desk'], '#4a4a4a')]
    o.append(boxp('DeskTop', -hw - 0.03, hw + 0.03, -hd - 0.03, hd, H - 0.05, H, '#646464', CC_['desk']))
    o.append(boxp('MonFoot', -0.62, -0.30, -0.05, 0.15, H, H + 0.02, '#1e1e1e', '#2a2a2a'))
    o.append(boxp('MonStem', -0.49, -0.43, 0.05, 0.11, H, H + 0.22, '#1e1e1e', '#2a2a2a'))
    o.append(boxp('Monitor', -0.80, -0.12, 0.08, 0.14, H + 0.18, H + 0.62, '#1a1a1a', '#2a2a2a'))
    o.append(P.cyl('Mouse', 0.04, 0.03, 10, (-0.95, -0.05, H), m=M('#3a3a3a', TOP), rz=0.055))
    pap = boxp('Paper', 0.55, 0.85, -0.20, 0.18, H, H + 0.01, '#e8e8e8', '#eeeeee')
    P.rotate_objs([pap], math.radians(-18), (0.70, 0.0, 0))
    o.append(pap)
    for k in range(5):
        ln = P.boxmm('PLine', 0.60, 0.80, -0.14 + k * 0.06, -0.12 + k * 0.06, H + 0.01, H + 0.012, M('#4a4a4a', TOP))
        P.rotate_objs([ln], math.radians(-18), (0.70, 0.0, 0))
        o.append(ln)
    return o


def armchair_objs():
    """Orange lounge chair facing east (t448): 0.62 wide (x) x 0.75 deep (y), back on the west side."""
    o = []
    o.append(boxp('Seat', -0.20, 0.31, -0.37, 0.37, 0.14, 0.45, CC_['chair'], CC_['chairTop'], '#b0562a'))
    o.append(boxp('Back', -0.31, -0.18, -0.37, 0.37, 0.14, 0.95, CC_['chair'], CC_['chairTop'], '#b0562a'))
    for sy in (-1, 1):
        o.append(boxp('Arm', -0.31, 0.31, sy * 0.37 - 0.06, sy * 0.37 + 0.06, 0.14, 0.62, CC_['chair'],
                      CC_['chairTop'], '#b0562a'))
    for (x, y) in ((-0.26, -0.33), (0.26, -0.33), (-0.26, 0.33), (0.26, 0.33)):
        o.append(P.boxmm('Leg', x - 0.025, x + 0.025, y - 0.025, y + 0.025, 0, 0.14, M('#3a3a3a')))
    return o


CUST_FN = {'customs_desk': customs_desk_objs, 'armchair_orange': armchair_objs}


def build_customs_furniture():
    return [('customs_desk', customs_desk_objs(), {'footprint': [2.4, 0.74], 'blocksSight': False, 'height': 1.4,
                                                   'note': 'owner stands north of it'}),
            ('armchair_orange', armchair_objs(), {'footprint': [0.62, 0.75], 'blocksSight': False, 'height': 0.95,
                                                  'note': 'faces east'})]


def build_customs():
    parts = customs_parts()
    inside = parts.pop('inside')
    for k in parts:
        shift(parts[k], -CAX, -CAY)
    furn = []
    for key, x, y in CUST_FURN:
        furn += place(CUST_FN[key](), x - CAX, y - CAY)
    furn += place(lift_objs(), (CU['bay'][0] + CU['bay'][1]) / 2 - CAX, 2.6 - CAY)
    see = inside + furn
    c = CU
    rel, rect = rel_fn(CAX, CAY)
    Wd, D, t, wx = c['W'], c['D'], c['t'], c['wx1']
    base = {'footprint': [Wd, D], 'anchor_note': 'all customs_* layers share this anchor (centre of the wall bbox)'}
    door = {'x0': rel(c['door'][0], 0)[0], 'x1': rel(c['door'][1], 0)[0], 'y': rel(0, 0)[1],
            'hinge': 'west jamb, opens outward'}
    meta_ext = dict(base, blocksSight=True, layer='exterior', height=c['mtop'],
                    colliders=[rect(0, Wd, 0, D)], door=door,
                    bay={'x0': rel(c['bay'][0], 0)[0], 'x1': rel(c['bay'][1], 0)[0], 'y': rel(0, 0)[1], 'state': 'open'},
                    roofProps=[{'key': 'ac_unit', 'pos': rel(10.9, 3.0), 'z': c['mdeck']},
                               {'key': 'roof_vent', 'pos': rel(7.2, 4.6), 'z': c['mdeck']}],
                    note='corrugated grey: west work bay wing (5.4 m tall, open bay with a lift) + showroom block '
                         '(6.4 m) with an orange stripe, "Automotive CUSTOMS" sign and a 5-pane window with the door; '
                         'roof AC/vent positions are guesses (roof only seen partly)')
    yb = D - t
    walls = [rect(0, c['bay'][0], 0, t), rect(c['bay'][1], c['win'][0], 0, t), rect(c['win'][1], Wd, 0, t),
             rect(c['win'][0], c['door'][0], 0, t), rect(c['door'][1], c['win'][1], 0, t),
             rect(0, t, 0, D), rect(Wd - t, Wd, 0, D), rect(0, Wd, yb, D), rect(wx - 0.1, wx + 0.1, t, yb)]
    furniture = {'customs_desk': rel(6.94, 4.53), 'armchair_orange': rel(6.07, 1.62), 'armchair_orange#2': rel(6.07, 0.68),
                 'car_lift': rel((c['bay'][0] + c['bay'][1]) / 2, 2.6)}
    meta_int = dict(base, layer='interior', walls=walls, cut_h=c['cut'],
                    rooms={'bay': rect(t, wx - 0.1, t, yb), 'showroom': rect(wx + 0.1, Wd - t, t, yb)},
                    doors={'front': door, 'bay': {'x0': rel(c['bay'][0], 0)[0], 'x1': rel(c['bay'][1], 0)[0],
                                                  'y': rel(0, 0)[1]}},
                    furniture=furniture, display={'pos': rel(11.6, 3.1), 'facing': 'south',
                                                  'vehicle': 'black sports car with grey stripe'},
                    note='chequered showroom (0.85 m squares), dark slat back wall with wheel rack / picture / red '
                         'bench, mats + rug + ottoman baked; west bay wing with oil stains (no door into the '
                         'showroom seen - partition is a cut wall)')
    return [
        ('customs', parts['walls'] + parts['roof'] + see, meta_ext),
        ('customs_roof', parts['roof'], dict(base, layer='roof')),
        ('customs_interior', parts['interior'], meta_int),
        ('customs_interior_front', parts['ifront'], dict(base, layer='interior_front', sortY=rel(0, 0)[1],
                                                          note='front wall cut 0.32 m; open bay + door gaps')),
        ('customs_door', parts['door'], dict(base, layer='door', sortY=rel(0, 0)[1], note='glass door closed')),
        ('customs_door_open', parts['door_open'], dict(base, layer='door', sortY=rel(0, -0.5)[1],
                                                       note='glass door swung 70 deg outward on the west jamb')),
    ]


# =============================================================== licensing ===
LC = dict(wall='#b8bbbf', band='#959595', cap='#b1b1b1', roof='#687877', base='#949494', brick='#c6c8cb',
          sign='#3686b6', signTop='#43a6d2', white='#f2f4f5', frame='#474546', dframe='#777777', dglass='#8ba5b1',
          glass='#8ca4b2', sill='#b3cdd9', chairSeat='#94dee7', chairBack='#8ac4d3', chairLeg='#9a9a82',
          interior='#7e95a3')
LI = dict(W=7.65, D=7.0, t=0.2, wall=2.11, top=4.26, deck=3.96, door=(0.615, 1.385), door_h=1.70,
          win1=(1.35, 3.03), win2=(3.80, 7.15), win_z=(0.32, 1.72))
LAX, LAY = LI['W'] / 2, LI['D'] / 2


def build_licensing():
    c, C = LI, LC
    o = []
    Wd, D, t = c['W'], c['D'], c['t']
    dd, w1, w2, (wz0, wz1) = c['door'], c['win1'], c['win2'], c['win_z']
    facade('LF', 0.0, Wd, 0.0, t, c['wall'], [(dd[0] - 0.06, dd[1] + 0.06, 0, c['door_h'] + 0.06),
                                              (w1[0], w1[1], wz0, wz1), (w2[0], w2[1], wz0, wz1)],
           C['wall'], C['cap'], out=o)
    o.append(boxp('LBase', 0.0, Wd, -0.02, t, 0, 0.24, C['base'], C['base']))
    o.append(boxp('LBand', 0.0, Wd, -0.03, t, c['wall'], c['top'], C['band'], C['cap']))
    R = parapet_roof('LR', 0.0, Wd, 0.0, D, c['top'], c['deck'], C['cap'], C['band'], C['roof'], [], t=0.16, front=False)
    R.append(boxp('LCapF', 0.0, Wd, -0.03, 0.16, c['top'] - 0.01, c['top'], C['band'], C['cap']))
    for (a, b) in ((0.0, t), (Wd - t, Wd)):
        o.append(boxp('LShell', a, b, t, D, 0, c['top'], C['wall'], C['cap']))
    o.append(boxp('LShellN', 0.0, Wd, D - t, D, 0, c['top'], C['wall'], C['cap']))
    bricks('LBrick', 0.15, Wd - 0.3, 0.4, c['wall'] - 0.3, -0.001, C['brick'], 4, 31, w=0.15, h=0.07, out=o,
           ranges=[(0.05, dd[0] - 0.1), (3.05, 3.22), (3.6, 3.78)])
    # door
    o.append(boxp('LDoorFrame', dd[0] - 0.06, dd[1] + 0.06, -0.04, 0.05, 0, c['door_h'] + 0.06, C['frame'], '#5a5a5a'))
    o.append(P.boxmm('LDoorIn', dd[0] + 0.04, dd[1] - 0.04, -0.05, -0.04, 0.06, c['door_h'] - 0.04, M(C['dframe'])))
    o.append(P.boxmm('LDoorGlass', dd[0] + 0.10, dd[1] - 0.10, -0.055, -0.05, 0.12, c['door_h'] - 0.10, M(C['dglass'])))
    o.append(P.boxmm('LNote', dd[0] + 0.28, dd[0] + 0.46, -0.06, -0.055, 1.05, 1.25, M('#d5edf7')))
    o.append(P.boxmm('LHandle', dd[1] - 0.09, dd[1] - 0.06, -0.09, -0.05, 0.55, 0.85, M('#9a9a9a')))
    # windows (see-through onto a dim waiting room with teal chairs)
    for i, (a, b, n) in enumerate(((w1[0], w1[1], 2), (w2[0], w2[1], 4))):
        o.append(boxp('LRoom', a, b, 1.30, 1.40, 0, wz1 + 1.2, C['interior'], C['interior']))
        o.append(boxp('LRoomFloor', a, b, 0.2, 1.4, wz0 - 0.02, wz0 + 0.03, C['sill'], C['sill']))
        window('LWin%d' % i, a, b, wz0, wz1, 0.10, n, None, C['dframe'], outer=0.06, top_bar=0.06, bar=0.035,
               glass=glass_mat('#a8c6d4', 0.55), out=o)
        pane = (b - a) / n
        for k in range(n):
            if i == 1 and k == 0:
                o.append(boxp('LBoard', a + 0.08, a + pane - 0.06, 0.9, 0.95, 0.85, 1.55, '#5f7380', '#6f8390'))
                continue
            xc = a + pane * (k + 0.5)
            if i == 1 and k == 3:
                o.append(boxp('LPlant', xc - 0.18, xc + 0.18, 0.7, 0.95, wz0, wz0 + 0.55, '#d8d0a8', '#e6dfba'))
                continue
            o.append(boxp('LChairSeat', xc - 0.24, xc + 0.24, 0.55, 0.95, wz0 + 0.30, wz0 + 0.42, C['chairSeat'],
                          '#a6eaf2'))
            o.append(boxp('LChairBack', xc - 0.24, xc + 0.24, 0.85, 0.95, wz0 + 0.42, wz0 + 0.92, C['chairBack'],
                          '#a6eaf2'))
            for xx in (xc - 0.20, xc + 0.16):
                o.append(P.boxmm('LChairLeg', xx, xx + 0.04, 0.58, 0.62, wz0, wz0 + 0.30, M(C['chairLeg'])))
    # lost-dog poster between the windows
    px0, px1, pz0, pz1 = 3.25, 3.58, 0.69, 1.36
    o.append(boxp('Poster', px0, px1, -0.012, 0.0, pz0, pz1, '#f4f4f4', '#ffffff'))
    o.append(P.boxmm('PosterRed', px0 + 0.03, px1 - 0.03, -0.016, -0.012, pz1 - 0.07, pz1 - 0.035, M('#d83a48')))
    o.append(P.boxmm('PosterPic', px0 + 0.06, px1 - 0.06, -0.016, -0.012, pz0 + 0.27, pz1 - 0.11, M('#c9c9c9')))
    o.append(P.boxmm('PosterDog', px0 + 0.11, px1 - 0.11, -0.02, -0.016, pz0 + 0.30, pz1 - 0.15, M('#2e2e2e')))
    for k in range(3):
        z = pz0 + 0.07 + k * 0.06
        o.append(P.boxmm('PosterLine', px0 + 0.06, px1 - 0.06, -0.016, -0.012, z, z + 0.025, M('#3a3a3a')))
    # LICENSING sign box with a car pictogram
    sx0, sx1, sz0, sz1 = 0.615, 3.03, 2.75, 3.66
    sg = boxp('Sign', sx0, sx1, -0.10, -0.03, sz0, sz1, C['sign'], C['signTop'], '#2f74a0')
    o.append(sg)
    o.append(fit_text('LicTxt', 'LICENSING', 1.73, 2.88, 3.03, 3.33, -0.101, C['white'], bold=0.0, font=FONT_ROUND))
    car = []
    cy = -0.102
    body = [(0.78, 2.97), (1.55, 2.97), (1.55, 3.12), (1.47, 3.19), (1.30, 3.23), (1.18, 3.41), (1.02, 3.42),
            (0.90, 3.25), (0.80, 3.21), (0.78, 3.11)]
    car.append(P.prism('CarBody', body[::-1], cy - 0.004, cy, M(C['white'])))
    for (a, b) in (((0.95, 3.26), (1.04, 3.37)), ((1.08, 3.26), (1.17, 3.37))):
        car.append(P.prism('CarWin', [(a[0], a[1]), (b[0], a[1]), (b[0], b[1]), (a[0] + 0.03, b[1])][::-1],
                           cy - 0.007, cy - 0.004, M(C['sign'])))
    for xw in (0.96, 1.38):
        car.append(P.cyl('CarWheel', 0.08, 0.004, 16, (xw, cy - 0.004, 2.97), axis='-Y', rz=0.13, m=M(C['white'])))
        car.append(P.cyl('CarWheelIn', 0.045, 0.004, 14, (xw, cy - 0.008, 2.97), axis='-Y', rz=0.075, m=M(C['sign'])))
        car.append(P.cyl('CarHub', 0.022, 0.004, 10, (xw, cy - 0.012, 2.97), axis='-Y', rz=0.036, m=M(C['white'])))
    o += car
    R.append(boxp('LSignBack', sx0 + 0.1, sx1 - 0.1, -0.03, 0.0, sz0 + 0.1, sz1 - 0.1, '#2f74a0', '#2f74a0'))
    R += place(ac_objs(), 0.99, 1.04, c['deck'])
    R += place(vent_objs(), 4.23, 0.80, c['deck'])
    objs = o + R
    shift(objs, -LAX, -LAY)
    rel, rect = rel_fn(LAX, LAY)
    meta = {'footprint': [Wd, D], 'blocksSight': True, 'layer': 'exterior', 'height': c['top'],
            'door': {'x0': rel(dd[0], 0)[0], 'x1': rel(dd[1], 0)[0], 'y': rel(0, 0)[1], 'note': 'decorative (no interior)'},
            'roofProps': [{'key': 'ac_unit', 'pos': rel(0.99, 1.04), 'z': c['deck'],
                           'note': 'the AC that gets a "?" icon at t243-253'},
                          {'key': 'roof_vent', 'pos': rel(4.23, 0.80), 'z': c['deck']}],
            'note': 'exterior only. 7.65 m west unit of the frontage (door, 2-pane + 4-pane windows onto a waiting '
                    'room, lost-dog poster, blue LICENSING sign). Depth 7 m is a guess (north edge never on screen); '
                    'the east neighbour with the red "RACE.." sign is not modelled'}
    return [('licensing', objs, meta),
            ('licensing_roof', R, {'footprint': [Wd, D], 'layer': 'roof', 'note': 'roof + AC + vent only'})]


BUILDERS = {
    'roof_bits': build_roof_bits,
    'dealer_furniture': build_dealer_furniture,
    'dealership': build_dealership,
    'garage_furniture': build_garage_furniture,
    'garage': build_garage,
    'customs_furniture': build_customs_furniture,
    'customs': build_customs,
    'licensing': build_licensing,
}

if __name__ == '__main__':
    P.run(BUILDERS)
