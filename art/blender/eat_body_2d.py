"""
Flat 2D build of the sasquatch for the EATING close-up (head + torso, front-on,
no arms -- the game draws the arms itself as thick 2-bone lines from the
shoulders).

The original close-up is flat vector art, so instead of rendering the 3D model
this builds flat-coloured polygons (unlit, exact colours) in Blender's XZ plane
and renders them with an orthographic camera.  Used by render_closeups.py.

All shapes are authored in *screen pixels of the 3024x1898 reference captures*
with the character centred on X0 (the game centres the body PNG on the screen
and scales it to 0.6 x screen width, head top at 3 % of the screen height), so
the measured positions from the stills can be typed in directly:
    your research/frames/tutorial/sheet_eating_closeup_sequence.png  (98.9, 105.6, 108.6: mouth closed)
    your research/frames/tutorial/t104.0_eat_closeup_ketchup_meter_filling.jpg (mouth open)
    your research/frames/tutorial/t096.4_eat_closeup_dump_backpack.jpg (beard, chest scales)
"""
import math
import random
import bpy

# ---- reference frame / game placement --------------------------------------
REF_W, REF_H = 3024, 1898
X0 = REF_W / 2                    # character centre line
HEAD_TOP = 0.03 * REF_H           # game puts headTop at 3 % H
PNG_W, PNG_H = 1814, 1400          # ~1:1 with the reference resolution
S = 0.6 * REF_W / PNG_W            # game scale (screen px per png px)
PAD_TOP = 20                       # png rows above the head top
Y_TOP = HEAD_TOP - PAD_TOP * S     # screen y of png row 0
UNIT = 1000.0                      # screen px per Blender unit

# ---- palette (sampled from the stills) ------------------------------------
HAIR = '#432f22'
FACE = '#edad7d'
EAR = '#b47552'
EYE = '#22150f'
TOOTH = '#f8f8f6'
CHEST = '#593928'
SCALE = '#5f3e2b'
MOUTH = '#673b3a'
MOUTH_IN = '#4e2b2d'
TONGUE = '#98022d'


def to_png(x, y):
    return ((x - X0) / S + PNG_W / 2, (y - Y_TOP) / S)


# ============================================================ geometry ====
def ellipse(cx, cy, rx, ry, n=96, rot=0.0, exp=2.0):
    pts = []
    cr, sr = math.cos(rot), math.sin(rot)
    for i in range(n):
        a = 2 * math.pi * i / n
        c, s = math.cos(a), math.sin(a)
        x = rx * math.copysign(abs(c) ** (2 / exp), c)
        y = ry * math.copysign(abs(s) ** (2 / exp), s)
        pts.append((cx + x * cr - y * sr, cy + x * sr + y * cr))
    return pts


def _cr(p0, p1, p2, p3, n, alpha=0.5):
    """Centripetal Catmull-Rom between p1 and p2 (n samples, excluding p2)."""
    def tj(ti, a, b):
        return ti + max(1e-6, math.hypot(b[0] - a[0], b[1] - a[1])) ** alpha
    t0 = 0.0
    t1 = tj(t0, p0, p1)
    t2 = tj(t1, p1, p2)
    t3 = tj(t2, p2, p3)
    out = []
    for k in range(n):
        t = t1 + (t2 - t1) * k / n
        def lerp(a, b, ta, tb):
            if tb - ta < 1e-9:
                return a
            return ((tb - t) / (tb - ta) * a[0] + (t - ta) / (tb - ta) * b[0],
                    (tb - t) / (tb - ta) * a[1] + (t - ta) / (tb - ta) * b[1])
        A1 = lerp(p0, p1, t0, t1); A2 = lerp(p1, p2, t1, t2); A3 = lerp(p2, p3, t2, t3)
        B1 = lerp(A1, A2, t0, t2); B2 = lerp(A2, A3, t1, t3)
        out.append(lerp(B1, B2, t1, t2))
    return out


def spline(pts, closed=True, n=10):
    """Smooth curve through pts.  closed=False keeps the end points (use it to
    chain segments with sharp corners between them)."""
    P = list(pts)
    m = len(P)
    out = []
    if closed:
        for i in range(m):
            out += _cr(P[i - 1], P[i], P[(i + 1) % m], P[(i + 2) % m], n)
    else:
        ext = [(2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1])] + P + \
              [(2 * P[-1][0] - P[-2][0], 2 * P[-1][1] - P[-2][1])]
        for i in range(1, m):
            out += _cr(ext[i - 1], ext[i], ext[i + 1], ext[i + 2], n)
        out.append(P[-1])
    return out


def mirror(pts):
    """Mirror points about X0 (the character centre line)."""
    return [(2 * X0 - x, y) for x, y in pts]


def rel(pts):
    return [(X0 + x, y) for x, y in pts]


def lock(root, tip, w, bend=0.0, taper=0.8, n=18):
    """A hair lock / fur scale: round at the root, tapering to a point at the tip.
    bend curves the centre line (fraction of the length, + = to the left of
    root->tip in screen space)."""
    (x0, y0), (x1, y1) = root, tip
    L = math.hypot(x1 - x0, y1 - y0)
    ux, uy = (x1 - x0) / L, (y1 - y0) / L
    px, py = uy, -ux
    mx, my = (x0 + x1) / 2 + px * bend * L, (y0 + y1) / 2 + py * bend * L

    def C(t):
        return ((1 - t) ** 2 * x0 + 2 * (1 - t) * t * mx + t * t * x1,
                (1 - t) ** 2 * y0 + 2 * (1 - t) * t * my + t * t * y1)

    def D(t):
        dx = 2 * (1 - t) * (mx - x0) + 2 * t * (x1 - mx)
        dy = 2 * (1 - t) * (my - y0) + 2 * t * (y1 - my)
        d = math.hypot(dx, dy) or 1.0
        return dx / d, dy / d

    left, right = [], []
    for i in range(n + 1):
        t = i / n
        h = w / 2 * (1 - t) ** taper * (1 + 0.15 * math.sin(math.pi * t))
        c = C(t)
        dx, dy = D(t)
        nx, ny = -dy, dx
        left.append((c[0] + nx * h, c[1] + ny * h))
        right.append((c[0] - nx * h, c[1] - ny * h))
    dx, dy = D(0)
    nx, ny = -dy, dx
    h0 = w / 2
    cap = []
    for i in range(1, 12):
        a = math.pi * i / 12
        cap.append((x0 + h0 * (nx * math.cos(a) - dx * math.sin(a)),
                    y0 + h0 * (ny * math.cos(a) - dy * math.sin(a))))
    return right + left[::-1][1:] + cap


def _area(p):
    return sum(p[i][0] * p[i - 1][1] - p[i - 1][0] * p[i][1] for i in range(len(p))) / 2


def clip(subject, clipper):
    """Sutherland-Hodgman: subject polygon clipped by a CONVEX clipper."""
    if _area(clipper) < 0:
        clipper = clipper[::-1]
    out = list(subject)
    for i in range(len(clipper)):
        a, b = clipper[i - 1], clipper[i]
        def inside(p):
            return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) <= 0
        def inter(p, q):
            x1, y1, x2, y2 = p[0], p[1], q[0], q[1]
            x3, y3, x4, y4 = a[0], a[1], b[0], b[1]
            den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
            t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den
            return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))
        inp, out = out, []
        if not inp:
            break
        for j in range(len(inp)):
            p, q = inp[j - 1], inp[j]
            if inside(q):
                if not inside(p):
                    out.append(inter(p, q))
                out.append(q)
            elif inside(p):
                out.append(inter(p, q))
    return out


def halfplane(p, q, big=4000):
    """Convex quad covering the side of line p->q to its left (screen coords)."""
    dx, dy = q[0] - p[0], q[1] - p[1]
    d = math.hypot(dx, dy)
    ux, uy = dx / d, dy / d
    nx, ny = uy, -ux                      # left normal in y-down screen space
    a = (p[0] - ux * big, p[1] - uy * big)
    b = (p[0] + ux * big, p[1] + uy * big)
    return [a, b, (b[0] + nx * big, b[1] + ny * big), (a[0] + nx * big, a[1] + ny * big)]


# ============================================================== design ====
def face_outline(open_mouth=False):
    """Peach face: two round lobes on top with a sharp notch, wide cheeks, two
    lower lobes with the beard poking up between them (98.9 / t104)."""
    top = [(0, 330), (6, 318), (13, 300), (22, 286), (34, 273), (50, 260),
           (75, 243), (110, 227), (157, 218), (200, 226), (240, 245), (275, 270),
           (305, 296), (335, 326), (362, 360), (385, 400), (403, 440), (416, 480),
           (422, 515), (420, 550)]
    if not open_mouth:
        bottom = [(412, 585), (397, 615), (376, 642), (348, 667), (310, 692),
                  (262, 714), (205, 732), (150, 742), (112, 742), (82, 734),
                  (62, 718), (44, 694), (26, 674), (0, 668)]
    else:
        bottom = [(416, 590), (409, 625), (398, 655), (383, 685), (362, 715),
                  (333, 742), (293, 766), (240, 786), (180, 799), (125, 804),
                  (85, 800), (58, 788), (40, 770), (22, 757), (0, 754)]
    right = spline(top + bottom, closed=False, n=6)
    left = mirror(rel(right))[::-1]
    return rel(right)[:-1] + left[:-1]


def ear(side):
    return ellipse(X0 + side * 502, 445, 70, 75, n=64)


def eye(side, open_mouth=False):
    e = ellipse(X0 + side * 253, 455, 27, 33, n=48)
    if not open_mouth:
        return e
    # the cheeks push up when the mouth is wide open (t104): flat lower lid,
    # higher on the nose side
    inner = (X0 + side * 220, 466)
    outer = (X0 + side * 286, 480)
    p, q = (inner, outer) if side < 0 else (outer, inner)
    return clip(e, halfplane(q, p))


def tooth(cx, tip_y, base_y, w, up=True, n=16, r=8, bulge=4):
    """Rounded canine: parabolic flanks (width ~ sqrt of the distance from the
    tip, as measured on t096.4), rounded base corners, slightly convex base."""
    h = abs(base_y - tip_y)
    sgn = 1 if up else -1
    side = []
    for i in range(n + 1):
        d = (h - r) * (i / n) ** 1.6
        hw = min(w / 2, w / 2 * math.sqrt(max(d, 0.0) / (h * 0.85)))
        side.append((hw, tip_y + sgn * d))
    # rounded corner and a gently convex base
    for k in range(1, 5):
        a = math.pi / 2 * k / 4
        side.append((w / 2 - r + r * math.cos(a), base_y - sgn * r + sgn * r * math.sin(a)))
    for k in range(1, 4):
        t = k / 4
        side.append(((w / 2 - r) * (1 - t), base_y + sgn * bulge * math.sin(math.pi / 2 * t)))
    right = [(cx + x, y) for x, y in side]
    left = [(cx - x, y) for x, y in side[::-1]]
    return right + [(cx, base_y + sgn * bulge)] + left[:-1]


def fang_closed(side):
    """Lower canines poking up over the lip (98.9 / t096.4: tip up, ~58 x 80 px)."""
    return tooth(X0 + side * 149, 550, 631, 58, up=True)


MOUTH_C = (X0, 611)


def SHOULDER(side):
    # where the game's arms start: the top corners of the chest, just under the
    # jaw hair (98.9: arms leave the body at ~42 % H, t104.0 ~45 % H)
    return (X0 + side * 300, 820)


def mouth_outer():
    return ellipse(MOUTH_C[0], MOUTH_C[1], 201, 93, n=120, exp=2.3)


def mouth_parts():
    outer = mouth_outer()
    inner = clip(ellipse(X0, 630, 150, 80, n=96), outer)
    tongue = [clip(ellipse(X0 + s * 52, 708, 74, 46, n=64), outer) for s in (-1, 1)]
    teeth = []
    for s in (-1, 1):
        # small upper teeth hanging from the top corners, big lower canines
        # standing at the bottom corners (t104.0)
        teeth.append(clip(tooth(X0 + s * 146, 569, 512, 40, up=False, r=3), outer))
        teeth.append(clip(tooth(X0 + s * 149, 628, 712, 54, up=True), outer))
    return outer, inner, tongue, teeth


# Silhouette of the mop, traced from t104.0 (relative to the face centre, which
# is the same in every eating frame up to the body lean) and simplified.  The
# original's hair runs off the top of the screen; here it is closed with a low
# dome so the topmost pixel can be the game's headTop (3 % H).
HAIR_LEFT = [(-461, 791), (-469, 764), (-469, 729), (-461, 696), (-451, 671), (-450, 648),
             (-477, 539), (-484, 530), (-493, 525), (-521, 522), (-551, 530), (-579, 556),
             (-585, 557), (-590, 548), (-599, 503), (-599, 472), (-592, 438), (-595, 435),
             (-610, 435), (-613, 432), (-619, 414), (-619, 400), (-617, 381), (-605, 343),
             (-590, 309), (-574, 284), (-553, 266), (-501, 247), (-485, 226), (-481, 207),
             (-483, 190), (-493, 169), (-505, 159), (-517, 155), (-554, 158), (-558, 155),
             (-558, 147)]
HAIR_RIGHT = [(479, 139), (506, 144), (524, 152), (556, 174), (578, 196), (592, 215), (604, 237),
              (608, 253), (608, 274), (603, 281), (596, 283), (568, 275), (556, 278), (560, 313),
              (553, 324), (535, 325), (513, 319), (509, 322), (513, 349), (513, 373), (510, 378),
              (532, 382), (548, 391), (563, 409), (569, 428), (570, 441), (564, 469), (547, 495),
              (552, 498), (562, 518), (569, 560), (568, 635), (559, 671), (552, 684), (539, 692),
              (528, 690), (498, 669), (477, 662), (455, 662), (445, 667), (436, 677), (426, 709),
              (436, 745), (438, 785), (434, 807)]
# hidden closing edge under the dome
HAIR_SIDES_TOP = [(-540, 140), (-470, 150), (400, 152)]
# below the jaw: two last locks hanging over the shoulders, closed under the beard
HAIR_BOTTOM = [(424, 846), (392, 806), (330, 770), (-330, 770), (-404, 812), (-446, 852)]
# crown: a round dome with locks combed out and down along its edge
CROWN = (0, 230, 545, 173, 3.2)          # cx, cy, rx, ry, exponent -> top at y=57
# locks combed out and down along the crown: (side, angle of the root on the
# dome, angle of the tip, width)
# scallops cut into the crown: lock tips pointing down and out at these dome
# angles (degrees from the side, 90 = top), per side for a little asymmetry
CROWN_NOTCHES = {1: (), -1: ()}
# broad locks rounding off the top corners, tips pointing out and down
CORNER_LOCKS = [((-445, 140), (-566, 152), 92, -0.10), ((440, 136), (566, 152), 88, 0.10)]
# extra bulk on the upper sides, so the mop is as wide as the original's
CROWN_BULGES = []
CROWN_DIPS = {1: ((205, 50, 7), (370, 50, 8)), -1: ((150, 50, 6), (320, 55, 8))}
CROWN_LOW = 150          # the dome stops here; the traced sides continue


def crown_point(deg, side):
    cx, cy, rx, ry, ex = CROWN
    a = math.radians(deg)
    c, s_ = math.cos(a), math.sin(a)
    x = rx * c ** (2 / ex)
    y = -ry * s_ ** (2 / ex)
    n = (x / rx ** 2, y / ry ** 2)
    d = math.hypot(*n)
    return (X0 + side * (cx + x), cy + y), (side * n[0] / d, n[1] / d)


def crown_half(side):
    """Dome outline from the top (90 deg) down to the side, with scallops."""
    notches = CROWN_NOTCHES[side]
    pts = []
    deg = 90.0
    while True:
        near = [n for n in notches if abs(deg - n) < 4]
        if near:
            n = near[0]
            (p, nv) = crown_point(n, side)
            (q, qv) = crown_point(n - 5, side)
            tx, ty = -nv[1], nv[0]                       # tangent ...
            if tx * side < 0:
                tx, ty = -tx, -ty                        # ... pointing towards the side
            pts.append((p[0] + nv[0] * 10 + tx * 34, p[1] + nv[1] * 10 + ty * 34))   # lock tip
            pts.append((q[0] - qv[0] * 30, q[1] - qv[1] * 30))                     # notch
            deg = n - 10
            continue
        p = crown_point(deg, side)[0]
        dx = abs(p[0] - X0)
        for (dc, dw, dd) in CROWN_DIPS[side]:
            if abs(dx - dc) < dw:
                p = (p[0], p[1] + dd * math.cos(math.pi / 2 * (dx - dc) / dw) ** 2)
        if p[1] > CROWN_LOW:
            break
        pts.append(p)
        deg -= 2.0
    # below that the traced sides take over; tuck the dome in behind them
    pts.append((X0 + side * 455, CROWN_LOW + 40))
    pts.append((X0 + side * 300, 420))
    return pts


def hair_shapes():
    """Big mop, one flat colour (the original has no inner hair lines)."""
    sides = HAIR_LEFT + HAIR_SIDES_TOP + HAIR_RIGHT + HAIR_BOTTOM
    out = [rel(spline(sides, closed=True, n=4))]
    crown = crown_half(-1)[::-1] + crown_half(1)[1:]
    out.append(crown)
    for cx, cy, rx, ry in CROWN_BULGES:
        out.append(ellipse(X0 + cx, cy, rx, ry, n=64))
    for r, t, w, b in CORNER_LOCKS:
        out.append(lock((X0 + r[0], r[1]), (X0 + t[0], t[1]), w, bend=b, taper=0.75))
    return out


def face_ring():
    """Hair strip between the face and the ears (the ears tuck in behind it)."""
    f = face_outline(False)
    return [(X0 + (x - X0) * 1.075, y) for x, y in f]


def beard_shapes():
    """Dark hair under the face: wide on the shoulders, gently wavy lower edge,
    one pointed tuft hanging in the middle of the chest (t096.4, 98.9)."""
    pts = [(-380, 610), (380, 610), (372, 720), (356, 786), (318, 798), (272, 797),
           (232, 812), (186, 818), (146, 830), (112, 850), (70, 866), (32, 884), (0, 904),
           (-32, 884), (-70, 866), (-112, 850), (-146, 830), (-186, 818), (-232, 812),
           (-272, 797), (-318, 798), (-356, 786), (-372, 720)]
    return [rel(spline(pts, closed=True, n=6))]


def leaf(a, b, w, bend=0.0, fat=0.42, n=22):
    """Fur scale: pointed at both ends (a = top, b = tip), widest at `fat`."""
    (x0, y0), (x1, y1) = a, b
    L = math.hypot(x1 - x0, y1 - y0)
    ux, uy = (x1 - x0) / L, (y1 - y0) / L
    px, py = uy, -ux
    mx, my = (x0 + x1) / 2 + px * bend * L, (y0 + y1) / 2 + py * bend * L
    p = math.log(0.5) / math.log(fat)
    left, right = [], []
    for i in range(n + 1):
        t = i / n
        c = ((1 - t) ** 2 * x0 + 2 * (1 - t) * t * mx + t * t * x1,
             (1 - t) ** 2 * y0 + 2 * (1 - t) * t * my + t * t * y1)
        dx = 2 * (1 - t) * (mx - x0) + 2 * t * (x1 - mx)
        dy = 2 * (1 - t) * (my - y0) + 2 * t * (y1 - my)
        d = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / d, dx / d
        h = w / 2 * math.sin(math.pi * t ** p) ** 0.7
        left.append((c[0] + nx * h, c[1] + ny * h))
        right.append((c[0] - nx * h, c[1] - ny * h))
    return right + left[::-1][1:-1]


# lighter fur scales on the chest (t096.4): (centre x, centre y, w, h, lean)
CHEST_SCALES = [(-262, 868, 100, 120, 0.10), (32, 850, 80, 100, -0.05), (-252, 985, 88, 132, 0.12),
                (-130, 1010, 100, 140, 0.05), (158, 968, 92, 132, -0.10), (268, 872, 96, 124, -0.12),
                (100, 1135, 100, 136, 0.08), (-230, 1240, 92, 120, 0.06), (-30, 1232, 108, 110, -0.04),
                (222, 1262, 100, 124, -0.06), (-110, 1380, 100, 120, 0.0), (120, 1390, 100, 120, 0.05),
                (-300, 1340, 80, 110, 0.15), (290, 1110, 70, 110, -0.15)]
# leaves hanging over the sides, pointing down and out: (root, tip, w)
CHEST_EDGE = [((-292, 925), (-392, 1046), 80), ((-298, 1050), (-400, 1176), 82),
              ((-304, 1180), (-394, 1300), 80),
              ((288, 935), (384, 1056), 78), ((300, 1100), (398, 1226), 82),
              ((300, 1240), (388, 1362), 78)]


def chest_shapes():
    body = [(-330, 740), (330, 740), (342, 880), (352, 1040), (360, 1200), (362, 1440),
            (-362, 1440), (-360, 1200), (-352, 1040), (-342, 880)]
    base = [rel(spline(body, closed=True, n=6))]
    sc = []
    for (cx, cy, w, h, lean) in CHEST_SCALES:
        a = (X0 + cx - lean * h * 0.5, cy - h / 2)
        b = (X0 + cx + lean * h * 0.5, cy + h / 2)
        sc.append(leaf(a, b, w, bend=-lean * 0.6, fat=0.45))
    for (r, t, w) in CHEST_EDGE:
        side = 1 if r[0] > 0 else -1
        sc.append(leaf((X0 + r[0], r[1]), (X0 + t[0], t[1]), w, bend=0.15 * side, fat=0.36))
    return base, sc


# ============================================================== blender ===
_MATS = {}


def _mat(hexcol):
    import lib_toon as T
    if hexcol not in _MATS:
        _MATS[hexcol] = T.toon_material('flat_' + hexcol.lstrip('#'), hexcol, shade=0.0)
    return _MATS[hexcol]


Y_MID = Y_TOP + PNG_H * S / 2


def add_poly(name, pts, hexcol, z, coll):
    # drop duplicate neighbours (they upset the ngon fill)
    clean = []
    for p in pts:
        if not clean or math.hypot(p[0] - clean[-1][0], p[1] - clean[-1][1]) > 0.05:
            clean.append(p)
    if len(clean) > 2 and math.hypot(clean[0][0] - clean[-1][0], clean[0][1] - clean[-1][1]) < 0.05:
        clean.pop()
    if len(clean) < 3:
        return None
    me = bpy.data.meshes.new(name)
    verts = [((x - X0) / UNIT, -z * 0.002, -(y - Y_MID) / UNIT) for x, y in clean]
    me.from_pydata(verts, [], [list(range(len(verts)))])
    me.update()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    ob.data.materials.append(_mat(hexcol))
    return ob


def build(scene):
    """Builds both variants; returns (closed_collection, open_collection)."""
    base = bpy.data.collections.new('eat_base')
    closed = bpy.data.collections.new('eat_closed')
    opened = bpy.data.collections.new('eat_open')
    for c in (base, closed, opened):
        scene.collection.children.link(c)
    for i, p in enumerate(hair_shapes()):
        add_poly('hair%d' % i, p, HAIR, 1, base)
    chest, scales = chest_shapes()
    for i, p in enumerate(chest):
        add_poly('chest%d' % i, p, CHEST, 2, base)
    for i, p in enumerate(scales):
        add_poly('scale%d' % i, p, SCALE, 3, base)
    for i, p in enumerate(beard_shapes()):
        add_poly('beard%d' % i, p, HAIR, 4, base)
    for s in (-1, 1):
        add_poly('ear%d' % s, ear(s), EAR, 5, base)
    add_poly('face_ring', face_ring(), HAIR, 5.5, base)
    # closed mouth
    add_poly('face_c', face_outline(False), FACE, 6, closed)
    for s in (-1, 1):
        add_poly('eye_c%d' % s, eye(s, False), EYE, 8, closed)
        add_poly('fang_c%d' % s, fang_closed(s), TOOTH, 8, closed)
    # open mouth
    add_poly('face_o', face_outline(True), FACE, 6, opened)
    outer, inner, tongue, teeth = mouth_parts()
    add_poly('mouth', outer, MOUTH, 7, opened)
    add_poly('mouth_in', inner, MOUTH_IN, 7.5, opened)
    for i, p in enumerate(tongue):
        add_poly('tongue%d' % i, p, TONGUE, 8, opened)
    for i, p in enumerate(teeth):
        add_poly('tooth%d' % i, p, TOOTH, 9, opened)
    for s in (-1, 1):
        add_poly('eye_o%d' % s, eye(s, True), EYE, 8, opened)
    return closed, opened


def camera(scene):
    cd = bpy.data.cameras.new('EatCam')
    cd.type = 'ORTHO'
    cd.ortho_scale = PNG_W * S / UNIT
    cd.clip_start = 0.01
    cd.clip_end = 100
    cam = bpy.data.objects.new('EatCam', cd)
    scene.collection.objects.link(cam)
    cam.location = (0, -10, 0)
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.camera = cam
    return cam


def top_y():
    """Topmost point of the art (the hair) in screen px; should be HEAD_TOP."""
    return min(y for p in hair_shapes() for _, y in p)


def meta():
    r = lambda p: [round(p[0], 1), round(p[1], 1)]
    return {
        'w': PNG_W, 'h': PNG_H,
        'mouth': r(to_png(*MOUTH_C)),
        # the sasquatch's left shoulder is on screen right
        'shoulderL': r(to_png(*SHOULDER(1))),
        'shoulderR': r(to_png(*SHOULDER(-1))),
        'headTop': r(to_png(X0, top_y())),
    }
