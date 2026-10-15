"""
Shared helpers for building flat-shaded low-poly models and rendering them as
sprites that line up with the game's fixed camera.

Run inside Blender (via the Blender MCP or `blender -b -P script.py`).

IMPORTANT: PITCH_DEG and PPM must match `camera.pitchDeg` and `world.pixelsPerMeter`
(camera.pitchDeg / render.spritePPM) in src/game/config/tuning.ts. If you change either, re-render every sprite.
"""
import bpy, bmesh, math, random, json, os
from mathutils import Vector, Matrix

# ---- must match src/game/config/tuning.ts ---------------------------------
PITCH_DEG = 52.0          # camera pitch above the horizon (measured: ground foreshortening 0.79)
PPM = 200.0               # rendered pixels per world metre (= render.spritePPM)
LIGHT_DIR = Vector((0.45, -0.35, 0.82)).normalized()   # x=east, y=north, z=up
SHADE = 0.22              # how much darker a face pointing away from the light gets
# ---------------------------------------------------------------------------

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')) if '__file__' in globals() else \
    '/Users/liamliam/Documents/sneaky sasquatch/sneaky-sasquatch'


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def hex_lin(h, a=1.0):
    r, g, b = hex_rgb(h)
    return (srgb_to_lin(r), srgb_to_lin(g), srgb_to_lin(b), a)


# ---------------------------------------------------------------- scene ----
def reset_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures, bpy.data.actions,
                 bpy.data.cameras, bpy.data.lights, bpy.data.curves):
        for d in list(coll):
            if d.users == 0:
                coll.remove(d)


def setup_render(w=256, h=256, samples=16):
    sc = bpy.context.scene
    try:
        sc.render.engine = 'BLENDER_EEVEE'
    except TypeError as e:
        print('engine', e)
    sc.render.resolution_x = w
    sc.render.resolution_y = h
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = True
    sc.render.filter_size = 0.9
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    try:
        sc.eevee.taa_render_samples = samples
    except Exception:
        pass
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    sc.view_settings.exposure = 0
    sc.view_settings.gamma = 1
    sc.display_settings.display_device = 'sRGB'
    w_ = sc.world or bpy.data.worlds.new('World')
    sc.world = w_
    w_.use_nodes = True
    bg = next(n for n in w_.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs[0].default_value = (0, 0, 0, 1)
    bg.inputs[1].default_value = 0.0


# ------------------------------------------------------------- material ----
def toon_material(name, hex_color, shade=SHADE, vcol=False, emit_boost=1.0):
    """Unlit material: base colour x (1-shade .. 1) depending on N.L with a fixed light.
    With vcol=True the per-face colour attribute 'Col' multiplies the base colour."""
    m = bpy.data.materials.get(name)
    if m:
        bpy.data.materials.remove(m)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    emit = nt.nodes.new('ShaderNodeEmission')
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    dot = nt.nodes.new('ShaderNodeVectorMath'); dot.operation = 'DOT_PRODUCT'
    dot.inputs[1].default_value = tuple(LIGHT_DIR)
    clamp = nt.nodes.new('ShaderNodeClamp')
    lerp = nt.nodes.new('ShaderNodeMapRange')
    lerp.inputs['From Min'].default_value = 0.0
    lerp.inputs['From Max'].default_value = 1.0
    lerp.inputs['To Min'].default_value = 1.0 - shade
    lerp.inputs['To Max'].default_value = 1.0
    mul = nt.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'
    mul.inputs['Factor'].default_value = 1.0
    base = hex_lin(hex_color)
    nt.links.new(geo.outputs['Normal'], dot.inputs[0])
    nt.links.new(dot.outputs['Value'], clamp.inputs['Value'])
    nt.links.new(clamp.outputs['Result'], lerp.inputs['Value'])
    col_socket_A = mul.inputs[6]  # A colour
    col_socket_B = mul.inputs[7]  # B colour
    if vcol:
        attr = nt.nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'Col'
        tint = nt.nodes.new('ShaderNodeMix'); tint.data_type = 'RGBA'; tint.blend_type = 'MULTIPLY'
        tint.inputs['Factor'].default_value = 1.0
        tint.inputs[6].default_value = base
        nt.links.new(attr.outputs['Color'], tint.inputs[7])
        nt.links.new(tint.outputs[2], col_socket_A)
    else:
        col_socket_A.default_value = base
    comb = nt.nodes.new('ShaderNodeCombineColor')
    for i in range(3):
        nt.links.new(lerp.outputs['Result'], comb.inputs[i])
    nt.links.new(comb.outputs['Color'], col_socket_B)
    nt.links.new(mul.outputs[2], emit.inputs['Color'])
    emit.inputs['Strength'].default_value = emit_boost
    nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])
    return m


def set_material(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def flat(obj):
    for p in obj.data.polygons:
        p.use_smooth = False


def face_color_variation(obj, variance=0.12, seed=1, hue_jitter=0.0):
    """Give each face a slightly different brightness (multiplies base colour)."""
    rnd = random.Random(seed)
    me = obj.data
    if 'Col' in me.color_attributes:
        me.color_attributes.remove(me.color_attributes['Col'])
    attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    for poly in me.polygons:
        v = 1.0 - variance + rnd.random() * variance * 2
        r = v * (1 + (rnd.random() - 0.5) * hue_jitter)
        for li in poly.loop_indices:
            attr.data[li].color = (r, v, v, 1)
    me.color_attributes.active_color = attr


# --------------------------------------------------------------- meshes ----
def new_obj(name, me, coll=None):
    o = bpy.data.objects.new(name, me)
    (coll or bpy.context.scene.collection).objects.link(o)
    return o


def bm_to_obj(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = new_obj(name, me)
    flat(o)
    return o


def ico(name, radius=1.0, subdiv=2, scale=(1, 1, 1), loc=(0, 0, 0), jag=0.0, seed=0, jag_mode='radial'):
    rnd = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    if jag:
        for v in bm.verts:
            d = v.co.normalized()
            v.co += d * (rnd.random() - 0.35) * jag * radius
    for v in bm.verts:
        v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2])) + Vector(loc)
    return bm_to_obj(name, bm)


def cone(name, r1, r2, depth, segs=8, loc=(0, 0, 0), rot=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r1, radius2=r2, depth=depth)
    for v in bm.verts:
        v.co.z += depth / 2
    if rot:
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=rot)
    for v in bm.verts:
        v.co += Vector(loc)
    return bm_to_obj(name, bm)


def box(name, size, loc=(0, 0, 0), bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2])) + Vector(loc)
    if bevel:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=1, affect='EDGES')
    return bm_to_obj(name, bm)


def limb(name, p0, p1, r0, r1=None, segs=6):
    """Tapered cylinder from p0 to p1 (object origin at p0, local +Z along limb)."""
    r1 = r0 if r1 is None else r1
    p0, p1 = Vector(p0), Vector(p1)
    L = (p1 - p0).length
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r0, radius2=r1, depth=L)
    for v in bm.verts:
        v.co.z += L / 2
    o = bm_to_obj(name, bm)
    d = (p1 - p0).normalized()
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    o.location = p0
    return o


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    return o


def apply_transforms(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


# --------------------------------------------------------------- camera ----
def cam_basis(pitch_deg=PITCH_DEG):
    p = math.radians(pitch_deg)
    fwd = Vector((0, math.cos(p), -math.sin(p)))        # looks north and down
    up = Vector((0, math.sin(p), math.cos(p)))
    right = Vector((1, 0, 0))
    return fwd, up, right


def ensure_camera(name='SpriteCam'):
    cam = bpy.data.objects.get(name)
    if not cam:
        cd = bpy.data.cameras.new(name)
        cam = bpy.data.objects.new(name, cd)
        bpy.context.scene.collection.objects.link(cam)
    cam.data.type = 'ORTHO'
    cam.data.clip_start = 0.1
    cam.data.clip_end = 500
    cam.rotation_mode = 'XYZ'
    cam.rotation_euler = (math.radians(90 - PITCH_DEG), 0, 0)
    bpy.context.scene.camera = cam
    return cam


def project(co, pitch_deg=PITCH_DEG):
    """World point -> (right, up) metres in camera plane (origin at world origin)."""
    _, up, right = cam_basis(pitch_deg)
    return co.dot(right), co.dot(up)


def aim_camera(cam, w, h, anchor_px, ppm=PPM):
    """Place the ortho camera so world origin lands on pixel anchor_px (x right, y down)."""
    fwd, up, right = cam_basis()
    scale_m = max(w, h) / ppm
    cam.data.ortho_scale = scale_m
    ax, ay = anchor_px
    # pixel offset of origin from image centre, in metres
    dx = (ax - w / 2) / ppm
    dy = (h / 2 - ay) / ppm
    center = Vector((0, 0, 0)) - right * dx - up * dy
    cam.location = center - fwd * 100


def world_verts(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in objs:
        if o.type != 'MESH':
            continue
        oe = o.evaluated_get(dg)
        me = oe.to_mesh()
        mw = oe.matrix_world
        pts += [mw @ v.co for v in me.vertices]
        oe.to_mesh_clear()
    return pts


def fit_sprite(objs, pad=4, ppm=PPM):
    """Return (w, h, anchor_px) that tightly fits objs when rendered."""
    pts = world_verts(objs)
    rs = [project(p)[0] for p in pts]
    us = [project(p)[1] for p in pts]
    minr, maxr, minu, maxu = min(rs), max(rs), min(us), max(us)
    w = int(math.ceil((maxr - minr) * ppm)) + pad * 2
    h = int(math.ceil((maxu - minu) * ppm)) + pad * 2
    w += w % 2; h += h % 2
    ax = pad + (-minr) * ppm
    ay = pad + maxu * ppm
    return w, h, (ax, ay)


def render_to(path, w, h, anchor_px, ppm=PPM):
    cam = ensure_camera()
    setup_render(w, h)
    aim_camera(cam, w, h, anchor_px, ppm)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def render_prop(objs, path, pad=4, meta=None, ppm=PPM):
    """Render objs (only these visible) tightly; write a .json next to the png with the anchor."""
    allm = [o for o in bpy.context.scene.objects if o.type in ('MESH', 'CURVE')]
    hidden = {}
    for o in allm:
        hidden[o.name] = o.hide_render
        o.hide_render = o not in objs
    w, h, anchor = fit_sprite(objs, pad, ppm)
    render_to(path, w, h, anchor, ppm)
    for o in allm:
        o.hide_render = hidden[o.name]
    info = {'w': w, 'h': h, 'anchorX': round(anchor[0], 2), 'anchorY': round(anchor[1], 2), 'ppm': ppm,
            'pitch': PITCH_DEG}
    if meta:
        info.update(meta)
    with open(path.replace('.png', '.json'), 'w') as f:
        json.dump(info, f, indent=1)
    return info
