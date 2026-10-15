"""
Poses + renders the Sasquatch atlas.

    Blender -b --factory-startup -P art/blender/render_sasquatch.py -- [--pack red|blue|green] [--key sasquatch]
                                      [--anims idle,drive] [--out <dir>]   (testing: subset / other output dir)

Bone conventions (verified): +X rotation swings thighs/upper arms BACKWARD and
flexes knees; elbows flex with -X. Chest +X leans the torso forward.
Animations (reference: your research/frames/tutorial/crop_run_cycle_30fps.png,
crop_tiptoe_cycle_30fps.png):
  idle   4 frames  gentle breathing
  walk   8 frames  the original's default "run": forward lean, long strides, bent pumping arms
  sneak  8 frames  crouched tiptoe, knees out, arms raised in front of the chest
  lying  1 frame   knocked down after a ranger tackle
  drive  2 frames  seated in the go-kart, hands on the wheel (outside-park o16 / o29)
  get    2 frames  item get (tutorial cut033.4, bonus-park cutscene 30.4-34.3 s): upright, one arm raised
                   forward with the open palm at about eye height, the other arm relaxed; frame 1 is a
                   slight breath (the raised hand stays put). The raised arm is the LEFT one (+X), so in the
                   game's mirrored west half (south-west = dir 14 = mirror of dir 2) it reads as his right
                   arm on screen-left, like the original. The chin-up / turn toward the hand fades out in
                   the facing-away dirs (else his eyes show over the hair). meta.sas.get.hand[dir] = palm
                   centre (m from the ground anchor, x east / y north / z up) per rendered dir; mirrored
                   dirs 9..15 use hand[16 - k] with x negated.

The drive frames use a different anchor point: the atlas anchor (280, 352) is the SEAT
point (top of the kart's seat cushion) instead of the feet, the whole body is scaled by
DRIVE_SCALE (the original draws the seated sasquatch smaller: hair ~0.57 x kart width),
and the kart (vehicles.build_kart, identical to the `kart` atlas) is in the scene as a
holdout, so whatever the kart covers is cut out of the sprite. Draw the drive sprite
directly ABOVE the kart sprite (depth = kart depth + epsilon) at
    x = kart.x - cos(facing) * SEAT_BACK,  y = kart.y - sin(facing) * SEAT_BACK,  z = SEAT_Z
(SEAT_BACK / SEAT_Z = vehicles.KART seat_s / seat_z, also in kart.json meta.sas.seat).
"""
import bpy, math, sys, os

ART = '/Users/liamliam/Documents/sneaky sasquatch/sneaky-sasquatch/art/blender'
if ART not in sys.path:
    sys.path.append(ART)
import importlib
import lib_toon as T
importlib.reload(T)
import atlas as A
importlib.reload(A)

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
# modes:
#   (default)          sasquatch body WITHOUT backpack            -> sprites/chars/sasquatch
#   --pack <colour>    backpack only, body as holdout (occludes) -> sprites/chars/pack_<colour>
PACK = argv[argv.index('--pack') + 1] if '--pack' in argv else None
KEY = argv[argv.index('--key') + 1] if '--key' in argv else ('pack_' + PACK if PACK else 'sasquatch')
ONLY = argv[argv.index('--anims') + 1].split(',') if '--anims' in argv else None
if '--out' in argv:
    A.CHARS = argv[argv.index('--out') + 1]

exec(open(os.path.join(ART, 'sasquatch.py')).read().replace("if __name__ == '__main__' or True:", 'if False:'))
rig, PARTS = build(with_backpack=bool(PACK), pack_color=PACK or 'red')
if PACK:
    # everything except the backpack becomes a holdout: it cuts the pack where the body covers it
    for o in PARTS:
        if o.name != 'Backpack':
            o.is_holdout = True

# ---- go-kart holdout for the drive frames ---------------------------------------------
import vehicles as V
importlib.reload(V)
V.PARTS.clear()
V.build_kart()
KART_PARTS = [o for o in V.PARTS if o.type == 'MESH']
SEAT_BACK = -V.KART['seat_s']      # seat point is this far behind the kart centre (m)
SEAT_Z = V.KART['seat_z']          # ... and this high above the ground (m)
DRIVE_SCALE = 0.86
SEAT_REST = (0.0, 0.03, 0.64)      # point of the (unscaled, rest) body that sits on the seat
for o in KART_PARTS:
    # move the kart so its seat point is the world origin (= the drive frames' anchor)
    o.location = (0.0, -SEAT_BACK, -SEAT_Z)
    o.is_holdout = True
    o.hide_render = True
    o.parent = rig
bpy.context.view_layer.update()

# ---- item-get pose (armature space = model space: faces -Y, left side +X) ----------------
GET_UPPER = (0.66, -0.60, 0.12)    # raised LEFT upper arm: out + forward, a little up
GET_FORE = (0.36, -0.36, 0.86)     # ... forearm bent up so the open hand points up (palm at eye height)
GET_CHEST = -2.0                   # deg, slight back lean (standing tall; idle is +2)
GET_TWIST = 5.0                    # deg, chest turns toward the raised arm (+ = toward +X)
GET_HEAD = -12.0                   # deg, chin up toward the item
GET_HEAD_TWIST = 12.0              # deg, head turns further toward the raised hand / item

R = math.radians
from mathutils import Vector, Matrix


def _point_bone(rig, name, target):
    """rotate pose bone `name` (minimal rotation) so its tail points at target (armature space)"""
    pb = rig.pose.bones[name]
    M = pb.matrix.copy()
    head = M.translation.copy()
    ycur = M.col[1].xyz.normalized()
    rot = ycur.rotation_difference((target - head).normalized()).to_matrix()
    pb.matrix = Matrix.Translation(head) @ (rot @ M.to_3x3()).to_4x4()
    bpy.context.view_layer.update()


def aim_arm(rig, side, wrist, pole):
    """two-bone IK: put the wrist (foreArm tail) at `wrist`, elbow bent toward `pole`"""
    up, fo = rig.pose.bones['upperArm.' + side], rig.pose.bones['foreArm.' + side]
    S = up.head.copy()
    a = (up.tail - up.head).length
    b = (fo.tail - fo.head).length
    d = min((wrist - S).length, (a + b) * 0.999)
    u = (wrist - S).normalized()
    v = (pole - u * pole.dot(u)).normalized()
    ca = max(-1.0, min(1.0, (a * a + d * d - b * b) / (2 * a * d)))
    alpha = math.acos(ca)
    E = S + a * (math.cos(alpha) * u + math.sin(alpha) * v)
    _point_bone(rig, 'upperArm.' + side, E)
    _point_bone(rig, 'foreArm.' + side, S + u * d)


def reset(rig):
    for b in rig.pose.bones:
        b.rotation_mode = 'XYZ'
        b.rotation_euler = (0, 0, 0)
        b.location = (0, 0, 0)
        b.scale = (1, 1, 1)


def pose(rig, anim, fi, n):
    reset(rig)
    pb = rig.pose.bones
    ph = fi / n
    s = math.sin(ph * math.tau)
    c = math.cos(ph * math.tau)
    if anim == 'idle':
        pb['chest'].rotation_euler.x = R(2 + 1.5 * s)
        pb['head'].rotation_euler.x = R(-1.5 * s)
        pb['root'].location.z = 0.0
        for side, sg in (('L', 1), ('R', -1)):
            pb['upperArm.' + side].rotation_euler.y = R(sg * (4 + 1.5 * s))
            pb['foreArm.' + side].rotation_euler.x = R(-8)
    elif anim == 'walk':
        # run: lean, big strides, knees kick back, arms bent and pumping
        pb['chest'].rotation_euler.x = R(14)
        pb['head'].rotation_euler.x = R(-10)
        pb['root'].location.y = 0.0
        # root bone points +Y: its local Y is world Y, local Z is world -Z? use location on hips instead
        pb['hips'].location.y = 0.05 * abs(c)          # local Y of hips = world Z (bone points up)
        for side, sg in (('L', 1), ('R', -1)):
            sw = sg * s
            pb['thigh.' + side].rotation_euler.x = R(-38 * sw - 4)
            # knee flexes most while the leg swings back/through
            knee = 20 + 70 * max(0.0, math.sin(ph * math.tau * 1 + (0 if sg > 0 else math.pi) + math.pi * 0.35))
            pb['shin.' + side].rotation_euler.x = R(knee)
            pb['upperArm.' + side].rotation_euler.x = R(34 * sw)
            pb['upperArm.' + side].rotation_euler.y = R(sg * 8)
            pb['foreArm.' + side].rotation_euler.x = R(-75)
    elif anim == 'sneak':
        bob = abs(s)
        pb['hips'].location.y = -0.13 + 0.03 * bob
        pb['chest'].rotation_euler.x = R(20)
        pb['head'].rotation_euler.x = R(-14)
        for side, sg in (('L', 1), ('R', -1)):
            sw = sg * s
            pb['thigh.' + side].rotation_euler.x = R(-28 - 16 * sw)
            pb['thigh.' + side].rotation_euler.z = R(-sg * 12)
            pb['shin.' + side].rotation_euler.x = R(48 + 22 * max(0.0, sw))
            pb['upperArm.' + side].rotation_euler.x = R(-62 + 8 * sw)
            pb['upperArm.' + side].rotation_euler.y = R(sg * 14)
            pb['foreArm.' + side].rotation_euler.x = R(-70)
    elif anim == 'lying':
        # curled up on his side after a tackle: body rotated onto its side
        # (+90° about Y puts the head toward +X), knees pulled up, arms tucked
        pb['root'].rotation_euler.y = R(90)
        pb['root'].location.x = -1.0
        pb['chest'].rotation_euler.x = R(25)
        pb['head'].rotation_euler.x = R(10)
        for side, sg in (('L', 1), ('R', -1)):
            pb['thigh.' + side].rotation_euler.x = R(-85)
            pb['shin.' + side].rotation_euler.x = R(110)
            pb['upperArm.' + side].rotation_euler.x = R(-60)
            pb['foreArm.' + side].rotation_euler.x = R(-95)
    elif anim == 'drive':
        # seated in the kart: thighs forward, shins angled down to the pedals, hands on the wheel;
        # the root bone scales the body about the rig origin and shifts the seat point onto it
        bob = 1.0 if fi % 2 else 0.0
        pb['root'].scale = (DRIVE_SCALE,) * 3
        pb['root'].location = tuple(-DRIVE_SCALE * c for c in SEAT_REST)
        pb['chest'].rotation_euler.x = R(2 + 2.5 * bob)
        pb['head'].rotation_euler.x = R(-12 - 2.5 * bob)
        for side, sg in (('L', 1), ('R', -1)):
            pb['thigh.' + side].rotation_euler.x = R(-84)
            pb['thigh.' + side].rotation_euler.z = R(-sg * 8)
            pb['shin.' + side].rotation_euler.x = R(30)
        # hands on the steering-wheel rim: two-bone IK solved in armature space
        bpy.context.view_layer.update()
        for side, sg in (('L', 1), ('R', -1)):
            grab = Vector((sg * 0.13, -V.KART['wheel_s'] - SEAT_BACK + 0.05, V.KART['wheel_z'] - SEAT_Z + 0.08))
            aim_arm(rig, side, grab, Vector((sg * 1.0, 0.3, -0.25)))
    elif anim == 'get':
        # item get: standing tall, head up and turned toward the item; LEFT upper arm out/forward, elbow
        # bent so the forearm and open hand point up; right arm hanging relaxed. The wrist point is
        # taken from the frame-0 pose, so the hand stays put while frame 1 breathes.
        # cheat to camera: the chin-up and the turn toward the hand only while the face is toward the camera;
        # facing away (dirs 6-8) they would show his eyes over the top of the hair, so they fade to the idle
        # carriage between dir 3 and dir 6 (rig z rotation = facing, 0 = south / camera)
        w = max(0.0, min(1.0, (135.0 - math.degrees(rig.rotation_euler.z) % 360) / 67.5))
        chest_x = 2.0 + (GET_CHEST - 2.0) * w
        head_x = GET_HEAD * w
        pb['chest'].rotation_euler.x = R(chest_x)
        pb['chest'].rotation_euler.y = R(GET_TWIST * w)
        pb['head'].rotation_euler.x = R(head_x)
        pb['head'].rotation_euler.y = R(GET_HEAD_TWIST * w)
        pb['upperArm.R'].rotation_euler.y = R(-5)
        pb['foreArm.R'].rotation_euler.x = R(-10)
        bpy.context.view_layer.update()
        up, fo = pb['upperArm.L'], pb['foreArm.L']
        u1, u2 = Vector(GET_UPPER).normalized(), Vector(GET_FORE).normalized()
        wrist = up.head + u1 * (up.tail - up.head).length + u2 * (fo.tail - fo.head).length
        if fi % 2:
            pb['chest'].rotation_euler.x = R(chest_x + 1.5)
            pb['head'].rotation_euler.x = R(head_x - 1.5)
            bpy.context.view_layer.update()
        aim_arm(rig, 'L', wrist, u1)

if __name__ == '__main__':
    # lying needs the body lifted so it rests on the ground: shift the root up by the torso half-depth
    def pose_with_ground(rig, anim, fi, n):
        pose(rig, anim, fi, n)
        for o in KART_PARTS:
            o.hide_render = anim != 'drive'
        if anim == 'lying':
            rig.pose.bones['root'].location = (0, 0, 0)
            rig.location = (0, 0, 0.3)
        else:
            rig.location = (0, 0, 0)

    anims = {'idle': {'frames': 4, 'fps': 2}, 'walk': {'frames': 8, 'fps': 12}, 'sneak': {'frames': 8, 'fps': 8},
             'lying': {'frames': 1, 'fps': 1}, 'drive': {'frames': 2, 'fps': 3}, 'get': {'frames': 2, 'fps': 2}}
    if ONLY:
        anims = {k: v for k, v in anims.items() if k in ONLY}
    A.render_atlas(KEY, rig, anims, cell=(560, 440), anchor=(280, 352), pose_fn=pose_with_ground)
    # document the drive-frame seat convention in the atlas meta (the game reads meta.sas)
    import json
    jp = os.path.join(A.CHARS, KEY + '.json')
    j = json.load(open(jp))
    if 'drive' in anims:
        j['meta']['sas']['drive'] = {
            'anchor': 'seat', 'seatBack': round(SEAT_BACK, 3), 'seatZ': round(SEAT_Z, 3), 'scale': DRIVE_SCALE,
            'note': 'drive frames are anchored at the kart seat point; draw at kart pos - heading*seatBack, '
                    'z=seatZ, depth just above the kart (kart parts are already cut out)',
        }
    if 'get' in anims:
        # palm centre of the raised hand per rendered direction (identical in both frames)
        hand_obj = next(o for o in PARTS if o.name.startswith('Hand.L'))
        hands = {}
        for d in range(9):
            rig.rotation_euler = (0, 0, math.radians(d * 22.5))
            pose_with_ground(rig, 'get', 0, anims['get']['frames'])
            bpy.context.view_layer.update()
            pts = T.world_verts([hand_obj])
            c = sum(pts, Vector()) / len(pts)
            hands[str(d)] = [round(c.x, 3), round(c.y, 3), round(c.z, 3)]
        rig.rotation_euler = (0, 0, 0)
        j['meta']['sas']['get'] = {
            'hand': hands,
            'note': 'hand[dir] = palm centre of the raised hand in metres from the ground anchor (x east, y north, '
                    'z up) for rendered dirs 0..8; mirrored dirs k=9..15 use hand[16-k] with x negated. '
                    'Same in both frames (frame 1 is a slight breath).',
        }
    if 'drive' in anims or 'get' in anims:
        with open(jp, 'w') as f:
            json.dump(j, f)
