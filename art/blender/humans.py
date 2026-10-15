"""
Parametric low-poly humans (rangers, campers) sharing the sasquatch's bone
names, so the same pose code drives them. Facing -Y.

    Blender -b --factory-startup -P art/blender/humans.py -- [keys...]

Looks are defined in LOOKS below; each renders to sprites/chars/<key>.png/json.
Reference: your research/frames/tutorial/t059.5_ranger_dialog.jpg (ranger),
inside-park stills for campers (your research/frames/inside-park/, video
"more inside park.mov": kid+reader t0066.5, campers t0315/t0931, rv guy t0294,
pink kid t0266, green hat t0263, hiker t0410, ranger in bed t0650).

Body proportions come from BODY (per look `body=`):
  classic  the original tutorial rig (ranger, camper_a-d) - all factors 1, unchanged.
  adult    the chibi proportions measured on the inside-park stills: big head
           (x1.32), shorter legs / torso.
  kid      even bigger head, short legs, smaller overall.
  stout    classic head and torso on short legs (businessman).
Per-look extras: hairStyle ('cap' | 'bob' | 'bald' | 'back' | 'none'), beard, glasses
('sun' | 'round'), shorts (skin-coloured shins), sitStyle ('chair' | 'ground'),
props ('rod', 'newspaper', 'cane'), anims (which animations to render).
Businessman extras: hat 'tophat' (hatColor / hatTop / hatBand), headTilt / hatTilt (camera-relative
tilt in degrees, see tilt_from_camera), mustache,
ears, sleeves='long' (jacket-coloured forearms), shirtFront, bowTie.

Optional env SAS_TMP: directory for the intermediate per-frame renders.
"""
import bpy, math, sys, os
from mathutils import Vector

ART = '/Users/liamliam/Documents/sneaky sasquatch/sneaky-sasquatch/art/blender'
if ART not in sys.path:
    sys.path.append(ART)
import importlib
import lib_toon as T
importlib.reload(T)
import atlas as A
importlib.reload(A)

R = math.radians

# ---------------------------------------------------------------- bodies
BODY = {
    'classic': dict(kL=1.0, kT=1.0, kH=1.0, kW=1.0, scale=1.0),
    'adult': dict(kL=0.78, kT=0.83, kH=1.32, kW=0.86, scale=1.0),
    'kid': dict(kL=0.7, kT=0.76, kH=1.48, kW=0.84, scale=1.0),
    # businessman: the classic rig on short legs (cutscene: jacket hem to shoe ~20 % of his height)
    'stout': dict(kL=0.74, kT=1.0, kH=1.0, kW=1.12, scale=0.95),
}

CLASSIC_ANIMS = ['idle', 'walk', 'run', 'sleep', 'sit', 'tackle']
WALKERS = ['idle', 'walk', 'run']

# ---------------------------------------------------------------- looks
LOOKS = {
    # ---- tutorial cast (classic proportions) ----
    'ranger': dict(skin='#f2b285', shirt='#d9a63a', pants='#4b3524', shoes='#2b2522', hat='campaign',
                   hatBrim='#f3b443', hatCrown='#c98d33', hatBand='#4b3524', hair='#5a3a22',
                   anims=CLASSIC_ANIMS + ['sleepBed'], cell=(400, 460), anchor=(200, 350)),   # bigger cell: lying in bed
    'camper_a': dict(skin='#f2b285', shirt='#e05a4a', pants='#3a5a8a', shoes='#3a3030', hat='cap', hatColor='#2f6fb0', hair='#6a4228'),
    'camper_b': dict(skin='#c98b5e', shirt='#5aa0d8', pants='#5a5048', shoes='#2b2522', hat=None, hair='#2b1d14'),
    'camper_c': dict(skin='#f2c098', shirt='#f2c740', pants='#6a7a4a', shoes='#3a3030', hat='bucket', hatColor='#7a8a5a', hair='#c89a52'),
    'camper_d': dict(skin='#e8a878', shirt='#8a5ab0', pants='#2f3a4a', shoes='#f0f0f0', hat=None, hair='#a0522d', hairLong=True),

    # ---- Milestone 2: inside the park (colours sampled from the video) ----
    # kid on the red/white picnic blanket with the radio (t0066.5): brown bob, olive-yellow tee, brown shorts
    'kid_radio': dict(body='kid', skin='#efc8a0', shirt='#d8d460', pants='#7a603a', shoes='#26231e', hat=None,
                      hair='#523923', hairStyle='bob', shorts=True, sitStyle='ground', anims=WALKERS + ['sit']),
    # bearded man on a log behind his newspaper (t0066.5 - only the paper is ever visible)
    'reader': dict(body='adult', skin='#efb890', shirt='#b84c3c', pants='#3d5a80', shoes='#3a2c22', hat=None,
                   hair='#5a3a22', beard='#5a3a22', props=['newspaper'], anims=WALKERS + ['sit', 'read']),
    # fisher: yellow fishing hat, grey shirt, rod held upright (rod baked into every frame)
    'fisher': dict(body='adult', skin='#eab48c', shirt='#9c9ca2', pants='#7d6c4c', shoes='#2b2522', hat='bucket',
                   hatColor='#f2c440', hair='#6a4228', shorts=True, props=['rod'], anims=WALKERS + ['sit'],
                   cell=(380, 460), anchor=(190, 390)),   # bigger cell for the rod
    # hiker by RV site A (t0410): grey beanie, green tee, dark trousers, blue shoes
    'hiker': dict(body='adult', skin='#8a6248', shirt='#6cc35a', pants='#38363c', shoes='#2b3f6a', hat='beanie',
                  hatColor='#7e7e82', hair='#1e1612', anims=WALKERS),
    # pink-haired kid at RV site B (t0266/t0874): pink bob, coral tee, charcoal shorts
    'kid_pink': dict(body='kid', skin='#d9a382', shirt='#e26a6a', pants='#3b3b3e', shoes='#2e2e30', hat=None,
                     hair='#e0727a', hairStyle='bob', shorts=True, anims=WALKERS + ['sit']),
    # campsite C fire ring (t0315/t0931): blue bucket hat + round glasses, tan tee, jeans
    'camper_bluehat': dict(body='adult', skin='#b47c5e', shirt='#e2a66e', pants='#2f5f7a', shoes='#273751', hat='bucket',
                           hatColor='#58afd2', hair='#2b1d14', glasses='round', anims=WALKERS + ['sit']),
    # blond bowl cut, light-blue tee, khaki shorts
    'camper_blond': dict(body='adult', skin='#d29a78', shirt='#4aa6cc', pants='#a58a5c', shoes='#1d1d1f', hat=None,
                         hair='#cdb671', hairStyle='bob', shorts=True, anims=WALKERS + ['sit']),
    # red cap, sunglasses, beard, purple tee, dark shorts (t0874)
    'camper_redcap': dict(body='adult', skin='#e0ac88', shirt='#9c4c9c', pants='#2f2d2f', shoes='#2b2522', hat='cap2',
                          hatColor='#d65254', hair='#4a3020', beard='#6a4a2c', glasses='sun', shorts=True,
                          anims=WALKERS + ['sit']),
    # RV site D radio owner (t0294/t0311): bald crown, yellow comb-over/fringe + beard, shades, purple tee, green trousers
    'rv_guy': dict(body='adult', skin='#d6a48a', shirt='#7666c8', pants='#3f8a3c', shoes='#3a2c22', hat=None,
                   hair='#efd462', hairStyle='bald', beard='#efd462', glasses='sun', anims=WALKERS),
    # green-hat man in the white RV door (t0263): pointed green hat with black band, lavender tee, brown trousers
    'greenhat': dict(body='adult', skin='#b07a60', shirt='#a49cd0', pants='#6a5442', shoes='#2b2522', hat='safari',
                     hatColor='#7dc474', hatBand='#1e1e1e', hair='#2b1d14', anims=WALKERS),

    # ---- bonus park cutscene (videos/bonus park cutscene.mov, 0-8.6 s) ----
    # Mr Pemberton, the businessman: huge black top hat with a red band, black suit with long sleeves,
    # white shirt front, red bow tie, brown hair + handlebar mustache, black cane in the right hand.
    # Same classic body as the ranger (collar-to-feet matches him in the cutscene); the hat is ~half his height.
    'businessman': dict(body='stout', skin='#f8b583', shirt='#272727', pants='#202020', shoes='#181818', hat='tophat',
                        hatColor='#282d2c', hatTop='#383e3f', hatBand='#d24b4c', headTilt=22,
                        hair='#453219', hairStyle='back', mustache='#453219', ears=True, sleeves='long',
                        shirtFront='#f4f4f4', bowTie='#d24b4b', props=['cane'], anims=WALKERS),
}

ANIM_INFO = {
    'idle': {'frames': 4, 'fps': 2},
    'walk': {'frames': 8, 'fps': 10},
    'run': {'frames': 8, 'fps': 14},
    'sleep': {'frames': 4, 'fps': 1.5},
    'sit': {'frames': 1, 'fps': 1},
    'tackle': {'frames': 1, 'fps': 1},
    'read': {'frames': 2, 'fps': 0.5},
    'sleepBed': {'frames': 2, 'fps': 0.8},
}

J = dict(
    hip=(0, 0, 0.56), chest=(0, 0.0, 1.0), neck=(0, 0.0, 1.04), headTop=(0, 0.0, 1.5),
    shL=(0.2, 0.0, 0.97), elL=(0.23, 0.01, 0.77), wrL=(0.24, 0.0, 0.58),
    hipL=(0.095, 0, 0.56), knL=(0.1, -0.01, 0.31), anL=(0.095, 0.0, 0.07),
)

# ranger-station bed (sleepBed): mattress top height and head (pillow) position, bed-centre origin.
# Matches the `bed` prop (0.85 x 1.5, mattress top 0.46, pillow at y = +0.45); head centre at y = +0.5.
BED_TOP = 0.46
BED_HEAD_Y = 0.5

# businessman's cane: swing amplitude (deg from vertical) per anim, and outward lean (deg) while standing
CANE_SWING = {'walk': 34, 'run': 42}
CANE_LEAN = 9


def mirror(p):
    return (-p[0], p[1], p[2])


class Prop:
    """Height remapping for one body: legs (z<=hip) x kL, torso/arms x kT, head x kH."""

    def __init__(self, P):
        self.P = P
        self.kL, self.kT, self.kH, self.kW = P['kL'], P['kT'], P['kH'], P['kW']
        self.identity = all(abs(P[k] - 1) < 1e-9 for k in ('kL', 'kT', 'kH', 'kW'))
        self.hipN = 0.07 + (0.56 - 0.07) * self.kL
        self.neckN = self.hipN + (1.04 - 0.56) * self.kT

    def Z(self, z):
        if self.identity or z <= 0.07:
            return z
        if z <= 0.56:
            return 0.07 + (z - 0.07) * self.kL
        if z <= 1.04:
            return self.hipN + (z - 0.56) * self.kT
        return self.neckN + (z - 1.04) * self.kH

    def B(self, p):
        """body point (torso/limbs): x,y scaled by width."""
        if self.identity:
            return tuple(p)
        return (p[0] * self.kW, p[1] * self.kW, self.Z(p[2]))

    def H(self, p):
        """head point: x,y scaled with the head."""
        if self.identity:
            return tuple(p)
        return (p[0] * self.kH, p[1] * self.kH, self.Z(p[2]))

    def hs(self, s):
        return tuple(s) if self.identity else tuple(c * self.kH for c in s)

    def hr(self, r):
        return r if self.identity else r * self.kH


def build_armature(pr):
    arm_d = bpy.data.armatures.new('HumanRig')
    arm = bpy.data.objects.new('HumanRig', arm_d)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_d.edit_bones
    Jb = {k: pr.B(v) for k, v in J.items()}

    def bone(name, h, t, parent=None):
        b = eb.new(name)
        b.head = h; b.tail = t
        if parent:
            b.parent = eb[parent]

    bone('root', (0, 0, 0), (0, 0.3, 0))
    bone('hips', Jb['hip'], (0, 0, pr.Z(0.72)), 'root')
    bone('chest', (0, 0, pr.Z(0.72)), Jb['chest'], 'hips')
    bone('head', Jb['neck'], pr.H(J['headTop']), 'chest')
    hc = pr.H((0, 0, 1.24))
    bone('hat', hc, (hc[0], hc[1], hc[2] + 0.2), 'head')
    for s, f in (('L', lambda p: p), ('R', mirror)):
        bone('upperArm.' + s, f(Jb['shL']), f(Jb['elL']), 'chest')
        bone('foreArm.' + s, f(Jb['elL']), f(Jb['wrL']), 'upperArm.' + s)
        # hand-prop bone continues the forearm direction (an exactly vertical bone gets a flipped roll)
        w, e = Vector(f(Jb['wrL'])), Vector(f(Jb['elL']))
        bone('prop.' + s, w, w + (w - e).normalized() * 0.1, 'foreArm.' + s)
        bone('thigh.' + s, f(Jb['hipL']), f(Jb['knL']), 'hips')
        bone('shin.' + s, f(Jb['knL']), f(Jb['anL']), 'thigh.' + s)
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def attach(obj, arm, bone):
    bpy.context.view_layer.update()
    mw = obj.matrix_world.copy()
    obj.parent = arm
    obj.parent_type = 'BONE'
    obj.parent_bone = bone
    bpy.context.view_layer.update()
    obj.matrix_world = mw


def attach_obj(obj, arm):
    bpy.context.view_layer.update()
    mw = obj.matrix_world.copy()
    obj.parent = arm
    obj.parent_type = 'OBJECT'
    bpy.context.view_layer.update()
    obj.matrix_world = mw


def rotate_obj(o, rx=0.0, ry=0.0, rz=0.0, pivot=None):
    """Rotate mesh data about pivot (world) and keep it there (applied)."""
    from mathutils import Matrix, Euler
    pv = Vector(pivot) if pivot is not None else o.location.copy()
    T.apply_transforms(o)
    m = Matrix.Translation(pv) @ Euler((rx, ry, rz), 'XYZ').to_matrix().to_4x4() @ Matrix.Translation(-pv)
    o.data.transform(m)
    o.data.update()


def build(look):
    T.reset_scene()
    L = LOOKS[look]
    P = BODY[L.get('body', 'classic')]
    pr = Prop(P)
    cache = {}

    def M(name, hexv):
        k = f'{look}_{name}'
        if k not in cache:
            cache[k] = T.toon_material(k, hexv)
        return cache[k]
    skin, shirt, pants, shoes = M('skin', L['skin']), M('shirt', L['shirt']), M('pants', L['pants']), M('shoes', L['shoes'])
    hairM = M('hair', L['hair'])
    arm = build_armature(pr)
    H, hs, hr = pr.H, pr.hs, pr.hr

    # head
    head = T.ico('HeadBall', 1.0, subdiv=2, scale=hs((0.2, 0.19, 0.21)), loc=H((0, 0.0, 1.24)))
    T.set_material(head, skin)
    parts_head = [head]
    style = L.get('hairStyle', 'cap')
    if style == 'cap':
        hair = T.ico('HairCap', 1.0, subdiv=2, scale=hs((0.21, 0.2, 0.16)), loc=H((0, 0.03, 1.30)))
        T.set_material(hair, hairM)
        parts_head.append(hair)
    elif style == 'bob':
        # helmet-like bowl cut: covers crown, sides and back, face open at the front
        hair = T.ico('HairBob', 1.0, subdiv=2, scale=hs((0.228, 0.222, 0.185)), loc=H((0, 0.045, 1.305)))
        back = T.ico('HairBack', 1.0, subdiv=2, scale=hs((0.215, 0.16, 0.16)), loc=H((0, 0.075, 1.205)))
        for o in (hair, back):
            T.set_material(o, hairM)
        parts_head += [hair, back]
    elif style == 'bald':
        # fringe round the back and sides + a few comb-over strands on the bare crown
        ring = T.ico('HairRing', 1.0, subdiv=2, scale=hs((0.222, 0.2, 0.13)), loc=H((0, 0.035, 1.2)))
        T.set_material(ring, hairM)
        parts_head.append(ring)
        for i, x in enumerate((-0.075, -0.015, 0.05)):
            sp = H((x, -0.01, 1.428 - abs(x) * 0.25))
            st = T.ico('Strand%d' % i, 1.0, subdiv=1, scale=hs((0.03, 0.15, 0.03)), loc=sp)
            rotate_obj(st, rx=R(-12), rz=R(-14 + i * 12), pivot=sp)
            T.set_material(st, hairM)
            parts_head.append(st)
    elif style == 'back':
        # hair round the back and sides only: the forehead stays bare under a hat brim
        hair = T.ico('HairCrown', 1.0, subdiv=2, scale=hs((0.204, 0.19, 0.17)), loc=H((0, 0.075, 1.3)))
        back = T.ico('HairBack', 1.0, subdiv=2, scale=hs((0.198, 0.15, 0.16)), loc=H((0, 0.09, 1.2)))
        for o in (hair, back):
            T.set_material(o, hairM)
        parts_head += [hair, back]
    if L.get('hairLong'):
        hl = T.ico('HairLong', 1.0, subdiv=2, scale=hs((0.2, 0.14, 0.2)), loc=H((0, 0.1, 1.16)))
        T.set_material(hl, hairM)
        parts_head.append(hl)
    if L.get('beard'):
        bd = T.ico('Beard', 1.0, subdiv=2, scale=hs((0.188, 0.135, 0.105)), loc=H((0, -0.085, 1.135)))
        T.set_material(bd, M('beard', L['beard']))
        parts_head.append(bd)
    if L.get('mustache'):
        # handlebar mustache under the nose: two tapering lobes swept up at the ends + curled tips
        for sx in (-1, 1):
            p0 = H((sx * 0.068, -0.192, 1.162))
            lobe = T.ico('Stache', 1.0, subdiv=2, scale=hs((0.085, 0.036, 0.027)), loc=p0)
            rotate_obj(lobe, ry=R(-sx * 16), rz=R(sx * 18), pivot=p0)
            pt = H((sx * 0.148, -0.148, 1.178))
            tip = T.ico('StacheTip', 1.0, subdiv=1, scale=hs((0.036, 0.024, 0.022)), loc=pt)
            rotate_obj(tip, ry=R(-sx * 45), rz=R(sx * 30), pivot=pt)
            for o in (lobe, tip):
                T.set_material(o, M('mustache', L['mustache']))
                parts_head.append(o)
    if L.get('ears'):
        for sx in (-1, 1):
            ear = T.ico('Ear', 1.0, subdiv=1, scale=hs((0.035, 0.045, 0.056)), loc=H((sx * 0.205, 0.01, 1.225)))
            T.set_material(ear, M('ear', T_shade(L['skin'], 0.92)))
            parts_head.append(ear)
    gl = L.get('glasses')
    eye_y = -0.185
    if gl == 'round':
        eye_y = -0.2
        for s, x in (('L', 0.075), ('R', -0.075)):
            rim = T.ico('Rim.' + s, 1.0, subdiv=1, scale=hs((0.052, 0.012, 0.05)), loc=H((x, -0.192, 1.25)))
            T.set_material(rim, M('rim', '#f2f2f2'))
            parts_head.append(rim)
        br = T.box('Bridge', hs((0.05, 0.01, 0.012)), loc=H((0, -0.2, 1.262)))
        T.set_material(br, M('rim', '#f2f2f2'))
        parts_head.append(br)
    elif gl == 'sun':
        # wrap-around shades: front piece + two temples following the head
        sg = T.box('Shades', hs((0.19, 0.03, 0.045)), loc=H((0, -0.192, 1.25)))
        T.set_material(sg, M('shades', '#16161a'))
        parts_head.append(sg)
        for sx in (-1, 1):
            p0 = H((sx * 0.135, -0.155, 1.252))
            tm = T.box('Temple', hs((0.11, 0.025, 0.035)), loc=p0)
            rotate_obj(tm, rz=R(sx * 42), pivot=p0)
            T.set_material(tm, M('shades', '#16161a'))
            parts_head.append(tm)
    if gl != 'sun':
        for s, x in (('L', 0.075), ('R', -0.075)):
            e = T.ico('Eye.' + s, hr(0.022), subdiv=1, loc=H((x, eye_y, 1.25)))
            T.set_material(e, M('eye', '#1b120c'))
            parts_head.append(e)
    nose = T.ico('Nose', 1.0, subdiv=1, scale=hs((0.03, 0.03, 0.035)), loc=H((0, -0.2, 1.21)))
    T.set_material(nose, M('nose', L['skin']))
    parts_head.append(nose)

    hat = L.get('hat')
    parts_hat = []
    if hat == 'campaign':
        brim = T.cone('Brim', hr(0.44), hr(0.42), hr(0.03), segs=20, loc=H((0, 0.0, 1.36)))
        T.set_material(brim, M('brim', L['hatBrim']))
        crown = T.ico('Crown', 1.0, subdiv=2, scale=hs((0.21, 0.21, 0.24)), loc=H((0, 0.0, 1.42)))
        T.set_material(crown, M('crown', L['hatCrown']))
        band = T.cone('Band', hr(0.215), hr(0.212), hr(0.055), segs=20, loc=H((0, 0.0, 1.38)))
        T.set_material(band, M('band', L['hatBand']))
        parts_hat += [brim, crown, band]
    elif hat == 'cap':
        crown = T.ico('Cap', 1.0, subdiv=2, scale=hs((0.215, 0.21, 0.13)), loc=H((0, 0.02, 1.34)))
        T.set_material(crown, M('cap', L['hatColor']))
        bill = T.box('Bill', hs((0.26, 0.2, 0.025)), loc=H((0, -0.22, 1.33)))
        T.set_material(bill, M('cap', L['hatColor']))
        parts_hat += [crown, bill]
    elif hat == 'cap2':
        # baseball cap with the bill tipped up so the face stays visible (t0874)
        crown = T.ico('Cap', 1.0, subdiv=2, scale=hs((0.222, 0.215, 0.13)), loc=H((0, 0.02, 1.375)))
        T.set_material(crown, M('cap', L['hatColor']))
        # visor worn turned to the wearer's left (screen right when facing the camera), as at t0874
        bill = T.ico('Bill', 1.0, subdiv=2, scale=hs((0.14, 0.13, 0.011)), loc=H((0, -0.27, 1.322)))
        rotate_obj(bill, rx=R(8), rz=R(50), pivot=H((0, 0.0, 1.322)))
        T.set_material(bill, M('capbill', T_shade(L['hatColor'], 0.86)))
        parts_hat += [crown, bill]
    elif hat == 'bucket':
        lift = 0.0 if pr.identity else 0.07
        brim = T.cone('BBrim', hr(0.3), hr(0.28), hr(0.04), segs=16, loc=H((0, 0.0, 1.32 + lift)))
        crown = T.cone('BCrown', hr(0.21), hr(0.17), hr(0.16), segs=16, loc=H((0, 0.0, 1.34 + lift)))
        for o in (brim, crown):
            T.set_material(o, M('bucket', L['hatColor']))
        parts_hat += [brim, crown]
        if not pr.identity:
            top = T.ico('BTop', 1.0, subdiv=2, scale=hs((0.17, 0.17, 0.05)), loc=H((0, 0, 1.5 + lift)))
            T.set_material(top, M('bucket', L['hatColor']))
            parts_hat.append(top)
            for o in (brim, crown, top):
                rotate_obj(o, rx=R(-12), pivot=H((0, 0.05, 1.3)))
    elif hat == 'safari':
        # wide floppy brim + pointed crown + black band (green-hat man, t0263)
        brim = T.cone('SBrim', hr(0.34), hr(0.2), hr(0.045), segs=18, loc=H((0, 0.0, 1.32)))
        crown = T.cone('SCrown', hr(0.2), hr(0.075), hr(0.21), segs=14, loc=H((0, 0.0, 1.45)))
        tip = T.ico('STip', 1.0, subdiv=1, scale=hs((0.08, 0.08, 0.035)), loc=H((0, 0, 1.655)))
        for o in (brim, crown, tip):
            T.set_material(o, M('safari', L['hatColor']))
        band = T.cone('SBand', hr(0.205), hr(0.2), hr(0.1), segs=14, loc=H((0, 0.0, 1.355)))
        T.set_material(band, M('sband', L.get('hatBand', '#1e1e1e')))
        parts_hat += [brim, crown, tip, band]
    elif hat == 'beanie':
        bn = T.ico('Beanie', 1.0, subdiv=2, scale=hs((0.234, 0.228, 0.195)), loc=H((0, 0.045, 1.305)))
        bk = T.ico('BeanieBack', 1.0, subdiv=2, scale=hs((0.222, 0.17, 0.17)), loc=H((0, 0.08, 1.19)))
        for o in (bn, bk):
            T.set_material(o, M('beanie', L['hatColor']))
        parts_hat += [bn, bk]
    elif hat == 'tophat':
        parts_hat += build_tophat(L, H, hr, M)
    headObj = T.join(parts_head, 'Head')
    attach(headObj, arm, 'head')
    if parts_hat:
        hatObj = T.join(parts_hat, 'Hat')
        attach(hatObj, arm, 'hat')

    # torso (shirt) + pelvis
    kW, kT, kL = pr.kW, pr.kT, pr.kL
    torso = T.ico('Torso', 1.0, subdiv=2, scale=(0.23 * kW, 0.17 * kW, 0.27 * kT), loc=pr.B((0, 0.0, 0.8)))
    T.set_material(torso, shirt)
    attach(torso, arm, 'chest')
    pelvis = T.ico('Pelvis', 1.0, subdiv=2, scale=(0.2 * kW, 0.15 * kW, 0.11 * (kL + kT) / 2), loc=pr.B((0, 0.0, 0.58)))
    T.set_material(pelvis, pants)
    attach(pelvis, arm, 'hips')
    if L.get('shirtFront') or L.get('bowTie'):
        build_shirt_front(arm, pr, L, M)

    Jb = {k: pr.B(v) for k, v in J.items()}
    shinM = skin if L.get('shorts') else pants
    lw = 1.0 if pr.identity else (0.5 + 0.5 * kW)   # limb thickness
    for s, f in (('L', lambda p: p), ('R', mirror)):
        ua = T.limb('UpperArm.' + s, f(Jb['shL']), f(Jb['elL']), 0.055 * lw, 0.048 * lw)
        T.set_material(ua, shirt)
        fa = T.limb('ForeArm.' + s, f(Jb['elL']), f(Jb['wrL']), 0.045 * lw, 0.04 * lw)
        T.set_material(fa, shirt if L.get('sleeves') == 'long' else skin)
        hand = T.ico('Hand.' + s, 1.0, subdiv=1, scale=(0.045, 0.045, 0.05), loc=Vector(f(Jb['wrL'])) + Vector((0, 0, -0.03)))
        T.set_material(hand, skin)
        th = T.limb('Thigh.' + s, f(Jb['hipL']), f(Jb['knL']), 0.075 * lw, 0.065 * lw)
        sn = T.limb('Shin.' + s, f(Jb['knL']), f(Jb['anL']), 0.062 * lw, 0.055 * lw)
        T.set_material(th, pants)
        T.set_material(sn, shinM)
        shoe = T.ico('Shoe.' + s, 1.0, subdiv=1, scale=(0.06, 0.1, 0.045), loc=Vector(f(Jb['anL'])) + Vector((0, -0.04, -0.03)))
        T.set_material(shoe, shoes)
        attach(ua, arm, 'upperArm.' + s)
        attach(fa, arm, 'foreArm.' + s)
        attach(hand, arm, 'foreArm.' + s)
        attach(th, arm, 'thigh.' + s)
        attach(sn, arm, 'shin.' + s)
        attach(shoe, arm, 'shin.' + s)

    props = L.get('props', [])
    if 'rod' in props:
        build_rod(arm, pr, M)
    if 'newspaper' in props:
        build_newspaper(arm, pr, M)
    if 'cane' in props:
        build_cane(arm, pr, M)
    if 'sleepBed' in L.get('anims', []):
        build_bed_blanket(arm, M)
    arm['bodyScale'] = P['scale']
    arm.scale = (P['scale'],) * 3
    return arm


def T_shade(hexc, f):
    r, g, b = T.hex_rgb(hexc)
    return '#%02x%02x%02x' % tuple(int(max(0, min(1, c * f)) * 255) for c in (r, g, b))


def build_rod(arm, pr, M):
    """Fishing rod held upright in the right hand (character's right = -x). Baked into every frame;
    the 'prop.R' bone counter-rotates so it stays roughly upright while the arm swings."""
    w = Vector(mirror(pr.B(J['wrL']))) + Vector((0, 0, -0.03))
    base = w + Vector((0.0, 0.03, -0.16))
    tip = w + Vector((-0.3, -0.1, 1.36))   # leaning out past the hat brim
    parts = []
    handle = T.limb('RodHandle', base, base + (tip - base).normalized() * 0.3, 0.022, 0.018, segs=6)
    T.set_material(handle, M('rodcork', '#c89a62'))
    rod = T.limb('Rod', base + (tip - base).normalized() * 0.3, tip, 0.014, 0.006, segs=5)
    T.set_material(rod, M('rod', '#2a2420'))
    reel = T.ico('Reel', 1.0, subdiv=1, scale=(0.035, 0.03, 0.035), loc=base + (tip - base).normalized() * 0.2 + Vector((0, -0.03, 0)))
    T.set_material(reel, M('reel', '#8a8a90'))
    for o in (handle, rod, reel):
        T.apply_transforms(o)
        parts.append(o)
    r = T.join(parts, 'FishingRod')
    attach(r, arm, 'prop.R')


def build_newspaper(arm, pr, M):
    """Open broadsheet held up in front of the face (only shown in 'read')."""
    hc = Vector(pr.H((0, 0, 1.24)))
    ctr = Vector((0, -0.36 * pr.kH, hc.z + 0.0))
    W, Hh = 0.33 * pr.kH, 0.46 * pr.kH
    parts = []
    paper = M('paper', '#eeede6')
    ink = M('ink', '#8e8e92')
    dark = M('inkdark', '#4a4a50')
    for side in (-1, 1):
        pg = T.box('Page', (W, 0.012, Hh), loc=(side * W / 2, 0, 0))
        T.set_material(pg, paper)
        page_parts = [pg]
        # headline + photo + text lines on the outward (camera-facing) side
        hl = T.box('Head', (W * 0.8, 0.004, Hh * 0.08), loc=(side * W / 2, -0.009, Hh * 0.36))
        T.set_material(hl, dark)
        page_parts.append(hl)
        if side < 0:
            ph = T.box('Photo', (W * 0.42, 0.004, Hh * 0.3), loc=(side * W / 2 - W * 0.18, -0.009, Hh * 0.1))
            T.set_material(ph, dark)
            page_parts.append(ph)
        for i in range(5):
            x0 = side * W / 2 + (W * 0.12 if side < 0 else 0)
            ww = W * (0.5 if side < 0 and i < 3 else 0.78)
            if side < 0 and i < 3:
                x0 = side * W / 2 + W * 0.2
            ln = T.box('Line', (ww, 0.004, Hh * 0.025), loc=(x0, -0.009, Hh * (0.2 - i * 0.1) - (0.0 if i < 3 else 0.0)))
            T.set_material(ln, ink)
            page_parts.append(ln)
        pj = T.join(page_parts, 'PageJ')
        # pages open in a shallow V away from the reader (spine toward the camera side)
        rotate_obj(pj, rz=R(side * 14), pivot=(0, 0, 0))
        parts.append(pj)
    np_ = T.join(parts, 'Newspaper')
    rotate_obj(np_, rx=R(-12), pivot=(0, 0, 0))
    np_.location = ctr
    T.apply_transforms(np_)
    np_['only'] = 'read'
    attach(np_, arm, 'chest')


def set_material_top(obj, side, top, nz=0.9):
    """Two materials: faces whose normal points up (z > nz) get `top`, the rest `side`.
    The original's cel shading lights the tops of the hat much more than its sides."""
    obj.data.materials.clear()
    obj.data.materials.append(side)
    obj.data.materials.append(top)
    for p in obj.data.polygons:
        p.material_index = 1 if p.normal.z > nz else 0


def build_tophat(L, H, hr, M):
    """Tall stovepipe top hat (businessman): flat brim, slightly flared crown, red band.
    Sits high on the head; pose() tilts it back from the camera (hatTilt) so it reads like the
    cutscene's flatter view of the top and the face/mustache stay visible under the brim."""
    side = M('tophat', L['hatColor'])
    top = M('tophatTop', L.get('hatTop', L['hatColor']))
    zb, th = 1.48, 0.035                    # brim underside (high on the head), brim thickness
    rb, rc, hc = 0.47, 0.335, 0.5           # brim radius, crown radius, crown height
    brim = T.cone('TBrim', hr(rb), hr(rb), hr(th), segs=28, loc=H((0, 0, zb)))
    crown = T.cone('TCrown', hr(rc), hr(rc * 1.04), hr(hc), segs=28, loc=H((0, 0, zb + th)))
    for o in (brim, crown):
        set_material_top(o, side, top)
    band = T.cone('TBand', hr(rc + 0.008), hr(rc + 0.009), hr(0.09), segs=28, loc=H((0, 0, zb + th)))
    T.set_material(band, M('tophatBand', L.get('hatBand', '#cc4849')))
    return [brim, crown, band]


def build_shirt_front(arm, pr, L, M):
    """White shirt front (a V under the lapels) and a red bow tie under the chin; attached to the chest."""
    from mathutils import Matrix
    parts = []
    if L.get('shirtFront'):
        v = T.cone('ShirtFront', 0.022, 0.085, 0.24, segs=12)
        v.data.transform(Matrix.Diagonal((pr.kW, 0.32 * pr.kW, pr.kT, 1.0)))
        v.data.transform(Matrix.Translation(pr.B((0, -0.142, 0.78))))
        T.set_material(v, M('shirtFront', L['shirtFront']))
        parts.append(v)
    if L.get('bowTie'):
        bow = M('bowTie', L['bowTie'])
        for sx in (-1, 1):
            p0 = Vector(pr.B((sx * 0.052, -0.135, 1.025)))
            w = T.ico('BowWing', 1.0, subdiv=1, scale=(0.064, 0.03, 0.046), loc=p0)
            rotate_obj(w, ry=R(sx * 10), pivot=p0)
            T.set_material(w, bow)
            parts.append(w)
        knot = T.ico('BowKnot', 1.0, subdiv=1, scale=(0.026, 0.026, 0.028), loc=pr.B((0, -0.15, 1.025)))
        T.set_material(knot, bow)
        parts.append(knot)
    o = T.join(parts, 'ShirtFront')
    attach(o, arm, 'chest')


def build_cane(arm, pr, M):
    """Thin black walking cane gripped in the right hand (character's right = -x), tip on the ground at rest.
    Hangs from the 'prop.R' bone; pose() swings it like a pendulum on the walk (see `cane` in pose)."""
    w = Vector(mirror(pr.B(J['wrL'])))
    top, tip = w + Vector((0, 0, 0.0)), Vector((w.x, w.y, 0.0))
    cane = T.limb('Cane', top, tip, 0.021, 0.019, segs=8)
    knob = T.ico('CaneKnob', 1.0, subdiv=1, scale=(0.028, 0.028, 0.024), loc=top + Vector((0, 0, 0.01)))
    for o in (cane, knob):
        T.set_material(o, M('cane', '#222827'))
        T.apply_transforms(o)
    c = T.join([cane, knob], 'Cane')
    attach(c, arm, 'prop.R')


def tilt_from_camera(rig, bone, deg, pivot_bone=None):
    """Tilt a pose bone (and its children) back by `deg` about the world east-west axis, toward world north
    (away from the fixed sprite camera), whatever direction the rig faces. The camera's pitch is a rotation about
    that same axis, so the bone renders as if seen from a camera `deg` lower. Pivot: the head of `pivot_bone`
    (default: the bone itself). Must run after every other bone of the frame is posed."""
    from mathutils import Matrix
    bpy.context.view_layer.update()
    pb = rig.pose.bones[bone]
    axis = (rig.matrix_world.to_3x3().inverted() @ Vector((1, 0, 0))).normalized()
    piv = rig.pose.bones[pivot_bone or bone].head.copy()
    pb.matrix = Matrix.Translation(piv) @ Matrix.Rotation(R(-deg), 4, axis) @ Matrix.Translation(-piv) @ pb.matrix


def build_bed_blanket(arm, M):
    """Teal ranger-station blanket over the lying ranger (sleepBed only). Bed-centre origin."""
    w, z0, z1 = 0.75, BED_TOP - 0.08, BED_TOP + 0.36   # tucked over the body (front of chest ~ BED_TOP + 0.3)
    main = T.box('Blanket', (w, 0.8, z1 - z0), loc=(0, -0.37, (z0 + z1) / 2), bevel=0.05)
    T.set_material(main, M('blanket', '#6bcad4'))
    fold = T.box('Fold', (w + 0.02, 0.16, z1 - z0 + 0.03), loc=(0, 0.06, (z0 + z1) / 2 + 0.015), bevel=0.05)
    T.set_material(fold, M('fold', '#589ba9'))
    b = T.join([main, fold], 'BedBlanket')
    b['only'] = 'sleepBed'
    attach_obj(b, arm)


def reset(rig):
    for b in rig.pose.bones:
        b.rotation_mode = 'XYZ'
        b.rotation_euler = (0, 0, 0)
        b.location = (0, 0, 0)


def pose(rig, anim, fi, n, look=None):
    reset(rig)
    L = LOOKS.get(look, {}) if look else {}
    P = BODY[L.get('body', 'classic')]
    kL = P['kL']
    for o in rig.children:
        if 'only' in o.keys():
            o.hide_render = anim not in o['only'].split(',')
    pb = rig.pose.bones
    ph = fi / n
    s = math.sin(ph * math.tau)
    c = math.cos(ph * math.tau)
    if anim == 'idle':
        pb['chest'].rotation_euler.x = R(1 + 1.2 * s)
        for side, sg in (('L', 1), ('R', -1)):
            pb['upperArm.' + side].rotation_euler.y = R(sg * 6)
            pb['foreArm.' + side].rotation_euler.x = R(-6)
    elif anim == 'walk':
        pb['chest'].rotation_euler.x = R(4)
        pb['hips'].location.y = 0.025 * abs(c) * kL
        for side, sg in (('L', 1), ('R', -1)):
            sw = sg * s
            pb['thigh.' + side].rotation_euler.x = R(-26 * sw)
            pb['shin.' + side].rotation_euler.x = R(8 + 30 * max(0.0, math.sin(ph * math.tau + (0 if sg > 0 else math.pi) + 1.0)))
            pb['upperArm.' + side].rotation_euler.x = R(24 * sw)
            pb['upperArm.' + side].rotation_euler.y = R(sg * 5)
            pb['foreArm.' + side].rotation_euler.x = R(-15)
    elif anim == 'run':
        pb['chest'].rotation_euler.x = R(12)
        pb['head'].rotation_euler.x = R(-8)
        pb['hips'].location.y = 0.045 * abs(c) * kL
        for side, sg in (('L', 1), ('R', -1)):
            sw = sg * s
            pb['thigh.' + side].rotation_euler.x = R(-40 * sw)
            pb['shin.' + side].rotation_euler.x = R(20 + 70 * max(0.0, math.sin(ph * math.tau + (0 if sg > 0 else math.pi) + 1.1)))
            pb['upperArm.' + side].rotation_euler.x = R(38 * sw)
            pb['upperArm.' + side].rotation_euler.y = R(sg * 8)
            pb['foreArm.' + side].rotation_euler.x = R(-80)
    elif anim == 'sleep':
        # dozing on his feet: head slumped forward, slow breathing
        pb['chest'].rotation_euler.x = R(10 + 2 * s)
        pb['head'].rotation_euler.x = R(30 + 3 * s)
        for side, sg in (('L', 1), ('R', -1)):
            pb['upperArm.' + side].rotation_euler.x = R(-10)
            pb['upperArm.' + side].rotation_euler.y = R(-sg * 8)
            pb['foreArm.' + side].rotation_euler.x = R(-60)
    elif anim in ('sit', 'read') and L.get('sitStyle') == 'ground':
        # sitting on a picnic blanket: bottom on the ground, legs forward, knees a little up
        hipN = 0.07 + 0.49 * kL
        pb['hips'].location.y = -(hipN - 0.11 * (kL + P['kT']) / 2)
        pb['chest'].rotation_euler.x = R(4)
        for side, sg in (('L', 1), ('R', -1)):
            pb['thigh.' + side].rotation_euler.x = R(-100)
            pb['thigh.' + side].rotation_euler.y = R(sg * 6)
            pb['shin.' + side].rotation_euler.x = R(48)
            pb['upperArm.' + side].rotation_euler.x = R(-18)
            pb['upperArm.' + side].rotation_euler.y = R(sg * 10)
            pb['foreArm.' + side].rotation_euler.x = R(-35)
    elif anim in ('sit', 'read'):
        pb['hips'].location.y = -0.3 * kL
        pb['chest'].rotation_euler.x = R(-4)
        for side, sg in (('L', 1), ('R', -1)):
            pb['thigh.' + side].rotation_euler.x = R(-88)
            pb['shin.' + side].rotation_euler.x = R(88)
            pb['upperArm.' + side].rotation_euler.x = R(-25)
            pb['foreArm.' + side].rotation_euler.x = R(-40)
        if anim == 'read':
            # newspaper held up in front of the face; frame 1 = small page shuffle / nod
            pb['chest'].rotation_euler.x = R(-6 + 3 * fi)
            pb['head'].rotation_euler.x = R(10 + 4 * fi)
            for side, sg in (('L', 1), ('R', -1)):
                pb['upperArm.' + side].rotation_euler.x = R(-62 - 3 * fi)
                pb['upperArm.' + side].rotation_euler.y = R(sg * 30)
                pb['upperArm.' + side].rotation_euler.z = R(-sg * 10)
                pb['foreArm.' + side].rotation_euler.x = R(-62)
    elif anim == 'tackle':
        # diving forward with arms out
        pb['chest'].rotation_euler.x = R(55)
        pb['hips'].location.y = -0.1 * kL
        for side, sg in (('L', 1), ('R', -1)):
            pb['thigh.' + side].rotation_euler.x = R(30)
            pb['shin.' + side].rotation_euler.x = R(40)
            pb['upperArm.' + side].rotation_euler.x = R(-150)
    elif anim == 'sleepBed':
        # lying on his back in the station bed, head north on the pillow, hat over the face (t0650).
        # Origin = bed centre; the body rests on the mattress (BED_TOP).
        pr = Prop(P)
        hc = pr.H((0, 0, 1.24))[2]
        back = 0.17 * P['kW']
        pb['root'].rotation_euler.x = R(-90)
        pb['root'].location = (0, BED_HEAD_Y - hc, BED_TOP + back - 0.02)
        pb['chest'].rotation_euler.x = R(-1.5 * fi)      # breathing
        pb['head'].rotation_euler.x = R(-6)
        pb['hat'].rotation_euler.x = R(78)
        pb['hat'].rotation_euler.y = R(22)
        pb['hat'].location = (0, -0.1, 0.17)
        for side, sg in (('L', 1), ('R', -1)):
            pb['upperArm.' + side].rotation_euler.y = R(sg * 4)
            pb['foreArm.' + side].rotation_euler.x = R(-25)
            pb['thigh.' + side].rotation_euler.y = R(sg * 3)
    # hand-held props stay roughly upright whatever the arm does
    if 'prop.R' in pb:
        ua, fa = pb['upperArm.R'].rotation_euler, pb['foreArm.R'].rotation_euler
        pb['prop.R'].rotation_euler.x = -(ua.x + fa.x + pb['chest'].rotation_euler.x)
        pb['prop.R'].rotation_euler.y = -ua.y
    if 'cane' in L.get('props', []):
        # cane: world angle phi from vertical (+ = tip back). Walking it swings like a pendulum, a little
        # behind the arm and wider than it; standing, the tip is planted a little forward and out.
        ua, fa = pb['upperArm.R'].rotation_euler, pb['foreArm.R'].rotation_euler
        if anim in ('walk', 'run'):
            amp = CANE_SWING[anim]
            phi, lean = R(-amp * math.sin(ph * math.tau - 0.55)), R(CANE_LEAN * 0.5)
        else:
            phi, lean = R(-6), R(CANE_LEAN)
        pb['prop.R'].rotation_euler.x = phi - (ua.x + fa.x + pb['chest'].rotation_euler.x)
        pb['prop.R'].rotation_euler.y = -ua.y
        pb['prop.R'].rotation_euler.z = lean
    if L.get('headTilt'):
        # head + hat drawn as if from the cutscene's flatter camera (face and mustache readable under the brim)
        tilt_from_camera(rig, 'head', L['headTilt'], pivot_bone='hat')
    if L.get('hatTilt'):
        tilt_from_camera(rig, 'hat', L['hatTilt'])


def anims_for(look):
    names = LOOKS[look].get('anims', CLASSIC_ANIMS)
    return {k: dict(ANIM_INFO[k]) for k in names}


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    keys = argv or list(LOOKS.keys())
    for key in keys:
        rig = build(key)
        tmp = os.path.join(os.environ['SAS_TMP'], 'atlas_' + key) if os.environ.get('SAS_TMP') else None
        L = LOOKS[key]
        A.render_atlas(key, rig, anims_for(key), cell=L.get('cell', (320, 400)), anchor=L.get('anchor', (160, 330)), tmp=tmp,
                       pose_fn=lambda r, a, fi, n, key=key: pose(r, a, fi, n, key))
