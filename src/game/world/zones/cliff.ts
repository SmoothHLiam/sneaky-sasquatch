import type { ZoneDef } from '../types';
import { DECAL_MIX, forest, pts, rect, scatter } from './helpers';

/**
 * CLIFF & CAVE MOUTH — north of the RV park (inside-park 352-371 s, k360-k370).
 * A light-grass trail runs east through the trees below a long grey cliff, past a
 * yellow caution sign and big rocks. The cave opens in the cliff face over a dirt
 * apron; a brown bear sits by the entrance and a lantern stands on the right.
 */
const W = 64, H = 40;
const CAVE = { x: 30, y: 25.2 };

const trail = pts(-1, 5.0, 8, 9.0, 20, 13.6, 34, 15.8, 46, 16.4, W + 1, 17.0);
// ≈8 m wide, 2.5 m deep in k370
const apron = pts(26.4, 24.6, 34.2, 24.8, 35.0, 22.6, 32.0, 21.8, 30.4, 22.6, 28.4, 21.6, 25.8, 22.4);
const cliff = pts(0, 22.0, 10, 23.6, 20, 24.2, 26, 25.0, 34, 25.0, 42, 24.0, 52, 23.0, W, 22.6, W, H, 0, H);
/** foot of the cliff face (the same line the walls follow) */
const FOOT = [[-6, 23.0], [0, 23.4], [10, 24.4], [20, 25.0], [28.6, 25.6], [31.4, 25.6], [40, 25.0], [52, 24.0], [W, 23.6], [W + 6, 23.4]];
const footY = (x: number) => {
    for (let i = 0; i + 1 < FOOT.length; i++) {
        const [x0, y0] = FOOT[i], [x1, y1] = FOOT[i + 1];
        if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
    return FOOT[FOOT.length - 1][1];
};
/** cliff_rocks tiles every 6 m either side of the cave mouth's slot (cave_mouth.json: tile_x 6) */
const cliffTiles = [-1, -2, -3, -4, -5, 1, 2, 3, 4, 5, 6].map((k, i) => {
    const x = CAVE.x + k * 6;
    return { type: 'cliffRocks', x, y: footY(x) + 0.5, v: i % 2 };
});
const forestS = pts(0, 0, W, 0, W, 12.6, 50, 12.0, 38, 10.6, 26, 9.2, 14, 6.4, 6, 2.4, 0, 1.0);
const forestW = pts(0, 9.4, 6, 11.6, 14, 16.8, 18, 21.6, 10, 22.6, 0, 21.4);
const forestE = pts(42, 19.6, 52, 19.4, W, 20.4, W, 22.6, 52, 23.0, 42, 24.0);

export const cliffZone: ZoneDef = {
    id: 'cliff',
    name: 'Cliffs',
    w: W,
    h: H,
    zoom: 1.12,
    groundColor: 0x3f9c37,
    ground: [
        { kind: 'grassLight', pts: trail, width: 3.2 },
        { kind: 'dirt', pts: apron },
        { kind: 'gravel', pts: cliff, sharp: true },
    ],
    props: [
        ...forest(forestS, 111),
        ...forest(forestW, 112),
        ...forest(forestE, 113),
        ...scatter(rect(4, 12, 56, 10), DECAL_MIX, 120, 114, { minGap: 0.6 }),
        ...scatter(rect(20, 17, 22, 7), [{ type: 'pebble', weight: 3 }, { type: 'rock', weight: 1 }], 14, 115, { minGap: 1.0, avoid: [rect(26, 19, 10, 6)] }),
        // the cliff face along the top: grey rock columns, the cave a dark slot in it (k368-k370)
        ...cliffTiles,
        { type: 'caveMouth', x: CAVE.x, y: CAVE.y + 0.4 },
        { type: 'warningSign', x: 12.6, y: 14.2 },
        { type: 'rockBig', x: 15.0, y: 11.2 },
        { type: 'lantern', x: 36.8, y: 21.2 },
        { type: 'fern', x: 22.0, y: 18.0 },
    ],
    cover: [forestS, forestW],
    walls: [pts(0, 23.4, 10, 24.4, 20, 25.0, 28.6, 25.6, 28.6, H, 0, H), pts(31.4, 25.6, 40, 25.0, 52, 24.0, W, 23.6, W, H, 31.4, H)],
    exits: [
        { rect: { x: 0, y: 2.0, w: 1.2, h: 6 }, to: 'rvParkN', entry: 'east' },
        { rect: { x: CAVE.x - 1.2, y: CAVE.y - 0.2, w: 2.4, h: 1.0 }, to: 'cave', entry: 'south' },
    ],
    entries: {
        default: { x: 3, y: 6.0, facing: 30 },
        south: { x: 3, y: 6.0, facing: 30 },
        cave: { x: CAVE.x, y: CAVE.y - 1.6, facing: -90 },
    },
    npcs: [{ id: 'bearCave', kind: 'bear', look: 'bear_brown', x: 23.6, y: 20.4, facing: -40, behaviour: 'sit' }],
    interactables: [],
    // caught anywhere in the campground: you wake outside the gate (inside-park t138.6)
    respawn: { zone: 'home', x: 69.4, y: 24.4, rangerAt: { x: 71.2, y: 25.6 } },
    rangerSpawns: [{ x: 1, y: 5 }],
    rangersRespond: true,
    scatter: { seed: 110 },
};

/**
 * THE CAVE (inside-park 372-397 s, t0380): pitch black but for a soft glow
 * around the sasquatch; brown floor between grey rock ledges.
 */
const CW = 34, CH = 26;
const floor = pts(13.0, 0, 18.4, 0, 18.8, 4.6, 24.6, 7.4, 29.4, 12.6, 28.0, 19.2, 21.4, 22.6, 12.0, 22.0, 5.4, 18.0, 4.6, 11.4, 9.4, 6.4, 12.4, 4.2);

export const caveZone: ZoneDef = {
    id: 'cave',
    name: 'Cave',
    w: CW,
    h: CH,
    zoom: 1.12,
    groundColor: 0x1d1a17,
    grass: false,
    dark: true,
    ground: [{ kind: 'dirt', pts: floor }],
    props: [
        ...[[11.2, 3.4], [19.6, 3.6], [24.0, 6.0], [27.6, 9.6], [29.4, 15.6], [26.0, 20.6], [19.0, 23.0], [12.0, 22.8], [6.4, 19.8], [4.0, 14.6], [5.8, 9.2], [8.8, 5.6]]
            .map(([x, y]) => ({ type: 'rockBig', x, y })),
        { type: 'rock', x: 16.6, y: 12.4 },
        { type: 'rock', x: 21.4, y: 15.2 },
        { type: 'pebble', x: 14.0, y: 9.0 },
        { type: 'pebble', x: 19.0, y: 18.0 },
    ],
    walls: [
        pts(-1, -1, 13.0, -1, 13.0, 0, 12.4, 4.2, 9.4, 6.4, 4.6, 11.4, 5.4, 18.0, 12.0, 22.0, 21.4, 22.6, 28.0, 19.2, 29.4, 12.6, 24.6, 7.4, 18.8, 4.6, 18.4, 0, 18.4, -1, CW + 1, -1, CW + 1, CH + 1, -1, CH + 1),
    ],
    exits: [{ rect: { x: 13.6, y: 0, w: 4.4, h: 1.0 }, to: 'cliff', entry: 'cave' }],
    entries: {
        default: { x: 15.8, y: 2.4, facing: 90 },
        south: { x: 15.8, y: 2.4, facing: 90 },
    },
    npcs: [],
    interactables: [],
    respawn: { x: 15.8, y: 2.4 },
    rangersRespond: false,
    scatter: { seed: 120 },
};
