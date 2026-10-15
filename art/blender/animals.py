"""
Quadruped animals (raccoon, bear, bear_brown) — low-poly, rigid parts on a simple rig.
Facing -Y.   Blender -b --factory-startup -P art/blender/animals.py -- [raccoon bear bear_brown duck duck_hat fox bluejay]

The Milestone-2 critters (duck, duck_hat, fox, bluejay) are built in animals_m2.py.
bear_brown = the bear rig in the warmer brown of the cave-cliff bear (t0369).

Reference: your research/frames/tutorial/t043.5_dialog_box_zoomed_raccoon_hiya_buddy.jpg,
t133.0_tiptoe_tutorial_ghost_pointer_sleeping_ranger.jpg (raccoon sitting up),
t228.6_bear_dialog_quest_marker.jpg (bear).
"""
import bpy, math, sys
from mathutils import Vector, Euler

ART = '/Users/liamliam/Documents/sneaky sasquatch/sneaky-sasquatch/art/blender'
if ART not in sys.path:
    sys.path.append(ART)
import importlib
import lib_toon as T
importlib.reload(T)
import atlas as A
importlib.reload(A)
import animals_m2 as M2
importlib.reload(M2)
import os

R = math.radians

SPECS = {
    'raccoon': dict(scale=1.65, body='#5f5f63', belly='#8a8a8e', face='#c9c9cc', mask='#2a2a2e', tail='#56565a', tailRing='#262629',
                    ear='#4a4a4e', nose='#1c1c1e', legs='#3a3a3e'),
    'bear': dict(scale=2.6, body='#3b2a20', belly='#4a3426', face='#8a6440', mask='#3b2a20', tail='#3b2a20', tailRing='#3b2a20',
                 ear='#2e2018', nose='#1a1210', legs='#30221a'),
    # cave-cliff bear (t0369, sitting by the cave): body #453325 in shade, lit fur #604731, tan muzzle
    'bear_brown': dict(scale=2.6, body='#4e3826', belly='#5e4430', face='#7c5a3c', mask='#4e3826', tail='#4e3826', tailRing='#4e3826',
                       ear='#3a291c', nose='#1e1612', legs='#3e2c1f'),
}


def build(kind):
    T.reset_scene()
    S = SPECS[kind]
    k = S['scale']
    cache = {}

    def M(name):
        if name not in cache:
            cache[name] = T.toon_material(f'{kind}_{name}', S[name])
        return cache[name]

    arm_d = bpy.data.armatures.new(kind + 'Rig')
    rig = bpy.data.objects.new(kind + 'Rig', arm_d)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_d.edit_bones

    def bone(name, h, t, parent=None):
        b = eb.new(name)
        b.head = Vector(h) * k
        b.tail = Vector(t) * k
        if parent:
            b.parent = eb[parent]

    bone('root', (0, 0, 0), (0, 0.1, 0))
    bone('body', (0, 0.12, 0.24), (0, -0.12, 0.26), 'root')
    bone('head', (0, -0.14, 0.27), (0, -0.3, 0.3), 'body')
    bone('tail', (0, 0.16, 0.25), (0, 0.4, 0.22), 'body')
    for s, x in (('L', 0.07), ('R', -0.07)):
        bone('legF.' + s, (x, -0.1, 0.2), (x, -0.11, 0.02), 'body')
        bone('legB.' + s, (x, 0.11, 0.2), (x, 0.12, 0.02), 'body')
    bpy.ops.object.mode_set(mode='OBJECT')

    def att(o, b):
        bpy.context.view_layer.update()
        mw = o.matrix_world.copy()
        o.parent = rig
        o.parent_type = 'BONE'
        o.parent_bone = b
        bpy.context.view_layer.update()
        o.matrix_world = mw

    def sc(v):
        return tuple(c * k for c in v)

    body = T.ico('Body', 1.0, subdiv=2, scale=sc((0.1, 0.17, 0.095)), loc=sc((0, 0.0, 0.25)))
    T.set_material(body, M('body'))
    belly = T.ico('Belly', 1.0, subdiv=1, scale=sc((0.08, 0.13, 0.05)), loc=sc((0, -0.01, 0.2)))
    T.set_material(belly, M('belly'))
    att(T.join([body, belly], 'Torso'), 'body')

    head = T.ico('HeadB', 1.0, subdiv=2, scale=sc((0.075, 0.08, 0.07)), loc=sc((0, -0.19, 0.29)))
    T.set_material(head, M('body'))
    face = T.ico('Face', 1.0, subdiv=1, scale=sc((0.06, 0.05, 0.045)), loc=sc((0, -0.24, 0.28)))
    T.set_material(face, M('face'))
    snout = T.ico('Snout', 1.0, subdiv=1, scale=sc((0.028, 0.045, 0.026)), loc=sc((0, -0.29, 0.27)))
    T.set_material(snout, M('face'))
    nose = T.ico('Nose', 1.0, subdiv=1, scale=sc((0.014, 0.012, 0.012)), loc=sc((0, -0.33, 0.275)))
    T.set_material(nose, M('nose'))
    parts = [head, face, snout, nose]
    if kind == 'raccoon':
        mask = T.box('Mask', sc((0.13, 0.03, 0.03)), loc=sc((0, -0.255, 0.3)))
        T.set_material(mask, M('mask'))
        parts.append(mask)
    for s, x in (('L', 0.045), ('R', -0.045)):
        ear = T.cone('Ear' + s, 0.028 * k, 0.0, 0.05 * k, segs=4, loc=sc((x, -0.17, 0.34)))
        T.set_material(ear, M('ear'))
        eye = T.ico('Eye' + s, 0.011 * k, subdiv=1, loc=sc((x * 0.65, -0.275, 0.305)))
        T.set_material(eye, M('nose'))
        parts += [ear, eye]
    att(T.join(parts, 'Head'), 'head')

    if kind == 'raccoon':
        segs = []
        for i in range(5):
            y0 = 0.17 + i * 0.05
            seg = T.limb('Tail%d' % i, sc((0, y0, 0.25 - i * 0.012)), sc((0, y0 + 0.05, 0.25 - (i + 1) * 0.012)), 0.04 * k * (1 - i * 0.08), 0.04 * k * (1 - (i + 1) * 0.08), segs=7)
            T.set_material(seg, M('tailRing') if i % 2 else M('tail'))
            segs.append(seg)
        for sgo in segs:
            T.apply_transforms(sgo)
        att(T.join(segs, 'Tail'), 'tail')
    else:
        tl = T.ico('TailB', 1.0, subdiv=1, scale=sc((0.03, 0.03, 0.03)), loc=sc((0, 0.18, 0.27)))
        T.set_material(tl, M('tail'))
        att(tl, 'tail')

    for s, x in (('L', 0.07), ('R', -0.07)):
        for fb, y in (('F', -0.1), ('B', 0.11)):
            leg = T.limb('Leg' + fb + s, sc((x, y, 0.21)), sc((x, y - 0.01, 0.02)), 0.026 * k, 0.022 * k, segs=6)
            T.set_material(leg, M('legs'))
            paw = T.ico('Paw' + fb + s, 1.0, subdiv=1, scale=sc((0.025, 0.035, 0.018)), loc=sc((x, y - 0.02, 0.018)))
            T.set_material(paw, M('legs'))
            att(leg, 'leg' + fb + '.' + s)
            att(paw, 'leg' + fb + '.' + s)
    return rig


def reset(rig):
    for b in rig.pose.bones:
        b.rotation_mode = 'XYZ'
        b.rotation_euler = (0, 0, 0)
        b.location = (0, 0, 0)


SIT_PITCH = {'raccoon': 75, 'bear': 60, 'bear_brown': 60}
SIT_DROP = {'raccoon': 0.1, 'bear': 0.1, 'bear_brown': 0.1}   # x scale: lowers the rump onto the ground


def pose(rig, anim, fi, n, kind=None):
    reset(rig)
    pb = rig.pose.bones
    ph = fi / n
    s = math.sin(ph * math.tau)
    if anim == 'idle':
        pb['head'].rotation_euler.x = R(3 * s)
        pb['tail'].rotation_euler.z = R(10 * s)
    elif anim == 'walk':
        # trot: diagonal pairs move together
        for leg, phase in (('legF.L', 0), ('legB.R', 0), ('legF.R', math.pi), ('legB.L', math.pi)):
            pb[leg].rotation_euler.x = R(30 * math.sin(ph * math.tau + phase))
        pb['body'].location.z = 0.0
        pb['tail'].rotation_euler.z = R(14 * s)
        pb['head'].rotation_euler.x = R(-4 + 3 * s)
    elif anim == 'sit':
        # sitting upright on the haunches (raccoon waiting for the sasquatch t133.0, bears t228.6 / t0369).
        # On this rig a NEGATIVE body x pitches the nose up (the old +55 tipped the animal onto its nose).
        a = SIT_PITCH.get(kind, 50)
        pb['body'].rotation_euler.x = R(-a)
        pb['head'].rotation_euler.x = R(a * 0.8)
        pb['tail'].rotation_euler.x = R(a * 0.7)
        for s_ in ('L', 'R'):
            pb['legB.' + s_].rotation_euler.x = R(a - 85)    # folded forward under the haunch
            pb['legF.' + s_].rotation_euler.x = R(a - 22)    # front legs reaching down in front
    elif anim == 'sleep':
        pb['body'].location.y = 0.0
        for s_ in ('L', 'R'):
            pb['legF.' + s_].rotation_euler.x = R(-80)
            pb['legB.' + s_].rotation_euler.x = R(80)
        pb['head'].rotation_euler.x = R(-15 + 2 * s)


ANIMS = {
    'idle': {'frames': 4, 'fps': 2},
    'walk': {'frames': 8, 'fps': 14},
    'sit': {'frames': 1, 'fps': 1},
    'sleep': {'frames': 2, 'fps': 0.7},
}

ALL = ['raccoon', 'bear', 'bear_brown'] + list(M2.CRITTERS.keys())


def build_any(kind):
    if kind not in M2.CRITTERS:
        return build(kind)
    rig = M2.CRITTERS[kind]['build']()
    rig.scale = (M2.CRITTERS[kind].get('scale', 1.0),) * 3
    return rig


def anims_for(kind):
    return M2.ANIMS[kind] if kind in M2.CRITTERS else ANIMS


def pose_full(r, kind, anim, fi, n):
    if kind in M2.CRITTERS:
        M2.CRITTERS[kind]['pose'](r, anim, fi, n)
        return
    pose(r, anim, fi, n, kind)
    # lying down / sitting lowers the whole body
    drop = 0.14 if anim == 'sleep' else SIT_DROP.get(kind, 0.1) if anim == 'sit' else 0.0
    r.location = (0, 0, -drop * SPECS[kind]['scale'])


def cell_for(kind):
    if kind in M2.CRITTERS:
        return M2.CRITTERS[kind]['cell'], M2.CRITTERS[kind]['anchor']
    # cells were 360x300 / 560x520 before M2; taller now so the sit / sleep frames facing away aren't clipped
    if kind == 'raccoon':
        return (360, 340), (180, 220)
    return (560, 580), (280, 400)


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for kind in (argv or ALL):
        rig = build_any(kind)
        cell, anchor = cell_for(kind)
        tmp = os.path.join(os.environ['SAS_TMP'], 'atlas_' + kind) if os.environ.get('SAS_TMP') else None
        A.render_atlas(kind, rig, anims_for(kind), cell=cell, anchor=anchor, tmp=tmp,
                       pose_fn=lambda r, anim, fi, n, kind=kind: pose_full(r, kind, anim, fi, n))
