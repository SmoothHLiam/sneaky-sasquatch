import { Vec, pointInPoly, rng } from '../../core/math';
import type { PropPlacement } from '../types';

/**
 * Authoring helpers for zone data. All coordinates in metres (x east, y north).
 */

/** Fill a polygon with randomly placed props of the given types, keeping `minGap` between them. */
export function scatter(
    poly: Vec[],
    types: { type: string; weight: number }[],
    count: number,
    seed: number,
    opts: { minGap?: number; avoid?: Vec[][]; avoidPts?: { p: Vec; r: number }[] } = {},
): PropPlacement[] {
    const r = rng(seed);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of poly) {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    }
    const total = types.reduce((a, b) => a + b.weight, 0);
    const out: PropPlacement[] = [];
    const gap = opts.minGap ?? 1.5;
    let tries = 0;
    while (out.length < count && tries++ < count * 40) {
        const p = { x: r.range(minX, maxX), y: r.range(minY, maxY) };
        if (!pointInPoly(p, poly)) continue;
        if (opts.avoid?.some((a) => pointInPoly(p, a))) continue;
        if (opts.avoidPts?.some((a) => Math.hypot(a.p.x - p.x, a.p.y - p.y) < a.r)) continue;
        if (out.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < gap)) continue;
        let pick = r.next() * total;
        let type = types[0].type;
        for (const t of types) {
            if ((pick -= t.weight) <= 0) { type = t.type; break; }
        }
        out.push({ type, x: +p.x.toFixed(2), y: +p.y.toFixed(2), flip: r.chance(0.5) });
    }
    return out;
}

/** Axis-aligned rectangle as a polygon. */
export const rect = (x: number, y: number, w: number, h: number): Vec[] => [
    { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h },
];

/** Shorthand for point lists: pts(x1,y1, x2,y2, ...) */
export function pts(...n: number[]): Vec[] {
    const out: Vec[] = [];
    for (let i = 0; i < n.length; i += 2) out.push({ x: n[i], y: n[i + 1] });
    return out;
}

/** Dense forest mix used on zone borders. */
export const FOREST_MIX = [
    { type: 'pine', weight: 5 },
    { type: 'pineDark', weight: 3 },
    { type: 'roundTree', weight: 2 },
    { type: 'pineSmall', weight: 1 },
];

export const UNDERGROWTH_MIX = [
    { type: 'bush', weight: 3 },
    { type: 'berryBush', weight: 2 },
    { type: 'fern', weight: 3 },
];

/** Small flat decals sprinkled on grass. */
export const DECAL_MIX = [
    { type: 'grassTuft', weight: 6 },
    { type: 'pebble', weight: 2 },
    { type: 'stick', weight: 1 },
    { type: 'flowersYellow', weight: 1 },
    { type: 'flowersWhite', weight: 1 },
];

/**
 * Fill a forest area with trees (+ some undergrowth). Returns props; add the
 * same polygon to the zone's `cover` list so it hides the sasquatch.
 */
export function forest(poly: Vec[], seed: number, opts: { trees?: number; gap?: number; under?: number; mix?: { type: string; weight: number }[] } = {}): PropPlacement[] {
    let area = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) area += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
    area = Math.abs(area / 2);
    const trees = opts.trees ?? Math.round(area / 3.0);
    const out = scatter(poly, opts.mix ?? FOREST_MIX, trees, seed, { minGap: opts.gap ?? 1.2 });
    out.push(...scatter(poly, UNDERGROWTH_MIX, opts.under ?? Math.round(area / 30), seed + 1, { minGap: 1.2 }));
    return out;
}
