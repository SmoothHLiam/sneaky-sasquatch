#!/usr/bin/env node
/**
 * Flat vector art for the close-up screens (cooler / trash can / cache /
 * eating) and food items. Writes SVGs to public/assets/closeup/*.svg.
 * Colours sampled from your research/frames/tutorial/ (cooler §7, eating §3).
 *
 * Usage: node art/tools/gen-closeup-art.mjs && node art/tools/build-manifest.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(root, 'public/assets/closeup');
fs.mkdirSync(OUT, { recursive: true });
const svg = (name, w, h, body) => fs.writeFileSync(path.join(OUT, name + '.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`);

function rng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ---------------------------------------------------------------- cooler
// 1100 x 900 canvas; body interior opening = x 120..980, y 300..560
{
    const r = rng(5);
    let ice = '';
    for (let i = 0; i < 26; i++) {
        const x = 150 + r() * 800, y = 330 + r() * 220, s = 22 + r() * 22;
        ice += `<path d="M${x - s} ${y + s * 0.4} L${x - s * 0.6} ${y - s * 0.6} L${x + s * 0.5} ${y - s * 0.7} L${x + s} ${y + s * 0.3} L${x + s * 0.2} ${y + s * 0.8} Z" fill="#c7e6e8" opacity="0.92"/><path d="M${x - s * 0.4} ${y - s * 0.35} L${x + s * 0.3} ${y - s * 0.45}" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`;
    }
    svg('cooler_body', 1100, 900, `
<rect x="20" y="180" width="80" height="260" rx="10" fill="#f2f2f2"/><rect x="40" y="200" width="40" height="220" fill="#d4d4d4"/>
<rect x="1000" y="180" width="80" height="260" rx="10" fill="#f2f2f2"/><rect x="1020" y="200" width="40" height="220" fill="#d4d4d4"/>
<path d="M90 250 L1010 250 L1010 790 Q1010 860 940 860 L160 860 Q90 860 90 790 Z" fill="#4f8e90"/>
<path d="M90 250 L1010 250 L1010 600 Q1010 630 980 630 L120 630 Q90 630 90 600 Z" fill="#63d6da"/>
<path d="M120 280 L980 280 L980 570 Q980 590 960 590 L140 590 Q120 590 120 570 Z" fill="#4c9297"/>
<path d="M120 380 L980 380 L980 570 Q980 590 960 590 L140 590 Q120 590 120 570 Z" fill="#5cabb2"/>
${ice}`);
    svg('cooler_lid_closed', 1100, 900, `
<path d="M80 170 L1020 170 L1020 600 L80 600 Z" fill="#e7e7e7"/>
<rect x="80" y="170" width="940" height="66" fill="#f6f6f6"/>
<rect x="140" y="300" width="820" height="26" rx="6" fill="#d8d8d8"/>
<rect x="80" y="552" width="940" height="48" fill="#949494"/>
<rect x="480" y="520" width="140" height="70" rx="8" fill="#b2b2b2"/><rect x="500" y="540" width="100" height="14" rx="5" fill="#9a9a9a"/>`);
    svg('cooler_lid_open', 1100, 300, `
<rect x="80" y="40" width="940" height="200" fill="#bfbfbf"/><rect x="80" y="40" width="940" height="60" fill="#d0d0d0"/>
<rect x="460" y="40" width="180" height="70" fill="#999494"/><rect x="140" y="140" width="820" height="22" rx="6" fill="#cfcfcf"/>`);
}

// ------------------------------------------------------------- trash can
{
    let ribs = '';
    for (let i = 0; i < 9; i++) ribs += `<rect x="${170 + i * 85}" y="330" width="34" height="520" fill="#8f979a"/>`;
    const r = rng(9);
    let lines = '';
    for (let i = 0; i < 5; i++) {
        const x = 260 + r() * 520;
        lines += `<path d="M${x} 420 q-20 -40 0 -80 q20 -40 0 -80" stroke="#e8d23a" stroke-width="12" fill="none" stroke-linecap="round"/>`;
    }
    svg('trash_body', 1100, 900, `
<path d="M140 300 L960 300 L920 860 L180 860 Z" fill="#a9b1b4"/>${ribs}
<ellipse cx="550" cy="300" rx="430" ry="90" fill="#7d8588"/>
<ellipse cx="550" cy="305" rx="390" ry="70" fill="#6b7037"/>
<ellipse cx="550" cy="315" rx="350" ry="52" fill="#7b8040"/>${lines}`);
    svg('trash_lid', 1100, 400, `
<ellipse cx="550" cy="200" rx="450" ry="110" fill="#e9eded"/><ellipse cx="550" cy="190" rx="400" ry="90" fill="#f6f8f8"/>
<rect x="440" y="150" width="220" height="40" rx="20" fill="#c9d0d0"/><rect x="470" y="120" width="160" height="40" rx="18" fill="#dfe4e4"/>`);
}

// ---------------------------------------------------------------- cache chest
svg('cache_body', 1100, 900, `
<rect x="140" y="300" width="820" height="520" rx="40" fill="#c8313b"/><rect x="140" y="300" width="820" height="90" fill="#a8262f"/>
<rect x="190" y="340" width="720" height="380" rx="20" fill="#5a1a1e"/>
<path d="M550 560 l-60 90 h40 l-50 70 h140 l-50 -70 h40 Z" fill="#ffffff" opacity="0.9"/>`);
svg('cache_lid', 1100, 400, `<rect x="120" y="60" width="860" height="260" rx="50" fill="#e0444e"/><path d="M550 120 l-55 80 h36 l-46 64 h130 l-46 -64 h36 Z" fill="#fff"/>`);

// ------------------------------------------------------------- bear-proof food box
svg('foodbox_body', 1100, 900, `
<rect x="110" y="250" width="880" height="600" rx="14" fill="#7d8583"/><rect x="150" y="290" width="800" height="300" fill="#3f4544"/>
<rect x="110" y="620" width="880" height="30" fill="#6b7271"/>`);
svg('foodbox_lid', 1100, 400, `<rect x="90" y="70" width="920" height="260" rx="12" fill="#9aa2a0"/><rect x="480" y="250" width="140" height="70" rx="10" fill="#5e6564"/>`);

// ------------------------------------------------------------------ hand & arm
svg('hand_open', 300, 340, `
<path d="M150 330 C90 330 66 290 62 240 L40 150 C34 126 64 118 72 140 L92 196 L96 190 L82 70 C80 46 112 44 114 68 L126 176 L134 176 L136 44 C136 18 170 18 170 44 L172 176 L180 178 L196 70 C200 46 230 50 228 74 L214 196 L220 200 L244 136 C252 114 282 124 274 148 L240 262 C228 304 202 330 150 330 Z" fill="#f6b17d"/>`);
svg('hand_grab', 300, 340, `
<path d="M150 330 C92 330 64 296 60 250 C56 200 70 160 98 142 C110 120 140 116 160 128 C176 112 210 116 222 138 C246 146 262 170 258 206 C256 246 238 304 210 322 C194 330 172 330 150 330 Z" fill="#f6b17d"/>
<path d="M100 172 C120 160 150 160 170 168 M118 206 C140 196 172 196 196 204" stroke="#d8905e" stroke-width="10" fill="none" stroke-linecap="round"/>`);
{
    // furry forearm segment, drawn pointing up, 200 wide x 1000 tall; ragged fur edges
    const r = rng(3);
    let left = '', right = '';
    for (let y = 1000; y >= 0; y -= 60) {
        left += ` L${40 + r() * 20} ${y} L${10 + r() * 14} ${y - 30}`;
        right = ` L${190 - r() * 14} ${y - 30} L${160 - r() * 20} ${y}` + right;
    }
    svg('arm_fur', 200, 1000, `<path d="M50 1000${left} L60 0 L140 0${right} L150 1000 Z" fill="#442e21"/>
<path d="M90 980 L80 700 L96 420 L84 160" stroke="#5a3c2a" stroke-width="10" fill="none"/>`);
}

// -------------------------------------------------------- backpack mouth (drop target)
svg('bag_mouth', 700, 560, `
<ellipse cx="350" cy="300" rx="340" ry="250" fill="#ca3535"/>
<ellipse cx="350" cy="300" rx="290" ry="205" fill="#533928"/>
<ellipse cx="350" cy="330" rx="250" ry="160" fill="#3e2a1e"/>
<path d="M60 250 Q350 40 640 250" stroke="#fe3d3e" stroke-width="40" fill="none"/>`);

// ------------------------------------------------------------------- food items
const items = {
    hotdog: [260, 120, `<rect x="10" y="30" width="240" height="64" rx="32" fill="#ea4e55"/><rect x="24" y="40" width="200" height="14" rx="7" fill="#f58489"/>`],
    ketchup: [140, 300, `<rect x="44" y="10" width="52" height="46" rx="8" fill="#f2f2f2"/><path d="M30 60 Q20 80 22 120 L22 270 Q22 292 44 292 L96 292 Q118 292 118 270 L118 120 Q120 80 110 60 Z" fill="#ca4847"/><rect x="22" y="130" width="96" height="96" fill="#f2f2f2"/><circle cx="70" cy="178" r="24" fill="#ca4847"/>`],
    pickles: [180, 240, `<rect x="30" y="10" width="120" height="40" rx="8" fill="#d9c34a"/><path d="M20 50 L160 50 L160 210 Q160 232 138 232 L42 232 Q20 232 20 210 Z" fill="#7fbf4a" opacity="0.95"/><ellipse cx="62" cy="140" rx="20" ry="58" fill="#4f8f2a"/><ellipse cx="116" cy="150" rx="20" ry="56" fill="#4a8526"/><rect x="40" y="110" width="100" height="60" fill="#f4f0d8"/>`],
    water: [120, 300, `<rect x="40" y="6" width="40" height="30" rx="6" fill="#3a7fd0"/><path d="M28 40 L92 40 L104 80 L104 278 Q104 294 88 294 L32 294 Q16 294 16 278 L16 80 Z" fill="#bfe6f6" opacity="0.9"/><rect x="16" y="130" width="88" height="70" fill="#3a7fd0"/>`],
    soda: [140, 220, `<rect x="20" y="20" width="100" height="190" rx="14" fill="#d8333b"/><rect x="26" y="10" width="88" height="20" rx="8" fill="#c8c8c8"/><path d="M30 90 Q70 60 110 90 L110 130 Q70 100 30 130 Z" fill="#f2f2f2"/>`],
    chips: [200, 240, `<path d="M20 20 L180 20 L170 220 L30 220 Z" fill="#f2c230"/><rect x="20" y="20" width="160" height="26" fill="#e0a020"/><circle cx="100" cy="128" r="42" fill="#e05a2a"/>`],
    sandwich: [240, 180, `<path d="M20 40 Q120 0 220 40 L220 70 L20 70 Z" fill="#e8c27a"/><rect x="16" y="70" width="208" height="22" fill="#6abf4a"/><rect x="16" y="92" width="208" height="24" fill="#d8605a"/><path d="M20 116 L220 116 L220 150 Q120 170 20 150 Z" fill="#e8c27a"/>`],
    orange: [150, 150, `<circle cx="75" cy="80" r="62" fill="#f39a1d"/><path d="M70 22 Q90 4 110 16 Q92 30 74 28 Z" fill="#4f8f2a"/>`],
    pepper: [140, 200, `<path d="M40 40 Q70 20 100 40 Q130 100 100 180 Q70 200 44 170 Q10 100 40 40 Z" fill="#5aa832"/><rect x="62" y="10" width="16" height="36" rx="6" fill="#3a6a22"/>`],
    stinkyFood: [220, 160, `<path d="M30 110 Q20 60 70 50 Q100 20 140 46 Q200 50 196 110 Q190 150 110 150 Q40 150 30 110 Z" fill="#7a5a2a"/><circle cx="90" cy="90" r="14" fill="#5a3e18"/><circle cx="140" cy="100" r="10" fill="#5a3e18"/>`],
    smores: [200, 160, `<rect x="20" y="96" width="160" height="40" rx="8" fill="#d8a85a"/><rect x="30" y="66" width="140" height="34" rx="14" fill="#f4f0e8"/><rect x="24" y="52" width="152" height="18" fill="#6a3a1e"/><rect x="20" y="20" width="160" height="36" rx="8" fill="#d8a85a"/>`],
    steak: [240, 170, `<path d="M30 80 Q30 20 110 20 Q220 20 214 90 Q206 150 120 150 Q30 150 30 80 Z" fill="#a8422e"/><path d="M60 80 Q70 50 120 50" stroke="#f2e0c8" stroke-width="12" fill="none"/>`],
    watermelon: [240, 150, `<path d="M10 20 L230 20 Q200 140 120 140 Q40 140 10 20 Z" fill="#3a8a3a"/><path d="M24 26 L216 26 Q190 122 120 122 Q50 122 24 26 Z" fill="#ea4e55"/><circle cx="90" cy="60" r="7" fill="#222"/><circle cx="140" cy="70" r="7" fill="#222"/><circle cx="115" cy="95" r="7" fill="#222"/>`],
    coinBag: [200, 220, `<path d="M60 70 Q30 120 34 170 Q40 210 100 210 Q160 210 166 170 Q170 120 140 70 Z" fill="#c8a36a"/><path d="M70 40 L130 40 L140 70 L60 70 Z" fill="#b08a52"/><rect x="60" y="62" width="80" height="14" fill="#7a5a30"/><circle cx="100" cy="150" r="28" fill="#e8b828"/>`],
};
for (const [k, [w, h, b]] of Object.entries(items)) svg('item_' + k, w, h, b);

// ---------------------------------------------------------------- eat table
// Full-width strip below 67.6 %H of a 3024x1898 frame (t096.4 / t104.0): the
// table slab spans 14-86 %W, bench ends sit lower at both edges, darker
// underside showing in the gaps. Plank seams are short rounded strokes.
{
    const seams = [[664, 151, 453], [1042, 385, 640], [1450, 129, 640], [1978, 250, 640], [2310, 250, 640], [151, 408, 640], [2854, 408, 640]]
        .map(([x, y0, y1]) => `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="#93652f" stroke-width="26" stroke-linecap="round"/>`)
        .join('');
    svg('eat_table', 3024, 615, `
<rect x="300" y="344" width="2424" height="271" fill="#7b5532"/>
<rect x="300" y="425" width="2424" height="190" fill="#634328"/>
<rect x="0" y="277" width="316" height="338" fill="#a06e37"/>
<rect x="2706" y="277" width="318" height="338" fill="#a06e37"/>
<rect x="425" y="0" width="2172" height="615" fill="#a06e37"/>
${seams}`);
}

// ---------------------------------------------------------------- upturned backpack (eat dump, t096.4)
// Seen from below while held over the head: the body with the dark open mouth
// and a lighter rim along the bottom edge.
for (const [name, main, rim, dark] of [
    ['red', '#c8283c', '#f0404f', '#4a1119'],
    ['blue', '#2f7fc4', '#3aa0e8', '#13283f'],
    ['green', '#7fa62f', '#9cc43a', '#2a3512'],
]) {
    svg('pack_dump_' + name, 600, 620, `
<rect x="20" y="20" width="560" height="520" rx="96" fill="${main}"/>
<rect x="50" y="318" width="500" height="282" rx="86" fill="${rim}"/>
<rect x="84" y="338" width="432" height="214" rx="74" fill="${dark}"/>`);
}

// ---------------------------------------------------------------- ketchup splats
for (let i = 0; i < 4; i++) {
    const r = rng(40 + i);
    let d = '';
    const n = 9;
    for (let k = 0; k < n * 2; k++) {
        const a = (k / (n * 2)) * Math.PI * 2;
        const rr = k % 2 ? 26 + r() * 10 : 44 + r() * 22;
        d += `${k ? 'L' : 'M'}${(70 + Math.cos(a) * rr).toFixed(1)} ${(70 + Math.sin(a) * rr).toFixed(1)} `;
    }
    svg('splat_' + i, 140, 140, `<path d="${d}Z" fill="#d8333b"/>`);
}
console.log('close-up art written to', path.relative(root, OUT));
