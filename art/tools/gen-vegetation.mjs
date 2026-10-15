#!/usr/bin/env node
/**
 * Procedural flat "paper-cut" vegetation, matching the original's 2D trees,
 * bushes, ferns and grass. Writes SVG sprites + anchor json into
 * public/assets/sprites/props/ (1 metre = PPM svg units, same as the Blender
 * renders), and the seamless grass tile into public/assets/images/.
 *
 * Usage: node art/tools/gen-vegetation.mjs && node art/tools/build-manifest.mjs
 * Tweak palettes/shapes below and re-run; the game picks the files up by key.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(root, 'public/assets/sprites/props');
const IMG = path.join(root, 'public/assets/images');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(IMG, { recursive: true });

const PPM = 200; // must equal TUNING.render.spritePPM

function rng(seed) {
    let s = seed >>> 0;
    const next = () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return { next, range: (a, b) => a + (b - a) * next(), pick: (a) => a[Math.floor(next() * a.length)] };
}

const f = (n) => +n.toFixed(1);
const f3 = (n) => +n.toFixed(3);
const poly = (pts, fill, extra = '') => `<path d="M${pts.map((p) => `${f3(p[0])} ${f3(p[1])}`).join(' L')} Z" fill="${fill}"${extra}/>`;

/** jagged ("sawtooth") ellipse */
function jagged(cx, cy, rx, ry, teeth, depth, r, rot = 0) {
    const pts = [];
    const n = teeth * 2;
    for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * Math.PI * 2;
        const k = i % 2 === 0 ? 1 : 1 - depth * r.range(0.6, 1.2);
        const j = r.range(0.94, 1.06);
        pts.push([cx + Math.cos(a) * rx * k * j, cy + Math.sin(a) * ry * k * j]);
    }
    return pts;
}

/**
 * Write a sprite. Coordinates in metres with the ground anchor at (0,0), y down.
 * bounds: [minX, minY, maxX, maxY] in metres.
 */
function write(key, body, bounds) {
    const [x0, y0, x1, y1] = bounds;
    const pad = 0.05;
    const w = Math.ceil((x1 - x0 + pad * 2) * PPM), h = Math.ceil((y1 - y0 + pad * 2) * PPM);
    const ox = -(x0 - pad), oy = -(y0 - pad);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g transform="scale(${PPM}) translate(${f3(ox)} ${f3(oy)})">${body}</g></svg>`;
    fs.writeFileSync(path.join(OUT, key + '.svg'), svg);
    fs.writeFileSync(path.join(OUT, key + '.json'), JSON.stringify({ w, h, anchorX: ox * PPM, anchorY: oy * PPM, ppm: PPM, vector: true }));
}

// all shape helpers below work in metres (y down, anchor at ground (0,0))
const mpoly = poly;

// ------------------------------------------------------------------ pines
function pine(key, seed, pal, H, W) {
    const r = rng(seed);
    let body = '';
    const trunkW = W * 0.07;
    body += mpoly([[-trunkW, 0.05], [trunkW, 0.05], [trunkW * 0.7, -H * 0.6], [-trunkW * 0.7, -H * 0.6]], pal.trunk);
    // bare side branches poking out under the foliage
    for (let i = 0; i < 2; i++) {
        const s = i === 0 ? -1 : 1, y = -H * r.range(0.24, 0.36);
        body += mpoly([[0, y], [s * W * r.range(0.3, 0.42), y - H * 0.07], [s * W * 0.42, y - H * 0.06], [0, y + 0.1]], pal.trunk);
    }
    const tiers = 4 + (r.next() < 0.5 ? 1 : 0);
    const shapes = [];
    for (let t = 0; t < tiers; t++) {
        const k = t / (tiers - 1);                 // 0 = top tier, 1 = bottom tier
        const apexY = -H + k * H * 0.5;
        const botY = apexY + H * (0.24 + 0.08 * k);
        const halfW = W * (0.17 + 0.33 * k) * r.range(0.93, 1.07);
        const teeth = 3 + Math.round(halfW * 3.4);
        const depth = (botY - apexY) * r.range(0.12, 0.18);
        const make = (grow, dy) => {
            const hw = halfW * grow;
            const pts = [[0, apexY + dy - 0.02 * grow]];
            // left slope with two little spikes
            for (const u of [0.35, 0.68]) {
                const x = -hw * u, y = apexY + (botY - apexY) * u * 0.9 + dy;
                pts.push([x + hw * 0.04, y - depth * 0.2], [x - hw * 0.1, y + depth * 0.35], [x, y + depth * 0.1]);
            }
            pts.push([-hw, botY - depth * 0.3 + dy]);
            for (let i = 1; i < teeth * 2; i++) {
                const x = -hw + (i / (teeth * 2)) * hw * 2;
                const sag = Math.sin((i / (teeth * 2)) * Math.PI) * depth * 0.4;
                pts.push([x, botY + dy + sag - (i % 2 === 0 ? depth : 0) * r.range(0.8, 1.2)]);
            }
            pts.push([hw, botY - depth * 0.3 + dy]);
            for (const u of [0.68, 0.35]) {
                const x = hw * u, y = apexY + (botY - apexY) * u * 0.9 + dy;
                pts.push([x, y + depth * 0.1], [x + hw * 0.1, y + depth * 0.35], [x - hw * 0.04, y - depth * 0.2]);
            }
            return pts;
        };
        shapes.push({ t, apexY, botY, under: make(1.04, H * 0.035), main: make(1, 0) });
    }
    // draw bottom tiers first so upper tiers overlap them
    for (const sh of shapes.slice().reverse()) {
        body += mpoly(sh.under, pal.dark);
        body += mpoly(sh.main, sh.t % 2 === 0 ? pal.mid : pal.mid2);
        const left = sh.main.filter(([x]) => x <= 0.001);
        body += mpoly([...left, [0, sh.botY - (sh.botY - sh.apexY) * 0.1]], pal.light, ' opacity="0.5"');
    }
    write(key, body, [-W * 0.62, -H - 0.15, W * 0.62, 0.1]);
}

// ------------------------------------------------------------- round tree
function roundTree(key, seed, pal, H, W) {
    const r = rng(seed);
    let body = '';
    const tw = W * 0.07;
    body += mpoly([[-tw, 0.05], [tw, 0.05], [tw * 0.7, -H * 0.5], [-tw * 0.7, -H * 0.5]], pal.trunk);
    const cy = -H + W * 0.5;
    body += mpoly(jagged(0, cy + 0.15, W * 0.52, W * 0.5, 22, 0.13, r), pal.dark);
    body += mpoly(jagged(-W * 0.05, cy, W * 0.48, W * 0.46, 22, 0.12, r, 0.2), pal.mid);
    body += mpoly(jagged(-W * 0.1, cy - W * 0.08, W * 0.32, W * 0.3, 16, 0.14, r, 0.5), pal.light);
    write(key, body, [-W * 0.62, cy - W * 0.62, W * 0.62, 0.1]);
}

// ------------------------------------------------------------------ birch
/** white trunk with grey bands, forking near the top, round olive canopy (outside-park o02) */
function birch(key, seed, pal, H, W) {
    const r = rng(seed);
    let body = '';
    const tw = W * 0.06;
    const top = -H * 0.55;
    body += mpoly([[-tw, 0.05], [tw, 0.05], [tw * 0.75, top], [-tw * 0.75, top]], pal.trunk);
    // the fork: two limbs into the canopy
    body += mpoly([[-tw * 0.7, top + 0.05], [-W * 0.22, top - H * 0.16], [-W * 0.17, top - H * 0.17], [0, top - 0.02]], pal.trunk);
    body += mpoly([[tw * 0.7, top + 0.05], [W * 0.2, top - H * 0.14], [W * 0.15, top - H * 0.15], [0, top - 0.02]], pal.trunk);
    for (let i = 0; i < 5; i++) {
        const y = -H * r.range(0.05, 0.5), w = tw * r.range(0.6, 1.2);
        body += mpoly([[-w, y], [w * r.range(0.2, 0.9), y - 0.025], [w * r.range(0.2, 0.9), y + 0.02]], pal.band);
    }
    const cy = -H + W * 0.5;
    body += mpoly(jagged(0, cy + 0.15, W * 0.52, W * 0.48, 20, 0.12, r), pal.dark);
    body += mpoly(jagged(-W * 0.04, cy, W * 0.48, W * 0.44, 20, 0.11, r, 0.2), pal.mid);
    body += mpoly(jagged(-W * 0.1, cy - W * 0.08, W * 0.3, W * 0.28, 14, 0.13, r, 0.5), pal.light);
    write(key, body, [-W * 0.62, cy - W * 0.62, W * 0.62, 0.1]);
}

// ------------------------------------------------------------------ bushes
function bush(key, seed, pal, W, berries = false) {
    const r = rng(seed);
    let body = '';
    const H = W * 0.62;
    const blobs = [];
    const n = 3 + Math.floor(r.range(0, 3));
    for (let i = 0; i < n; i++) {
        const bx = r.range(-W * 0.3, W * 0.3), by = -H * r.range(0.35, 0.7);
        const rr = W * r.range(0.26, 0.36);
        blobs.push([bx, by, rr]);
    }
    blobs.sort((a, b) => a[1] - b[1]);
    for (const [bx, by, rr] of blobs) body += mpoly(jagged(bx, by + 0.06, rr * 1.05, rr * 0.8, 14, 0.16, r), pal.dark);
    for (const [bx, by, rr] of blobs) {
        body += mpoly(jagged(bx, by, rr, rr * 0.76, 14, 0.15, r, 0.3), pal.mid);
        body += mpoly(jagged(bx - rr * 0.12, by - rr * 0.12, rr * 0.62, rr * 0.45, 11, 0.16, r, 0.6), pal.light, ' opacity="0.8"');
        if (berries)
            for (let b = 0; b < 4; b++) {
                const a = r.range(0, Math.PI * 2), d = r.range(0.1, 0.8);
                body += `<ellipse cx="${(bx + Math.cos(a) * rr * d).toFixed(3)}" cy="${(by + Math.sin(a) * rr * 0.7 * d).toFixed(3)}" rx="0.045" ry="0.038" fill="${pal.berry}"/>`;
            }
    }
    const minY = Math.min(...blobs.map((b) => b[1] - b[2]));
    write(key, body, [-W * 0.75, minY - 0.1, W * 0.75, 0.15]);
}

function fern(key, seed, col, W) {
    const r = rng(seed);
    let body = '';
    const n = 7 + Math.floor(r.range(0, 3));
    for (let i = 0; i < n; i++) {
        const a = Math.PI + (i / (n - 1)) * Math.PI + r.range(-0.12, 0.12);
        const L = W * r.range(0.4, 0.55);
        const tip = [Math.cos(a) * L, Math.sin(a) * L * 0.55 - 0.02];
        const nx = -Math.sin(a) * W * 0.06, ny = Math.cos(a) * W * 0.06 * 0.55;
        const mid = [tip[0] * 0.5, tip[1] * 0.5];
        body += mpoly([[0, 0], [mid[0] + nx, mid[1] + ny], tip, [mid[0] - nx, mid[1] - ny]], i % 2 ? col : shade(col, -12));
    }
    write(key, body, [-W * 0.6, -W * 0.4, W * 0.6, 0.05]);
}

function tuft(key, seed, cols, W) {
    const r = rng(seed);
    let body = '';
    const n = 5 + Math.floor(r.range(0, 4));
    for (let i = 0; i < n; i++) {
        const x = r.range(-W / 2, W / 2), h = r.range(0.25, 0.55), w = r.range(0.04, 0.07);
        const lean = r.range(-0.05, 0.05);
        body += mpoly([[x - w, 0], [x + w, 0], [x + lean, -h]], r.pick(cols));
    }
    write(key, body, [-W / 2 - 0.1, -0.6, W / 2 + 0.1, 0.05]);
}

function flowers(key, seed, petal, centre) {
    const r = rng(seed);
    let body = '';
    for (let i = 0; i < 4; i++) {
        const x = r.range(-0.18, 0.18), y = r.range(-0.08, 0.06), h = r.range(0.12, 0.22);
        body += mpoly([[x - 0.01, y], [x + 0.01, y], [x + 0.01, y - h], [x - 0.01, y - h]], '#3c8a30');
        for (let p = 0; p < 5; p++) {
            const a = (p / 5) * Math.PI * 2;
            body += `<circle cx="${(x + Math.cos(a) * 0.035).toFixed(3)}" cy="${(y - h + Math.sin(a) * 0.028).toFixed(3)}" r="0.03" fill="${petal}"/>`;
        }
        body += `<circle cx="${x.toFixed(3)}" cy="${(y - h).toFixed(3)}" r="0.022" fill="${centre}"/>`;
    }
    write(key, body, [-0.3, -0.35, 0.3, 0.1]);
}

function stick(key, seed) {
    const r = rng(seed);
    const L = r.range(0.5, 0.8);
    let body = mpoly([[-L / 2, 0.01], [L / 2, -0.03], [L / 2, -0.06], [-L / 2, -0.02]], '#8a4f2a');
    const fx = r.range(-0.1, 0.15);
    body += mpoly([[fx, -0.02], [fx + 0.18, -0.12], [fx + 0.19, -0.1], [fx + 0.03, 0.0]], '#8a4f2a');
    write(key, body, [-L / 2 - 0.05, -0.2, L / 2 + 0.25, 0.05]);
}

function pebble(key, seed) {
    const r = rng(seed);
    const w = r.range(0.14, 0.24);
    let body = mpoly(jagged(0, -0.02, w, w * 0.45, 4, 0.1, r), '#6f7472');
    body += mpoly(jagged(-0.01, -0.04, w * 0.85, w * 0.32, 4, 0.08, r), '#8a8f8c');
    write(key, body, [-w - 0.05, -w * 0.6, w + 0.05, w * 0.5]);
}

function mushrooms(key) {
    let body = '';
    for (const [x, y, s] of [[-0.1, 0, 1], [0.08, -0.04, 0.8], [0.0, 0.05, 0.9], [0.15, 0.04, 0.7]]) {
        body += mpoly([[x - 0.015 * s, y], [x + 0.015 * s, y], [x + 0.012 * s, y - 0.1 * s], [x - 0.012 * s, y - 0.1 * s]], '#f1e2c0');
        body += `<ellipse cx="${x}" cy="${y - 0.1 * s}" rx="${0.06 * s}" ry="${0.035 * s}" fill="#e9c35a"/>`;
    }
    write(key, body, [-0.25, -0.25, 0.3, 0.1]);
}

function lilypad(key) {
    const body = `<path d="M0 -0.0 L0.3 -0.06 A0.32 0.18 0 1 1 0.3 0.06 Z" fill="#5fbf4f"/><path d="M0 -0.0 L0.3 -0.06 A0.32 0.18 0 0 0 -0.2 -0.12 Z" fill="#78d060" opacity="0.6"/>`;
    write(key, body, [-0.4, -0.25, 0.4, 0.25]);
}

function cattails(key, seed) {
    const r = rng(seed);
    let body = '';
    for (let i = 0; i < 5; i++) {
        const x = r.range(-0.18, 0.18), h = r.range(0.7, 1.1);
        body += mpoly([[x - 0.012, 0], [x + 0.012, 0], [x + 0.03, -h], [x + 0.01, -h]], '#5c8a3a');
        if (i % 2 === 0) body += `<rect x="${(x - 0.025).toFixed(3)}" y="${(-h * 0.85).toFixed(3)}" width="0.05" height="0.18" rx="0.025" fill="#8a5a30"/>`;
    }
    write(key, body, [-0.3, -1.2, 0.3, 0.05]);
}

function shade(hex, d) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, v + d));
    return '#' + [c(n >> 16), c((n >> 8) & 255), c(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// ------------------------------------------------------------ grass tile
function grassTile() {
    // seamless 4 m x 4 m tile of blades seen from the camera; drawn at 0.5x in game (tileScale)
    const size = 1024; // px; 1024 px = 2.56 m at PPM 400 → displayed at 0.5 → 200 px/m... keep simple:
    const r = rng(77);
    let body = '';
    const blade = (x, y, h, w, col) => `<path d="M${f(x - w)} ${f(y)} L${f(x + w)} ${f(y)} L${f(x + r.range(-3, 3))} ${f(y - h)} Z" fill="${col}"/>`;
    const cols = ['#46a83a', '#4caf3e', '#3a9632', '#52b443', '#3d9b34'];
    const items = [];
    // sparse little spikes
    for (let i = 0; i < 420; i++) items.push({ x: r.range(0, size), y: r.range(0, size), h: r.range(16, 36), w: r.range(3.5, 6), c: r.pick(cols) });
    // a few clumps of tall blades
    for (let k = 0; k < 14; k++) {
        const cx = r.range(0, size), cy = r.range(0, size);
        for (let i = 0; i < 11; i++) items.push({ x: cx + r.range(-55, 55), y: cy + r.range(-14, 14), h: r.range(70, 150), w: r.range(6, 10), c: r.pick(cols) });
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
        const x = it.x + ox, y = it.y + oy;
        if (x < -20 || x > size + 20 || y < -20 || y > size + 140) continue;
        body += blade(x, y, it.h, it.w, it.c);
    }
    fs.writeFileSync(path.join(IMG, 'grass_tile.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`);
}

// =================================================================== build
const PINE = { trunk: '#8a4a2a', dark: '#2f5a24', mid: '#4f7d33', mid2: '#46742f', light: '#6b9a44' };
const PINE2 = { trunk: '#7c4428', dark: '#24461c', mid: '#3d6a2a', mid2: '#365f26', light: '#56853a' };
const PINE_DARK = { trunk: '#5e3520', dark: '#152a12', mid: '#22401b', mid2: '#1e3a18', light: '#2f5426' };
const ROUND = { trunk: '#7a4a2a', dark: '#223d1a', mid: '#2e4f22', light: '#3a6229' };
const ROUND2 = { trunk: '#7a4a2a', dark: '#2a5a24', mid: '#3a7a30', light: '#4e9038' };
const BUSH = { dark: '#2f6a2a', mid: '#3e8a36', light: '#4e9a40' };
const BUSH2 = { dark: '#2a5f26', mid: '#387d32', light: '#46903c' };
const BERRY = { dark: '#244d22', mid: '#33652b', light: '#3f7533', berry: '#d73a48' };

pine('pine_a', 1, PINE, 5.0, 2.7);
pine('pine_b', 2, PINE2, 5.8, 3.1);
pine('pine_c', 3, PINE, 4.4, 2.5);
pine('pine_dark_a', 4, PINE_DARK, 6.2, 3.5);
pine('pine_dark_b', 5, PINE_DARK, 5.4, 3.2);
pine('pine_small_a', 6, PINE, 2.6, 1.6);
pine('pine_small_b', 7, PINE2, 2.2, 1.4);
roundTree('round_tree_a', 8, ROUND, 5.0, 3.6);
roundTree('round_tree_b', 9, ROUND2, 4.6, 3.3);
// outside the park (outside-park o02, o03, §1): birches west of the paved road, autumn trees east
birch('birch_a', 40, { trunk: '#e6e0d6', band: '#7d7b77', dark: '#466f25', mid: '#5c8c2d', light: '#73a338' }, 4.8, 3.2);
birch('birch_b', 41, { trunk: '#e6e0d6', band: '#7d7b77', dark: '#4f7a28', mid: '#679a32', light: '#7fb03e' }, 4.2, 2.9);
roundTree('autumn_maroon', 42, { trunk: '#5a3a28', dark: '#5e2427', mid: '#7f3233', light: '#9a4641' }, 4.6, 3.4);
roundTree('autumn_olive', 43, { trunk: '#5a3a28', dark: '#4f4f22', mid: '#6b6b2c', light: '#85853a' }, 4.4, 3.2);
roundTree('autumn_orange', 44, { trunk: '#5a3a28', dark: '#8f4519', mid: '#b75f22', light: '#d57d33' }, 4.8, 3.5);
bush('bush_a', 10, BUSH, 2.2);
bush('bush_b', 11, BUSH2, 2.6);
bush('bush_c', 12, BUSH, 1.8);
bush('berry_bush_a', 13, BERRY, 2.4, true);
bush('hide_bush', 31, { dark: '#5f5a26', mid: '#7f7a33', light: '#959040' }, 1.9);
bush('berry_bush_b', 14, BERRY, 2.8, true);
fern('fern_a', 15, '#2f7f30', 1.2);
fern('fern_b', 16, '#33873a', 1.0);
tuft('tuft_a', 17, ['#4fb442', '#3f9e36', '#56bb47'], 0.5);
tuft('tuft_b', 18, ['#4fb442', '#3f9e36', '#56bb47'], 0.4);
flowers('flowers_yellow', 19, '#f2c230', '#e0a020');
flowers('flowers_white', 20, '#f4efe2', '#e8c86a');
stick('stick_a', 21);
stick('stick_b', 22);
pebble('pebble_a', 23);
pebble('pebble_b', 24);
mushrooms('mushrooms');
lilypad('lilypad');
cattails('cattails', 25);
grassTile();
console.log('vegetation written to', path.relative(root, OUT));
