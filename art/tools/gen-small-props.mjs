#!/usr/bin/env node
/**
 * Small world bits drawn as flat vector sprites (too small to be worth a Blender
 * model), matched to inside-park t0066.5: the folded newspaper lying on the
 * Campsite B firewood, the wicker picnic basket and the little red radio.
 * Same output format as gen-vegetation.mjs (1 m = PPM units, anchor = resting point).
 *
 * Usage: node art/tools/gen-small-props.mjs && node art/tools/build-manifest.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(root, 'public/assets/sprites/props');
fs.mkdirSync(OUT, { recursive: true });
const PPM = 200;
const f3 = (n) => +n.toFixed(3);

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

// folded newspaper, tilted, grey print lines and a photo box (t0066.5 on the firewood)
write('newspaper_folded', `
<g transform="rotate(-24)">
${rect(-0.26, -0.18, 0.52, 0.34, '#e9eaea', 0.02)}
${rect(-0.26, -0.18, 0.52, 0.04, '#cfd2d2', 0.02)}
${rect(-0.21, -0.1, 0.17, 0.17, '#5d6466', 0.01)}
${[-0.09, -0.04, 0.01, 0.06, 0.11].map((y) => rect(0.0, y, 0.2, 0.022, '#7c8486')).join('')}
</g>`, [-0.32, -0.32, 0.32, 0.18]);

// wicker picnic basket with a handle (t0066.5, left of the umbrella)
write('picnic_basket', `
${rect(-0.33, -0.36, 0.66, 0.36, '#e9b968', 0.05)}
${rect(-0.33, -0.36, 0.66, 0.11, '#f6d189', 0.04)}
${rect(-0.36, -0.42, 0.72, 0.08, '#f3c97c', 0.03)}
${rect(-0.03, -0.66, 0.06, 0.26, '#c99545', 0.02)}
${rect(-0.12, -0.68, 0.24, 0.05, '#c99545', 0.02)}`, [-0.38, -0.7, 0.38, 0.02]);

// little red transistor radio with yellow knobs (t0066.5, beside the blanket)
write('radio_small', `
${rect(-0.22, -0.26, 0.44, 0.26, '#d8313f', 0.04)}
${rect(-0.22, -0.26, 0.44, 0.06, '#ea4250', 0.03)}
<circle cx="0.1" cy="-0.11" r="0.065" fill="#9a1f2a"/>
<circle cx="-0.13" cy="-0.11" r="0.03" fill="#f2c94a"/><circle cx="-0.05" cy="-0.11" r="0.03" fill="#f2c94a"/>
<line x1="0.16" y1="-0.26" x2="0.3" y2="-0.48" stroke="#b7bcbe" stroke-width="0.018" stroke-linecap="round"/>`, [-0.24, -0.5, 0.32, 0.02]);

// "RESERVED" painted in the dealership stalls (outside-park o05): flat on the asphalt, so the
// letters are squashed by sin(52°) to read as lying on the ground
write('paint_reserved', `
<g transform="scale(1 0.79)"><text x="0" y="-0.02" text-anchor="middle" font-family="Bree Serif, Georgia, serif" font-weight="bold" font-size="0.42" fill="#aab3b0" fill-opacity="0.9">RESERVED</text></g>`, [-1.15, -0.32, 1.15, 0.02]);

// potted plant in the Ranger Station's east wing (inside-park t0470): terracotta pot, long
// pointed leaves fanning out, a darker centre spike
const leaf = (ang, len, w, fill) => {
    const r = (ang * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
    const tx = c * len, ty = -s * len * 0.82, mx = c * len * 0.5, my = -s * len * 0.5 * 0.82;
    const nx = -s * w, ny = -c * w;
    return `<path d="M0 -0.36 Q${f3(mx + nx)} ${f3(my + ny - 0.36)} ${f3(tx)} ${f3(ty - 0.36)} Q${f3(mx - nx)} ${f3(my - ny - 0.36)} 0 -0.36Z" fill="${fill}"/>`;
};
write('potted_plant', `
<ellipse cx="0" cy="-0.02" rx="0.3" ry="0.08" fill="#000" fill-opacity="0.12"/>
${[[160, 0.62, 0.09, '#2a7d33'], [20, 0.62, 0.09, '#2a7d33'], [140, 0.66, 0.1, '#33913a'], [40, 0.66, 0.1, '#33913a'],
    [118, 0.72, 0.1, '#3aa040'], [62, 0.72, 0.1, '#3aa040'], [100, 0.78, 0.09, '#2f8a35'], [80, 0.8, 0.09, '#2f8a35'], [90, 0.92, 0.07, '#24702c']]
    .map(([a, l, w, f]) => leaf(a, l, w, f)).join('')}
<path d="M-0.21 -0.4 L0.21 -0.4 L0.16 -0.02 L-0.16 -0.02Z" fill="#b5553d"/>
${rect(-0.24, -0.46, 0.48, 0.09, '#c9654a', 0.02)}
${rect(-0.24, -0.46, 0.48, 0.03, '#d77556', 0.015)}`, [-0.72, -1.15, 0.72, 0.02]);

// a torn treasure-map piece (bonus cutscene 31.5-34.3: held up overhead; pinned on the notice board after)
write('map_piece', `
<path d="M-0.15 -0.36 L0.13 -0.38 L0.16 -0.27 L0.14 -0.15 L0.17 -0.03 L-0.12 0 L-0.16 -0.12 L-0.13 -0.24Z" fill="#e8c86a" stroke="#b8923e" stroke-width="0.014"/>
<path d="M-0.1 -0.3 Q-0.02 -0.26 0.02 -0.2 T0.1 -0.08" fill="none" stroke="#c0392b" stroke-width="0.014" stroke-dasharray="0.03 0.025"/>
<path d="M0.06 -0.12 l0.04 0.04 M0.1 -0.12 l-0.04 0.04" stroke="#c0392b" stroke-width="0.016"/>`, [-0.18, -0.4, 0.19, 0.02]);

console.log('small props written to', path.relative(root, OUT));
