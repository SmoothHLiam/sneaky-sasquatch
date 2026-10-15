import type { Vec } from '../core/math';
import type { CollisionWorld } from './collision';

/**
 * Coarse walkability grid + A* for NPCs (rangers chasing, campers wandering).
 * Built once per zone from the collision world.
 */
export class NavGrid {
    readonly cell = 0.5;
    readonly cols: number;
    readonly rows: number;
    private blocked: Uint8Array;

    constructor(private world: CollisionWorld, agentRadius = 0.3) {
        this.cols = Math.ceil(world.w / this.cell);
        this.rows = Math.ceil(world.h / this.cell);
        this.blocked = new Uint8Array(this.cols * this.rows);
        for (let r = 0; r < this.rows; r++)
            for (let c = 0; c < this.cols; c++) {
                const p = { x: (c + 0.5) * this.cell, y: (r + 0.5) * this.cell };
                if (!world.isFree(p, agentRadius)) this.blocked[r * this.cols + c] = 1;
            }
    }

    private idx(c: number, r: number) {
        return r * this.cols + c;
    }

    walkable(p: Vec) {
        const c = Math.floor(p.x / this.cell), r = Math.floor(p.y / this.cell);
        if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return false;
        return !this.blocked[this.idx(c, r)];
    }

    /** Nearest walkable cell centre to p (spiral search). */
    nearestWalkable(p: Vec): Vec {
        const c0 = Math.floor(p.x / this.cell), r0 = Math.floor(p.y / this.cell);
        for (let rad = 0; rad < 20; rad++)
            for (let dc = -rad; dc <= rad; dc++)
                for (let dr = -rad; dr <= rad; dr++) {
                    if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad) continue;
                    const c = c0 + dc, r = r0 + dr;
                    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
                    if (!this.blocked[this.idx(c, r)]) return { x: (c + 0.5) * this.cell, y: (r + 0.5) * this.cell };
                }
        return p;
    }

    /** A* path from a to b (metres). Returns waypoints (excluding start), simplified by line-of-walk. */
    path(a: Vec, b: Vec, maxNodes = 6000): Vec[] | null {
        const start = this.nearestWalkable(a), goal = this.nearestWalkable(b);
        const sc = Math.floor(start.x / this.cell), sr = Math.floor(start.y / this.cell);
        const gc = Math.floor(goal.x / this.cell), gr = Math.floor(goal.y / this.cell);
        const N = this.cols * this.rows;
        const gScore = new Float32Array(N).fill(Infinity);
        const came = new Int32Array(N).fill(-1);
        const closed = new Uint8Array(N);
        const open: { i: number; f: number }[] = [];
        const h = (c: number, r: number) => Math.hypot(c - gc, r - gr);
        const si = this.idx(sc, sr), gi = this.idx(gc, gr);
        gScore[si] = 0;
        open.push({ i: si, f: h(sc, sr) });
        let expanded = 0;
        while (open.length) {
            // small open lists: linear min is fine
            let bi = 0;
            for (let k = 1; k < open.length; k++) if (open[k].f < open[bi].f) bi = k;
            const cur = open.splice(bi, 1)[0];
            if (closed[cur.i]) continue;
            closed[cur.i] = 1;
            if (cur.i === gi) break;
            if (++expanded > maxNodes) return null;
            const cc = cur.i % this.cols, cr = Math.floor(cur.i / this.cols);
            for (let dc = -1; dc <= 1; dc++)
                for (let dr = -1; dr <= 1; dr++) {
                    if (!dc && !dr) continue;
                    const nc = cc + dc, nr = cr + dr;
                    if (nc < 0 || nr < 0 || nc >= this.cols || nr >= this.rows) continue;
                    const ni = this.idx(nc, nr);
                    if (this.blocked[ni] || closed[ni]) continue;
                    if (dc && dr && (this.blocked[this.idx(cc + dc, cr)] || this.blocked[this.idx(cc, cr + dr)])) continue;
                    const g = gScore[cur.i] + (dc && dr ? 1.4142 : 1);
                    if (g < gScore[ni]) {
                        gScore[ni] = g;
                        came[ni] = cur.i;
                        open.push({ i: ni, f: g + h(nc, nr) });
                    }
                }
        }
        if (came[gi] === -1 && gi !== si) return null;
        const cells: Vec[] = [];
        for (let i = gi; i !== -1 && i !== si; i = came[i]) {
            cells.push({ x: ((i % this.cols) + 0.5) * this.cell, y: (Math.floor(i / this.cols) + 0.5) * this.cell });
        }
        cells.reverse();
        cells.push(b);
        // string-pull: skip waypoints that are directly reachable
        const out: Vec[] = [];
        let from = a;
        let k = 0;
        while (k < cells.length) {
            let far = k;
            for (let j = cells.length - 1; j > k; j--) {
                if (this.clearLine(from, cells[j])) { far = j; break; }
            }
            out.push(cells[far]);
            from = cells[far];
            k = far + 1;
        }
        return out;
    }

    clearLine(a: Vec, b: Vec): boolean {
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        const steps = Math.ceil(d / (this.cell * 0.5));
        for (let s = 1; s < steps; s++) {
            const t = s / steps;
            if (!this.walkable({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return false;
        }
        return true;
    }

    get collision() {
        return this.world;
    }
}
