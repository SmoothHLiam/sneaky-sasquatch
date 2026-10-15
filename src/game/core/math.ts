export interface Vec { x: number; y: number }

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const len = (x: number, y: number) => Math.hypot(x, y);

/** Wrap an angle to (-PI, PI]. */
export function wrapAngle(a: number): number {
    a = (a + Math.PI) % TAU;
    if (a < 0) a += TAU;
    return a - Math.PI;
}

/** Rotate `from` toward `to` by at most `maxStep` radians. */
export function approachAngle(from: number, to: number, maxStep: number): number {
    const d = wrapAngle(to - from);
    if (Math.abs(d) <= maxStep) return to;
    return from + Math.sign(d) * maxStep;
}

export function approach(v: number, target: number, step: number): number {
    if (v < target) return Math.min(target, v + step);
    return Math.max(target, v - step);
}

export const easeOutBack = (t: number, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/** Small deterministic RNG (mulberry32) so procedural scatter is stable between runs. */
export function rng(seed: number) {
    let s = seed >>> 0;
    const next = () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
        next,
        range: (a: number, b: number) => a + (b - a) * next(),
        int: (a: number, b: number) => Math.floor(a + (b - a + 1) * next()),
        pick: <T>(arr: readonly T[]) => arr[Math.floor(next() * arr.length)],
        chance: (p: number) => next() < p,
    };
}
export type Rng = ReturnType<typeof rng>;

/** Point-in-polygon (even-odd). */
export function pointInPoly(p: Vec, poly: readonly Vec[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
}

/** Closest point on segment ab to p. */
export function closestOnSegment(p: Vec, a: Vec, b: Vec): Vec {
    const abx = b.x - a.x, aby = b.y - a.y;
    const l2 = abx * abx + aby * aby;
    let t = l2 > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2 : 0;
    t = clamp(t, 0, 1);
    return { x: a.x + abx * t, y: a.y + aby * t };
}

/** Does segment p→q intersect segment a→b? */
export function segmentsIntersect(p: Vec, q: Vec, a: Vec, b: Vec): boolean {
    const d = (q.x - p.x) * (b.y - a.y) - (q.y - p.y) * (b.x - a.x);
    if (d === 0) return false;
    const u = ((a.x - p.x) * (b.y - a.y) - (a.y - p.y) * (b.x - a.x)) / d;
    const v = ((a.x - p.x) * (q.y - p.y) - (a.y - p.y) * (q.x - p.x)) / d;
    return u >= 0 && u <= 1 && v >= 0 && v <= 1;
}

/** Does segment p→q pass within r of point c? */
export function segmentHitsCircle(p: Vec, q: Vec, c: Vec, r: number): boolean {
    const cp = closestOnSegment(c, p, q);
    return dist(cp, c) < r;
}

/** Catmull-Rom smoothing of a closed (or open) polyline, for organic ground shapes. */
export function smoothPath(pts: readonly Vec[], closed: boolean, steps = 6): Vec[] {
    const out: Vec[] = [];
    const n = pts.length;
    const get = (i: number) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
        const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
        for (let s = 0; s < steps; s++) {
            const t = s / steps, t2 = t * t, t3 = t2 * t;
            out.push({
                x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
                y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
            });
        }
    }
    if (!closed) out.push(pts[n - 1]);
    return out;
}

/** Offset a polyline/polygon outward by d (approximate, miter-less). */
export function offsetPoly(pts: readonly Vec[], d: number, closed = true): Vec[] {
    const n = pts.length;
    const out: Vec[] = [];
    // signed area to know winding
    let area = 0;
    for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        area += a.x * b.y - b.x * a.y;
    }
    const sgn = area > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
        const prev = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
        const next = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
        let tx = next.x - prev.x, ty = next.y - prev.y;
        const l = Math.hypot(tx, ty) || 1;
        tx /= l; ty /= l;
        // outward normal for CCW polygon is (ty, -tx)
        out.push({ x: pts[i].x + ty * d * sgn, y: pts[i].y - tx * d * sgn });
    }
    return out;
}

export function polyBounds(pts: readonly Vec[]) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
}
