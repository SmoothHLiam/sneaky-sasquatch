import type { ZoneDef } from '../types';
import { DECAL_MIX, forest, pts, rect, scatter } from './helpers';

/**
 * LAKE (north shore) — south of the junction (inside-park 941-948 s, k945, and the
 * "RV Park ↑ / Lake ↓" sign). Only its first seconds are in the video: the dirt
 * road coming down from the north, a red outhouse and a picnic table west of it,
 * a tan camper trailer, forest. The shore itself is extrapolated from the park
 * map (big lake south of the campground) — [guess] layout, to verify with M3 footage.
 */
const W = 60, H = 48;

const road = pts(36.6, H + 1, 36.0, 38, 34.6, 26, 33.0, 18, 30.0, 13.4);
const lake = pts(-1, 11.6, 10, 12.8, 22, 11.4, 30, 9.6, 40, 10.4, 50, 12.8, W + 1, 12.0, W + 1, -1, -1, -1);
const forestW = pts(0, 15.6, 10, 16.0, 14, 22, 12, 34, 16, 42, 18, H, 0, H);
const forestE = pts(44, H, 42, 38, 43.4, 26, 50, 18.6, W, 17.0, W, H);

export const lakeZone: ZoneDef = {
    id: 'lake',
    name: 'Lake',
    w: W,
    h: H,
    zoom: 1.12,
    groundColor: 0x3f9c37,
    ground: [
        { kind: 'water', pts: lake },
        { kind: 'sand', pts: pts(20, 12.6, 30, 10.8, 38, 11.4, 37, 14.0, 28, 14.6, 21, 14.4) },
        { kind: 'dirt', pts: road, width: 4.6 },
    ],
    props: [
        ...forest(forestW, 131),
        ...forest(forestE, 132),
        ...scatter(rect(14, 15, 30, 30), DECAL_MIX, 120, 133, { minGap: 0.6, avoid: [rect(30, 14, 9, H)] }),
        { type: 'outhouse', x: 22.4, y: 34.0, id: 'outhouseL' },
        { type: 'picnicTable', x: 27.2, y: 28.2, id: 'tableL' },
        { type: 'stump', x: 40.4, y: 32.6 },
        { type: 'rvWhite', x: 24.0, y: 21.0 },
        { type: 'fern', x: 25.2, y: 32.0 },
        { type: 'cattails', x: 14.6, y: 13.4 },
        { type: 'cattails', x: 45.0, y: 13.8 },
    ],
    cover: [forestW, forestE],
    walls: [],
    exits: [{ rect: { x: 33.0, y: H - 1.2, w: 7.0, h: 1.2 }, to: 'junction', entry: 'south' }],
    entries: {
        default: { x: 36.4, y: H - 2.6, facing: -90 },
        north: { x: 36.4, y: H - 2.6, facing: -90 },
    },
    npcs: [],
    interactables: [
        { id: 'outhouseL', kind: 'hide', x: 22.4, y: 33.1, radius: 0.9 },
        { id: 'tableL', kind: 'table', x: 27.2, y: 28.2, radius: 1.9 },
    ],
    // caught anywhere in the campground: you wake outside the gate (inside-park t138.6)
    respawn: { zone: 'home', x: 69.4, y: 24.4, rangerAt: { x: 71.2, y: 25.6 } },
    rangerSpawns: [{ x: 36.4, y: H - 1 }],
    rangersRespond: true,
    scatter: { seed: 130 },
};
