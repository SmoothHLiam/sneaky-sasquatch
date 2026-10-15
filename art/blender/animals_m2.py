"""
Milestone-2 critters (inside the park): duck, duck_hat, fox, bluejay.
Low-poly rigid parts on small rigs, facing -Y, rendered by animals.py:

    Blender -b --factory-startup -P art/blender/animals.py -- duck duck_hat fox bluejay

Reference (your research/frames/inside-park + "more inside park.mov"):
  duck      t0277.0 (dialog zoom), t0268/t0280 (native scale ~110 px tall)
  duck_hat  t0345 / t0349.0 badge: duck under an oversized, stretched red cap
  fox       t0459.0 (dialog zoom), t0455/t0659 (native ~130 px tall front view)
  bluejay   t0062/t0106 (standing, ~135 px), t0221.5 (flying, ~240 px wingspan)
Colours were sampled from those frames.
"""
import bpy, math
from mathutils import Vector, Matrix, Euler
import lib_toon as T

R = math.radians

COL = {
    'duck': dict(body='#ececec', wing='#dedede', bill='#f5ad10', feet='#f3a70b', eye='#1b1b1b',
                 cap='#f75357', visor='#c94946'),
    'fox': dict(body='#d0703a', white='#e6e3de', dark='#332c24', nose='#1c1a18', eye='#1c1a18'),
    'bluejay': dict(blue='#447bbe', wing='#3b6aa8', black='#3b3b3e', beak='#222224', legs='#2a2a2c'),
}


# ------------------------------------------------------------------ helpers
def make_rig(name, bones):
    arm_d = bpy.data.armatures.new(name)
    rig = bpy.data.objects.new(name, arm_d)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_d.edit_bones
    for bn, h, t, parent in bones:
        b = eb.new(bn)
        b.head = h
        b.tail = t
        if parent:
            b.parent = eb[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    return rig


def att(o, rig, bone):
    bpy.context.view_layer.update()
    mw = o.matrix_world.copy()
    o.parent = rig
    o.parent_type = 'BONE'
    o.parent_bone = bone
    bpy.context.view_layer.update()
    o.matrix_world = mw


def rot(o, rx=0.0, ry=0.0, rz=0.0, pivot=(0, 0, 0)):
    T.apply_transforms(o)
    pv = Vector(pivot)
    m = Matrix.Translation(pv) @ Euler((rx, ry, rz), 'XYZ').to_matrix().to_4x4() @ Matrix.Translation(-pv)
    o.data.transform(m)
    o.data.update()
    return o


def mats(kind):
    cache = {}

    def M(name, hexc=None):
        if name not in cache:
            cache[name] = T.toon_material(f'{kind}_{name}', hexc or COL[kind.split('_')[0]][name])
        return cache[name]
    return M


def paint(o, m):
    T.set_material(o, m)
    return o


def reset(rig):
    for b in rig.pose.bones:
        b.rotation_mode = 'XYZ'
        b.rotation_euler = (0, 0, 0)
        b.location = (0, 0, 0)
    rig.location = (0, 0, 0)


# -------------------------------------------------------------------- duck
def build_duck(kind='duck'):
    """White Pekin-style duck, upright neck, orange bill/feet. ~0.65 m to the crown."""
    T.reset_scene()
    M = mats('duck' if kind == 'duck' else kind)
    if kind == 'duck_hat':
        M = mats('duck')
    rig = make_rig(kind + 'Rig', [
        ('root', (0, 0, 0), (0, 0.1, 0), None),
        ('body', (0, 0.06, 0.26), (0, -0.14, 0.3), 'root'),
        ('neck', (0, -0.12, 0.36), (0, -0.175, 0.66), 'body'),
        ('tail', (0, 0.2, 0.3), (0, 0.34, 0.38), 'body'),
        ('leg.L', (0.06, 0.04, 0.17), (0.06, 0.03, 0.02), 'root'),
        ('leg.R', (-0.06, 0.04, 0.17), (-0.06, 0.03, 0.02), 'root'),
    ])
    body = paint(T.ico('Body', 1.0, subdiv=2, scale=(0.16, 0.225, 0.155), loc=(0, 0.04, 0.28)), M('body'))
    rot(body, rx=R(-24), pivot=(0, 0.04, 0.28))
    chest = paint(T.ico('Chest', 1.0, subdiv=2, scale=(0.145, 0.13, 0.15), loc=(0, -0.11, 0.31)), M('body'))
    parts = [body, chest]
    for sx in (-1, 1):
        w = paint(T.ico('Wing', 1.0, subdiv=2, scale=(0.05, 0.16, 0.08), loc=(sx * 0.11, 0.08, 0.3)), M('wing'))
        rot(w, rx=R(-22), rz=R(sx * -4), pivot=(sx * 0.13, 0.08, 0.32))
        parts.append(w)
    att(T.join(parts, 'Torso'), rig, 'body')
    tail = paint(T.cone('Tail', 0.06, 0.0, 0.1, segs=6, loc=(0, 0, 0)), M('body'))
    rot(tail, rx=R(-62), pivot=(0, 0, 0))      # short upturned tail, mostly backwards
    tail.scale = (0.9, 0.9, 0.5)
    tail.location = (0, 0.22, 0.25)
    T.apply_transforms(tail)
    att(tail, rig, 'tail')

    neck = paint(T.limb('Neck', (0, -0.12, 0.36), (0, -0.175, 0.66), 0.068, 0.052, segs=8), M('body'))
    T.apply_transforms(neck)
    head = paint(T.ico('Head', 1.0, subdiv=2, scale=(0.072, 0.09, 0.074), loc=(0, -0.195, 0.7)), M('body'))
    bill = paint(T.ico('Bill', 1.0, subdiv=2, scale=(0.04, 0.08, 0.018), loc=(0, -0.3, 0.678)), M('bill'))
    hp = [neck, head, bill]
    for sx in (-1, 1):
        hp.append(paint(T.ico('Eye', 0.012, subdiv=1, loc=(sx * 0.06, -0.235, 0.725)), M('eye')))
    if kind == 'duck_hat':
        hp += duck_cap(M)
    att(T.join(hp, 'HeadNeck'), rig, 'neck')

    for s, sx in (('L', 1), ('R', -1)):
        leg = paint(T.limb('Leg' + s, (sx * 0.06, 0.04, 0.17), (sx * 0.06, 0.03, 0.03), 0.02, 0.016, segs=5), M('feet'))
        foot = paint(T.cone('Foot' + s, 0.075, 0.0, 0.13, segs=3, loc=(0, 0, 0)), M('feet'))
        rot(foot, rx=R(90), pivot=(0, 0, 0))     # flat triangle pointing forward (-y)
        foot.scale = (1.0, 1.0, 0.18)
        foot.location = (sx * 0.06, 0.035, 0.012)
        T.apply_transforms(foot)
        att(leg, rig, 'leg.' + s)
        att(foot, rig, 'leg.' + s)
    return rig


def duck_cap(M):
    """Oversized baseball cap pulled down over head and neck (Duck's Hat quest reward)."""
    c = (0, -0.15, 0.56)
    crown = paint(T.ico('CapCrown', 1.0, subdiv=2, scale=(0.205, 0.26, 0.28), loc=c), M('cap'))
    for v in crown.data.vertices:          # flat cap opening at the bottom
        v.co.z = max(v.co.z, c[2] - 0.28 * 0.55)
    rot(crown, rx=R(22), pivot=c)
    button = paint(T.ico('CapButton', 1.0, subdiv=1, scale=(0.04, 0.04, 0.022), loc=(0, c[1], c[2] + 0.272)), M('cap'))
    rot(button, rx=R(22), pivot=c)
    visor = paint(T.ico('CapVisor', 1.0, subdiv=2, scale=(0.18, 0.19, 0.014), loc=(0, -0.44, 0.42)), M('visor'))
    rot(visor, rx=R(26), pivot=(0, -0.28, 0.42))
    return [crown, button, visor]


def pose_duck(rig, anim, fi, n):
    reset(rig)
    pb = rig.pose.bones
    ph = fi / n
    s = math.sin(ph * math.tau)
    if anim == 'idle':
        pb['neck'].rotation_euler.x = R(5 * max(0.0, s))           # little head bob
        pb['tail'].rotation_euler.z = R(14 * math.sin(ph * math.tau * 2))
    elif anim == 'walk':
        # waddle: body rolls side to side, legs alternate, head pumps
        pb['body'].rotation_euler.y = R(7 * s)
        pb['neck'].rotation_euler.x = R(-4 + 5 * abs(s))
        pb['tail'].rotation_euler.z = R(-10 * s)
        pb['leg.L'].rotation_euler.x = R(32 * s)
        pb['leg.R'].rotation_euler.x = R(-32 * s)
        rig.location = (0, 0, 0.012 * abs(math.cos(ph * math.tau)))


# --------------------------------------------------------------------- fox
def build_fox():
    """Slim red fox: white chest/cheeks/tail tip, black socks and ear backs. ~1.25 m nose to tail."""
    T.reset_scene()
    M = mats('fox')
    rig = make_rig('foxRig', [
        ('root', (0, 0, 0), (0, 0.1, 0), None),
        ('body', (0, 0.24, 0.46), (0, -0.24, 0.49), 'root'),
        ('head', (0, -0.27, 0.54), (0, -0.42, 0.68), 'body'),
        ('tail', (0, 0.29, 0.48), (0, 0.55, 0.36), 'body'),
        ('legF.L', (0.075, -0.19, 0.42), (0.075, -0.2, 0.03), 'body'),
        ('legF.R', (-0.075, -0.19, 0.42), (-0.075, -0.2, 0.03), 'body'),
        ('legB.L', (0.08, 0.2, 0.42), (0.08, 0.21, 0.03), 'body'),
        ('legB.R', (-0.08, 0.2, 0.42), (-0.08, 0.21, 0.03), 'body'),
    ])
    body = paint(T.ico('Body', 1.0, subdiv=2, scale=(0.12, 0.32, 0.14), loc=(0, 0.02, 0.48)), M('body'))
    haunch = paint(T.ico('Haunch', 1.0, subdiv=2, scale=(0.13, 0.14, 0.15), loc=(0, 0.19, 0.46)), M('body'))
    chest = paint(T.ico('Chest', 1.0, subdiv=2, scale=(0.105, 0.11, 0.145), loc=(0, -0.23, 0.46)), M('white'))
    belly = paint(T.ico('Belly', 1.0, subdiv=1, scale=(0.09, 0.2, 0.05), loc=(0, -0.02, 0.37)), M('white'))
    att(T.join([body, haunch, chest, belly], 'Torso'), rig, 'body')

    neck = paint(T.limb('Neck', (0, -0.24, 0.5), (0, -0.36, 0.65), 0.09, 0.075, segs=8), M('body'))
    T.apply_transforms(neck)
    throat = paint(T.ico('Throat', 1.0, subdiv=1, scale=(0.075, 0.075, 0.1), loc=(0, -0.32, 0.54)), M('white'))
    head = paint(T.ico('Head', 1.0, subdiv=2, scale=(0.12, 0.125, 0.105), loc=(0, -0.41, 0.69)), M('body'))
    cheeks = paint(T.ico('Cheeks', 1.0, subdiv=2, scale=(0.13, 0.085, 0.06), loc=(0, -0.445, 0.63)), M('white'))
    snout = paint(T.ico('Snout', 1.0, subdiv=2, scale=(0.05, 0.12, 0.045), loc=(0, -0.55, 0.655)), M('body'))
    chin = paint(T.ico('Chin', 1.0, subdiv=1, scale=(0.045, 0.1, 0.026), loc=(0, -0.54, 0.625)), M('white'))
    nose = paint(T.ico('Nose', 1.0, subdiv=1, scale=(0.024, 0.022, 0.02), loc=(0, -0.665, 0.662)), M('nose'))
    hp = [neck, throat, head, cheeks, snout, chin, nose]
    for sx in (-1, 1):
        hp.append(paint(T.ico('Eye', 0.018, subdiv=1, loc=(sx * 0.06, -0.505, 0.715)), M('eye')))
        ear = paint(T.cone('Ear', 0.065, 0.0, 0.16, segs=4, loc=(0, 0, 0)), M('dark'))
        rot(ear, rx=R(-10), ry=R(sx * 16), rz=R(45), pivot=(0, 0, 0))
        ear.location = (sx * 0.075, -0.39, 0.76)
        T.apply_transforms(ear)
        inner = paint(T.cone('EarIn', 0.045, 0.0, 0.115, segs=4, loc=(0, 0, 0)), M('body'))
        rot(inner, rx=R(-10), ry=R(sx * 16), rz=R(45), pivot=(0, 0, 0))
        inner.location = (sx * 0.075, -0.41, 0.765)
        T.apply_transforms(inner)
        hp += [ear, inner]
    att(T.join(hp, 'HeadNeck'), rig, 'head')

    # bushy tail: tapered segments drooping back, white tip
    # one long bushy brush drooping back, white tip
    brush = paint(T.ico('Tail', 1.0, subdiv=2, scale=(0.085, 0.26, 0.085), loc=(0, 0.0, 0.0)), M('body'))
    tip = paint(T.ico('TailTip', 1.0, subdiv=2, scale=(0.06, 0.09, 0.06), loc=(0, 0.25, 0.0)), M('white'))
    tl = T.join([brush, tip], 'Tail')
    rot(tl, rx=R(-28), pivot=(0, 0, 0))
    tl.location = (0, 0.53, 0.37)
    T.apply_transforms(tl)
    att(tl, rig, 'tail')

    for nm, x, y in (('legF.L', 0.075, -0.19), ('legF.R', -0.075, -0.19), ('legB.L', 0.08, 0.2), ('legB.R', -0.08, 0.2)):
        up = paint(T.limb('LegU', (x, y, 0.42), (x, y - 0.005, 0.2), 0.048 if 'B' in nm else 0.04, 0.034, segs=6), M('body'))
        lo = paint(T.limb('LegL', (x, y - 0.005, 0.21), (x, y - 0.01, 0.03), 0.034, 0.028, segs=6), M('dark'))
        paw = paint(T.ico('Paw', 1.0, subdiv=1, scale=(0.034, 0.05, 0.024), loc=(x, y - 0.03, 0.022)), M('dark'))
        for o in (up, lo, paw):
            att(o, rig, nm)
    return rig


def pose_fox(rig, anim, fi, n):
    reset(rig)
    pb = rig.pose.bones
    ph = fi / n
    s = math.sin(ph * math.tau)
    if anim == 'idle':
        pb['head'].rotation_euler.x = R(3 * s)
        pb['tail'].rotation_euler.z = R(9 * s)
    elif anim == 'walk':
        for leg, phase in (('legF.L', 0), ('legB.R', 0), ('legF.R', math.pi), ('legB.L', math.pi)):
            pb[leg].rotation_euler.x = R(28 * math.sin(ph * math.tau + phase))
        pb['tail'].rotation_euler.z = R(10 * s)
        pb['head'].rotation_euler.x = R(-3 + 3 * s)
        rig.location = (0, 0, 0.012 * abs(math.cos(ph * math.tau)))
    elif anim == 'sit':
        # sitting on the haunches, front legs straight, tail curled forward round the feet
        a = SIT_A        # body pitched front-up by a (negative x on this bone = nose up)
        pb['body'].rotation_euler.x = R(-a)
        pb['head'].rotation_euler.x = R(a * 0.8)
        for s_ in ('L', 'R'):
            pb['legF.' + s_].rotation_euler.x = R(a)
            pb['legB.' + s_].rotation_euler.x = R(a - 80)    # folded forward under the haunch
        pb['tail'].rotation_euler.x = R(a * 0.8)
        pb['tail'].rotation_euler.z = R(40)
        rig.location = (0, 0.0, -0.27)


SIT_A = 34


# ---------------------------------------------------------------- blue jay
def build_jay():
    """Steller's jay: black head + crest, blue body/wings/tail. Folded wings for idle/hop,
    spread wings (own bones) for fly."""
    T.reset_scene()
    M = mats('bluejay')
    rig = make_rig('jayRig', [
        ('root', (0, 0, 0), (0, 0.1, 0), None),
        ('body', (0, 0.06, 0.2), (0, -0.08, 0.36), 'root'),
        ('head', (0, -0.08, 0.36), (0, -0.12, 0.5), 'body'),
        ('tail', (0, 0.08, 0.2), (0, 0.3, 0.08), 'body'),
        ('wing.L', (0.06, 0.0, 0.3), (0.3, 0.0, 0.3), 'body'),
        ('wing.R', (-0.06, 0.0, 0.3), (-0.3, 0.0, 0.3), 'body'),
        ('leg.L', (0.035, 0.02, 0.14), (0.035, 0.0, 0.0), 'root'),
        ('leg.R', (-0.035, 0.02, 0.14), (-0.035, 0.0, 0.0), 'root'),
    ])
    body = paint(T.ico('Body', 1.0, subdiv=2, scale=(0.085, 0.15, 0.095), loc=(0, 0.0, 0.26)), M('blue'))
    rot(body, rx=R(-50), pivot=(0, 0.0, 0.26))
    # black hood runs down the nape and upper breast (Steller's jay)
    hood = paint(T.ico('Hood', 1.0, subdiv=2, scale=(0.078, 0.085, 0.085), loc=(0, -0.05, 0.36)), M('black'))
    fold = []
    for sx in (-1, 1):
        w = paint(T.ico('WingF', 1.0, subdiv=1, scale=(0.03, 0.16, 0.07), loc=(sx * 0.075, 0.05, 0.27)), M('wing'))
        rot(w, rx=R(-30), pivot=(sx * 0.075, 0.05, 0.27))
        fold.append(w)
    torso = T.join([body, hood], 'Torso')
    att(torso, rig, 'body')
    folded = T.join(fold, 'WingsFolded')
    folded['only'] = 'idle,hop'
    att(folded, rig, 'body')

    head = paint(T.ico('Head', 1.0, subdiv=2, scale=(0.07, 0.075, 0.07), loc=(0, -0.1, 0.42)), M('black'))
    crest = paint(T.cone('Crest', 0.045, 0.0, 0.16, segs=5, loc=(0, 0, 0)), M('black'))
    rot(crest, rx=R(28), pivot=(0, 0, 0))
    crest.location = (0, -0.07, 0.45)
    T.apply_transforms(crest)
    beak = paint(T.cone('Beak', 0.02, 0.0, 0.08, segs=4, loc=(0, 0, 0)), M('beak'))
    rot(beak, rx=R(95), pivot=(0, 0, 0))
    beak.location = (0, -0.16, 0.415)
    T.apply_transforms(beak)
    hp = [head, crest, beak]
    for sx in (-1, 1):
        hp.append(paint(T.ico('Eye', 0.01, subdiv=1, loc=(sx * 0.05, -0.15, 0.435)), M('blue')))
    att(T.join(hp, 'HeadJ'), rig, 'head')

    tail = paint(T.ico('Tail', 1.0, subdiv=1, scale=(0.045, 0.15, 0.014), loc=(0, 0.2, 0.15)), M('blue'))
    rot(tail, rx=R(30), pivot=(0, 0.2, 0.15))
    att(tail, rig, 'tail')

    for s, sx in (('L', 1), ('R', -1)):
        sp = paint(T.ico('WingS' + s, 1.0, subdiv=1, scale=(0.27, 0.11, 0.014), loc=(sx * 0.31, 0.03, 0.3)), M('wing'))
        tipb = paint(T.ico('WingTip' + s, 1.0, subdiv=1, scale=(0.12, 0.08, 0.012), loc=(sx * 0.5, 0.07, 0.3)), M('tip', '#2c4f86'))
        wj = T.join([sp, tipb], 'WingSpread' + s)
        wj['only'] = 'fly'
        att(wj, rig, 'wing.' + s)
        leg = paint(T.limb('Leg' + s, (sx * 0.035, 0.02, 0.15), (sx * 0.035, 0.0, 0.01), 0.011, 0.009, segs=4), M('legs'))
        toe = paint(T.ico('Toe' + s, 1.0, subdiv=1, scale=(0.02, 0.045, 0.008), loc=(sx * 0.035, -0.02, 0.008)), M('legs'))
        att(leg, rig, 'leg.' + s)
        att(toe, rig, 'leg.' + s)
    return rig


def pose_jay(rig, anim, fi, n):
    reset(rig)
    for o in rig.children:
        if 'only' in o.keys():
            o.hide_render = anim not in o['only'].split(',')
    pb = rig.pose.bones
    ph = fi / n
    s = math.sin(ph * math.tau)
    if anim == 'idle':
        # look around + tail flick
        pb['head'].rotation_euler.z = R(25 * (1 if fi % 2 else -1))
        pb['tail'].rotation_euler.x = R(-8 * fi)
    elif anim == 'hop':
        # crouch - airborne - land - settle
        hz = [0.0, 0.11, 0.07, 0.0][fi % 4]
        crouch = [1, 0, 0, 0.5][fi % 4]
        rig.location = (0, 0, hz - 0.025 * crouch)
        pb['body'].rotation_euler.x = R(10 * crouch - 8 * (hz > 0))
        pb['tail'].rotation_euler.x = R(-15 if hz > 0 else 5)
        for sd in ('L', 'R'):
            pb['leg.' + sd].rotation_euler.x = R(-35 if hz > 0 else 0)
    elif anim == 'fly':
        # body levels out, legs tucked, wings flap (fi 0 = up, 2 = down)
        pb['body'].rotation_euler.x = R(40)
        pb['tail'].rotation_euler.x = R(-30)
        flap = math.cos(ph * math.tau)
        for sd, sg in (('L', 1), ('R', -1)):
            pb['wing.' + sd].rotation_euler.z = R(sg * 40 * flap)
            pb['leg.' + sd].rotation_euler.x = R(-70)
        rig.location = (0, 0, 0.12)


ANIMS = {
    'duck': {'idle': {'frames': 4, 'fps': 2}, 'walk': {'frames': 8, 'fps': 12}},
    'duck_hat': {'idle': {'frames': 4, 'fps': 2}, 'walk': {'frames': 8, 'fps': 12}},
    'fox': {'idle': {'frames': 4, 'fps': 2}, 'walk': {'frames': 8, 'fps': 12}, 'sit': {'frames': 1, 'fps': 1}},
    'bluejay': {'idle': {'frames': 2, 'fps': 1.5}, 'hop': {'frames': 4, 'fps': 10}, 'fly': {'frames': 4, 'fps': 12}},
}

CRITTERS = {
    'duck': dict(build=lambda: build_duck('duck'), pose=pose_duck, cell=(280, 280), anchor=(140, 210), scale=1.35),
    'duck_hat': dict(build=lambda: build_duck('duck_hat'), pose=pose_duck, cell=(340, 340), anchor=(170, 240), scale=1.35),
    'fox': dict(build=build_fox, pose=pose_fox, cell=(420, 400), anchor=(210, 240)),
    'bluejay': dict(build=build_jay, pose=pose_jay, cell=(440, 360), anchor=(220, 240), scale=1.45),
}
