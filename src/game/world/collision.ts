import { Vec, closestOnSegment, dist, pointInPoly, segmentHitsCircle, segmentsIntersect } from '../core/math';

interface CircleShape { kind: 'circle'; c: Vec; r: number; sight: boolean; solid: boolean; tag?: string }
interface PolyShape { kind: 'poly'; pts: Vec[]; sight: boolean; solid: boolean; tag?: string; minX: number; minY: number; maxX: number; maxY: number }
type Shape = CircleShape | PolyShape;

const CELL = 4;

/**
 * Static collision + line-of-sight world for one zone (metres).
 * A simple spatial hash keeps queries cheap even with hundreds of trees.
 */
export class CollisionWorld {
    private grid = new Map<string, Shape[]>();
    private all: Shape[] = [];
    /** circles that hide the player (bushes) */
    hideSpots: { c: Vec; r: number }[] = [];

    constructor(public w: number, public h: number) {}

    private key(cx: number, cy: number) {
        return cx + ',' + cy;
    }

    private insert(s: Shape, minX: number, minY: number, maxX: number, maxY: number) {
        this.all.push(s);
        for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++)
            for (let cy = Math.floor(minY / CELL); cy <= Math.floor(maxY / CELL); cy++) {
                const k = this.key(cx, cy);
                let arr = this.grid.get(k);
                if (!arr) this.grid.set(k, (arr = []));
                arr.push(s);
            }
    }

    addCircle(c: Vec, r: number, opts: { sight?: boolean; solid?: boolean; tag?: string } = {}) {
        const s: CircleShape = { kind: 'circle', c, r, sight: !!opts.sight, solid: opts.solid !== false, tag: opts.tag };
        this.insert(s, c.x - r, c.y - r, c.x + r, c.y + r);
    }

    addBox(cx: number, cy: number, w: number, d: number, opts: { sight?: boolean; solid?: boolean; tag?: string } = {}) {
        this.addPoly([
            { x: cx - w / 2, y: cy - d / 2 },
            { x: cx + w / 2, y: cy - d / 2 },
            { x: cx + w / 2, y: cy + d / 2 },
            { x: cx - w / 2, y: cy + d / 2 },
        ], opts);
    }

    addPoly(pts: Vec[], opts: { sight?: boolean; solid?: boolean; tag?: string } = {}) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of pts) {
            minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        }
        const s: PolyShape = { kind: 'poly', pts, sight: !!opts.sight, solid: opts.solid !== false, tag: opts.tag, minX, minY, maxX, maxY };
        this.insert(s, minX, minY, maxX, maxY);
    }

    addHideSpot(c: Vec, r: number) {
        this.hideSpots.push({ c, r });
    }

    private near(minX: number, minY: number, maxX: number, maxY: number): Set<Shape> {
        const out = new Set<Shape>();
        for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++)
            for (let cy = Math.floor(minY / CELL); cy <= Math.floor(maxY / CELL); cy++) {
                const arr = this.grid.get(this.key(cx, cy));
                if (arr) for (const s of arr) out.add(s);
            }
        return out;
    }

    /** Push a circle (p, r) out of all solid shapes and the zone bounds. Returns the corrected position. */
    resolve(p: Vec, r: number, ignoreTag?: string): Vec {
        let x = p.x, y = p.y;
        for (let iter = 0; iter < 3; iter++) {
            let moved = false;
            for (const s of this.near(x - r, y - r, x + r, y + r)) {
                if (!s.solid || (ignoreTag && s.tag === ignoreTag)) continue;
                if (s.kind === 'circle') {
                    const dx = x - s.c.x, dy = y - s.c.y;
                    const d = Math.hypot(dx, dy);
                    const min = r + s.r;
                    if (d < min) {
                        const nx = d > 1e-6 ? dx / d : 1, ny = d > 1e-6 ? dy / d : 0;
                        x = s.c.x + nx * min;
                        y = s.c.y + ny * min;
                        moved = true;
                    }
                } else {
                    if (x + r < s.minX || x - r > s.maxX || y + r < s.minY || y - r > s.maxY) continue;
                    const inside = pointInPoly({ x, y }, s.pts);
                    let best: Vec | null = null, bestD = Infinity;
                    for (let i = 0; i < s.pts.length; i++) {
                        const a = s.pts[i], b = s.pts[(i + 1) % s.pts.length];
                        const c = closestOnSegment({ x, y }, a, b);
                        const d = dist(c, { x, y });
                        if (d < bestD) { bestD = d; best = c; }
                    }
                    if (!best) continue;
                    if (inside) {
                        const dx = best.x - x, dy = best.y - y;
                        const d = Math.hypot(dx, dy) || 1e-6;
                        x = best.x + (dx / d) * r;
                        y = best.y + (dy / d) * r;
                        moved = true;
                    } else if (bestD < r) {
                        const dx = x - best.x, dy = y - best.y;
                        const d = bestD || 1e-6;
                        x = best.x + (dx / d) * r;
                        y = best.y + (dy / d) * r;
                        moved = true;
                    }
                }
            }
            if (!moved) break;
        }
        x = Math.max(r, Math.min(this.w - r, x));
        y = Math.max(r, Math.min(this.h - r, y));
        return { x, y };
    }

    /** True when nothing that blocks sight lies between a and b. */
    lineOfSight(a: Vec, b: Vec): boolean {
        const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
        const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
        for (const s of this.near(minX, minY, maxX, maxY)) {
            if (!s.sight) continue;
            if (s.kind === 'circle') {
                // ignore shapes that contain either end-point (the viewer/target standing at it)
                if (dist(a, s.c) < s.r || dist(b, s.c) < s.r) continue;
                if (segmentHitsCircle(a, b, s.c, s.r)) return false;
            } else {
                if (maxX < s.minX || minX > s.maxX || maxY < s.minY || minY > s.maxY) continue;
                for (let i = 0; i < s.pts.length; i++) {
                    if (segmentsIntersect(a, b, s.pts[i], s.pts[(i + 1) % s.pts.length])) return false;
                }
            }
        }
        return true;
    }

    /** Is a circle at p free of solid shapes? */
    isFree(p: Vec, r: number): boolean {
        const q = this.resolve(p, r);
        return Math.abs(q.x - p.x) < 1e-4 && Math.abs(q.y - p.y) < 1e-4;
    }

    hideSpotAt(p: Vec): { c: Vec; r: number } | null {
        for (const h of this.hideSpots) if (dist(p, h.c) < h.r * 0.85) return h;
        return null;
    }
}
