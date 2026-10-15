"""
Natural props: rocks, boulder cluster, tree stump, fallen log.

  Blender -b --factory-startup -P art/blender/props_nature.py -- [rocks rock_big stump log]
Refs: t030.0 / t0250.0 / t056.0 (rocks), inside i_0091 (boulder), t0250.0 (stump).
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

ROCK = dict(top='#7d7b6f', side='#727064', dark='#66645a')
BARK, END, RING = '#75582e', '#b07e39', '#986231'


def rock_lump(name, size, loc, seed, jag=0.08, subdiv=2):
    r = P.rock(name, size, seed=seed, subdiv=subdiv, jag=jag, loc=loc, flat_bottom=0.35)
    P.paint(r, M(ROCK['side']), top=M(ROCK['top'], TOP), left=M(ROCK['dark'], (-1, 0, 0)),
            back=M(ROCK['side'], (0, 1, 0)), top_thresh=0.55)
    return r


def build_rocks():
    # rock_a: rounded rock with a smaller lump on top (t030.0 top-left / t0250.0)
    a = [rock_lump('RockA', (1.05, 0.80, 0.55), (0, 0, 0), 3, jag=0.15),
         rock_lump('RockA2', (0.50, 0.42, 0.34), (-0.10, 0.06, 0.34), 8, jag=0.15)]
    # rock_b: low flat slab with a small companion rock (t056.0)
    b = [rock_lump('RockB', (0.95, 0.62, 0.24), (-0.08, 0.02, 0), 5, jag=0.12),
         rock_lump('RockB2', (0.38, 0.30, 0.16), (0.42, -0.18, 0), 11, jag=0.12)]
    return [('rock_a', a, {'footprint': [1.0, 0.75], 'blocksSight': False}),
            ('rock_b', b, {'footprint': [1.2, 0.65], 'blocksSight': False})]


def column(name, cx, cy, w, d, h, seed, top_tilt=0.18):
    """Irregular hexagonal rock column with a slanted faceted top."""
    rnd = random.Random(seed)
    n = 6
    base = []
    for i in range(n):
        a = (i + 0.5) / n * math.tau - math.pi / 2
        rr = 1 + rnd.uniform(-0.12, 0.08)
        base.append((math.cos(a) * w / 2 * rr, math.sin(a) * d / 2 * rr))
    rings = []
    for z, sc in ((0.0, 1.04), (h * 0.80, 1.0), (h * 0.93, 0.80)):
        ring = []
        for i, (x, y) in enumerate(base):
            zz = z
            if z > 0:
                zz = z - top_tilt * h * 0.15 * (x / (w / 2)) + rnd.uniform(-0.03, 0.03) * h
            ring.append((cx + x * sc, cy + y * sc, zz))
        rings.append(ring)
    bm = bmesh.new()
    vr = [[bm.verts.new(p) for p in ring] for ring in rings]
    for ra, rb in zip(vr, vr[1:]):
        for i in range(n):
            bm.faces.new((ra[i], ra[(i + 1) % n], rb[(i + 1) % n], rb[i]))
    top = bm.verts.new((cx - w * 0.06, cy + d * 0.05, h))
    for i in range(n):
        bm.faces.new((vr[-1][i], vr[-1][(i + 1) % n], top))
    bm.faces.new(vr[0][::-1])
    o = P.bm_obj(name, bm)
    P.paint(o, M('#6e6a69'), top=M('#837f7e', TOP), left=M('#605e5f', (-1, 0, 0)),
            right=M('#6e6a69', (1, 0, 0)), top_thresh=0.45)
    return o


def build_rock_big():
    """Columnar boulder cluster (inside-park i_0091), ~2.3 m wide, 3.3 m tall."""
    objs = [column('ColMain', 0.0, 0.10, 0.82, 0.72, 3.3, 1),
            column('ColLeft', -0.55, 0.30, 0.50, 0.55, 2.45, 2),
            column('ColRight', 0.58, 0.22, 0.60, 0.58, 2.3, 3),
            column('ColFront', 0.72, -0.30, 0.62, 0.50, 1.05, 4),
            column('ColBackL', -0.85, 0.05, 0.38, 0.40, 1.3, 5)]
    return [('rock_big_a', objs, {'footprint': [2.2, 1.3], 'blocksSight': True})]


def build_stump():
    """Cut stump, 0.45 m diameter, tan top with spiral rings (t0250.0)."""
    objs = []
    n = 12
    rings = []
    for z, r in ((0.0, 0.255), (0.08, 0.238), (0.25, 0.226), (0.50, 0.225)):
        rings.append([(math.cos((i + 0.5) / n * math.tau) * r, math.sin((i + 0.5) / n * math.tau) * r * 0.97, z)
                      for i in range(n)])
    s = P.loft('Stump', rings)
    P.paint(s, M(BARK, FRONT, 0.14), top=M(END, TOP), bottom=M(BARK))
    objs.append(s)
    sp = [(x, y) for x, y in P.spiral(0.20, 0.195, 2.1, 0.17, 60)]
    objs.append(P.slab('Rings', sp, 0.50, 0.505, M(RING, TOP)))
    for x, h0, h1 in ((-0.13, 0.05, 0.40), (0.02, 0.10, 0.46), (0.15, 0.03, 0.33)):
        y = -math.sqrt(max(0.0, 0.228 ** 2 - x ** 2)) - 0.004
        objs.append(P.boxmm('Streak', x - 0.012, x + 0.012, y - 0.004, y + 0.01, h0, h1, M('#5f4524')))
    return [('stump', objs, {'footprint': [0.5, 0.5], 'blocksSight': False})]


def build_log():
    """Fallen log ~2.1 m along x; ends cut obliquely so the rings face the camera."""
    objs = []
    L, r, n = 2.1, 0.22, 10
    th = math.radians(35)
    rings = []
    for side in (-1, 1):
        ring = []
        for i in range(n):
            a = (i + 0.5) / n * math.tau
            y, z = math.cos(a) * r, r + math.sin(a) * r * 1.0
            x = side * (L / 2 + y * math.tan(th))
            ring.append((x, y, z))
        rings.append(ring)
    bm = bmesh.new()
    va = [bm.verts.new(p) for p in rings[0]]
    vb = [bm.verts.new(p) for p in rings[1]]
    for i in range(n):
        bm.faces.new((va[i], va[(i + 1) % n], vb[(i + 1) % n], vb[i]))
    bm.faces.new(va)
    bm.faces.new(vb[::-1])
    lg = P.bm_obj('Log', bm)
    m_end = M(END, (-math.cos(th), -math.sin(th), 0))
    P.paint(lg, M(BARK, TOP), front=M(BARK), left=m_end, right=M(END, (math.cos(th), -math.sin(th), 0)),
            bottom=M(BARK))
    objs.append(lg)
    # spiral rings on both ends (in the oblique end planes)
    for side in (-1, 1):
        nrm = Vector((side * math.cos(th), -math.sin(th), 0))
        pts = []
        for px, pz in P.spiral(r * 0.88, r * 0.88, 2.0, 0.17, 50, a0=side):
            y = px
            x = side * (L / 2 + y * math.tan(th))
            pts.append(Vector((x, y, r + pz)) + nrm * 0.006)
        if side < 0:
            pts = pts[::-1]
        objs.append(P.solid_poly('LogRing', [tuple(p) for p in pts], 0.004, nrm, M(RING, nrm)))
    # bark streaks + a branch stub
    rnd = random.Random(4)
    for i in range(6):
        x0 = rnd.uniform(-0.85, 0.5)
        a = rnd.uniform(0.2, 1.3)
        y, z = -math.cos(a) * (r + 0.004), r + math.sin(a) * (r + 0.004)
        objs.append(P.beam('Streak', (x0, y, z), (x0 + rnd.uniform(0.25, 0.5), y, z), 0.025, 0.012, M('#5f4524')))
    stub = P.tube('Stub', (0.35, 0.02, r * 1.8), (0.48, -0.05, r * 2.0 + 0.16), 0.06, 6, None, 0.045)
    P.paint(stub, M(BARK, TOP), top=M(END, TOP))
    objs.append(stub)
    return [('log', objs, {'footprint': [2.0, 0.5], 'blocksSight': False})]


BUILDERS = {
    'rocks': build_rocks,
    'rock_big': build_rock_big,
    'stump': build_stump,
    'log': build_log,
}

if __name__ == '__main__':
    P.run(BUILDERS)
