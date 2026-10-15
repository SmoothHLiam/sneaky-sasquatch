"""
Ranger Station: log building (exterior + roof + cut-away interior layers + doors) and its
interior furniture.

  Blender -b --factory-startup -P art/blender/props_station.py -- [group ...]
Groups: station atm vending newspaper fridge stove counter tv moose smoke table chair bed cabinet rugs

Refs (more inside park.mov): exterior 450-458 s and 657-673 s (t0660.3, f_454 / f_658 at zoom 1.0),
interior 646-656 s + t0470 / t0495 (the camera zooms ~1.56x inside; every interior size below was
divided by that zoom and measured against the back-wall base line).

Building-local frame used while modelling: x = 0 at the gabled main block's centre line, y = 0 at
its front (south) wall face. The L-shaped plan (interior measurements):
  main block     x -2.62 .. 2.62, y 0 .. 7.91  (front door at x 0.39..1.22)
  east wing      x  2.62 .. 5.39, y 2.20 .. 7.91 (front wall set back 2.2 m, window, no door)
  partition      y 4.52 .. 4.78 across the whole width, door at x 3.49..4.31
  north room     y 4.78 .. 7.68 (bed, wardrobe, table, TV, fridge, counter, stove)
Every station layer shares one anchor = centre of the 8.01 x 7.91 wall bounding box
(building-local (1.385, 3.955)); json carries walls/doors/furniture spots relative to it.
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
LEFTN, RIGHTN = (-1, 0, 0), (1, 0, 0)


def boxp(name, x0, x1, y0, y1, z0, z1, front, top=None, side=None, left=None, back=None):
    """Axis box painted per face with colours sampled from the reference (compensated)."""
    o = P.boxmm(name, x0, x1, y0, y1, z0, z1)
    P.paint(o, M(front), top=M(top or front, TOP), side=M(side or front, RIGHTN),
            left=M(left or side or front, LEFTN), back=M(back or front, (0, 1, 0)))
    return o


def shift(objs, dx, dy, dz=0.0):
    for o in objs:
        o.location = (dx, dy, dz)
        T.apply_transforms(o)
    return objs


def stadium(x0, x1, z0, z1, segs=5, round_l=True, round_r=True):
    """XZ outline of a log row: rectangle with semicircular ends (radius = half height)."""
    r = (z1 - z0) / 2
    zc = (z0 + z1) / 2
    pts = []
    if round_r:
        for i in range(segs + 1):
            a = -math.pi / 2 + math.pi * i / segs
            pts.append((x1 - r + r * math.cos(a), zc + r * math.sin(a)))
    else:
        pts += [(x1, z0), (x1, z1)]
    if round_l:
        for i in range(segs + 1):
            a = math.pi / 2 + math.pi * i / segs
            pts.append((x0 + r + r * math.cos(a), zc + r * math.sin(a)))
    else:
        pts += [(x0, z1), (x0, z0)]
    return pts


def top_round_rect(w, h, r, segs=4, cx=0.0, z0=0.0):
    """XZ outline (CCW): flat bottom at z0, rounded top corners."""
    pts = [(cx - w / 2, z0), (cx + w / 2, z0)]
    for i in range(segs + 1):
        a = math.radians(90 * i / segs)
        pts.append((cx + w / 2 - r + r * math.cos(a), z0 + h - r + r * math.sin(a)))
    for i in range(segs + 1):
        a = math.radians(90 + 90 * i / segs)
        pts.append((cx - w / 2 + r + r * math.cos(a), z0 + h - r + r * math.sin(a)))
    return pts


# =================================================================== building ===
SC = dict(
    log='#79552d', seam='#6c4828', end='#b77e34', ring='#ab7042', endSide='#8f6129',
    roofW='#885932', roofE='#a36b39', fascia='#614126', roofBack='#5a3e22', shingleW='#7c512d',
    shingleE='#ad7442',
    frame='#614426', trimTop='#835d36', glass='#98ac97', glassLo='#7a978c', door='#b37034',
    handle='#4a4a46', board='#543b23', boardTop='#8a623a', text='#d4d4d4',
    lampCap='#303739', lampDark='#1f2121', glow='#fdf5d1', glow2='#ecc946',
    # interior
    floor='#a56f39', floor2='#a06b37', floorSeam='#986634', iwall='#79552c', iseam='#6c482b',
    rim='#b47335', cutTop='#c48544', cutFace='#9d6b37',
)
B = dict(
    side_c=2.17, log_hw=2.69,           # main side walls (log-end stacks) at x=+-2.17, logs reach +-2.69
    row=0.54, seam=0.03,                # log row height (both outside and on the inside back wall)
    ridge=5.49, k=0.92, rh=2.92, rt=0.235, ov=0.35,   # main gable roof (ridge along y)
    depth=7.91,
    wing_y=2.20, wing_c=4.96, wing_hw=5.50, wing_eave=2.91, wing_k=0.60,
    disc_rx=0.21, disc_rz=0.27, disc_out=0.15,
    win_w=1.165, win_z0=0.655, win_z1=2.14,
    door_x0=0.395, door_x1=1.225, door_h=1.97,
    # interior (cut-away) walls
    in_w0=-2.62, in_w1=5.39, main_e=2.62, wall_t=0.19, front_t=0.26, back_t=0.23, back_h=2.71, cut=0.32,
    part_y0=4.52, part_y1=4.78, pdoor_x0=3.485, pdoor_x1=4.315,
)
AX, AY = (B['in_w0'] + B['in_w1']) / 2, B['depth'] / 2      # anchor in building-local coords


def roof_top(x):
    return B['ridge'] - abs(x) * B['k']


def roof_under(x):
    return roof_top(x) - B['rt']


def log_rows(name, x0, x1, y, z1_fn, rnd, depth=0.30, round_l=True, round_r=True, z0=0.0):
    """Horizontal log rows (front face at y) from z0 up; each row is clipped to the half width
    returned by z1_fn(z) (gable) when given."""
    out = []
    r, s = B['row'], B['seam']
    z = z0
    i = 0
    while True:
        za, zb = z + s / 2, z + r - s / 2
        if z1_fn is not None:
            lim = z1_fn(zb)
            if lim is None:
                break
            xa, xb, rl, rr = max(x0, -lim), min(x1, lim), round_l and -lim <= x0, round_r and lim >= x1
            if xb - xa < 0.1:
                break
        else:
            xa, xb, rl, rr = x0, x1, round_l, round_r
        pts = stadium(xa, xb, za, zb, 5, rl, rr)
        yo = y - rnd.uniform(0, 0.008)
        o = P.prism('%s%d' % (name, i), pts, yo, yo + depth)
        P.paint(o, M(SC['log']), top=M(P.tint(SC['log'], 1.08), TOP), side=M(P.tint(SC['log'], 0.8), RIGHTN))
        out.append(o)
        # seam strip (dark line between rows) slightly behind
        out.append(P.boxmm('Seam', xa + 0.2, xb - 0.2, yo + 0.01, yo + 0.05, zb - 0.005, zb + s + 0.005, M(SC['seam'])))
        z += r
        i += 1
    return out


def disc_stack(x, y, z_top, rnd, n_max=8):
    """Side-wall log ends: elliptic cylinders protruding towards -y with spiral rings on the face."""
    out = []
    rx, rz, r = B['disc_rx'], B['disc_rz'], B['row']
    for i in range(n_max):
        zc = r / 2 + i * r
        if zc - rz * 0.4 > z_top:
            break
        ring = P.ellipse(rx * 0.97, rz * 0.97, 18, 0, zc, a0=math.pi / 2)
        d = P.prism('Disc', ring, y - B['disc_out'], y + 0.25)
        P.paint(d, M(SC['end']), top=M(P.tint(SC['end'], 1.05), TOP), side=M(SC['endSide'], RIGHTN),
                left=M(SC['endSide'], LEFTN))
        out.append(d)
        sp = P.spiral(rx * 0.95, rz * 0.95, turns=2.4, width=0.075, n=70, cx=0, cz=0, a0=rnd.uniform(0, 6.28))
        sp = [(px, pz) for px, pz in sp]
        o = P.prism('Ring', sp, y - B['disc_out'] - 0.006, y - B['disc_out'] + 0.001, M(SC['ring']))
        P.xform(o, loc=(0, 0, zc))
        out.append(o)
    for o in out:
        o.location = (x, 0, 0)
        T.apply_transforms(o)
    return out


def window(cx, y, out):
    w, z0, z1 = B['win_w'], B['win_z0'], B['win_z1']
    x0, x1 = cx - w / 2, cx + w / 2
    fr = 0.09
    out.append(P.boxmm('WinGlass', x0 + fr, x1 - fr, y - 0.02, y + 0.02, z0 + fr, z1 - fr, M(SC['glass'])))
    out.append(P.boxmm('WinGlassLo', x0 + fr, x1 - fr, y - 0.025, y - 0.02, z0 + fr, z0 + fr + 0.13, M(SC['glassLo'])))
    for (a, b, c, d) in ((x0, x1, z1 - fr, z1), (x0, x1, z0, z0 + fr), (x0, x0 + fr, z0, z1), (x1 - fr, x1, z0, z1),
                         (cx - 0.035, cx + 0.035, z0, z1), (x0, x1, (z0 + z1) / 2 + 0.06 - 0.035, (z0 + z1) / 2 + 0.06 + 0.035)):
        o = P.boxmm('WinFrame', a, b, y - 0.06, y + 0.02, c, d)
        P.paint(o, M(SC['frame']), top=M(SC['trimTop'], TOP))
        out.append(o)
    hd = P.boxmm('WinHead', x0, x1, y - 0.07, y + 0.02, z1, z1 + 0.04)
    P.paint(hd, M(SC['frame']), top=M(SC['trimTop'], TOP))
    out.append(hd)


def door_leaf(name='Door'):
    """Front door leaf in its own frame: hinge (west) edge at x=0, y=0, leaf along +x."""
    w = B['door_x1'] - B['door_x0']
    objs = [P.boxmm(name, 0.0, w, -0.05, 0.0, 0.0, B['door_h'], M(SC['door']))]
    o = P.boxmm(name + 'Edge', 0.0, w, -0.05, 0.0, B['door_h'] - 0.01, B['door_h'])
    P.paint(o, M(SC['door']), top=M(P.tint(SC['door'], 1.1), TOP))
    objs.append(o)
    objs.append(P.boxmm(name + 'Handle', w - 0.20, w - 0.09, -0.09, -0.05, 0.93, 0.98, M(SC['handle'])))
    objs.append(P.boxmm(name + 'Handle2', w - 0.11, w - 0.09, -0.09, -0.05, 0.93, 1.01, M(SC['handle'])))
    return objs


def roof_slabs(out, rnd):
    y0, y1 = -B['ov'], B['depth'] + B['ov']
    rh = B['rh']
    for sx, top in ((-1, SC['roofW']), (1, SC['roofE'])):
        pts = [(0, B['ridge']), (sx * rh, roof_top(rh)), (sx * rh, roof_under(rh)), (0, B['ridge'] - B['rt'])]
        if sx > 0:
            pts = pts[::-1]
        s = P.prism('RoofSlab', pts, y0, y1)
        n = (sx * B['k'], 0, 1)
        P.paint(s, M(SC['fascia'], (sx, 0, 0)), front=M(SC['fascia']), top=M(top, n),
                side=M(SC['fascia'], (sx, 0, 0)), top_thresh=0.4)
        out.append(s)
        # shingle strokes: short slivers lying on the slope
        nl = Vector(n).normalized()
        sh = SC['shingleW'] if sx < 0 else SC['shingleE']
        for i in range(18):
            u = rnd.uniform(0.15, 0.9)
            yy = rnd.uniform(y0 + 0.4, y1 - 0.3)
            x = sx * u * rh
            z = roof_top(x) + 0.006
            L, wd = rnd.uniform(0.30, 0.5), 0.13
            dirv = Vector((sx * 0.55, 0.8, -0.55 * B['k'])).normalized()
            p0 = Vector((x, yy, z))
            side = nl.cross(dirv).normalized()
            q = [p0, p0 + dirv * L, p0 + dirv * L + side * wd, p0 + side * wd]
            out.append(P.plane_poly('Shingle', [tuple(v) for v in q], M(sh, n)))


def wing_roof(out):
    """East-wing roof: E-W ridge, front eave 2.91 m (fascia bottom) over the set-back front wall."""
    k, t = B['wing_k'], B['rt']
    yf = B['wing_y'] - B['ov']
    yb = B['depth'] + B['ov']
    ym = (yf + yb) / 2
    zf = B['wing_eave'] + t
    zr = zf + (ym - yf) * k
    x0, x1 = 1.7, B['wing_hw'] + 0.30
    for half in (0, 1):
        if half == 0:
            pts = [(yf, zf), (ym, zr), (ym, zr - t), (yf, zf - t)]
        else:
            pts = [(ym, zr), (yb, zf), (yb, zf - t), (ym, zr - t)]
        # build in YZ: prism along x
        bm = bmesh.new()
        vs = [bm.verts.new((x0, yy, zz)) for yy, zz in pts]
        f = bm.faces.new(vs)
        r = bmesh.ops.extrude_face_region(bm, geom=[f])
        for v in [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]:
            v.co.x = x1
        s = P.bm_obj('WingRoof', bm)
        P.paint(s, M(SC['fascia']), top=M(SC['roofW'], (0, -k, 1) if half == 0 else (0, k, 1)),
                side=M(SC['fascia'], RIGHTN), back=M(SC['roofBack'], (0, 1, 0)), top_thresh=0.4)
        out.append(s)


def build_station_parts(seed=7):
    rnd = random.Random(seed)
    parts = dict(walls=[], roof=[], interior=[], ifront=[], ifront_wing=[], ipart=[], door_open=[], door=[],
                 pdoor=[], pdoor_open=[])
    W = parts['walls']
    D = B['depth']
    sc, hw = B['side_c'], B['log_hw']
    # ---- main block body (hidden mostly) + gable back fill
    W.append(boxp('Body', -sc - 0.18, sc + 0.18, 0.05, D, 0, 3.0, SC['seam'], SC['log']))
    gz = 2.9
    W.append(P.prism('GableFill', [(-(B['ridge'] - B['rt'] - gz) / B['k'], gz), ((B['ridge'] - B['rt'] - gz) / B['k'], gz),
                                   (0, B['ridge'] - B['rt'] - 0.02)], 0.05, D, M(SC['seam'])))
    # ---- front wall logs (rounded tips beyond the side walls), clipped by the gable underside
    under = lambda z: (B['ridge'] - B['rt'] - z) / B['k'] if z < B['ridge'] - B['rt'] - 0.15 else None
    W += log_rows('Log', -hw, hw, 0.0, lambda z: min(hw, under(z)) if under(z) else None, rnd)
    # ---- side-wall log-end stacks
    for sx in (-1, 1):
        x = sx * sc
        W += disc_stack(x, 0.0, roof_under(abs(x) + B['disc_rx']) - 0.05, rnd)
    # ---- window, door, sign, lantern
    window(-0.82, 0.0, W)
    dx0, dx1, dh = B['door_x0'], B['door_x1'], B['door_h']
    W.append(P.boxmm('DoorGap', dx0, dx1, -0.01, 0.2, 0, dh, M('#3a2a1c')))
    leaf = door_leaf()
    shift(leaf, dx0, -0.01)
    parts['door'] = [o for o in leaf]
    W += [P.duplicate(o) for o in leaf]
    for (a, b) in ((dx0 - 0.10, dx0), (dx1, dx1 + 0.10)):
        W.append(boxp('Jamb', a, b, -0.07, 0.02, 0, dh + 0.02, SC['frame'], SC['trimTop']))
    W.append(boxp('Lintel', dx0 - 0.10, dx1 + 0.10, -0.08, 0.02, dh, dh + 0.15, SC['frame'], SC['trimTop']))
    # sign board + text
    bz0, bz1 = 2.70, 3.52
    W.append(boxp('Board', -1.40, 1.40, -0.10, 0.0, bz0, bz1, SC['board'], SC['boardTop']))
    txt = P.text_mesh('SignText', 'RANGER STATION', size=0.40, depth=0.01, bold=0.004, stretch_z=ST,
                      loc=(0, 0, 0), m=M(SC['text']))
    (tx0, tx1), _, (tz0, tz1) = P.bounds([txt])
    sxs, szs = 2.52 / (tx1 - tx0), 0.40 / (tz1 - tz0)
    P.xform(txt, scale=(sxs, 1, szs))
    (tx0, tx1), _, (tz0, tz1) = P.bounds([txt])
    P.xform(txt, loc=(-(tx0 + tx1) / 2, -0.10, (bz0 + bz1) / 2 - (tz0 + tz1) / 2 + 0.01))
    W.append(txt)
    # lantern (hangs from the gable above the board)
    ly = -0.16
    W.append(P.boxmm('LampArm', -0.025, 0.025, ly, 0.0, 4.62, 4.67, M(SC['lampCap'])))
    W.append(P.cyl('LampNeck', 0.035, 0.18, 10, (0, ly, 4.46), m=M(SC['lampCap'])))
    W.append(T.ico('LampKnob', 0.05, 1, loc=(0, ly, 4.66)))
    P.setm(W[-1], M(SC['lampCap']))
    cap = P.cyl('LampCap', 0.17, 0.26, 16, (0, ly, 4.20), r2=0.05)
    P.paint(cap, M(SC['lampCap']), top=M(SC['lampCap'], TOP), top_thresh=0.3)
    W.append(cap)
    W.append(P.cyl('LampRim', 0.175, 0.05, 16, (0, ly, 4.15), m=M(SC['lampDark'])))
    W.append(P.cyl('LampGlow', 0.105, 0.22, 14, (0, ly, 3.93), m=P.mat(SC['glow'], None, 0.0)))
    W.append(P.cyl('LampGlow2', 0.105, 0.17, 14, (0, ly, 3.76), r2=0.075, m=P.mat(SC['glow2'], None, 0.0)))
    W.append(P.cyl('LampBase', 0.055, 0.05, 10, (0, ly, 3.71), m=M(SC['lampDark'])))
    # ---- east wing: set-back front wall with window, log-end stack, roof
    wy = B['wing_y']
    W.append(boxp('WingBody', sc + 0.1, B['wing_c'] + 0.18, wy + 0.05, D, 0, B['wing_eave'] + 0.3, SC['seam'], SC['log']))
    W += log_rows('WLog', sc + 0.15, B['wing_hw'], wy, lambda z: 99 if z < B['wing_eave'] + 0.05 else None, rnd,
                  round_l=False)
    W += disc_stack(B['wing_c'], wy, B['wing_eave'] - 0.05, rnd)
    window(3.79, wy, W)
    R = parts['roof']
    roof_slabs(R, rnd)
    wing_roof(R)

    # ================= interior (roof off) =================
    I = parts['interior']
    x0, x1, xm, t = B['in_w0'], B['in_w1'], B['main_e'], B['wall_t']
    ft, bt = B['front_t'], B['back_t']
    yb = D - bt
    # floor: main block + wing, planks running N-S
    I.append(P.slab('Floor', [(x0, 0), (xm, 0), (xm, wy), (x1, wy), (x1, D), (x0, D)], 0.0, 0.02, M(SC['floor'], TOP)))
    x = x0 + t
    i = 0
    while x < x1 - t - 0.05:
        xb = min(x + 0.42, x1 - t)
        ys = 0.0 if x < xm else wy
        if i % 2:
            I.append(P.boxmm('Plank', x, xb, ys + 0.1, yb, 0.02, 0.024, M(SC['floor2'], TOP)))
        I.append(P.boxmm('PlankSeam', xb - 0.012, xb, ys + 0.1, yb, 0.02, 0.026, M(SC['floorSeam'], TOP)))
        x = xb
        i += 1
    # back wall (full height) with log rows on its inner face
    bw = P.boxmm('BackWall', x0, x1, yb, D, 0, B['back_h'])
    P.paint(bw, M(SC['iwall']), top=M(SC['rim'], TOP))
    I.append(bw)
    for k_ in range(1, 6):
        zs = k_ * B['row']
        if zs < B['back_h'] - 0.05:
            I.append(P.boxmm('BackSeam', x0 + t, x1 - t, yb - 0.012, yb, zs - 0.015, zs + 0.015, M(SC['iseam'])))
    # cut side walls (N-S): west, wing east, main-east stub south of the wing
    for (a, b, c, d) in ((x0, x0 + t, ft, yb), (x1 - t, x1, wy + ft, yb), (xm - t, xm, ft, wy + ft)):
        I.append(boxp('SideCut', a, b, c, d, 0, B['cut'], SC['cutFace'], SC['cutTop']))
    # ---- partition (own sort layer): E-W wall with a door gap
    PD = parts['ipart']
    for (a, b) in ((x0 + t, B['pdoor_x0']), (B['pdoor_x1'], x1 - t)):
        PD.append(boxp('Partition', a, b, B['part_y0'], B['part_y1'], 0, B['cut'], SC['cutFace'], SC['cutTop']))
    PD.append(P.boxmm('PThreshold', B['pdoor_x0'], B['pdoor_x1'], B['part_y0'], B['part_y1'], 0, 0.05, M(SC['cutTop'], TOP)))
    # ---- front walls (own sort layers)
    F = parts['ifront']
    for (a, b) in ((x0, dx0 - 0.02), (dx1 + 0.02, xm)):
        F.append(boxp('FrontCut', a, b, 0, ft, 0, B['cut'], SC['cutFace'], SC['cutTop']))
    F.append(P.boxmm('Threshold', dx0 - 0.02, dx1 + 0.02, 0, ft, 0, 0.05, M(SC['cutTop'], TOP)))
    FW = parts['ifront_wing']
    FW.append(boxp('WingFrontCut', xm - t, x1, wy, wy + ft, 0, B['cut'], SC['cutFace'], SC['cutTop']))
    # ---- doors: front door open (swung OUT ~80 deg, hinge on the west jamb, t0660.3)
    DO = door_leaf('ODoor')
    P.rotate_objs(DO, math.radians(-80))
    shift(DO, dx0, -0.01)
    parts['door_open'] = DO
    # partition door: closed leaf in the gap, and open (swung north into the north room, f_654)
    pw = B['pdoor_x1'] - B['pdoor_x0']
    PC = door_leaf('PDoor')
    shift(PC, B['pdoor_x0'], B['part_y0'] + 0.02)
    parts['pdoor'] = PC
    PO = door_leaf('PODoor')
    P.rotate_objs(PO, math.radians(95))
    shift(PO, B['pdoor_x0'], B['part_y1'])
    parts['pdoor_open'] = PO
    return parts


def rel(x, y):
    return [round(x - AX, 3), round(y - AY, 3)]


def rect(x0, x1, y0, y1):
    return {'x0': round(x0 - AX, 3), 'x1': round(x1 - AX, 3), 'y0': round(y0 - AY, 3), 'y1': round(y1 - AY, 3)}


def build_station():
    parts = build_station_parts()
    for k in parts:
        shift(parts[k], -AX, -AY)
    x0, x1, xm, t = B['in_w0'], B['in_w1'], B['main_e'], B['wall_t']
    D, wy, ft = B['depth'], B['wing_y'], B['front_t']
    fp = [round(x1 - x0, 2), D]
    walls = [rect(x0, B['door_x0'], 0, ft), rect(B['door_x1'], xm, 0, ft),      # main front (door gap)
             rect(xm - t, xm, 0, wy + ft),                                        # main east stub
             rect(xm - t, x1, wy, wy + ft),                                       # wing front
             rect(x0, x0 + t, 0, D), rect(x1 - t, x1, wy, D), rect(x0, x1, D - B['back_t'], D),
             rect(x0 + t, B['pdoor_x0'], B['part_y0'], B['part_y1']), rect(B['pdoor_x1'], x1 - t, B['part_y0'], B['part_y1'])]
    yb = D - B['back_t']
    lx = x0 + t          # left inner wall
    furniture = {
        # north room (backs against the back wall unless noted); positions = footprint centres
        'bed_teal': rel(lx + 0.415, yb - 0.685),
        'cabinet_wood': rel(lx + 1.43, yb - 0.24),
        'moose_head': rel(lx + 2.74, yb), 'table_yellow': rel(lx + 2.705, yb - 0.495),
        'chair_cyan_e': rel(lx + 2.03, yb - 0.50), 'chair_cyan_w': rel(lx + 3.38, yb - 0.50),
        'tv_crt': rel(lx + 4.065, yb - 0.28), 'fridge': rel(lx + 5.15, yb - 0.25),
        'kitchen_counter': rel(lx + 6.195, yb - 0.28), 'stove_range': rel(lx + 7.215, yb - 0.283),
        'smoke_detector': rel(lx + 7.20, yb), 'rug_red_station': rel(lx + 2.885, yb - 1.695),
        # south room (against the partition's south face / front wall)
        'atm': rel(lx + 0.825, B['part_y0'] - 0.42), 'vending_machine': rel(lx + 2.23, B['part_y0'] - 0.365),
        'newspaper_box': rel(lx + 3.565, B['part_y0'] - 0.21),
        'rug_red_station_b': rel(lx + 3.215, ft + 0.70 + 1.255),
        'table_yellow_long': rel(lx + 1.245, 1.88), 'chair_cyan_e#2': rel(lx + 0.42, 2.05),
        'chair_cyan#1': rel(lx + 2.215, ft + 0.30), 'chair_cyan#2': rel(lx + 4.215, ft + 0.30),
    }
    base = {'footprint': fp, 'anchor_note': 'all station_* layers share this anchor (centre of the wall bbox)'}
    meta_ext = dict(base, blocksSight=True, layer='exterior',
                    colliders=[rect(-B['side_c'] - 0.2, B['side_c'] + 0.2, 0, D), rect(B['side_c'], B['wing_c'] + 0.2, wy, D)],
                    door={'x0': rel(B['door_x0'], 0)[0], 'x1': rel(B['door_x1'], 0)[0], 'y': rel(0, 0)[1],
                          'hinge': 'west jamb, opens outward (south)'},
                    note='L-shaped log building: gabled main block (sign, door, window) + east wing set back 2.2 m')
    meta_int = dict(base, layer='interior', walls=walls, cut_h=B['cut'],
                    rooms={'south': [rect(x0 + t, xm - t, ft, B['part_y0']), rect(xm - t, x1 - t, wy + ft, B['part_y0'])],
                           'north': rect(x0 + t, x1 - t, B['part_y1'], yb)},
                    doors={'front': {'x0': rel(B['door_x0'], 0)[0], 'x1': rel(B['door_x1'], 0)[0], 'y': rel(0, 0)[1]},
                           'partition': {'x0': rel(B['pdoor_x0'], 0)[0], 'x1': rel(B['pdoor_x1'], 0)[0],
                                         'y': rel(0, B['part_y0'])[1]}},
                    furniture=furniture,
                    note='floor + full-height back wall + cut side walls; draw behind everything inside. '
                         'Camera zooms ~1.56x inside in the original.')
    return [
        ('station', parts['walls'] + parts['roof'], meta_ext),
        ('station_roof', parts['roof'], dict(base, layer='roof')),
        ('station_interior', parts['interior'], meta_int),
        ('station_interior_mid', parts['ipart'], dict(base, layer='interior_mid', sortY=rel(0, B['part_y0'])[1],
                                                       note='partition wall (cut 0.32 m) with door gap')),
        ('station_interior_front', parts['ifront'], dict(base, layer='interior_front', sortY=rel(0, 0)[1],
                                                          note='main front wall cut 0.32 m, door gap')),
        ('station_interior_front_wing', parts['ifront_wing'], dict(base, layer='interior_front',
                                                                    sortY=rel(0, B['wing_y'])[1],
                                                                    note='wing front wall cut 0.32 m')),
        ('station_door', parts['door'], dict(base, layer='door', sortY=rel(0, 0)[1],
                                             note='front door leaf closed (full height) - draw over the cut front wall')),
        ('station_door_open', parts['door_open'], dict(base, layer='door', sortY=rel(0, -0.45)[1],
                                                       note='front door swung ~80 deg outward on the west jamb')),
        ('station_door_inner', parts['pdoor'], dict(base, layer='door', sortY=rel(0, B['part_y0'])[1],
                                                    note='partition door closed')),
        ('station_door_inner_open', parts['pdoor_open'], dict(base, layer='door', sortY=rel(0, B['part_y1'] + 0.4)[1],
                                                              note='partition door swung open into the north room')),
    ]


# ================================================================ furniture ===
def build_atm():
    """ATM (t0470 / f_650): grey cabinet 0.82 x 0.32 x 2.28, blue ATM sign, screen, keypad."""
    W, Dp, H = 0.82, 0.32, 2.28
    hw = W / 2
    yf = -Dp / 2
    o = []
    o.append(boxp('Body', -hw, hw, yf, Dp / 2, 0, H, '#6b6b6b', '#8e8e8e', '#5c5c5c'))
    def face(name, x0, x1, z0, z1, col, dy=0.012):
        return P.boxmm(name, x0, x1, yf - dy, yf, z0, z1, M(col))
    o.append(face('Sign', -0.34, 0.34, 1.92, 2.22, '#3c5990'))
    t = P.text_mesh('AtmText', 'ATM', size=0.30, depth=0.01, bold=0.008, stretch_z=ST, loc=(0, 0, 0), m=M('#e6b654'))
    (a, b), _, (c, d) = P.bounds([t])
    P.xform(t, scale=(0.56 / (b - a), 1, 0.20 / (d - c)))
    (a, b), _, (c, d) = P.bounds([t])
    P.xform(t, loc=(-(a + b) / 2, yf - 0.012, 2.07 - (c + d) / 2))
    o.append(t)
    o.append(face('ScreenFrame', -0.30, 0.30, 1.27, 1.84, '#505050'))
    o.append(face('Screen', -0.18, 0.18, 1.39, 1.72, '#333333', 0.02))
    for sx in (-1, 1):
        for i in range(4):
            z = 1.44 + i * 0.075
            x = sx * 0.245
            o.append(P.boxmm('SideBtn', x - 0.035, x + 0.035, yf - 0.03, yf - 0.012, z, z + 0.04, M('#d0d0d0')))
    o.append(face('Keypad', -0.30, 0.30, 0.84, 1.26, '#868686'))
    for r_ in range(4):
        for c_ in range(3):
            x = -0.25 + c_ * 0.065
            z = 1.17 - r_ * 0.085
            o.append(P.boxmm('Key', x - 0.025, x + 0.025, yf - 0.03, yf - 0.012, z - 0.03, z + 0.03, M('#bdbdbd')))
    for i, col in enumerate(('#d24b4b', '#d9c64b', '#4fbf4f')):
        z = 1.17 - i * 0.085
        o.append(P.boxmm('FKey', -0.03, 0.06, yf - 0.03, yf - 0.012, z - 0.03, z + 0.03, M(col)))
    o.append(P.boxmm('Slot', 0.10, 0.26, yf - 0.03, yf - 0.012, 1.15, 1.19, M('#2a2a2a')))
    o.append(P.boxmm('Receipt', 0.12, 0.26, yf - 0.03, yf - 0.012, 1.00, 1.08, M('#c9c9c9')))
    o.append(face('Lower', -0.34, 0.34, 0.05, 0.80, '#5f5f5f'))
    o.append(face('LowerIn', -0.27, 0.27, 0.15, 0.70, '#666666', 0.016))
    return [('atm', o, {'footprint': [0.82, 0.4], 'blocksSight': False, 'height': H,
                        'note': 'stands with its back ~0.25 m off the partition in the original (top only 0.32 deep)'})]


def build_vending():
    """Blue vending machine 1.16 x 0.73 x 2.32 with stocked window (t0470)."""
    W, Dp, H = 1.16, 0.73, 2.32
    hw, yf = W / 2, -Dp / 2
    o = []
    body = P.prism('Body', top_round_rect(W, H, 0.12, 4), yf, Dp / 2)
    P.paint(body, M('#346ea5'), top=M('#4385bf', TOP), side=M('#2c5f90', RIGHTN), top_thresh=0.3)
    o.append(body)
    def face(name, x0, x1, z0, z1, col, dy=0.012):
        return P.boxmm(name, x0 - hw, x1 - hw, yf - dy, yf, z0, z1, M(col))
    o.append(face('Window', 0.10, 0.76, 0.84, 2.18, '#282828'))
    shelves = [1.86, 1.53, 1.20]
    for z in shelves + [0.88]:
        o.append(face('Shelf', 0.10, 0.76, z, z + 0.05, '#454545', 0.016))
    o.append(face('ShelfTop', 0.10, 0.76, 2.13, 2.18, '#454545', 0.016))
    stock = [(1.91, ('#e07a33', '#e07a33')), (1.58, ('#e04a55', '#e04a55'))]
    for z, cols in stock:
        for i, col in enumerate(cols):
            x = 0.27 + i * 0.30 - hw
            can = P.cyl('Can', 0.045, 0.16, 10, (x, yf - 0.06, z + 0.01), m=M(col))
            o.append(can)
            o.append(P.boxmm('CanLbl', x - 0.025, x + 0.025, yf - 0.11, yf - 0.10, z + 0.06, z + 0.12, M('#f2d6a8')))
    for i in range(2):
        x = 0.27 + i * 0.30 - hw
        bag = P.prism('Chips', [(x - 0.09, 1.26), (x + 0.09, 1.26), (x + 0.10, 1.47), (x - 0.10, 1.47)], yf - 0.06, yf - 0.02,
                      M('#d93b3f'))
        o.append(bag)
        o.append(P.prism('ChipsLogo', P.ellipse(0.05, 0.05, 10, x, 1.36), yf - 0.065, yf - 0.06, M('#f0c040')))
    for z in (1.99, 1.62, 1.23):
        o.append(face('Btn', 0.86, 1.08, z - 0.06, z + 0.06, '#c4bdb0', 0.02))
        o.append(face('BtnIn', 0.94, 1.00, z - 0.025, z + 0.025, '#8a8780', 0.03))
    o.append(face('Tray', 0.10, 0.76, 0.39, 0.73, '#274963', 0.02))
    o.append(face('TrayLip', 0.25, 0.60, 0.46, 0.48, '#3f6f99', 0.03))
    o.append(face('Coin', 0.89, 1.06, 0.45, 0.61, '#262a2e', 0.02))
    o.append(face('CoinSlot', 1.02, 1.04, 0.48, 0.58, '#9a9a9a', 0.03))
    return [('vending_machine', o, {'footprint': [1.16, 0.73], 'blocksSight': True, 'height': H})]


def build_newspaper():
    """Newspaper stand (f_650 / t0495): brown frame on dark legs, two shelves of stacked papers,
    front page on top, small coin box at the back."""
    W, Dp = 0.67, 0.46
    hw, yf = W / 2, -Dp / 2
    o = []
    fr, lg = '#755831', '#3b3b3b'
    for sx in (-1, 1):
        for sy in (-1, 1):
            x = sx * (hw - 0.035)
            y = sy * (Dp / 2 - 0.035)
            o.append(boxp('Leg', x - 0.035, x + 0.035, y - 0.035, y + 0.035, 0, 0.98, lg, '#555555'))
    for z0, z1 in ((0.03, 0.11), (0.57, 0.65)):
        o.append(boxp('ShelfF', -hw, hw, yf, Dp / 2, z0, z1, fr, '#564225'))
    # lower stack
    for i in range(5):
        z = 0.11 + i * 0.065
        o.append(boxp('PaperL', -hw + 0.06, hw - 0.06, yf + 0.03, Dp / 2 - 0.04, z, z + 0.06,
                      '#959595' if i % 2 else '#767676', '#b8b8b8'))
    # upper stack + front page
    for i in range(5):
        z = 0.65 + i * 0.065
        o.append(boxp('PaperU', -hw + 0.03, hw - 0.03, yf + 0.01, Dp / 2 - 0.06, z, z + 0.06,
                      '#c1c1c1' if i % 2 else '#a1a1a1', '#e7e7e7'))
    zt = 0.65 + 5 * 0.065
    y0, y1 = yf + 0.01, Dp / 2 - 0.06
    L = y1 - y0
    def page(name, u0, u1, v0, v1, col):   # u across x (-1..1 of half width), v along y from the front edge
        return P.boxmm(name, u0, u1, y0 + v0 * L, y0 + v1 * L, zt, zt + 0.004, M(col, TOP))
    o.append(page('Head', -0.27, 0.27, 0.78, 0.92, '#717171'))
    o.append(page('Photo', -0.27, -0.07, 0.25, 0.68, '#717171'))
    for i in range(6):
        v = 0.66 - i * 0.085
        o.append(page('Line', -0.02, 0.27, v - 0.03, v, '#717171'))
    # coin box on top at the back
    cb = P.prism('CoinBox', P.rrect(0.40, 0.26, 0.05, 3, 0, zt + 0.13), Dp / 2 - 0.13, Dp / 2)
    P.paint(cb, M('#564225'), top=M('#755831', TOP), top_thresh=0.4)
    o.append(cb)
    o.append(P.boxmm('CoinFace', -0.16, 0.16, Dp / 2 - 0.14, Dp / 2 - 0.13, zt + 0.04, zt + 0.21, M('#755831')))
    return [('newspaper_box', o, {'footprint': [0.67, 0.46], 'blocksSight': False, 'height': round(zt + 0.26, 2)})]


def build_fridge():
    """White fridge 0.82 x 0.50 x 1.78 (t0470 closed / f_650 open with wire shelves)."""
    W, Dp, H = 0.82, 0.50, 1.78
    hw, yf = W / 2, -Dp / 2
    out = []
    for opened in (False, True):
        o = []
        body = P.prism('Body', top_round_rect(W, H, 0.07, 3), yf + (0.05 if opened else 0), Dp / 2)
        P.paint(body, M('#cdcdcd'), top=M('#e7e7e7', TOP), side=M('#b5b5b5', RIGHTN), top_thresh=0.3)
        o.append(body)
        if not opened:
            o.append(P.boxmm('TopTrim', -hw + 0.02, hw - 0.02, yf - 0.01, yf, H - 0.17, H - 0.12, M('#a1a1a1')))
            o.append(P.boxmm('Split', -hw + 0.02, hw - 0.02, yf - 0.008, yf, 1.18, 1.20, M('#b0b0b0')))
            o.append(P.boxmm('Handle', -hw + 0.06, -hw + 0.09, yf - 0.05, yf, 0.72, 1.08, M('#9a9a9a')))
            o.append(P.boxmm('Handle2', -hw + 0.06, -hw + 0.09, yf - 0.05, yf, 1.26, 1.46, M('#9a9a9a')))
            o.append(P.boxmm('Kick', -hw + 0.02, hw - 0.02, yf - 0.01, yf, 0.0, 0.07, M('#8e8e8e')))
        else:
            yi = yf + 0.05
            o.append(P.boxmm('Cavity', -hw + 0.06, hw - 0.06, yi - 0.004, yi, 0.08, H - 0.10, M('#e7e7e7')))
            o.append(P.boxmm('Frame', -hw + 0.04, hw - 0.04, yi - 0.006, yi - 0.003, 0.06, H - 0.08, M('#9a9a9a')))
            o.append(P.boxmm('Cavity2', -hw + 0.07, hw - 0.07, yi - 0.009, yi - 0.006, 0.09, H - 0.11, M('#e7e7e7')))
            for z0 in (0.14, 0.62, 1.10):
                o.append(P.boxmm('ShelfBar', -hw + 0.07, hw - 0.07, yi - 0.03, yi - 0.009, z0 + 0.40, z0 + 0.44, M('#bfbfbf')))
                for i in range(9):
                    x = -hw + 0.12 + i * 0.075
                    o.append(P.boxmm('Wire', x - 0.018, x + 0.018, yi - 0.03, yi - 0.009, z0, z0 + 0.40, M('#bfbfbf')))
            door = P.boxmm('Door', -0.05, 0.0, -W + 0.02, 0.0, 0.03, H - 0.04)
            P.paint(door, M('#bdbdbd'), top=M('#d4d4d4', TOP), side=M('#e0e0e0', RIGHTN), left=M('#d0d0d0', LEFTN))
            P.xform(door, loc=(-hw, yf + 0.04, 0), rot=(0, 0, math.radians(-12)))
            o.append(door)
        key = 'fridge_open' if opened else 'fridge'
        out.append((key, o, {'footprint': [0.82, 0.5], 'blocksSight': False, 'height': H,
                             'note': 'door hinged on the west side' + (', swung open' if opened else '')}))
    return out


def build_stove():
    """White 4-burner range 0.77 x 0.565 x 0.86 with backsplash and oven window (t0495 / t0476)."""
    W, Dp, H = 0.77, 0.565, 0.86
    hw, yf = W / 2, -Dp / 2
    o = []
    o.append(boxp('Body', -hw, hw, yf, Dp / 2, 0, H, '#cdcdcd', '#e7e7e7', '#b8b8b8'))
    o.append(boxp('Splash', -hw, hw, Dp / 2 - 0.05, Dp / 2, H, H + 0.09, '#cdcdcd', '#e7e7e5'))
    for cx in (-0.18, 0.18):
        for cy in (-0.11, 0.13):
            ring_o = P.ellipse(0.14, 0.11, 20, cx, cy)
            ring_i = P.ellipse(0.10, 0.075, 20, cx, cy)
            ring = ring_o + [ring_o[0], ring_i[0]] + ring_i[::-1]
            o.append(P.slab('Burner', ring, H, H + 0.012, M('#6f6f6f', TOP)))
            o.append(P.slab('BurnerC', P.ellipse(0.035, 0.03, 10, cx, cy), H, H + 0.014, M('#6f6f6f', TOP)))
            for a in range(4):
                ang = a * math.pi / 2
                p0 = (cx + math.cos(ang) * 0.035, cy + math.sin(ang) * 0.028)
                p1 = (cx + math.cos(ang) * 0.12, cy + math.sin(ang) * 0.095)
                dxv, dyv = -(p1[1] - p0[1]), p1[0] - p0[0]
                ln = math.hypot(dxv, dyv) or 1
                dxv, dyv = dxv / ln * 0.012, dyv / ln * 0.012
                o.append(P.slab('Grate', [(p0[0] - dxv, p0[1] - dyv), (p1[0] - dxv, p1[1] - dyv), (p1[0] + dxv, p1[1] + dyv),
                                          (p0[0] + dxv, p0[1] + dyv)], H, H + 0.013, M('#6f6f6f', TOP)))
    # knob strip
    o.append(P.boxmm('KnobStrip', -hw + 0.02, hw - 0.02, yf - 0.006, yf, H - 0.11, H - 0.01, M('#cdcdcd')))
    for i in range(5):
        x = -0.28 + i * 0.14
        o.append(P.cyl('Knob', 0.032, 0.03, 10, (x, yf - 0.006, H - 0.06), axis='-Y', m=M('#6f6f6f')))
    # oven door + handle + window grille
    o.append(P.boxmm('OvenDoor', -hw + 0.02, hw - 0.02, yf - 0.012, yf, 0.14, H - 0.13, M('#cdcdcd')))
    o.append(P.boxmm('OvenHandle', -hw + 0.06, hw - 0.06, yf - 0.035, yf - 0.012, H - 0.20, H - 0.17, M('#9a9a9a')))
    o.append(P.boxmm('OvenWin', -hw + 0.07, hw - 0.07, yf - 0.016, yf - 0.012, 0.25, H - 0.24, M('#999999')))
    n = 13
    for i in range(n):
        x = -hw + 0.09 + i * (W - 0.18) / (n - 1)
        o.append(P.boxmm('Grille', x - 0.012, x + 0.012, yf - 0.02, yf - 0.016, 0.27, H - 0.26, M('#b1b1b1')))
    o.append(P.boxmm('Drawer', -hw + 0.02, hw - 0.02, yf - 0.012, yf, 0.02, 0.12, M('#cdcccc')))
    o.append(P.boxmm('DrawerHandle', -0.25, 0.25, yf - 0.03, yf - 0.012, 0.05, 0.08, M('#b4b6b7')))
    return [('stove_range', o, {'footprint': [0.77, 0.565], 'blocksSight': False, 'height': H,
                                'burners_m': [[-0.18, -0.11, H], [0.18, -0.11, H], [-0.18, 0.13, H], [0.18, 0.13, H]]})]


def build_counter():
    """Kitchen counter 1.25 x 0.56 x 0.80 with a white sink (between fridge and stove, t0495)."""
    W, Dp, H = 1.25, 0.56, 0.80
    hw, yf = W / 2, -Dp / 2
    o = []
    o.append(boxp('Cab', -hw + 0.02, hw - 0.02, yf + 0.03, Dp / 2, 0, H - 0.07, '#c7a05e', '#c7a05e', '#b08c50'))
    o.append(boxp('Top', -hw, hw, yf, Dp / 2, H - 0.07, H, '#855833', '#97683c', '#7a512f'))
    for (a, b, kx) in ((-hw + 0.04, -hw + 0.385, -hw + 0.34), (-hw + 0.395, -hw + 0.74, -hw + 0.43)):
        o.append(P.boxmm('CDoor', a, b, yf + 0.018, yf + 0.03, 0.07, 0.65, M('#b4874c')))
        o.append(P.cyl('Knob', 0.02, 0.02, 8, (kx, yf + 0.018, 0.55), axis='-Y', m=M('#865d2f')))
    sx = -hw + 0.17 + 0.24
    sy0, sy1 = Dp / 2 - 0.37, Dp / 2 - 0.03
    o.append(boxp('Sink', sx - 0.24, sx + 0.24, sy0, sy1, H, H + 0.16, '#e7e7e7', '#e7e7e7', '#d0d0d0'))
    o.append(P.slab('Basin', P.rrect(0.36, 0.17, 0.05, 3, sx, (sy0 + sy1) / 2 - 0.02), H + 0.16, H + 0.164, M('#bfbfbf', TOP)))
    o.append(P.slab('Drain', P.ellipse(0.035, 0.025, 10, sx, (sy0 + sy1) / 2 - 0.04), H + 0.164, H + 0.167, M('#8a8a8a', TOP)))
    o.append(boxp('Faucet', sx - 0.025, sx + 0.025, sy1 - 0.06, sy1 - 0.01, H + 0.16, H + 0.30, '#999999', '#b0b0b0'))
    o.append(boxp('Spout', sx - 0.02, sx + 0.02, sy1 - 0.13, sy1 - 0.01, H + 0.26, H + 0.30, '#999999', '#b0b0b0'))
    for dx in (-0.11, 0.11):
        o.append(P.cyl('Tap', 0.03, 0.06, 10, (sx + dx, sy1 - 0.04, H + 0.16), m=M('#6f6f6f')))
    return [('kitchen_counter', o, {'footprint': [1.25, 0.56], 'blocksSight': False, 'height': H})]


def build_tv():
    """CRT TV on a pale wooden stand (t0495): stand 1.0 x 0.56 x 0.49, TV 0.9 wide, V antenna."""
    o = []
    SW, SD, SH = 1.0, 0.56, 0.49
    yf = -0.28
    top = boxp('StandTop', -SW / 2, SW / 2, yf, yf + SD, SH - 0.10, SH, '#b69457', '#e8c977', '#a8874f')
    o.append(top)
    for sx in (-1, 1):
        for sy in (0, 1):
            x = sx * (SW / 2 - 0.08)
            y = yf + 0.06 + sy * (SD - 0.12)
            o.append(boxp('Leg', x - 0.05, x + 0.05, y - 0.05, y + 0.05, 0, SH - 0.10, '#b69457', '#c8a46a'))
    # TV cabinet: shallow front box + tapered hood behind
    TW, TH = 0.90, 0.73
    tf = yf + 0.055
    o.append(boxp('TvFront', -TW / 2, TW / 2, tf, tf + 0.14, SH, SH + TH, '#3e3e3e', '#714a38', '#333333'))
    rings = []
    for (yy, w, h) in ((tf + 0.14, 0.82, 0.64), (tf + 0.36, 0.48, 0.38)):
        zc = SH + TH / 2 + (0.0 if w > 0.6 else 0.06)
        rings.append([(-w / 2, yy, zc - h / 2), (w / 2, yy, zc - h / 2), (w / 2, yy, zc + h / 2), (-w / 2, yy, zc + h / 2)])
    bm = bmesh.new()
    vr = [[bm.verts.new(p) for p in r] for r in rings]
    for i in range(4):
        bm.faces.new((vr[0][i], vr[0][(i + 1) % 4], vr[1][(i + 1) % 4], vr[1][i]))
    bm.faces.new(vr[1])
    hood = P.bm_obj('Hood', bm)
    P.paint(hood, M('#4f4f4f'), top=M('#4f4f4f', (0, 0.3, 1)), side=M('#454545', RIGHTN), top_thresh=0.3)
    o.append(hood)
    # front details: screen (news) + control panel
    def face(name, x0, x1, z0, z1, col, dy=0.01):
        return P.boxmm(name, x0, x1, tf - dy, tf, SH + z0, SH + z1, M(col))
    o.append(face('Screen', -0.40, 0.17, 0.08, 0.62, '#4f8db6'))
    o.append(face('ScreenHi', -0.40, 0.17, 0.40, 0.62, '#5a9bc4', 0.012))
    o.append(P.prism('Anchor', P.ellipse(0.09, 0.10, 12, -0.12, SH + 0.36), tf - 0.016, tf - 0.012, M('#c2956e')))
    o.append(P.prism('Suit', [(-0.24, SH + 0.10), (0.0, SH + 0.10), (-0.02, SH + 0.24), (-0.22, SH + 0.24)],
                     tf - 0.016, tf - 0.012, M('#222721')))
    o.append(P.prism('Tie', [(-0.13, SH + 0.10), (-0.11, SH + 0.10), (-0.11, SH + 0.23), (-0.13, SH + 0.23)],
                     tf - 0.02, tf - 0.016, M('#c03a3a')))
    o.append(face('NewsBar', -0.40, 0.05, 0.10, 0.15, '#d24646', 0.02))
    o.append(face('Ticker', 0.05, 0.17, 0.10, 0.15, '#a6a79e', 0.02))
    o.append(face('Panel', 0.20, 0.42, 0.06, 0.66, '#585858'))
    o.append(P.cyl('Dial', 0.06, 0.02, 14, (0.31, tf - 0.01, SH + 0.53), axis='-Y', m=M('#3e3e3e')))
    o.append(P.boxmm('DialMark', 0.30, 0.32, tf - 0.035, tf - 0.03, SH + 0.53, SH + 0.59, M('#e04a4a')))
    for i in range(5):
        z = 0.26 + i * 0.04
        o.append(face('Grill', 0.24, 0.38, z, z + 0.018, '#3e3e3e', 0.014))
    for x in (0.26, 0.36):
        o.append(P.cyl('Btn', 0.025, 0.02, 10, (x, tf - 0.01, SH + 0.13), axis='-Y', m=M('#3e3e3e')))
    # antenna
    hz = SH + TH / 2 + 0.06 + 0.19
    hy = tf + 0.30
    o.append(P.cyl('AntBase', 0.04, 0.04, 10, (0, hy, hz - 0.02), m=M('#3e3e3e')))
    for sx in (-1, 1):
        o.append(P.tube('Antenna', Vector((0, hy, hz)), Vector((sx * 0.22, hy - 0.04, hz + 0.62)), 0.012, 6, M('#b1b0b1')))
    return [('tv_crt', o, {'footprint': [1.0, 0.56], 'blocksSight': False, 'height': round(hz + 0.62, 2),
                           'screen': {'centre_m': [-0.115, round(tf, 3), round(SH + 0.35, 3)], 'w': 0.57, 'h': 0.54}})]


def build_moose():
    """Moose-head trophy on a yellow shield plaque, wall-mounted (back wall, t0495 / f_650).
    Origin = floor point at the wall face under the plaque; plaque spans z 0.90..1.99."""
    o = []
    zc = 1.45
    hw, top, bot, zs = 0.305, 0.545, -0.545, -0.05
    right = [(hw * math.cos(a), zs - (zs - bot) * math.sin(a)) for a in [math.pi / 2 * i / 10 for i in range(11)]]
    shield = [(-hw, top), (hw, top)] + right[:-1] + [(0, bot)] + [(-x, z) for x, z in right[:-1][::-1]]
    sp = [(x, zc + z) for x, z in shield]
    o.append(P.prism('Plaque', sp[::-1], -0.06, 0.0, M('#d1a307')))
    inner = [(x * 0.84, zc + z * 0.86 + 0.02) for x, z in shield]
    o.append(P.prism('PlaqueIn', inner[::-1], -0.065, -0.06, M('#e0b20a')))
    # head: outline + face, ears, muzzle (screen-designed, stretched)
    hd = '#4b3621'
    zh = zc + 0.10
    head = [(-0.20, 0.36), (0.20, 0.36), (0.23, 0.14), (0.18, -0.14), (0.11, -0.40), (0.0, -0.46), (-0.11, -0.40),
            (-0.18, -0.14), (-0.23, 0.14)]
    o.append(P.prism('HeadOut', [(x, zh + z) for x, z in head][::-1], -0.16, -0.065, M(hd)))
    face = [(x * 0.80, zh + z * 0.86 - 0.02) for x, z in head]
    o.append(P.prism('Face', face[::-1], -0.17, -0.16, M('#75582e')))
    for sx in (-1, 1):
        ear = [(sx * 0.17, zh + 0.30), (sx * 0.29, zh + 0.42), (sx * 0.29, zh + 0.30), (sx * 0.21, zh + 0.22)]
        o.append(P.prism('Ear', ear if sx > 0 else ear[::-1], -0.12, -0.08, M(hd)))
        o.append(P.prism('Eye', P.ellipse(0.024, 0.032, 8, sx * 0.085, zh + 0.08), -0.18, -0.17, M('#241912')))
    muz = P.ellipse(0.095, 0.13, 12, 0, zh - 0.27)
    o.append(P.prism('Muzzle', muz, -0.20, -0.16, M('#5c432a')))
    o.append(P.prism('Nose', P.ellipse(0.05, 0.038, 10, 0, zh - 0.35), -0.21, -0.20, M('#1f1610')))
    # antlers (tan): rise ~0.75 m from the head top, spreading to about the plaque width
    ant = '#c0915a'
    for sx in (-1, 1):
        base = Vector((sx * 0.12, -0.10, zh + 0.36))
        pts = [base, base + Vector((sx * 0.05, 0, 0.25)), base + Vector((sx * 0.10, 0, 0.52)),
               base + Vector((sx * 0.15, 0, 0.78))]
        for a, b in zip(pts, pts[1:]):
            o.append(P.tube('Antler', a, b, 0.017, 6, M(ant)))
        for p, d in ((pts[1], (sx * 0.12, 0, 0.13)), (pts[2], (sx * 0.11, 0, 0.14)), (pts[2], (-sx * 0.05, 0, 0.17))):
            o.append(P.tube('Tine', p, p + Vector(d), 0.014, 6, M(ant)))
    return [('moose_head', o, {'footprint': [0.62, 0.2], 'blocksSight': False, 'wallMounted': True,
                               'mountZ': 0.90, 'plaqueTopZ': 1.99, 'height': 2.45,
                               'note': 'origin = floor point at the wall face below the plaque; place at the back wall'})]


def build_smoke():
    """Round smoke detector puck on the back wall (axis along -y), z 2.05 (t0495 / f_650)."""
    o = []
    zc = 2.05
    body = P.cyl('Puck', 0.12, 0.07, 20, (0, 0.0, zc), axis='-Y')
    P.paint(body, M('#c1c1c1'), top=M('#e5e5e5', TOP), top_thresh=0.3)
    o.append(body)
    o.append(P.cyl('Rim', 0.095, 0.01, 20, (0, -0.07, zc), axis='-Y', m=M('#b4b4b4')))
    o.append(P.cyl('Led', 0.016, 0.01, 8, (0.06, -0.08, zc - 0.03), axis='-Y', m=M('#d7707a')))
    return [('smoke_detector', o, {'footprint': [0.24, 0.07], 'blocksSight': False, 'wallMounted': True,
                                   'mountZ': round(zc, 2), 'height': round(zc + 0.12, 2),
                                   'note': 'origin = floor point at the wall face below it; alarm target'})]


def table(W, Dp, H, legs_in=0.05):
    o = []
    o.append(boxp('Top', -W / 2, W / 2, -Dp / 2, Dp / 2, H - 0.08, H, '#b69357', '#e8c977', '#a8874f'))
    for sx in (-1, 1):
        for sy in (-1, 1):
            x = sx * (W / 2 - legs_in - 0.05)
            y = sy * (Dp / 2 - legs_in - 0.05)
            o.append(boxp('Leg', x - 0.05, x + 0.05, y - 0.05, y + 0.05, 0, H - 0.08, '#b69457', '#c8a46a', '#a8874f'))
    return o


def build_table():
    return [('table_yellow', table(0.93, 0.71, 0.76), {'footprint': [0.93, 0.71], 'blocksSight': False, 'height': 0.76}),
            ('table_yellow_long', table(0.78, 1.34, 0.74), {'footprint': [0.78, 1.34], 'blocksSight': False,
                                                             'height': 0.74, 'note': 'long axis N-S (south room)'})]


def chair(rot, back_h=0.55):
    """Cyan chair: seat 0.5 x 0.42 at 0.45 m, backrest back_h above the seat, brown legs. Faces -y, rotated.
    (E/W-facing chairs in the stills show a 0.55 m back, the S-facing ones only ~0.3 m.)"""
    o = []
    sw, sd, sz = 0.50, 0.42, 0.45
    for sx in (-1, 1):
        for sy in (-1, 1):
            x = sx * (sw / 2 - 0.04)
            y = sy * (sd / 2 - 0.04)
            o.append(boxp('Leg', x - 0.03, x + 0.03, y - 0.03, y + 0.03, 0, sz - 0.05, '#75582e', '#86653a', '#6a4f29'))
    o.append(boxp('Seat', -sw / 2, sw / 2, -sd / 2, sd / 2, sz - 0.06, sz, '#589ba9', '#6fcfd3', '#4f8f9c'))
    o.append(boxp('Back', -sw / 2, sw / 2, sd / 2 - 0.07, sd / 2, sz, sz + back_h, '#589ba9', '#74d4d2', '#4f8f9c',
                  back='#5fa9b4'))
    o.append(boxp('Rail', -sw / 2, sw / 2, -sd / 2 + 0.02, sd / 2 - 0.02, 0.14, 0.18, '#589ba9', '#6fcfd3'))
    P.rotate_objs(o, rot)
    return o


def build_chair():
    return [('chair_cyan', chair(0, 0.30), {'footprint': [0.5, 0.45], 'blocksSight': False, 'note': 'faces south'}),
            ('chair_cyan_e', chair(math.radians(90)), {'footprint': [0.45, 0.5], 'blocksSight': False, 'note': 'faces east'}),
            ('chair_cyan_w', chair(math.radians(-90)), {'footprint': [0.45, 0.5], 'blocksSight': False, 'note': 'faces west'}),
            ('chair_cyan_n', chair(math.radians(180), 0.30), {'footprint': [0.5, 0.45], 'blocksSight': False, 'note': 'faces north'})]


def build_bed():
    """Single bed with teal blanket and wooden head/foot boards; long axis N-S, head north (f_650)."""
    W, L = 0.83, 1.37
    o = []
    wood, woodT = '#875c32', '#a3703a'
    for y, h, t in ((L / 2 - 0.08, 0.80, 0.08), (-L / 2, 0.46, 0.09)):
        a = P.prism('Board', top_round_rect(W, h, 0.14, 4), y, y + t)
        P.paint(a, M(wood), top=M(woodT, TOP), side=M('#77512d', RIGHTN), top_thresh=0.4)
        o.append(a)
    mw = W - 0.06
    o.append(boxp('Frame', -W / 2 + 0.02, W / 2 - 0.02, -L / 2 + 0.06, L / 2 - 0.08, 0.12, 0.24, '#77512d', '#875c32'))
    o.append(boxp('Mattress', -mw / 2, mw / 2, -L / 2 + 0.09, L / 2 - 0.08, 0.24, 0.40, '#d8d6d4', '#eeebe9'))
    pil = P.rock('Pillow', (0.60, 0.30, 0.12), seed=3, subdiv=2, jag=0.0, loc=(0, L / 2 - 0.27, 0.39))
    P.setm(pil, M('#eeebe9', TOP))
    o.append(pil)
    yb0, yb1 = -L / 2 + 0.09, L / 2 - 0.50
    o.append(boxp('Blanket', -mw / 2 - 0.015, mw / 2 + 0.015, yb0, yb1, 0.30, 0.45, '#5fb7c0', '#6bcad4', '#58a8b2'))
    o.append(boxp('Fold', -mw / 2 - 0.02, mw / 2 + 0.02, yb1 - 0.02, yb1 + 0.16, 0.30, 0.47, '#589ba9', '#589ba9'))
    return [('bed_teal', o, {'footprint': [W, L], 'blocksSight': False, 'note': 'head north; ranger sleeps here'})]


def build_cabinet():
    """Pale wooden wardrobe 0.82 x 0.48 x 1.88 with two doors (f_650)."""
    W, Dp, H = 0.82, 0.48, 1.88
    hw, yf = W / 2, -Dp / 2
    o = [boxp('Body', -hw, hw, yf, Dp / 2, 0, H, '#c79f5f', '#fad680', '#b08c50')]
    o.append(P.boxmm('Lip', -hw, hw, yf - 0.01, yf, H - 0.09, H, M('#cba35f')))
    for (a, b) in ((-hw + 0.06, -0.008), (0.008, hw - 0.06)):
        o.append(P.boxmm('Door', a, b, yf - 0.012, yf, 0.10, H - 0.16, M('#b4874c')))
    for x in (-0.06, 0.06):
        o.append(P.prism('Knob', P.ellipse(0.028, 0.022, 10, x, 0.98), yf - 0.025, yf - 0.012, M('#8a6237')))
    return [('cabinet_wood', o, {'footprint': [0.82, 0.48], 'blocksSight': False, 'height': H})]


def build_rugs():
    out = []
    for key, Wd, Dp, b in (('rug_red_station', 3.37, 1.27, 0.12), ('rug_red_station_b', 2.69, 2.51, 0.12)):
        objs = [P.boxmm('RugBorder', -Wd / 2, Wd / 2, -Dp / 2, Dp / 2, 0.0, 0.012, M('#a94646', TOP)),
                P.boxmm('RugField', -Wd / 2 + b, Wd / 2 - b, -Dp / 2 + b, Dp / 2 - b, 0.012, 0.016, M('#c55150', TOP))]
        out.append((key, objs, {'footprint': [Wd, Dp], 'blocksSight': False, 'decal': True}))
    return out


BUILDERS = {
    'station': build_station,
    'atm': build_atm,
    'vending': build_vending,
    'newspaper': build_newspaper,
    'fridge': build_fridge,
    'stove': build_stove,
    'counter': build_counter,
    'tv': build_tv,
    'moose': build_moose,
    'smoke': build_smoke,
    'table': build_table,
    'chair': build_chair,
    'bed': build_bed,
    'cabinet': build_cabinet,
    'rugs': build_rugs,
}

if __name__ == '__main__':
    P.run(BUILDERS)
