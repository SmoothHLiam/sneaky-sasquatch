import type { ZoneDef } from '../types';
import { DECAL_MIX, forest, pts, rect, scatter } from './helpers';

/**
 * CAMPGROUND EDGE — the dirt road leaving the park eastward (outside-park o01,
 * t0-9.7). A wide brown dirt road (≈6.6 m with sandy shoulders) runs east; a
 * three-rail fence follows its south verge with the power line beyond (poles
 * >16 m apart, two wires); further south an earth bank drops away to pines. The
 * green CAMPGROUND sign stands on the north verge. ≈10 s of walking long.
 */
const W = 46, H = 34;
const ROAD_Y = 17.3;

const forestN = pts(0, 23.6, 10, 24.2, 20, 23.4, 32, 24.4, W, 23.8, W, H, 0, H);
const forestS = pts(0, 0, W, 0, W, 6.8, 36, 7.4, 24, 6.4, 12, 7.2, 0, 6.6);

export const campEdgeZone: ZoneDef = {
    id: 'campEdge',
    name: 'Campground Road',
    w: W,
    h: H,
    zoom: 1.12,
    groundColor: 0x3f9c37,
    ground: [
        { kind: 'shoulder', pts: pts(-1, ROAD_Y, W + 1, ROAD_Y), width: 6.6, sharp: true },
        { kind: 'dirt', pts: pts(-1, ROAD_Y, W + 1, ROAD_Y), width: 5.6, sharp: true },
        // the earth bank above the forest drop (o01 bottom)
        { kind: 'dirt', pts: pts(-1, 9.2, 10, 8.4, 14, 6.2, 16, 8.6, 30, 8.8, 34, 6.0, 37, 8.6, W + 1, 9.0, W + 1, 6, -1, 6) },
    ],
    props: [
        ...forest(forestN, 141),
        ...forest(forestS, 142),
        ...scatter(rect(0, 9, W, 5), DECAL_MIX, 50, 143, { minGap: 0.6 }),
        ...scatter(rect(0, 20.8, W, 2.6), DECAL_MIX, 30, 144, { minGap: 0.6 }),
        ...Array.from({ length: 22 }, (_, i) => ({ type: 'fence', x: 1.0 + i * 2.13, y: 12.6 })),
        { type: 'powerPole', x: 8.0, y: 10.4 },
        { type: 'powerPole', x: 32.0, y: 10.4 },
        { type: 'signCampgroundGreen', x: 24.6, y: 21.8 },
        { type: 'rock', x: 12.0, y: 22.0 },
        { type: 'fern', x: 40.0, y: 22.6 },
    ],
    // the wires run on past both ends of the screen
    wires: [[{ x: -16, y: 10.4 }, { x: 8.0, y: 10.4 }, { x: 32.0, y: 10.4 }, { x: 56.0, y: 10.4 }]],
    cover: [forestN, forestS],
    walls: [rect(0, 0, W, 8.0)],
    exits: [
        { rect: { x: 0, y: 14.0, w: 1.2, h: 6.6 }, to: 'station', entry: 'east' },
        { rect: { x: W - 1.2, y: 14.0, w: 1.2, h: 6.6 }, to: 'highway', entry: 'west' },
    ],
    entries: {
        default: { x: 2.6, y: ROAD_Y, facing: 0 },
        west: { x: 2.6, y: ROAD_Y, facing: 0 },
        east: { x: W - 2.6, y: ROAD_Y, facing: 180 },
    },
    npcs: [],
    interactables: [],
    respawn: { zone: 'home', x: 69.4, y: 24.4, rangerAt: { x: 71.2, y: 25.6 } },
    rangerSpawns: [{ x: 1, y: ROAD_Y }, { x: W - 1, y: ROAD_Y }],
    rangersRespond: true,
    scatter: { seed: 140 },
};
