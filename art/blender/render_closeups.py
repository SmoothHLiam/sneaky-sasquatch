"""
Front-view renders of the sasquatch for the EATING close-up (head + torso, no
arms -- the arms are drawn as 2D IK limbs in the game so they can reach food).

    Blender -b --factory-startup -P art/blender/render_closeups.py

Writes public/assets/closeup/eat_body_closed.png, eat_body_open.png (+ .json with
the pixel positions of the mouth, shoulders and head top, used by the CloseUp scene).

The original close-up is flat vector art, so the body is built from flat
coloured polygons (see eat_body_2d.py) rather than the 3D model, and rendered
unlit with an orthographic camera.
Reference: your research/frames/tutorial/sheet_eating_closeup_sequence.png,
           t104.0_eat_closeup_ketchup_meter_filling.jpg, t096.4_eat_closeup_dump_backpack.jpg
"""
import bpy, sys, os, json

ART = '/Users/liamliam/Documents/sneaky sasquatch/sneaky-sasquatch/art/blender'
if ART not in sys.path:
    sys.path.append(ART)
import importlib
import lib_toon as T
import eat_body_2d as E
importlib.reload(T)
importlib.reload(E)

OUT = os.environ.get('EAT_OUT') or os.path.join(T.ROOT, 'public', 'assets', 'closeup')
os.makedirs(OUT, exist_ok=True)

T.reset_scene()
scene = bpy.context.scene
closed, opened = E.build(scene)
E.camera(scene)
T.setup_render(E.PNG_W, E.PNG_H, samples=16)
scene.render.dither_intensity = 0.0          # flat colours: no noise, small PNGs
scene.render.image_settings.compression = 90

for name, show in (('eat_body_closed.png', closed), ('eat_body_open.png', opened)):
    closed.hide_render = show is not closed
    opened.hide_render = show is not opened
    scene.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)

meta = E.meta()
with open(os.path.join(OUT, 'eat_body.json'), 'w') as f:
    json.dump(meta, f, indent=1)
print('closeups done', meta)
