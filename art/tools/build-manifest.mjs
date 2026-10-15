#!/usr/bin/env node
/**
 * Scans public/assets and writes public/assets/manifest.json.
 *
 *   sprites/props/<key>.png + <key>.json   → manifest.sprites[key]   (anchor/ppm from the json)
 *   sprites/chars/<key>.png + <key>.json   → manifest.atlases[key]   (Phaser JSON-hash + meta.sas)
 *   ui/<key>.svg                            → manifest.svgs[key]      (rasterised at 256 px)
 *   images/<key>.png|jpg                    → manifest.images[key]
 *   audio/<key>.wav|mp3|ogg                 → manifest.audio[key]
 *
 * Usage:  node art/tools/build-manifest.mjs
 * Swapping art = replace the png (and its json if the anchor changed), re-run this.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const assets = path.join(root, 'public/assets');
const rel = (p) => path.relative(assets, p).split(path.sep).join('/');
const list = (dir, exts) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => exts.some((e) => f.toLowerCase().endsWith(e))) : []);

const manifest = { sprites: {}, atlases: {}, svgs: {}, images: {}, audio: {}, json: {} };

const propsDir = path.join(assets, 'sprites/props');
for (const f of list(propsDir, ['.png', '.svg'])) {
    const key = f.replace(/\.(png|svg)$/i, '');
    const metaPath = path.join(propsDir, key + '.json');
    if (!fs.existsSync(metaPath)) continue;
    const m = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    manifest.sprites[key] = { file: rel(path.join(propsDir, f)), w: m.w, h: m.h, anchorX: m.anchorX, anchorY: m.anchorY, ppm: m.ppm };
}

const charsDir = path.join(assets, 'sprites/chars');
for (const f of list(charsDir, ['.png'])) {
    const key = f.replace(/\.png$/i, '');
    const jsonPath = path.join(charsDir, key + '.json');
    if (!fs.existsSync(jsonPath)) continue;
    const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const s = j.meta && j.meta.sas;
    if (!s) continue;
    manifest.atlases[key] = {
        image: rel(path.join(charsDir, f)),
        json: rel(jsonPath),
        anchorX: s.anchorX, anchorY: s.anchorY, cellW: s.cellW, cellH: s.cellH, ppm: s.ppm, anims: s.anims,
        // per-atlas extras the game reads (drive seat point, the item-get hand, vehicle footprints...)
        ...(s.drive ? { drive: s.drive } : {}),
        ...(s.get ? { get: s.get } : {}),
        ...(s.seat ? { seat: s.seat } : {}),
        ...(s.footprint ? { footprint: s.footprint } : {}),
    };
}

for (const f of list(path.join(assets, 'ui'), ['.svg'])) {
    const tall = f.startsWith('backpack_'); // backpack icons are 256x360
    manifest.svgs['ui_' + f.replace(/\.svg$/i, '')] = { file: 'ui/' + f, w: 256, h: tall ? 360 : 256 };
}
// close-up screen art: keys cu_<name>, rasterised at their own width/height
for (const f of list(path.join(assets, 'closeup'), ['.svg'])) {
    const src = fs.readFileSync(path.join(assets, 'closeup', f), 'utf8');
    const w = +(src.match(/width="(\d+)"/) || [0, 256])[1], h = +(src.match(/height="(\d+)"/) || [0, 256])[1];
    manifest.svgs['cu_' + f.replace(/\.svg$/i, '')] = { file: 'closeup/' + f, w, h };
}
for (const f of list(path.join(assets, 'closeup'), ['.json'])) {
    manifest.json['cu_' + f.replace(/\.json$/i, '')] = 'closeup/' + f;
}
for (const f of list(path.join(assets, 'closeup'), ['.png'])) {
    manifest.images['cu_' + f.replace(/\.png$/i, '')] = 'closeup/' + f;
}
for (const f of list(path.join(assets, 'images'), ['.png', '.jpg', '.webp', '.svg'])) {
    manifest.images[f.replace(/\.(png|jpg|webp|svg)$/i, '')] = 'images/' + f;
}
for (const f of list(path.join(assets, 'audio'), ['.wav', '.mp3', '.ogg'])) {
    manifest.audio[f.replace(/\.(wav|mp3|ogg)$/i, '')] = 'audio/' + f;
}

fs.writeFileSync(path.join(assets, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(
    `manifest: ${Object.keys(manifest.sprites).length} sprites, ${Object.keys(manifest.atlases).length} atlases, ` +
        `${Object.keys(manifest.svgs).length} svgs, ${Object.keys(manifest.images).length} images, ${Object.keys(manifest.audio).length} audio`,
);
