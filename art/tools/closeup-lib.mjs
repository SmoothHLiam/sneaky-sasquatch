/**
 * Shared helpers for the close-up art generators (flat vector SVGs written to
 * public/assets/closeup/). No dependencies.
 *
 *   svg(name, w, h, body)   write public/assets/closeup/<name>.svg (same format as gen-closeup-art.mjs)
 *   json(name, obj)         write public/assets/closeup/<name>.json (manifest key cu_<name> in manifest.json)
 *   rng(seed)               deterministic PRNG
 *   rr / poly / f           tiny path helpers
 *   FONTS / text / fitText  text → <path> outlines (TrueType glyf parser incl. composites,
 *                           cmap 4/12 and GPOS/kern pair kerning), so the SVGs never depend
 *                           on fonts being installed where they are rasterised.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const OUT = path.join(root, 'public/assets/closeup');
fs.mkdirSync(OUT, { recursive: true });

/** numbers in paths: 1 decimal, no trailing zeros */
export const f = (v) => String(Math.round(v * 10) / 10);

export const svg = (name, w, h, body) =>
    fs.writeFileSync(path.join(OUT, name + '.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`);

export const json = (name, obj) => fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(obj, null, 1) + '\n');

export function rng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** rounded-rect path (per-corner radii [tl,tr,br,bl] or one number) */
export function rr(x, y, w, h, r) {
    const [a, b, c, d] = Array.isArray(r) ? r : [r, r, r, r];
    return `M${f(x + a)} ${f(y)}H${f(x + w - b)}${b ? `A${f(b)} ${f(b)} 0 0 1 ${f(x + w)} ${f(y + b)}` : ''}V${f(y + h - c)}${c ? `A${f(c)} ${f(c)} 0 0 1 ${f(x + w - c)} ${f(y + h)}` : ''}H${f(x + d)}${d ? `A${f(d)} ${f(d)} 0 0 1 ${f(x)} ${f(y + h - d)}` : ''}V${f(y + a)}${a ? `A${f(a)} ${f(a)} 0 0 1 ${f(x + a)} ${f(y)}` : ''}Z`;
}
/** polygon path from [[x,y],...] */
export const poly = (pts) => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + 'Z';

// ------------------------------------------------------------------ TrueType
class Font {
    constructor(file, index = 0) {
        const b = (this.b = fs.readFileSync(file));
        this.file = file;
        let off = 0;
        if (b.toString('latin1', 0, 4) === 'ttcf') off = b.readUInt32BE(12 + 4 * index);
        const n = b.readUInt16BE(off + 4);
        this.t = {};
        for (let i = 0; i < n; i++) {
            const r = off + 12 + 16 * i;
            this.t[b.toString('latin1', r, r + 4)] = b.readUInt32BE(r + 8);
        }
        if (!this.t.glyf) throw new Error(file + ': no glyf table');
        this.upm = b.readUInt16BE(this.t.head + 18);
        this.locFmt = b.readInt16BE(this.t.head + 50);
        this.nHM = b.readUInt16BE(this.t.hhea + 34);
        this.cache = new Map();
        this.cmapFn = this.parseCmap();
        this.kernFn = this.parseGPOS() || this.parseKern() || (() => 0);
    }
    parseCmap() {
        const b = this.b, o = this.t.cmap, n = b.readUInt16BE(o + 2);
        let best = null, score = -1;
        for (let i = 0; i < n; i++) {
            const pid = b.readUInt16BE(o + 4 + 8 * i), eid = b.readUInt16BE(o + 6 + 8 * i), so = o + b.readUInt32BE(o + 8 + 8 * i);
            const fmt = b.readUInt16BE(so);
            const sc = fmt === 12 ? 3 : fmt === 4 && pid === 3 && eid === 1 ? 2 : fmt === 4 ? 1 : -1;
            if (sc > score) (score = sc), (best = so);
        }
        const so = best;
        if (b.readUInt16BE(so) === 12) {
            const ng = b.readUInt32BE(so + 12);
            return (cp) => {
                for (let i = 0; i < ng; i++) {
                    const r = so + 16 + 12 * i, s = b.readUInt32BE(r), e = b.readUInt32BE(r + 4);
                    if (cp >= s && cp <= e) return b.readUInt32BE(r + 8) + cp - s;
                }
                return 0;
            };
        }
        const segX2 = b.readUInt16BE(so + 6), ends = so + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ros = deltas + segX2;
        return (cp) => {
            for (let i = 0; i < segX2 / 2; i++) {
                if (cp > b.readUInt16BE(ends + 2 * i)) continue;
                const s = b.readUInt16BE(starts + 2 * i);
                if (cp < s) return 0;
                const delta = b.readInt16BE(deltas + 2 * i), ro = b.readUInt16BE(ros + 2 * i);
                if (!ro) return (cp + delta) & 0xffff;
                const g = b.readUInt16BE(ros + 2 * i + ro + 2 * (cp - s));
                return g ? (g + delta) & 0xffff : 0;
            }
            return 0;
        };
    }
    coverage(o, g) {
        const b = this.b, fmt = b.readUInt16BE(o);
        if (fmt === 1) {
            const n = b.readUInt16BE(o + 2);
            for (let i = 0; i < n; i++) if (b.readUInt16BE(o + 4 + 2 * i) === g) return i;
            return -1;
        }
        const n = b.readUInt16BE(o + 2);
        for (let i = 0; i < n; i++) {
            const r = o + 4 + 6 * i, s = b.readUInt16BE(r), e = b.readUInt16BE(r + 2);
            if (g >= s && g <= e) return b.readUInt16BE(r + 4) + g - s;
        }
        return -1;
    }
    classOf(o, g) {
        const b = this.b, fmt = b.readUInt16BE(o);
        if (fmt === 1) {
            const s = b.readUInt16BE(o + 2), n = b.readUInt16BE(o + 4);
            return g >= s && g < s + n ? b.readUInt16BE(o + 6 + 2 * (g - s)) : 0;
        }
        const n = b.readUInt16BE(o + 2);
        for (let i = 0; i < n; i++) {
            const r = o + 4 + 6 * i;
            if (g >= b.readUInt16BE(r) && g <= b.readUInt16BE(r + 2)) return b.readUInt16BE(r + 4);
        }
        return 0;
    }
    parseGPOS() {
        const b = this.b, o = this.t.GPOS;
        if (!o) return null;
        const fl = o + b.readUInt16BE(o + 6), ll = o + b.readUInt16BE(o + 8);
        const idx = new Set();
        const nf = b.readUInt16BE(fl);
        for (let i = 0; i < nf; i++) {
            if (b.toString('latin1', fl + 2 + 6 * i, fl + 6 + 6 * i) !== 'kern') continue;
            const fo = fl + b.readUInt16BE(fl + 6 + 6 * i), lc = b.readUInt16BE(fo + 2);
            for (let k = 0; k < lc; k++) idx.add(b.readUInt16BE(fo + 4 + 2 * k));
        }
        const subs = [];
        for (const li of [...idx].sort((a, z) => a - z)) {
            const lo = ll + b.readUInt16BE(ll + 2 + 2 * li), type = b.readUInt16BE(lo), sc = b.readUInt16BE(lo + 4);
            for (let s = 0; s < sc; s++) {
                let so = lo + b.readUInt16BE(lo + 6 + 2 * s);
                if (type === 9) {
                    if (b.readUInt16BE(so + 2) !== 2) continue;
                    so = so + b.readUInt32BE(so + 4);
                } else if (type !== 2) continue;
                subs.push(so);
            }
        }
        if (!subs.length) return null;
        const vsize = (vf) => { let n = 0; for (let k = 0; k < 8; k++) if (vf & (1 << k)) n++; return n * 2; };
        const xadvOff = (vf) => { if (!(vf & 4)) return -1; let n = 0; for (let k = 0; k < 2; k++) if (vf & (1 << k)) n++; return n * 2; };
        return (g1, g2) => {
            for (const so of subs) {
                const fmt = b.readUInt16BE(so), ci = this.coverage(so + b.readUInt16BE(so + 2), g1);
                if (ci < 0) continue;
                const vf1 = b.readUInt16BE(so + 4), vf2 = b.readUInt16BE(so + 6), xo = xadvOff(vf1);
                if (fmt === 1) {
                    const ps = so + b.readUInt16BE(so + 10 + 2 * ci), n = b.readUInt16BE(ps), rs = 2 + vsize(vf1) + vsize(vf2);
                    for (let i = 0; i < n; i++) {
                        const r = ps + 2 + rs * i;
                        if (b.readUInt16BE(r) === g2) return xo < 0 ? 0 : b.readInt16BE(r + 2 + xo);
                    }
                } else if (fmt === 2) {
                    const c1 = this.classOf(so + b.readUInt16BE(so + 8), g1), c2 = this.classOf(so + b.readUInt16BE(so + 10), g2);
                    const n2 = b.readUInt16BE(so + 14), rs = vsize(vf1) + vsize(vf2);
                    return xo < 0 ? 0 : b.readInt16BE(so + 16 + (c1 * n2 + c2) * rs + xo);
                }
            }
            return 0;
        };
    }
    parseKern() {
        const b = this.b, o = this.t.kern;
        if (!o || b.readUInt16BE(o) !== 0) return null;
        const so = o + 4;
        if (b.readUInt16BE(so + 4) >> 8 !== 0) return null;
        const n = b.readUInt16BE(so + 6), m = new Map();
        for (let i = 0; i < n; i++) {
            const r = so + 14 + 6 * i;
            m.set(b.readUInt16BE(r) * 65536 + b.readUInt16BE(r + 2), b.readInt16BE(r + 4));
        }
        return (a, z) => m.get(a * 65536 + z) || 0;
    }
    adv(g) {
        return this.b.readUInt16BE(this.t.hmtx + 4 * Math.min(g, this.nHM - 1));
    }
    loca(g) {
        return this.locFmt ? this.b.readUInt32BE(this.t.loca + 4 * g) : this.b.readUInt16BE(this.t.loca + 2 * g) * 2;
    }
    /** contours: [[{x,y,on}]] in font units, y up */
    glyph(g) {
        if (this.cache.has(g)) return this.cache.get(g);
        const b = this.b, o0 = this.loca(g), o1 = this.loca(g + 1);
        let res = [];
        if (o1 > o0) {
            const p = this.t.glyf + o0, nc = b.readInt16BE(p);
            if (nc >= 0) {
                const ends = [];
                for (let i = 0; i < nc; i++) ends.push(b.readUInt16BE(p + 10 + 2 * i));
                const np = nc ? ends[nc - 1] + 1 : 0;
                let q = p + 12 + 2 * nc + b.readUInt16BE(p + 10 + 2 * nc);
                const fl = [];
                while (fl.length < np) {
                    const fv = b[q++];
                    fl.push(fv);
                    if (fv & 8) for (let r = b[q++]; r > 0; r--) fl.push(fv);
                }
                const xs = [], ys = [];
                let v = 0;
                for (const fv of fl) {
                    if (fv & 2) v += fv & 16 ? b[q++] : -b[q++];
                    else if (!(fv & 16)) (v += b.readInt16BE(q)), (q += 2);
                    xs.push(v);
                }
                v = 0;
                for (const fv of fl) {
                    if (fv & 4) v += fv & 32 ? b[q++] : -b[q++];
                    else if (!(fv & 32)) (v += b.readInt16BE(q)), (q += 2);
                    ys.push(v);
                }
                let s = 0;
                for (const e of ends) {
                    const c = [];
                    for (let i = s; i <= e; i++) c.push({ x: xs[i], y: ys[i], on: !!(fl[i] & 1) });
                    res.push(c);
                    s = e + 1;
                }
            } else {
                let q = p + 10, fl;
                const f2 = (o) => b.readInt16BE(o) / 16384;
                do {
                    fl = b.readUInt16BE(q);
                    const gi = b.readUInt16BE(q + 2);
                    q += 4;
                    let dx, dy;
                    if (fl & 1) (dx = b.readInt16BE(q)), (dy = b.readInt16BE(q + 2)), (q += 4);
                    else (dx = b.readInt8(q)), (dy = b.readInt8(q + 1)), (q += 2);
                    if (!(fl & 2)) dx = dy = 0;
                    let a = 1, bb = 0, c = 0, d = 1;
                    if (fl & 8) (a = d = f2(q)), (q += 2);
                    else if (fl & 0x40) (a = f2(q)), (d = f2(q + 2)), (q += 4);
                    else if (fl & 0x80) (a = f2(q)), (bb = f2(q + 2)), (c = f2(q + 4)), (d = f2(q + 6)), (q += 8);
                    for (const ct of this.glyph(gi)) res.push(ct.map((pt) => ({ x: a * pt.x + c * pt.y + dx, y: bb * pt.x + d * pt.y + dy, on: pt.on })));
                } while (fl & 0x20);
            }
        }
        this.cache.set(g, res);
        return res;
    }
    gid(ch) {
        return this.cmapFn(ch.codePointAt(0));
    }
}

/** lay out a string: returns quadratic segments in px (y down) plus ink bbox and advance */
function layout(font, str, size, letterSpacing = 0) {
    const k = size / font.upm, segs = [];
    let pen = 0, prev = -1;
    for (const ch of str) {
        const g = font.gid(ch);
        if (prev >= 0) pen += font.kernFn(prev, g) * k;
        for (const ct of font.glyph(g)) {
            const n = ct.length;
            if (!n) continue;
            const P = (i) => ({ x: pen + ct[(i + n) % n].x * k, y: -ct[(i + n) % n].y * k, on: ct[(i + n) % n].on });
            let st = ct.findIndex((pt) => pt.on), start;
            if (st < 0) {
                const a = P(0), z = P(1);
                start = { x: (a.x + z.x) / 2, y: (a.y + z.y) / 2 };
                st = 0;
            } else start = P(st);
            const c = { start, parts: [] };
            let ctrl = null, cur = start;
            for (let i = 1; i <= n; i++) {
                const pt = i === n && ct[st].on ? start : P(st + i);
                if (pt.on || (i === n && ct[st].on)) {
                    c.parts.push(ctrl ? { q: [cur, ctrl, pt] } : { l: [cur, pt] });
                    cur = pt;
                    ctrl = null;
                } else if (ctrl) {
                    const mid = { x: (ctrl.x + pt.x) / 2, y: (ctrl.y + pt.y) / 2 };
                    c.parts.push({ q: [cur, ctrl, mid] });
                    cur = mid;
                    ctrl = pt;
                } else ctrl = pt;
            }
            if (ctrl) c.parts.push({ q: [cur, ctrl, start] });
            segs.push(c);
        }
        pen += font.adv(g) * k + letterSpacing;
        prev = g;
    }
    pen -= letterSpacing;
    // exact ink bbox
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
    for (const c of segs)
        for (const p of c.parts) {
            if (p.l) { add(p.l[0].x, p.l[0].y); add(p.l[1].x, p.l[1].y); continue; }
            const [a, b, z] = p.q;
            add(a.x, a.y); add(z.x, z.y);
            for (const ax of ['x', 'y']) {
                const den = a[ax] - 2 * b[ax] + z[ax];
                if (Math.abs(den) < 1e-9) continue;
                const t = (a[ax] - b[ax]) / den;
                if (t > 0 && t < 1) {
                    const u = 1 - t;
                    add(u * u * a.x + 2 * u * t * b.x + t * t * z.x, u * u * a.y + 2 * u * t * b.y + t * t * z.y);
                }
            }
        }
    return { segs, adv: pen, x0, y0, x1, y1 };
}

function toD(segs, tx) {
    let d = '';
    for (const c of segs) {
        const s = tx(c.start);
        d += `M${f(s.x)} ${f(s.y)}`;
        for (const p of c.parts) {
            if (p.l) { const e = tx(p.l[1]); d += `L${f(e.x)} ${f(e.y)}`; }
            else { const q = tx(p.q[1]), e = tx(p.q[2]); d += `Q${f(q.x)} ${f(q.y)} ${f(e.x)} ${f(e.y)}`; }
        }
        d += 'Z';
    }
    return d;
}

/**
 * Text at a baseline: text(font, 'Hi', { x, y, size, anchor: 'start'|'middle'|'end', sx (h-stretch), skew, ls })
 * returns { d, x0, x1, y0, y1 } (d = path data)
 */
export function text(font, str, o) {
    const { x = 0, y = 0, size = 100, anchor = 'start', sx = 1, ls = 0, skew = 0 } = o;
    const L = layout(font, str, size, ls);
    const w = L.adv * sx;
    const ox = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
    const tx = (p) => ({ x: ox + p.x * sx - p.y * skew, y: y + p.y });
    return { d: toD(L.segs, tx), x0: ox + L.x0 * sx, x1: ox + L.x1 * sx, y0: y + L.y0, y1: y + L.y1, adv: w };
}

/**
 * Text whose ink bounding box exactly fills [x0,y0,x1,y1] (independent x/y scale).
 * Use for matching letters measured off the reference stills. `skew` shears x by -y.
 */
export function fitText(font, str, [bx0, by0, bx1, by1], o = {}) {
    const L = layout(font, str, 1000, o.ls || 0);
    const skew = o.skew || 0;
    // bbox after skew: approximate with extreme points of the segments
    let x0 = Infinity, x1 = -Infinity;
    for (const c of L.segs) for (const p of c.parts) for (const q of p.l || p.q) { const xx = q.x - q.y * skew; if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; }
    const sx = (bx1 - bx0) / (x1 - x0), sy = (by1 - by0) / (L.y1 - L.y0);
    const tx = (p) => ({ x: bx0 + (p.x - p.y * skew - x0) * sx, y: by0 + (p.y - L.y0) * sy });
    return toD(L.segs, tx);
}

// fonts: the game's own Bree Serif is bundled; heavier display faces come from macOS
// system fonts when present and fall back to Bree Serif elsewhere (outputs are committed).
const FONT_DIR = path.join(root, 'public/assets/fonts');
const SYS = '/System/Library/Fonts';
function tryFont(file, index, fallback) {
    try {
        if (fs.existsSync(file)) return new Font(file, index);
    } catch (e) {
        console.warn('font', file, e.message);
    }
    if (fallback) console.warn(`font ${path.basename(file)}#${index} missing, using Bree Serif`);
    return fallback;
}
let _fonts = null;
export function FONTS() {
    if (_fonts) return _fonts;
    const bree = new Font(path.join(FONT_DIR, 'BreeSerif-Regular.ttf'));
    _fonts = {
        bree,
        rockwellBold: tryFont(SYS + '/Supplemental/Rockwell.ttc', 2, bree),
        avenirReg: tryFont(SYS + '/Avenir Next.ttc', 7, bree),
        avenirBold: tryFont(SYS + '/Avenir Next.ttc', 0, bree),
        avenirDemi: tryFont(SYS + '/Avenir Next.ttc', 2, bree),
        avenirBoldItalic: tryFont(SYS + '/Avenir Next.ttc', 1, bree),
        avenirHeavy: tryFont(SYS + '/Avenir Next.ttc', 8, bree),
        avenirHeavyItalic: tryFont(SYS + '/Avenir Next.ttc', 9, bree),
        din: tryFont(SYS + '/Supplemental/DIN Alternate Bold.ttf', 0, bree),
    };
    return _fonts;
}
