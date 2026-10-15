import type { ZoneDef } from '../types';
import { DECAL_MIX, FOREST_MIX, UNDERGROWTH_MIX, pts, rect, scatter } from './helpers';

/** Engine test area (open with ?zone=test). Not part of the real map. */
const W = 60, H = 40;
const edge = [rect(0, 0, W, 6), rect(0, H - 7, W, 7), rect(0, 0, 6, H), rect(W - 6, 0, 6, H)];

export const testZone: ZoneDef = {
    id: 'test',
    name: 'Test Meadow',
    w: W,
    h: H,
    groundColor: 0x41a036,
    ground: [
        { kind: 'grassLight', pts: pts(14, 14, 26, 12, 34, 18, 28, 24, 16, 22) },
        { kind: 'dirt', pts: pts(36, 22, 44, 21, 46, 26, 40, 29, 35, 27) },
        { kind: 'path', pts: pts(0, 18, 12, 17, 24, 19, 40, 17, 60, 18), width: 2.6 },
        { kind: 'water', pts: pts(14, 26, 22, 25, 25, 29, 19, 32, 13, 30) },
        // asphalt pad for kart testing (skid marks)
        { kind: 'asphalt', pts: pts(40, 6, 58, 6, 58, 15, 40, 15), sharp: true },
    ],
    jeepRoutes: [[{ x: -3, y: 18.2 }, { x: 14, y: 18.4 }, { x: 20, y: 18.8 }]],
    lanes: [{ id: 'testRoad', pts: [{ x: -2, y: 18.2 }, { x: 24, y: 19 }, { x: 40, y: 17 }, { x: 62, y: 18 }], every: [6, 10], colors: [0xc43a3a, 0x2a2a2a, 0x9acd32] }],
    vehicles: [
        { id: 'testKart', kind: 'kart', x: 44, y: 11, facing: 0 },
        { id: 'testKart2', kind: 'kart', x: 47, y: 11, facing: 0 },
    ],
    props: [
        ...edge.flatMap((e, i) => scatter(e, FOREST_MIX, 40, 100 + i, { minGap: 2.0 })),
        ...scatter(rect(6, 6, W - 12, H - 13), UNDERGROWTH_MIX, 18, 7, { minGap: 3, avoid: [rect(0, 15, W, 6)] }),
        ...scatter(rect(6, 6, W - 12, H - 13), DECAL_MIX, 120, 8, { minGap: 0.6 }),
        { type: 'cabin', x: 30, y: 27 },
        { type: 'tent', x: 46, y: 12 },
        { type: 'cooler', x: 43, y: 11 },
        { type: 'firepit', x: 48, y: 9 },
        { type: 'picnicTable', x: 40, y: 9 },
        { type: 'hideBush', x: 16, y: 21 },
        { type: 'hideBush', x: 34, y: 12 },
        { type: 'outhouse', x: 24, y: 9 },
    ],
    walls: edge,
    exits: [],
    entries: { default: { x: 10, y: 18, facing: 0 } },
    npcs: [
        { id: 'camper1', kind: 'camper', x: 47, y: 14, facing: 180, behaviour: 'idle' },
        { id: 'ranger1', kind: 'ranger', x: 20, y: 10, facing: 0, behaviour: 'patrol', route: pts(20, 10, 40, 11, 40, 15, 20, 14) },
        { id: 'raccoon', kind: 'raccoon', x: 12, y: 20, facing: -90 },
    ],
    interactables: [
        { id: 'cooler1', kind: 'cooler', x: 43, y: 11, loot: ['hotdog', 'ketchup'] },
        { id: 'table1', kind: 'table', x: 40, y: 8.2 },
        { id: 'outhouse1', kind: 'hide', x: 24, y: 8.4 },
    ],
    respawn: { x: 10, y: 22 },
    scatter: { seed: 3 },
    rangersRespond: true,
};
