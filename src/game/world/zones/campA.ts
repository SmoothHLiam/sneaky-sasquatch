import type { ZoneDef } from '../types';
import { DECAL_MIX, forest, pts, rect, scatter } from './helpers';

/**
 * CAMPSITE A — first area inside the campground (tutorial cooler + picnic table).
 * Layout traced from tutorial t072-t120 and inside-park t022-t053:
 *   dirt road enters from the west (higher), dips south-east and runs east.
 *   North of the road: parking pad + trash can, firewood, "A" post, fire ring on a
 *   dirt pad, green tent behind it, cooler beside the tent. South: picnic table,
 *   berry bushes. East: road continues to Campsite B.
 */
const W = 76, H = 44;

const north = pts(0, 36, 8, 35.6, 14, 34.6, 20, 36.4, 32, 37.2, 40, 33.6, 50, 30.4, 60, 28.6, 68, 27.4, W, 27.0, W, H, 0, H);
const south = pts(0, 0, W, 0, W, 13.6, 66, 14.6, 56, 14.4, 48, 13.0, 42, 9.6, 36, 8.2, 30, 7.8, 20, 7.6, 14, 10.4, 8, 15.2, 3, 19.4, 0, 21);
// berry thickets flank the picnic table and run up to the road edge (t095.5)
const berriesW = pts(17.2, 17.0, 23.4, 17.1, 24.0, 14.8, 22.4, 12.2, 17.6, 12.4);
const berriesE = pts(29.4, 17.3, 35.6, 17.7, 36.8, 14.0, 33.6, 11.6, 29.8, 12.6);

export const campAZone: ZoneDef = {
    id: 'campA',
    name: 'Campsite A',
    w: W,
    h: H,
    zoom: 1.12,
    groundColor: 0x3f9c37,
    ground: [
        { kind: 'path', pts: pts(-1, 29.6, 6, 28.4, 12, 24.6, 18, 20.8, 26, 18.8, 34, 18.4, 44, 19.4, 54, 20.6, 64, 20.4, W + 1, 19.8), width: 2.9 },
        { kind: 'dirt', pts: pts(23.6, 21.8, 29.8, 20.8, 33.6, 23.6, 32.8, 28.2, 27.4, 29.4, 23.4, 26.8) },
        { kind: 'grassLight', pts: pts(20, 26, 23, 25.5, 24.5, 28.5, 22, 30.5, 19.5, 29) },
    ],
    props: [
        ...forest(north, 31),
        ...forest(south, 32),
        ...forest(berriesW, 33, { trees: 0, under: 5, mix: [{ type: 'berryBush', weight: 1 }] }),
        ...scatter(berriesW, [{ type: 'berryBush', weight: 1 }], 5, 34, { minGap: 1.6 }),
        ...scatter(berriesE, [{ type: 'berryBush', weight: 1 }], 6, 35, { minGap: 1.6 }),
        ...scatter(rect(2, 8, 72, 26), DECAL_MIX, 220, 36, { minGap: 0.55 }),
        ...scatter(rect(2, 14, 72, 18), [{ type: 'fern', weight: 2 }, { type: 'stick', weight: 2 }, { type: 'rock', weight: 1 }], 18, 37, {
            minGap: 2.6,
            avoid: [rect(0, 16, W, 6), rect(8, 22, 30, 10), rect(20, 10, 12, 6)],
        }),
        { type: 'parkingPad', x: 9.6, y: 27.8 },
        { type: 'trashCan', x: 9.6, y: 28.2, id: 'trashA' },
        { type: 'firewood', x: 17.4, y: 22.8 },
        { type: 'campSignA', x: 21.0, y: 22.2 },
        { type: 'firepit', x: 28.2, y: 24.6 },
        { type: 'tent', x: 27.2, y: 31.4, v: 0 },
        { type: 'cooler', x: 23.4, y: 28.6, id: 'coolerA' },
        { type: 'pine', x: 35.6, y: 22.2, v: 2 },
        { type: 'picnicTable', x: 26.4, y: 14.6 },
        { type: 'chair', x: 31.4, y: 26.8 },
        { type: 'flowersYellow', x: 19.4, y: 24.6 },
        { type: 'flowersYellow', x: 28.6, y: 13.8 },
    ],
    cover: [north, south],
    walls: [rect(0, 0, W, 4), rect(0, H - 4, W, 4)],
    exits: [
        { rect: { x: 0, y: 25.5, w: 1.2, h: 7.5 }, to: 'home', entry: 'east' },
        { rect: { x: W - 1.2, y: 16.5, w: 1.2, h: 7 }, to: 'campB', entry: 'west', requiresFlag: 'tutorialDone', blockedLine: undefined },
    ],
    entries: {
        default: { x: 3, y: 29.2, facing: 0 },
        west: { x: 2.6, y: 29.2, facing: 0 },
        east: { x: W - 2.6, y: 19.8, facing: 180 },
        gate: { x: 3, y: 29.2, facing: 0 },
    },
    npcs: [],
    interactables: [
        { id: 'coolerA', kind: 'cooler', x: 23.4, y: 28.6, radius: 1.1, loot: ['hotdog', 'hotdog', 'ketchup'] },
        { id: 'trashA', kind: 'trash', x: 9.6, y: 28.2, radius: 1.0, loot: ['stinkyFood'] },
        { id: 'tableA', kind: 'table', x: 26.4, y: 14.6, radius: 1.9 },
    ],
    // caught anywhere in the campground: you wake outside the gate (inside-park t138.6)
    respawn: { zone: 'home', x: 69.4, y: 24.4, rangerAt: { x: 71.2, y: 25.6 } },
    rangerSpawns: [{ x: W - 1, y: 20 }, { x: 1, y: 29.4 }],
    rangersRespond: true,
    scatter: { seed: 41 },
};
