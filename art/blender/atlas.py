"""
Render a rigged character in 9 directions x N animation frames and pack the
results into a trimmed Phaser multi-atlas:

    public/assets/sprites/chars/<key>.png  (+ <key>_1.png ... if it overflows)
    public/assets/sprites/chars/<key>.json (Phaser "textures" multiatlas format,
                                            plus meta.sas with anchor + anim info)

Frame names: `${anim}_${dir}_${frame}`, dir 0 = facing camera (south), going
counter-clockwise to dir 8 = facing away (north). The game mirrors 9..15.
"""
import bpy, math, os, json
import numpy as np
import lib_toon as T

CHARS = os.path.join(T.ROOT, 'public', 'assets', 'sprites', 'chars')


def _load_rgba(path):
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    arr = px.reshape(h, w, 4)[::-1]  # top-down
    return arr


def _save_rgba(arr, path):
    h, w, _ = arr.shape
    img = bpy.data.images.new('atlas_tmp', w, h, alpha=True)
    img.alpha_mode = 'STRAIGHT'
    img.pixels.foreach_set(arr[::-1].astype(np.float32).ravel())
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


def render_atlas(key, rig, anims, cell=(320, 400), anchor=(160, 318), pose_fn=None, tmp=None, max_w=4096, dirs=9, ppm=T.PPM):
    """
    anims: dict name -> {'frames': n, 'fps': f}
    pose_fn(rig, anim, frame_index, n_frames) sets the pose for that frame.
    """
    tmp = tmp or os.path.join('/tmp', 'sas_atlas_' + key)
    os.makedirs(tmp, exist_ok=True)
    os.makedirs(CHARS, exist_ok=True)
    cw, ch = cell
    frames = []  # (name, path)
    for d in range(dirs):
        rig.rotation_euler = (0, 0, math.radians(d * 22.5))
        for anim, info in anims.items():
            for fi in range(info['frames']):
                pose_fn(rig, anim, fi, info['frames'])
                bpy.context.view_layer.update()
                path = os.path.join(tmp, f'{anim}_{d}_{fi}.png')
                T.render_to(path, cw, ch, anchor, ppm)
                frames.append((f'{anim}_{d}_{fi}', path))
    rig.rotation_euler = (0, 0, 0)

    # trim
    trimmed = []
    for name, path in frames:
        a = _load_rgba(path)
        alpha = a[:, :, 3]
        ys, xs = np.nonzero(alpha > 0.004)
        if len(xs) == 0:
            x0 = y0 = 0; x1 = y1 = 1
        else:
            x0, x1 = xs.min(), xs.max() + 1
            y0, y1 = ys.min(), ys.max() + 1
        trimmed.append((name, a[y0:y1, x0:x1], int(x0), int(y0)))

    # shelf pack (tallest first), new page when height exceeds max_w
    order = sorted(trimmed, key=lambda t: -t[1].shape[0])
    pages = [[]]
    x = y = shelf_h = 0
    pad = 2
    placements = {}
    for name, img, ox, oy in order:
        h, w = img.shape[:2]
        if x + w + pad > max_w:
            x = 0
            y += shelf_h + pad
            shelf_h = 0
        if y + h + pad > max_w:
            pages.append([])
            x = y = shelf_h = 0
        placements[name] = (len(pages) - 1, x, y, w, h, ox, oy, img)
        pages[-1].append(name)
        x += w + pad
        shelf_h = max(shelf_h, h)

    textures = []
    for pi, names in enumerate(pages):
        pw = max(placements[n][1] + placements[n][3] for n in names)
        ph = max(placements[n][2] + placements[n][4] for n in names)
        canvas = np.zeros((ph, pw, 4), dtype=np.float32)
        fr = []
        for n in names:
            _, px, py, w, h, ox, oy, img = placements[n]
            canvas[py:py + h, px:px + w] = img
            fr.append({
                'filename': n,
                'rotated': False,
                'trimmed': True,
                'sourceSize': {'w': cw, 'h': ch},
                'spriteSourceSize': {'x': ox, 'y': oy, 'w': w, 'h': h},
                'frame': {'x': px, 'y': py, 'w': w, 'h': h},
            })
        fname = f'{key}.png' if pi == 0 else f'{key}_{pi}.png'
        _save_rgba(canvas, os.path.join(CHARS, fname))
        textures.append({'image': fname, 'format': 'RGBA8888', 'size': {'w': pw, 'h': ph}, 'scale': 1, 'frames': fr})

    meta = {
        'app': 'sneaky-sasquatch art/blender/atlas.py',
        'sas': {
            'anchorX': anchor[0], 'anchorY': anchor[1], 'cellW': cw, 'cellH': ch, 'ppm': ppm,
            'anims': {k: {'frames': v['frames'], 'fps': v.get('fps', 10), 'dirs': dirs} for k, v in anims.items()},
        },
    }
    with open(os.path.join(CHARS, key + '.json'), 'w') as f:
        json.dump({'textures': textures, 'meta': meta}, f)
    print('atlas', key, 'pages', len(pages), 'frames', len(frames))
