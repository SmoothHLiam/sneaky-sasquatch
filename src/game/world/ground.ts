import * as Phaser from 'phaser';
import { Vec, offsetPoly, polyBounds, rng, smoothPath } from '../core/math';
import { wx, wy } from '../core/proj';
import type { GroundKind, GroundPatch, ZoneDef } from './types';

/**
 * Ground palette — sampled from the reference captures. Each kind can have a
 * rim (drawn first, slightly larger) to give dirt/water the raised-edge look
 * of the original.
 */
export const GROUND_STYLE: Record<GroundKind, { fill: number; rim?: number; rimW?: number; lip?: number; lipH?: number; order: number }> = {
    grassLight: { fill: 0x5aaa3c, order: 0 },
    dirt: { fill: 0xa46e3a, rim: 0x8f5d30, rimW: 0.12, order: 2 },
    path: { fill: 0xc8924c, rim: 0xb07c3e, rimW: 0.1, order: 1 },
    sand: { fill: 0xe8d39a, order: 1 },
    gravel: { fill: 0x9a9890, order: 1 },
    asphalt: { fill: 0x5f6968, order: 1 },
    snow: { fill: 0xeef4f6, order: 1 },
    wood: { fill: 0xa8743e, rim: 0x7a5028, rimW: 0.08, order: 3 },
    water: { fill: 0x45c3d6, rim: 0x9c6636, rimW: 0.55, lip: 0x7f522a, lipH: 0.25, order: 4 },
    // road markings and sandy road shoulders (outside-park o02: yellow centre line #c9a830)
    shoulder: { fill: 0xc8924c, order: 0.5 },
    lineYellow: { fill: 0xc9a830, order: 5 },
    lineWhite: { fill: 0xe8ebe8, order: 5 },
    // race circuit: kerb red, chequered-line squares (outside-park §4.3)
    kerbRed: { fill: 0xe0405a, order: 5 },
    chequer: { fill: 0x3e4644, order: 6 },
};

export const GRASS_BASE = 0x41a036;

/** Turn a patch definition into a projected polygon in world pixels. */
export function patchPolygon(p: GroundPatch): Vec[] {
    if (p.width) {
        // ribbon along a centre line
        const centre = p.sharp ? p.pts : smoothPath(p.pts, false, 8);
        const left: Vec[] = [], right: Vec[] = [];
        for (let i = 0; i < centre.length; i++) {
            const a = centre[Math.max(0, i - 1)], b = centre[Math.min(centre.length - 1, i + 1)];
            let tx = b.x - a.x, ty = b.y - a.y;
            const l = Math.hypot(tx, ty) || 1;
            tx /= l; ty /= l;
            const hw = p.width / 2;
            left.push({ x: centre[i].x - ty * hw, y: centre[i].y + tx * hw });
            right.push({ x: centre[i].x + ty * hw, y: centre[i].y - tx * hw });
        }
        return [...left, ...right.reverse()];
    }
    return p.sharp ? p.pts.slice() : smoothPath(p.pts, true, 8);
}

function toWorldPx(pts: Vec[]): Vec[] {
    return pts.map((p) => ({ x: wx(p.x), y: wy(p.y) }));
}

function addPoly(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer, ptsWorldPx: Vec[], color: number, alpha = 1) {
    const b = polyBounds(ptsWorldPx);
    const local = ptsWorldPx.map((p) => ({ x: p.x - b.minX, y: p.y - b.minY }));
    const poly = scene.add.polygon(b.minX, b.minY, local, color, alpha);
    poly.setOrigin(0, 0);
    layer.add(poly);
    return poly;
}

/**
 * Builds the ground for a zone into `layer` (behind everything else).
 * Returns the water polygons (metres) so gameplay can query them.
 */
export function buildGround(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer, zone: ZoneDef) {
    const W = wx(zone.w), H0 = wy(zone.h), H1 = wy(0);
    // base fill (a bit beyond the zone so the camera never sees black at edges)
    const pad = 4000;
    const base = scene.add.rectangle(-pad, H0 - pad, W + pad * 2, H1 - H0 + pad * 2, zone.groundColor ?? GRASS_BASE).setOrigin(0, 0);
    layer.add(base);

    const patches = zone.ground.slice().sort((a, b) => (GROUND_STYLE[a.kind].order - GROUND_STYLE[b.kind].order) || ((a.z ?? 0) - (b.z ?? 0)));
    const water: Vec[][] = [];

    // light grass first, then the blade texture over all grass, then everything else
    const light = patches.filter((p) => p.kind === 'grassLight');
    const rest = patches.filter((p) => p.kind !== 'grassLight');
    for (const p of light) addPoly(scene, layer, toWorldPx(patchPolygon(p)), GROUND_STYLE.grassLight.fill);

    let grass: Phaser.GameObjects.TileSprite | null = null;
    if (zone.grass !== false && scene.textures.exists('grass_tile')) {
        const t = (grass = scene.add.tileSprite(-pad, H0 - pad, W + pad * 2, H1 - H0 + pad * 2, 'grass_tile').setOrigin(0, 0));
        t.setTileScale(0.5, 0.5);
        layer.add(t);
    }

    // consecutive patches of one kind merge: all their rims go down before any of their fills,
    // so a road running into a parking lot doesn't show a rim line across the join
    for (let i = 0; i < rest.length; ) {
        let j = i;
        while (j < rest.length && rest[j].kind === rest[i].kind) j++;
        const group = rest.slice(i, j);
        const st = GROUND_STYLE[rest[i].kind];
        for (const p of group) {
            if (st.rim === undefined || !st.rimW) continue;
            const poly = patchPolygon(p);
            const outer = p.width ? patchPolygon({ ...p, width: p.width + st.rimW * 2 }) : offsetPoly(poly, st.rimW);
            addPoly(scene, layer, toWorldPx(outer), st.rim);
            if (st.lip !== undefined && st.lipH) {
                // darker band just inside the top edge: reads as the bank's vertical face
                addPoly(scene, layer, toWorldPx(offsetPoly(poly, st.rimW * 0.15)), st.lip);
            }
        }
        for (const p of group) {
            const poly = patchPolygon(p);
            if (p.kind === 'water') water.push(poly);
            const fillPts = toWorldPx(poly);
            if (p.kind === 'water' && st.lipH) {
                // shift the water surface down a touch so the bank's face shows along the far edge
                const drop = st.lipH * 100 * 0.62;
                addPoly(scene, layer, fillPts.map((q) => ({ x: q.x, y: q.y + drop })), st.fill);
            } else {
                addPoly(scene, layer, fillPts, st.fill);
            }
        }
        i = j;
    }

    // procedural specks on dirt: small darker pebbles, like the original's dirt patches
    const r = rng((zone.scatter?.seed ?? 1) * 7919);
    for (const p of rest) {
        if (p.kind !== 'dirt' && p.kind !== 'path') continue;
        const poly = patchPolygon(p);
        const b = polyBounds(poly);
        const area = (b.maxX - b.minX) * (b.maxY - b.minY);
        const n = Math.round(area * (p.kind === 'dirt' ? 0.25 : 0.08));
        const g = scene.add.graphics();
        layer.add(g);
        const col = p.kind === 'dirt' ? 0x8c5b2f : 0xa97a3f;
        for (let i = 0; i < n; i++) {
            const q = { x: r.range(b.minX, b.maxX), y: r.range(b.minY, b.maxY) };
            if (!inside(q, poly)) continue;
            g.fillStyle(col, 0.9);
            const w = r.range(0.12, 0.32) * 100, h = w * 0.55;
            g.fillEllipse(wx(q.x), wy(q.y), w, h);
        }
    }
    return { water, grass };
}

function inside(p: Vec, poly: Vec[]) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
}
