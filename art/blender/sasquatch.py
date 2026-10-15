"""
Builds the Sasquatch (player) as a rigid-part, bone-parented low-poly model.
Reference: important photos/sprite.png + in-game close-ups (your research/frames).

Facing: the model faces -Y (towards the camera = "south" on screen).
Exec inside Blender:  exec(open(<this file>).read())
"""
import bpy, math, random, importlib, sys, os
from mathutils import Vector, Euler

ART = '/Users/liamliam/Documents/sneaky sasquatch/sneaky-sasquatch/art/blender'
if ART not in sys.path:
    sys.path.append(ART)
import lib_toon as T
importlib.reload(T)

C = dict(
    hair='#3d2a1f',     # head hair, arms, legs
    fur='#6e4732',      # torso fur (per-face variation added)
    furDark='#4a3122',
    skin='#f3b480',
    eye='#1b120c',
    tooth='#ffffff',
    pack='#ee3d40', packDark='#c32c31', strap='#7b2c25', packPanel='#f5a5a2', buckle='#9a9a9a',
)

# skeleton joints (metres, model faces -Y)
J = dict(
    hip=(0, 0, 0.78), chest=(0, 0.01, 1.24), neck=(0, 0.02, 1.30), headTop=(0, 0.02, 2.0),
    shL=(0.20, 0.03, 1.22), elL=(0.25, 0.04, 0.95), wrL=(0.27, 0.02, 0.69),
    hipL=(0.09, 0, 0.78), knL=(0.095, -0.01, 0.43), anL=(0.09, 0.0, 0.08),
)
HEAD_C = (0, 0.07, 1.64)


def mirror(p):
    return (-p[0], p[1], p[2])


def build_armature():
    arm_d = bpy.data.armatures.new('SasquatchRig')
    arm = bpy.data.objects.new('SasquatchRig', arm_d)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_d.edit_bones

    def bone(name, h, t, parent=None):
        b = eb.new(name)
        b.head = h; b.tail = t
        if parent:
            b.parent = eb[parent]
        return b

    bone('root', (0, 0, 0), (0, 0.3, 0))
    bone('hips', J['hip'], (0, 0, 0.92), 'root')
    bone('chest', (0, 0, 0.92), J['chest'], 'hips')
    bone('head', J['neck'], J['headTop'], 'chest')
    for s, f in (('L', lambda p: p), ('R', mirror)):
        bone('upperArm.' + s, f(J['shL']), f(J['elL']), 'chest')
        bone('foreArm.' + s, f(J['elL']), f(J['wrL']), 'upperArm.' + s)
        bone('thigh.' + s, f(J['hipL']), f(J['knL']), 'hips')
        bone('shin.' + s, f(J['knL']), f(J['anL']), 'thigh.' + s)
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


PACKS = {
    'red': dict(pack='#ee3d40', packDark='#c32c31', packPanel='#f5a5a2'),
    'blue': dict(pack='#3aa8d8', packDark='#2c7fa6', packPanel='#9bdde3'),
    'green': dict(pack='#98b23a', packDark='#6f8a2a', packPanel='#dcd77f'),
}


def build(with_backpack=True, seed=7, pack_color='red'):
    T.reset_scene()
    rnd = random.Random(seed)
    cols = dict(C)
    cols.update(PACKS.get(pack_color, PACKS['red']))
    M = {k: T.toon_material('sas_' + k, v) for k, v in cols.items()}
    M['furV'] = T.toon_material('sas_furV', C['fur'], vcol=True)
    M['hairV'] = T.toon_material('sas_hairV', C['hair'], vcol=True)
    arm = build_armature()
    parts = []

    # ---------------- head -------------------------------------------------
    hair = T.ico('Hair', 1.0, subdiv=2, scale=(0.41, 0.37, 0.35), loc=HEAD_C, jag=0.26, seed=seed)
    # extra jagged tufts for the shaggy silhouette
    tufts = []
    for i in range(26):
        a = rnd.random() * math.tau
        el = rnd.uniform(-0.15, 1.0)
        d = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el) + 0.05, math.sin(el)))
        if d.y < -0.45 and d.z < 0.45:     # keep the face area clear
            continue
        c = Vector(HEAD_C) + Vector((d.x * 0.37, d.y * 0.33, d.z * 0.31))
        t = T.cone('tuft%d' % i, rnd.uniform(0.09, 0.13), 0.0, rnd.uniform(0.07, 0.12), segs=3, loc=(0, 0, 0))
        t.rotation_mode = 'QUATERNION'
        t.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
        t.location = c
        tufts.append(t)
    for t in tufts:
        T.apply_transforms(t)
    hair = T.join([hair] + tufts, 'Hair')
    T.face_color_variation(hair, 0.10, seed)
    T.set_material(hair, M['hairV'])

    face = T.ico('Face', 1.0, subdiv=2, scale=(0.32, 0.18, 0.205), loc=(0, -0.235, 1.475))
    T.set_material(face, M['skin'])
    # centre "widow's peak" bang that splits the top of the face into two lobes
    bang = T.ico('Bang', 1.0, subdiv=1, scale=(0.08, 0.12, 0.10), loc=(0, -0.33, 1.625), jag=0.25, seed=seed + 3)
    T.set_material(bang, M['hair'])
    ears = [T.ico('Ear.' + s, 1.0, subdiv=1, scale=(0.05, 0.04, 0.065), loc=(x, -0.05, 1.47)) for s, x in (('L', 0.34), ('R', -0.34))]
    for e in ears:
        T.set_material(e, M['skin'])
    eyes = [T.ico('Eye.' + s, 0.027, subdiv=1, loc=(x, -0.40, 1.525)) for s, x in (('L', 0.125), ('R', -0.125))]
    for e in eyes:
        T.set_material(e, M['eye'])
    fangs = []
    for s, x in (('L', 0.13), ('R', -0.13)):
        f = T.cone('Fang.' + s, 0.025, 0.0, 0.06, segs=4, loc=(x, -0.36, 1.35), rot=Euler((math.pi, 0, 0)).to_matrix())
        T.set_material(f, M['tooth'])
        fangs.append(f)
    head = T.join([hair, face, bang] + ears + eyes + fangs, 'Head')
    attach(head, arm, 'head')
    parts.append(head)

    # ---------------- torso fur -------------------------------------------
    import bmesh
    bm = bmesh.new()
    rings = [(1.30, 0.17, 0.13), (1.14, 0.22, 0.155), (0.92, 0.235, 0.165), (0.76, 0.225, 0.155)]
    segs = 10
    vrings = []
    for z, rx, ry in rings:
        ring = []
        for i in range(segs):
            a = i / segs * math.tau
            ring.append(bm.verts.new((math.cos(a) * rx, math.sin(a) * ry + 0.02, z)))
        vrings.append(ring)
    for r0, r1 in zip(vrings, vrings[1:]):
        for i in range(segs):
            bm.faces.new((r0[i], r0[(i + 1) % segs], r1[(i + 1) % segs], r1[i]))
    bm.faces.new(vrings[0][::-1])
    # jagged hem: alternating spikes below the last ring
    last = vrings[-1]
    for i in range(segs):
        a = (i + 0.5) / segs * math.tau
        tip = bm.verts.new((math.cos(a) * 0.24, math.sin(a) * 0.165 + 0.02, 0.76 - rnd.uniform(0.06, 0.11)))
        bm.faces.new((last[(i + 1) % segs], last[i], tip))
    for v in bm.verts:
        v.co += Vector((rnd.uniform(-1, 1) * 0.012, rnd.uniform(-1, 1) * 0.012, 0))
    torso = T.bm_to_obj('Torso', bm)
    # fur shards on the surface
    shards = []
    for i in range(34):
        a = rnd.random() * math.tau
        z = rnd.uniform(0.80, 1.24)
        rr = 0.235 if z < 1.07 else 0.2
        p = Vector((math.cos(a) * rr, math.sin(a) * rr * 0.72 + 0.02, z))
        n = Vector((math.cos(a), math.sin(a) * 0.9, 0)).normalized()
        sh = T.cone('shard%d' % i, 0.065, 0.0, rnd.uniform(0.07, 0.12), segs=3)
        sh.rotation_mode = 'QUATERNION'
        sh.rotation_quaternion = Vector((0, 0, 1)).rotation_difference((n * 0.22 + Vector((0, 0, -1))).normalized())
        sh.location = p
        shards.append(sh)
    for s in shards:
        T.apply_transforms(s)
    torso = T.join([torso] + shards, 'Torso')
    T.face_color_variation(torso, 0.18, seed + 11, hue_jitter=0.06)
    T.set_material(torso, M['furV'])
    attach(torso, arm, 'chest')
    parts.append(torso)

    # ---------------- limbs ------------------------------------------------
    for s, f in (('L', lambda p: p), ('R', mirror)):
        ua = T.limb('UpperArm.' + s, f(J['shL']), f(J['elL']), 0.034, 0.03)
        fa = T.limb('ForeArm.' + s, f(J['elL']), f(J['wrL']), 0.03, 0.027)
        hp = Vector(f(J['wrL'])) + Vector((0, -0.01, -0.06))
        hand = T.ico('Hand.' + s, 1.0, subdiv=1, scale=(0.045, 0.055, 0.07), loc=hp)
        thumb = T.ico('Thumb.' + s, 1.0, subdiv=1, scale=(0.022, 0.022, 0.035), loc=hp + Vector((0, -0.045, 0.02)))
        th = T.limb('Thigh.' + s, f(J['hipL']), f(J['knL']), 0.038, 0.033)
        sn = T.limb('Shin.' + s, f(J['knL']), f(J['anL']), 0.033, 0.03)
        ap = Vector(f(J['anL']))
        foot = T.ico('Foot.' + s, 1.0, subdiv=1, scale=(0.065, 0.13, 0.045), loc=ap + Vector((0, -0.07, -0.025)))
        for o in (ua, fa, th, sn):
            T.set_material(o, M['hair'])
        for o in (hand, thumb, foot):
            T.set_material(o, M['skin'])
        attach(ua, arm, 'upperArm.' + s)
        attach(fa, arm, 'foreArm.' + s)
        attach(hand, arm, 'foreArm.' + s)
        attach(thumb, arm, 'foreArm.' + s)
        attach(th, arm, 'thigh.' + s)
        attach(sn, arm, 'shin.' + s)
        attach(foot, arm, 'shin.' + s)
        parts += [ua, fa, hand, thumb, th, sn, foot]

    # ---------------- backpack --------------------------------------------
    if with_backpack:
        bp = T.box('Pack', (0.30, 0.15, 0.30), loc=(0, 0.25, 1.08), bevel=0.02)
        T.set_material(bp, M['pack'])
        flap = T.box('PackFlap', (0.31, 0.16, 0.10), loc=(0, 0.245, 1.19), bevel=0.015)
        T.set_material(flap, M['packDark'])
        panel = T.box('PackPanel', (0.28, 0.02, 0.10), loc=(0, 0.33, 0.99))
        T.set_material(panel, M['packPanel'])
        straps = []
        for x in (-0.08, 0.08):
            st = T.box('Strap', (0.035, 0.02, 0.24), loc=(x, 0.33, 1.12))
            T.set_material(st, M['strap'])
            bk = T.box('Buckle', (0.045, 0.025, 0.03), loc=(x, 0.335, 1.02))
            T.set_material(bk, M['buckle'])
            straps += [st, bk]
        pack = T.join([bp, flap, panel] + straps, 'Backpack')
        attach(pack, arm, 'chest')
        parts.append(pack)
    return arm, parts


if __name__ == '__main__' or True:
    rig, PARTS = build(with_backpack=True)
    print('built', len(PARTS), 'parts')
