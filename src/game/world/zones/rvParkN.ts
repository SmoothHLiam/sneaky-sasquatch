import type { ZoneDef } from '../types';
import { DECAL_MIX, forest, pts, rect, scatter } from './helpers';

/**
 * RV PARK (north half) — inside-park 271-312 s and 352-364 s (1000-px frames,
 * 60.5 px/m across, 47.7 px/m down; offsets measured from the "D" post).
 *   The dirt road comes up from the south and bends north-east. West of it a pond
 *   with cattails and lily pads; the Duck waits on its east shore with a "!".
 *   The "C" site post stands across the road.
 *   Site D sits in the bend: the teal motorhome (enterable, cut-away interior,
 *   the Duck's hat on its table) with the yellow-haired camper at the door, a
 *   fire ring on a dirt pad, firewood, the red boombox on a little stand playing
 *   music, a picnic table. Grey cliffs wall the area off to the west and north;
 *   a yellow caution sign marks the way up toward the cave.
 */
const W = 50, H = 50;
const D = { x: 30, y: 30.4 };   // D post
const atD = (dx: number, dy: number) => ({ x: D.x + dx, y: D.y + dy });

const road = pts(23.2, -1, 23.4, 10, 25.2, 18, 30, 24, 37, 27.6, 44, 30, W + 1, 31.4);
const pond = pts(10.6, 23.6, 17.0, 24.0, 20.6, 20.6, 19.6, 16.4, 14.6, 15.0, 9.6, 16.4, 8.6, 20.0);
const padD = pts(21.0, 30.6, 31.0, 30.0, 33.6, 33.6, 32.6, 36.4, 22.4, 36.4, 20.4, 33.4);
const RV = { x: 29.5, y: 38.2 };

const cliffW = pts(0, 0, 5.4, 0, 6.4, 14, 4.8, 30, 6.6, 42, 0, 44);
const cliffN = pts(0, 44, 6.6, 42, 16, 43.4, 26, 42.6, 36, 44.4, 44, 43.6, W, 44.0, W, H, 0, H);
const forestSW = pts(5.4, 0, 21.0, 0, 20.6, 8.8, 16.0, 12.6, 8.0, 13.6, 6.4, 14);
const forestE = pts(27.4, 0, W, 0, W, 27.4, 42, 24.4, 34, 19.4, 29.6, 12.0);
const forestNW = pts(6.6, 26.4, 12.0, 27.0, 18.0, 30.2, 19.2, 37.6, 16, 42.6, 6.6, 41.4);
const forestNE = pts(36.2, 36.6, 44, 34.6, W, 35.4, W, 43.6, 36, 43.6);

export const rvParkNZone: ZoneDef = {
    id: 'rvParkN',
    name: 'RV Park',
    w: W,
    h: H,
    zoom: 1.12,
    groundColor: 0x3f9c37,
    ground: [
        { kind: 'water', pts: pond },
        { kind: 'dirt', pts: padD },
        { kind: 'dirt', pts: road, width: 5.2 },
        { kind: 'gravel', pts: cliffN, sharp: true },
        { kind: 'gravel', pts: cliffW, sharp: true },
    ],
    props: [
        ...forest(forestSW, 101),
        ...forest(forestE, 102),
        ...forest(forestNW, 103),
        ...forest(forestNE, 104),
        ...scatter(rect(8, 8, 36, 30), DECAL_MIX, 140, 105, { minGap: 0.6, avoid: [rect(8, 14, 13, 11)] }),
        // pond edge
        { type: 'cattails', x: 11.2, y: 23.0 },
        { type: 'cattails', x: 18.8, y: 18.0 },
        { type: 'lilypad', x: 13.6, y: 20.8 },
        { type: 'lilypad', x: 16.6, y: 18.4 },
        { type: 'fern', x: 21.4, y: 14.4 },
        { type: 'fern', x: 19.2, y: 13.0 },
        { type: 'campSignC', x: 28.4, y: 14.2 },
        // site D (offsets from the D post, n285 / n294)
        { type: 'campSignD', x: D.x, y: D.y },
        { type: 'firepitLit', x: atD(-1.9, 2.1).x, y: atD(-1.9, 2.1).y },
        { type: 'boomboxPost', x: atD(-5.4, 3.9).x, y: atD(-5.4, 3.9).y, id: 'boombox' },
        { type: 'firewood', x: atD(-7.4, 2.2).x, y: atD(-7.4, 2.2).y },
        { type: 'picnicTable', x: atD(-2.5, -3.6).x, y: atD(-2.5, -3.6).y, id: 'tableRvD' },
        { type: 'warningSign', x: 41.0, y: 41.4 },
        { type: 'rvTealBuilding', x: RV.x, y: RV.y, id: 'rvTeal' },
        // the Duck's hat on the RV table (duck_hat_item.json rvOffset_m); quests/duck.ts removes it once taken
        { type: 'duckHatItem', x: RV.x - 1.25, y: RV.y + 0.5, id: 'duckHatProp', in: 'rvTeal' },
        // cliff faces (until cliff_rocks art exists: big rocks along the edge)
        ...[3.0, 9.0, 15.0, 21.0, 27.0, 33.0, 39.0, 45.0].map((x, i) => ({ type: 'rockBig', x, y: 44.6 + (i % 2) * 0.8 })),
        ...[4.0, 10.0, 16.0, 22.0, 28.0, 34.0, 40.0].map((y) => ({ type: 'rockBig', x: 3.4, y })),
    ],
    cover: [forestSW, forestE, forestNW, forestNE],
    walls: [cliffW, rect(0, 45, W, 5)],
    buildings: [{
        id: 'rvTeal', x: RV.x, y: RV.y, w: 8.3, d: 1.72, doorX: -0.35, doorW: 0.9, exterior: 'rv_teal', interior: 'rv_teal_interior',
        interiorFront: 'rv_teal_front', frontSortY: -0.86,
    }],
    exits: [
        { rect: { x: 19.6, y: 0, w: 7.6, h: 1.2 }, to: 'rvParkS', entry: 'north' },
        { rect: { x: W - 1.2, y: 28.4, w: 1.2, h: 6 }, to: 'cliff', entry: 'south' },
    ],
    entries: {
        default: { x: 23.2, y: 2.6, facing: 90 },
        south: { x: 23.2, y: 2.6, facing: 90 },
        east: { x: W - 2.6, y: 31.2, facing: 180 },
    },
    npcs: [
        { id: 'duck', kind: 'duck', x: 20.4, y: 17.2, facing: 200 },
        // RV-D camper (yellow hair, purple shirt) at his door (t295-314)
        { id: 'rvGuy', kind: 'camper', look: 'rv_guy', x: atD(-2.2, 6.2).x, y: atD(-2.2, 6.2).y, facing: -90, behaviour: 'idle' },
    ],
    interactables: [
        { id: 'tableRvD', kind: 'table', x: atD(-2.5, -3.6).x, y: atD(-2.5, -3.6).y, radius: 1.9 },
        { id: 'boombox', kind: 'sign', x: atD(-5.4, 3.2).x, y: atD(-5.4, 3.2).y, radius: 1.0, icon: 'hand' },
        { id: 'duckHat', kind: 'sign', x: RV.x - 1.25, y: RV.y - 0.15, radius: 0.9, icon: 'hand', ifFlag: 'duckQuest', ifNotFlag: 'duckHatTaken' },
    ],
    // caught anywhere in the campground: you wake outside the gate (inside-park t138.6)
    respawn: { zone: 'home', x: 69.4, y: 24.4, rangerAt: { x: 71.2, y: 25.6 } },
    rangerSpawns: [{ x: 23.2, y: 1 }, { x: W - 1, y: 31.2 }],
    rangersRespond: true,
    scatter: { seed: 100 },
};
