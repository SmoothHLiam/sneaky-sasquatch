#!/usr/bin/env node
/**
 * Raccoon Shop display items and the pizza poster, as flat vector sprites
 * matched to tutorial t246.5 (shop zoom ≈1.75x → 212 px/m on the 2000-px still).
 * Writes SVG + anchor json into public/assets/sprites/props/ (1 m = PPM units,
 * anchor = the point the item rests on), same format as gen-vegetation.mjs.
 *
 * Usage: node art/tools/gen-shop-items.mjs && node art/tools/build-manifest.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(root, 'public/assets/sprites/props');
fs.mkdirSync(OUT, { recursive: true });
const PPM = 200; // must equal TUNING.render.spritePPM
const f3 = (n) => +n.toFixed(3);

/** coordinates in metres, y down, anchor at (0,0); bounds [x0, y0, x1, y1] */
function write(key, body, bounds) {
    const [x0, y0, x1, y1] = bounds;
    const pad = 0.04;
    const w = Math.ceil((x1 - x0 + pad * 2) * PPM), h = Math.ceil((y1 - y0 + pad * 2) * PPM);
    const ox = -(x0 - pad), oy = -(y0 - pad);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g transform="scale(${PPM}) translate(${f3(ox)} ${f3(oy)})">${body}</g></svg>`;
    fs.writeFileSync(path.join(OUT, key + '.svg'), svg);
    fs.writeFileSync(path.join(OUT, key + '.json'), JSON.stringify({ w, h, anchorX: ox * PPM, anchorY: oy * PPM, ppm: PPM, vector: true }));
}
const rect = (x, y, w, h, fill, rx = 0, extra = '') => `<rect x="${f3(x)}" y="${f3(y)}" width="${f3(w)}" height="${f3(h)}" rx="${f3(rx)}" fill="${fill}"${extra}/>`;
const line = (x1, y1, x2, y2, stroke, sw) => `<line x1="${f3(x1)}" y1="${f3(y1)}" x2="${f3(x2)}" y2="${f3(y2)}" stroke="${stroke}" stroke-width="${f3(sw)}" stroke-linecap="round"/>`;
const path_ = (d, fill, extra = '') => `<path d="${d}" fill="${fill}"${extra}/>`;

// -- row 3 ------------------------------------------------------------------
// flashlight: dark body lying diagonally, pale lens at the lower-left end
write('shop_flashlight', `
<g transform="rotate(-32)">
${rect(-0.2, -0.13, 0.4, 0.12, '#2b2f32', 0.05)}
${rect(-0.24, -0.15, 0.1, 0.16, '#33383b', 0.04)}
<ellipse cx="-0.24" cy="-0.07" rx="0.035" ry="0.075" fill="#c9cfd2"/>
<ellipse cx="-0.243" cy="-0.07" rx="0.02" ry="0.05" fill="#eef1f2"/>
</g>`, [-0.28, -0.3, 0.22, 0.05]);

// vehicle keys: ring, three silver keys, black fob with a red button
write('shop_keys', `
<circle cx="0" cy="-0.2" r="0.07" fill="none" stroke="#9aa0a3" stroke-width="0.018"/>
${line(0, -0.2, -0.21, -0.29, '#c7ccce', 0.03)}${line(0, -0.2, 0.2, -0.27, '#c7ccce', 0.03)}${line(0.02, -0.18, -0.06, 0.02, '#c7ccce', 0.03)}
<circle cx="-0.22" cy="-0.295" r="0.035" fill="#c7ccce"/><circle cx="0.21" cy="-0.27" r="0.035" fill="#c7ccce"/>
${rect(0.02, -0.22, 0.13, 0.17, '#222628', 0.035, ' transform="rotate(18 0.08 -0.13)"')}
<circle cx="0.105" cy="-0.12" r="0.026" fill="#d23a3a"/><circle cx="0.06" cy="-0.17" r="0.017" fill="#55595c"/>
${rect(-0.05, -0.31, 0.09, 0.12, '#222628', 0.03, ' transform="rotate(-20 0 -0.25)"')}`, [-0.27, -0.36, 0.25, 0.04]);

// skis: two red skis standing on their tails with dark bindings, a pole either side
write('shop_skis', `
${rect(-0.13, -1.27, 0.1, 1.27, '#d83c4c', 0.05)}${rect(0.03, -1.27, 0.1, 1.27, '#d83c4c', 0.05)}
${rect(-0.125, -0.72, 0.09, 0.2, '#3a3b3d')}${rect(0.035, -0.72, 0.09, 0.2, '#3a3b3d')}
${line(-0.3, -0.8, -0.3, 0, '#2f3234', 0.025)}${line(0.3, -0.8, 0.3, 0, '#2f3234', 0.025)}
${rect(-0.32, -0.82, 0.04, 0.12, '#1f2123', 0.015)}${rect(0.28, -0.82, 0.04, 0.12, '#1f2123', 0.015)}
<ellipse cx="-0.3" cy="-0.1" rx="0.06" ry="0.025" fill="#1f2123"/><ellipse cx="0.3" cy="-0.1" rx="0.06" ry="0.025" fill="#1f2123"/>`, [-0.37, -1.29, 0.37, 0.03]);

// -- row 2 ------------------------------------------------------------------
// paddle: dark wood, T grip on top, rounded blade resting on the counter
write('shop_paddle', `
${rect(-0.02, -1.18, 0.04, 0.84, '#3b281d')}
${rect(-0.075, -1.2, 0.15, 0.045, '#3b281d', 0.02)}
${path_('M -0.04 -0.38 C -0.17 -0.3 -0.19 -0.1 -0.18 0 L 0.18 0 C 0.19 -0.1 0.17 -0.3 0.04 -0.38 Z', '#3b281d')}`, [-0.2, -1.22, 0.2, 0.02]);

// fishing rod: thin black rod with guide eyes, red reel near the handle
write('shop_rod', `
${line(0, -1.16, 0, 0, '#1f2123', 0.022)}
${rect(-0.022, -0.3, 0.044, 0.3, '#2b2d2f', 0.015)}
${[0.95, 0.75, 0.56].map((y) => `<circle cx="0.022" cy="${-y}" r="0.014" fill="none" stroke="#6b6f72" stroke-width="0.008"/>`).join('')}
<circle cx="-0.045" cy="-0.33" r="0.045" fill="#c9313e"/><circle cx="-0.045" cy="-0.33" r="0.018" fill="#7a1d25"/>
${line(-0.045, -0.33, -0.1, -0.24, '#55595c', 0.012)}`, [-0.11, -1.18, 0.05, 0.02]);

// golf club: dark grip and shaft standing on the grey iron head
write('shop_golf', `
${line(0, -0.95, 0, -0.08, '#3a3d40', 0.022)}
${rect(-0.022, -0.97, 0.044, 0.26, '#1f2123', 0.015)}
${path_('M 0.012 -0.12 L 0.012 0 L -0.12 0 L -0.12 -0.03 Z', '#5d6366')}`, [-0.13, -0.99, 0.04, 0.02]);

// -- row 1 ------------------------------------------------------------------
// map: green booklet lying on the counter
write('shop_map', `
${rect(-0.17, -0.09, 0.34, 0.09, '#2f7a33', 0.015)}
${rect(-0.15, -0.075, 0.3, 0.04, '#e9e3c8', 0.008)}
${rect(-0.17, -0.12, 0.34, 0.04, '#3b9440', 0.015)}`, [-0.18, -0.13, 0.18, 0.01]);

// shovel: grey blade with a wooden handle, standing on the blade
write('shop_shovel', `
${line(0, -1.05, 0, -0.32, '#8a5a32', 0.04)}
${rect(-0.07, -1.09, 0.14, 0.05, '#2b2d2f', 0.02)}
${path_('M -0.17 -0.34 L 0.17 -0.34 L 0.16 -0.1 C 0.12 -0.02 0.05 0 0 0 C -0.05 0 -0.12 -0.02 -0.16 -0.1 Z', '#5e6b6d')}`, [-0.18, -1.11, 0.18, 0.02]);

// camper disguise: red cap with a blue band and brim
write('shop_hat', `
${path_('M -0.18 -0.06 C -0.18 -0.26 0.18 -0.26 0.18 -0.06 Z', '#d33b45')}
${rect(-0.19, -0.09, 0.38, 0.05, '#2f5fb3', 0.02)}
${path_('M 0.1 -0.05 L 0.3 -0.03 C 0.3 0 0.2 0.01 0.1 0 Z', '#2f5fb3')}`, [-0.2, -0.24, 0.31, 0.02]);

// pizza poster leaning on the wall (green sheet, pizza slice), t246.5 right wall
write('poster_pizza', `
<g transform="rotate(12 0 -0.5)">
${rect(-0.36, -1.0, 0.72, 1.0, '#3e8b3a', 0.02)}
${path_('M -0.25 -0.32 L 0.22 -0.78 L 0.27 -0.6 C 0.1 -0.42 -0.05 -0.33 -0.25 -0.32 Z', '#e8b04a')}
${path_('M 0.18 -0.8 L 0.3 -0.62 L 0.26 -0.58 L 0.14 -0.76 Z', '#a8682e')}
${[[-0.08, -0.45], [0.05, -0.55], [0.13, -0.66], [-0.0, -0.42], [0.12, -0.5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.035" fill="#d0393f"/>`).join('')}
</g>`, [-0.6, -1.12, 0.48, 0.1]);

console.log('shop items written to', path.relative(root, OUT));
