"""
Road furniture outside the park (outside-park video): stop sign, green highway direction sign, wooden
"Campground <-" / "Race Track ^" boards, the two-board "Race Track ^ / Podium <-" signpost, the blue
"Highway Intersection" bus-stop sign and the red-roofed map kiosk by the dealership.
(The green CAMPGROUND monument sign is built with the RACE TRACK sign in props_racetrack.py / monument.)

  Blender -b --factory-startup -P art/blender/props_roads.py -- [group ...]
Groups: stop_sign sign_highway wood_signs signpost bus_stop map_kiosk

Refs (1 still px == 1 sprite px, walking frames): stop sign + highway sign t034 (o03), "Campground <-" t014,
"Race Track ^" t043, "Race Track ^ / Podium <-" t245 (o25), bus stop t524 (o35), map kiosk t058 (o05).
The wooden boards reuse the measurements / colours of wood_sign and signpost_rv_lake (props_tutorial /
props_campground) - the outside-park boards are level (no roll) and stand taller (board centre 2.36 m).
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
FONT_ROUND = '/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf'


def boxp(name, x0, x1, y0, y1, z0, z1, front, top=None, side=None, left=None, back=None):
    o = P.boxmm(name, x0, x1, y0, y1, z0, z1)
    P.paint(o, M(front), top=M(top or front, TOP), side=M(side or front, RIGHTN),
            left=M(left or side or front, LEFTN), back=M(back or front, BACKN))
    return o


def flat(name, pts, y, col, depth=0.01):
    return P.prism(name, pts[::-1], y - depth, y, M(col))


def arrow(cx, cz, y, col, direction='right', L=0.30, H=0.24, t=0.055, head=0.12, depth=0.012):
    """Chevron-head arrow drawn in screen units (stretched x1/cos vertically), pointing right/left/up/down."""
    shaft = [(-L / 2, -t / 2), (L / 2 - t * 0.9, -t / 2), (L / 2 - t * 0.9, t / 2), (-L / 2, t / 2)]
    hd = [(L / 2, 0), (L / 2 - head, H / 2), (L / 2 - head - t * 1.1, H / 2), (L / 2 - t * 1.25, 0),
          (L / 2 - head - t * 1.1, -H / 2), (L / 2 - head, -H / 2)]
    ang = {'right': 0, 'up': 90, 'left': 180, 'down': 270}[direction]
    ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    out = []
    for poly in (shaft, hd[::-1]):
        pts = [(cx + px * ca - pz * sa, cz + (px * sa + pz * ca) * ST) for px, pz in poly]
        # keep CCW after a mirror-free rotation; prism() fixes the facing anyway
        out.append(P.prism('Arrow', pts, y - depth, y, M(col)))
    return out


# ================================================================ stop sign ===
def build_stop_sign():
    """Blank red octagon with a white rim on a dark pole (t034): 1.0 wide x 1.33 tall, centre 2.48 m, pole 3.47."""
    o = [boxp('Pole', -0.06, 0.06, 0.0, 0.12, 0, 3.47, '#424242', '#5b5b5b')]
    zc, hw, hh = 2.48, 0.50, 0.665

    def octo(sx, sz):
        k = 0.414
        return [(sx * k, sz), (sx, sz * k), (sx, -sz * k), (sx * k, -sz), (-sx * k, -sz), (-sx, -sz * k),
                (-sx, sz * k), (-sx * k, sz)]
    rim = [(x, zc + z) for x, z in octo(hw, hh)]
    o.append(P.prism('Rim', rim[::-1], -0.05, 0.0, M('#d0d1ce')))
    o.append(flat('Red', [(x, zc + z) for x, z in octo(hw - 0.055, hh - 0.075)], -0.05, '#be3b49'))
    return [('stop_sign', o, {'footprint': [0.25, 0.25], 'blocksSight': False, 'height': 3.47,
                              'note': 'faces south (-y); the original octagon is blank (no STOP text)'})]


# ============================================================ highway sign ===
def build_sign_highway():
    """Green 3-panel direction sign (t034): 2.68 m wide, panels 0.81 m each from 1.2 to 3.64 m, white rims,
    'Race Track ^ / Ski Resort > / Farm Valley >', two thin grey posts at +-0.79."""
    o = []
    for px in (-0.79, 0.79):
        o.append(boxp('Post', px - 0.035, px + 0.035, 0.03, 0.10, 0, 3.85, '#525252', '#6b6b6b'))
    hw = 1.34
    rows = [('Race Track', 'up'), ('Ski Resort', 'right'), ('Farm Valley', 'right')]
    z0 = 1.20
    ph = 0.813
    for i, (label, d) in enumerate(rows):
        zt = z0 + ph * (3 - i)
        zb = zt - ph
        o.append(boxp('Panel', -hw, hw, -0.03, 0.03, zb, zt, '#2e824e', '#3a8f5a', '#256e40'))
        rim = P.rrect(2 * hw - 0.05, ph - 0.07, 0.06, 3, 0.0, (zb + zt) / 2)
        rim_in = P.rrect(2 * hw - 0.11, ph - 0.15, 0.04, 3, 0.0, (zb + zt) / 2)
        o.append(P.prism('Rim', (rim + [rim[0]] + [rim_in[0]] + rim_in[::-1])[::-1], -0.036, -0.03, M('#d2d3d2')))
        # fixed font size for all rows (t034: 'Race Track' spans ~1.5 m), baseline 0.18 m under the row centre
        t = P.text_mesh('HwText', label, size=0.35, depth=0.006, align='LEFT', valign='BOTTOM', bold=0.0,
                        font=FONT_ROUND, stretch_z=ST, loc=(-1.21, -0.036, (zb + zt) / 2 - 0.27), m=M('#dbdfda'),
                        spacing=1.02)
        o.append(t)
        o += arrow(1.03, (zb + zt) / 2, -0.036, '#dbdfda', d, L=0.26, H=0.22, t=0.06, head=0.11)
    return [('sign_highway', o, {'footprint': [2.7, 0.2], 'blocksSight': False, 'height': 3.85,
                                 'posts': [[-0.79, 0.06], [0.79, 0.06]],
                                 'note': 'collide with the two posts; panels 1.2-3.64 m up'})]


# ================================================================ wood signs ===
WS = dict(board='#966f31', boardTop='#a58936', boardEnd='#8a6229', post='#5e4527', postTop='#86633b', text='#e2e2e0')


def wood_board_sign(label, direction, zc=2.36, post_top=3.31, posts=(-1.245, 1.245), board_w=3.18, board_h=1.11):
    """Level wooden board on two posts (t014 / t043), same construction as wood_sign (props_tutorial)."""
    o = []
    for px in posts:
        p_ = P.boxmm('Post', px - 0.10, px + 0.10, 0.0, 0.18, 0, post_top)
        P.paint(p_, M(WS['post']), top=M(WS['postTop'], TOP))
        o.append(p_)
    hw, hh = board_w / 2, board_h / 2
    yb0 = -0.12
    b = P.boxmm('Board', -hw, hw, yb0, 0.0, zc - hh, zc + hh)
    P.paint(b, M(WS['board']), top=M(WS['boardTop'], TOP), side=M(WS['boardEnd'], RIGHTN))
    o.append(b)
    o.append(P.text_mesh('SignText', label, size=0.43, depth=0.01, bold=0.0, align='LEFT', valign='BOTTOM',
                         stretch_z=ST, loc=(-hw + 0.22, yb0, zc - 0.21), m=M(WS['text']), spacing=1.06))
    o += arrow(hw - 0.36, zc - 0.03 if direction in ('up', 'down') else zc - 0.06, yb0, WS['text'], direction)
    return o


def build_wood_signs():
    meta = {'footprint': [2.7, 0.3], 'blocksSight': False, 'height': 3.31, 'posts': [[-1.245, 0.09], [1.245, 0.09]],
            'board': {'w': 3.18, 'h': 1.11, 'centre_m': [0, -0.12, 2.36]}}
    return [('sign_campground_left', wood_board_sign('Campground', 'left'), dict(meta)),
            ('sign_racetrack_up', wood_board_sign('Race Track', 'up'), dict(meta))]


def build_signpost():
    """Two-board signpost 'Race Track ^ / Podium <-' (t245): same as signpost_rv_lake (props_campground)."""
    o = []
    for x in (-1.25, 1.25):
        p_ = P.boxmm('Post', x - 0.10, x + 0.10, 0.0, 0.20, 0, 3.79)
        P.paint(p_, M('#75582e'), top=M('#a06e3b', TOP))
        o.append(p_)
    for zc, label, d in ((3.11, 'Race Track', 'up'), (1.84, 'Podium', 'left')):
        b = P.boxmm('Board', -1.59, 1.59, -0.12, 0.0, zc - 0.515, zc + 0.515)
        P.paint(b, M('#97702d'), top=M('#b28235', TOP), side=M('#8a6229', RIGHTN))
        o.append(b)
        o.append(P.text_mesh('SignText', label, size=0.43, depth=0.01, align='LEFT', valign='BOTTOM', stretch_z=ST,
                             loc=(-1.36, -0.12, zc - 0.26), m=M('#e5e3e1'), spacing=1.04))
        o += arrow(1.22, zc - 0.03 if d == 'up' else zc - 0.06, -0.12, '#e5e3e1', d)
    return [('sign_racetrack_podium', o, {'footprint': [2.7, 0.3], 'blocksSight': False, 'height': 3.79,
                                          'posts': [[-1.25, 0.1], [1.25, 0.1]],
                                          'boards': [{'centre_m': [0, -0.12, 3.11], 'w': 3.18, 'h': 1.03},
                                                     {'centre_m': [0, -0.12, 1.84], 'w': 3.18, 'h': 1.03}]})]


# ================================================================== bus stop ===
def build_bus_stop():
    """Blue bus-stop sign with a white bus pictogram on a dark pole (t524): plate 0.70 x 1.41 (1.72-3.13 m),
    pole 3.46 m. No bench or shelter in the stills."""
    o = [boxp('Pole', -0.07, 0.07, -0.05, 0.09, 0, 3.46, '#3a3a3a', '#525252')]
    z0, z1 = 1.72, 3.13
    zc = (z0 + z1) / 2
    plate = P.prism('Plate', P.rrect(0.70, z1 - z0, 0.10, 4, 0.0, zc)[::-1], -0.13, -0.05)
    P.paint(plate, M('#415ba8'), top=M('#5a78c8', TOP), side=M('#36508f', RIGHTN), top_thresh=0.3)
    o.append(plate)
    y = -0.13
    Z = lambda sz: zc + sz * ST          # icon drawn in screen units
    n0 = len(o)
    o.append(flat('BusBody', P.rrect(0.42, 0.40 * ST, 0.05, 3, 0.0, Z(0.02)), y, '#ececf2'))
    o.append(flat('BusWin', P.rrect(0.32, 0.15 * ST, 0.02, 2, 0.0, Z(0.09)), y - 0.01, '#415ba8', 0.004))
    o.append(flat('BusRoof', [(-0.12, Z(0.21)), (0.12, Z(0.21)), (0.12, Z(0.235)), (-0.12, Z(0.235))], y, '#ececf2'))
    for sx in (-1, 1):
        o.append(flat('Lamp', [(sx * 0.15 - 0.035, Z(-0.10)), (sx * 0.15 + 0.035, Z(-0.10)), (sx * 0.15 + 0.035, Z(-0.06)),
                               (sx * 0.15 - 0.035, Z(-0.06))], y - 0.01, '#415ba8', 0.004))
        o.append(flat('Wheel', [(sx * 0.14 - 0.045, Z(-0.24)), (sx * 0.14 + 0.045, Z(-0.24)),
                                (sx * 0.14 + 0.045, Z(-0.17)), (sx * 0.14 - 0.045, Z(-0.17))], y, '#ececf2'))
    o.append(flat('Grille', [(-0.07, Z(-0.10)), (0.07, Z(-0.10)), (0.07, Z(-0.08)), (-0.07, Z(-0.08))], y - 0.01,
                  '#415ba8', 0.004))
    for ob in o[n0:]:                    # the pictogram fills ~75 % of the plate in t524
        for v in ob.data.vertices:
            v.co.x *= 1.25
            v.co.z = zc + (v.co.z - zc) * 1.25
    return [('bus_stop', o, {'footprint': [0.3, 0.3], 'blocksSight': False, 'height': 3.46,
                             'note': '"Highway Intersection" stop: the game shows a "?" / bus button above it; '
                                     'stand south of it to open the Bus Route menu'})]


# ================================================================= map kiosk ===
MK = dict(roofR='#f04557', roofL='#dd4352', fascia='#be3c4a', post='#75582e', postS='#654a26', foot='#b6b7b2',
          footF='#a0a19d', frame='#5d4427', frameTop='#7a5a34', border='#a6aca6', green='#408340', lgreen='#71c95f',
          river='#44b6c8', snow='#c6caca', mtn='#3d4542', tree='#2a6a30', autumn='#8a2a35', tent='#e8b040',
          cabin='#8a5a30', cabinRoof='#5d4427')


def map_art(x0, x1, z0, z1, y):
    """Simplified trail map (t058 crop): forest, river, snowy mountains, lawn, tent, cabin."""
    o = []
    W, H = x1 - x0, z1 - z0
    X = lambda u: x0 + u * W
    Z = lambda v: z0 + v * H
    o.append(flat('MapBase', [(x0, z0), (x1, z0), (x1, z1), (x0, z1)], y, MK['green'], 0.004))
    snow = [(X(0.48), Z(1.0)), (X(1.0), Z(1.0)), (X(1.0), Z(0.55)), (X(0.82), Z(0.60)), (X(0.62), Z(0.66)),
            (X(0.52), Z(0.78))]
    o.append(flat('Snow', snow, y - 0.004, MK['snow'], 0.004))
    for (u, v, s) in ((0.66, 0.80, 0.10), (0.78, 0.84, 0.12), (0.90, 0.80, 0.09)):
        o.append(flat('Mtn', [(X(u - s), Z(v - 0.08)), (X(u + s), Z(v - 0.08)), (X(u), Z(v + 0.12))], y - 0.008,
                      MK['mtn'], 0.004))
    river = [(0.50, 1.0), (0.46, 0.80), (0.52, 0.62), (0.70, 0.52), (0.86, 0.50), (1.0, 0.46)]
    pts = []
    for (u, v) in river:
        pts.append((X(u), Z(v)))
    for a, b in zip(pts, pts[1:]):
        d = Vector((b[0] - a[0], 0, b[1] - a[1]))
        n = Vector((-d.z, 0, d.x)).normalized() * 0.03
        q = [(a[0] - n.x, a[1] - n.z), (b[0] - n.x, b[1] - n.z), (b[0] + n.x, b[1] + n.z), (a[0] + n.x, a[1] + n.z)]
        o.append(flat('River', q, y - 0.008, MK['river'], 0.004))
    river2 = [(0.50, 0.56), (0.40, 0.42), (0.36, 0.20), (0.40, 0.0)]
    pts = [(X(u), Z(v)) for u, v in river2]
    for a, b in zip(pts, pts[1:]):
        d = Vector((b[0] - a[0], 0, b[1] - a[1]))
        n = Vector((-d.z, 0, d.x)).normalized() * 0.03
        q = [(a[0] - n.x, a[1] - n.z), (b[0] - n.x, b[1] - n.z), (b[0] + n.x, b[1] + n.z), (a[0] + n.x, a[1] + n.z)]
        o.append(flat('River', q, y - 0.008, MK['river'], 0.004))
    o.append(flat('Lawn', P.ellipse(0.13 * W, 0.12 * H, 14, X(0.72), Z(0.22)), y - 0.008, MK['lgreen'], 0.004))
    rnd = random.Random(4)
    for (u, v) in ((0.08, 0.80), (0.20, 0.86), (0.32, 0.78), (0.12, 0.60), (0.26, 0.62), (0.08, 0.30)):
        o.append(flat('Tree', [(X(u - 0.04), Z(v - 0.07)), (X(u + 0.04), Z(v - 0.07)), (X(u), Z(v + 0.08))], y - 0.008,
                      MK['tree'], 0.004))
    for (u, v) in ((0.58, 0.30), (0.88, 0.32), (0.62, 0.12), (0.92, 0.12)):
        o.append(flat('Autumn', P.ellipse(0.035, 0.05, 10, X(u), Z(v)), y - 0.012, MK['autumn'], 0.004))
    o.append(flat('Tent', [(X(0.10), Z(0.44)), (X(0.26), Z(0.44)), (X(0.18), Z(0.56))], y - 0.008, MK['tent'], 0.004))
    o.append(flat('Cabin', [(X(0.12), Z(0.12)), (X(0.30), Z(0.12)), (X(0.30), Z(0.24)), (X(0.12), Z(0.24))], y - 0.008,
                  MK['cabin'], 0.004))
    o.append(flat('CabinRoof', [(X(0.10), Z(0.24)), (X(0.32), Z(0.24)), (X(0.21), Z(0.32))], y - 0.008,
                  MK['cabinRoof'], 0.004))
    return o


def build_map_kiosk():
    """Red-roofed map board by the dealership lawn (t058 crop): log posts at x = +-0.79 on concrete feet,
    dark frame 1.36 x 1.25 (0.90-2.15 m) holding a trail map, shallow red gable roof (ridge N-S, 3.38 m)."""
    o = []
    for px in (-0.79, 0.79):
        o.append(boxp('Foot', px - 0.21, px + 0.21, -0.18, 0.18, 0, 0.18, MK['footF'], MK['foot']))
        p_ = P.cyl('Post', 0.125, 2.80, 12, (px, 0, 0.0))
        P.paint(p_, M(MK['post']), top=M(MK['post'], TOP), side=M(MK['postS'], RIGHTN))
        o.append(p_)
    o.append(boxp('Frame', -0.67, 0.69, -0.07, 0.03, 0.90, 2.15, MK['frame'], MK['frameTop']))
    o.append(boxp('Border', -0.58, 0.60, -0.08, -0.07, 0.96, 2.07, MK['border'], MK['border']))
    o += map_art(-0.55, 0.57, 0.99, 2.04, -0.081)
    # roof: two slabs (ridge along y at x = 0), front fascia band
    ridge, eave, hw, d, t = 3.38, 2.78, 1.11, 0.40, 0.20
    for sx in (-1, 1):
        pts = [(0, ridge), (sx * hw, eave), (sx * hw, eave - t), (0, ridge - t)]
        if sx > 0:
            pts = pts[::-1]
        s = P.prism('Roof', pts, -d, d)
        k = (ridge - eave) / hw
        nrm = Vector((sx * k, 0, 1)).normalized()
        P.paint(s, M(MK['fascia']), top=M(MK['roofR'] if sx > 0 else MK['roofL'], tuple(nrm)), top_thresh=0.3,
                side=M(MK['fascia'], RIGHTN))
        o.append(s)
    return [('map_kiosk', o, {'footprint': [2.0, 0.45], 'blocksSight': False, 'height': 3.38,
                              'posts': [[-0.79, 0.0], [0.79, 0.0]],
                              'note': 'like notice_board_maps but with the clean red roof + a printed trail map '
                                      '(o05: stands on the lawn NW of the dealership, next to a hydrant)'})]


BUILDERS = {
    'stop_sign': build_stop_sign,
    'sign_highway': build_sign_highway,
    'wood_signs': build_wood_signs,
    'signpost': build_signpost,
    'bus_stop': build_bus_stop,
    'map_kiosk': build_map_kiosk,
}

if __name__ == '__main__':
    P.run(BUILDERS)
