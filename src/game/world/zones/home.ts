import type { ZoneDef } from '../types';
import { DECAL_MIX, forest, pts, rect, scatter } from './helpers';

/**
 * SASQUATCH HOUSE area (tutorial start). West → east:
 *   cabin (door south) · pond SW · garden patch · notice board + picnic table ·
 *   sleeping bear's den (south of the trail) · Raccoon Shop tree (north) ·
 *   "Campsites →" sign · yellow swing gate · dirt road east → Campsite A.
 * Layout traced from videos/tutorial.mov (see your research/video-notes/tutorial-and-cutscene.md §1).
 */
const W = 92, H = 48;

const southForest = pts(0, 0, W, 0, W, 19.8, 84, 19.9, 77, 19.6, 70, 19.0, 62, 18.2, 55, 16.8, 50, 13.6, 46, 11.6, 36, 10.4, 30, 11.2, 23, 9.4, 14, 9.6, 6, 10.2, 3, 12.5, 0, 14);
const northForest = pts(0, 35, 6, 33.6, 12, 34.2, 20, 34.4, 30, 32.6, 40, 32.4, 46, 33.4, 49.5, 38.5, 61.5, 38.5, 62.5, 31.6, 66, 30.2, 70, 29.4, 77, 28.0, 84, 27.8, W, 27.8, W, H, 0, H);
const westForest = pts(0, 12, 4.2, 13.5, 3.8, 22, 4.6, 30, 3.4, 36, 0, 36);
const shopBack = pts(49.5, 39.5, 61.5, 39.5, 61.5, H, 49.5, H);

const clear = [
    pts(4, 13, 24, 13, 26, 18, 20, 21.5, 4, 21.5), // pond area
    rect(8, 20, 66, 9), // trail corridor
    rect(10, 24.5, 18, 8), // cabin + garden
    rect(33, 26, 12, 6), // notice board + table
    rect(34, 13, 13, 8), // bear den
    rect(50, 26, 12, 13), // shop yard
];

export const homeZone: ZoneDef = {
    id: 'home',
    name: 'Sasquatch House',
    w: W,
    h: H,
    zoom: 1.12,
    groundColor: 0x3f9c37,
    ground: [
        // worn light-grass trail from the cabin door east to the gate, and the branch to the shop door
        { kind: 'grassLight', pts: pts(14.5, 25.6, 18, 23.6, 24, 22.6, 30, 23.0, 36, 24.6, 44, 25.4, 52, 26.0, 60, 25.6, 66, 25.2, 73, 24.6), width: 2.6 },
        { kind: 'grassLight', pts: pts(52.5, 25.8, 54.2, 30, 55.4, 35), width: 2.2 },
        { kind: 'grassLight', pts: pts(12.4, 25.4, 16.2, 24.8, 16.8, 26.4, 12.6, 26.3) },
        // garden patch east of the cabin
        { kind: 'dirt', pts: pts(17.4, 27.4, 21.4, 26.6, 24.6, 27.6, 24.8, 30.4, 20.8, 31.4, 17.2, 30.2) },
        // bear den
        { kind: 'dirt', pts: pts(36.4, 16.2, 40.8, 14.6, 45.0, 16.0, 44.6, 19.4, 40.2, 20.4, 36.6, 19.4) },
        // pond south-west of the cabin
        { kind: 'water', pts: pts(5.4, 17.8, 9.4, 15.0, 15.6, 14.6, 20.6, 16.2, 19.6, 19.6, 13.8, 20.8, 7.6, 20.6) },
        // dirt road east of the gate (campground road)
        { kind: 'path', pts: pts(71.2, 24.6, 76, 24.4, 84, 24.6, W + 1, 24.5), width: 2.9 },
    ],
    props: [
        ...forest(southForest, 11),
        ...forest(northForest, 12, { gap: 1.6 }),
        ...forest(westForest, 13),
        ...forest(shopBack, 14, { trees: 6 }),
        ...scatter(rect(4, 9, 86, 26), DECAL_MIX, 260, 15, { minGap: 0.55, avoid: [pts(5.4, 17.8, 9.4, 15.0, 15.6, 14.6, 20.6, 16.2, 19.6, 19.6, 13.8, 20.8, 7.6, 20.6)] }),
        ...scatter(rect(4, 12, 70, 22), [{ type: 'fern', weight: 3 }, { type: 'pineSmall', weight: 1 }, { type: 'stump', weight: 1 }], 26, 16, { minGap: 3.2, avoid: clear }),
        // structures
        { type: 'cabin', x: 14, y: 27.6, id: 'cabin' },
        { type: 'bed', x: 13.1, y: 28.05 },
        { type: 'woodStove', x: 15.05, y: 28.55 },
        { type: 'lantern', x: 14.95, y: 28.45, z: 0.95 }, // on the stove top (t208)
        { type: 'rock', x: 8.6, y: 31.2 },
        { type: 'rock', x: 10.8, y: 32.4, v: 1 },
        { type: 'mushrooms', x: 29.5, y: 24.8 },
        { type: 'flowersYellow', x: 31, y: 26.2 },
        { type: 'flowersWhite', x: 32.2, y: 25.6 },
        { type: 'lilypad', x: 9.4, y: 17.4 },
        { type: 'lilypad', x: 14.6, y: 16.6 },
        { type: 'cattails', x: 17.6, y: 19.6 },
        { type: 'cattails', x: 6.6, y: 20.2 },
        { type: 'noticeBoard', x: 36, y: 29.6, id: 'noticeBoard' },
        { type: 'flowersYellow', x: 36.2, y: 26.6 }, // the yellow flower the Duck stands by (cutscene k21.0, k29.8)
        { type: 'picnicTable', x: 39.6, y: 29.0 }, // its west end ≈2.7 m east of the board's centre (t40.7, cutscene k16.0/k33.4)
        { type: 'pebble', x: 34.4, y: 28.75 },
        { type: 'rock', x: 37.2, y: 28.85, v: 1 }, // just right of the board, behind the Raccoon (t40.7, cutscene k16.0)
        { type: 'shopTree', x: 55.5, y: 37.2, id: 'shopTree' },
        { type: 'woodSignCampsites', x: 66.2, y: 28.6 },
        { type: 'gate', x: 72.2, y: 26.6 },
        { type: 'gatePost', x: 72.2, y: 22.4 },
        { type: 'stump', x: 47, y: 31 },
        { type: 'stump', x: 64, y: 21.8 },
    ],
    cover: [southForest, northForest, westForest],
    walls: [rect(0, 0, W, 4.5), rect(0, H - 4, W, 4), rect(0, 0, 2.5, H), rect(49, 39, 13, 9)],
    buildings: [{
        id: 'cabin', x: 14, y: 27.6, w: 3.27, d: 2.8, doorX: 0.48, doorW: 0.95, exterior: 'cabin', interior: 'cabin_interior',
        interiorFront: 'cabin_interior_front', frontSortY: -1.4, doorOpen: 'cabin_door_open', doorSortY: -0.9,
    }],
    exits: [
        { rect: { x: W - 1.2, y: 21.5, w: 1.2, h: 6.5 }, to: 'campA', entry: 'west', requiresFlag: 'gateOpen' },
        { rect: { x: 54.6, y: 35.0, w: 1.8, h: 0.8 }, to: 'shop', entry: 'door', requiresFlag: 'shopOpen' },
    ],
    entries: {
        default: { x: 14.48, y: 25.2, facing: -90 },
        cabinDoor: { x: 14.48, y: 25.5, facing: -90 },
        bed: { x: 13.1, y: 28.1, facing: -90 },
        east: { x: W - 2.4, y: 24.6, facing: 180 },
        shopDoor: { x: 55.5, y: 33.6, facing: -90 },
    },
    npcs: [
        { id: 'bear', kind: 'bear', x: 40.6, y: 17.6, facing: 200, behaviour: 'sleep' },
        { id: 'raccoon', kind: 'raccoon', x: 53.2, y: 28.6, facing: -90, ifNotFlag: 'raccoonInShop' },
    ],
    interactables: [
        { id: 'bed', kind: 'bed', x: 13.1, y: 27.6, radius: 1.0 },
        { id: 'homeTable', kind: 'table', x: 39.6, y: 28.0, radius: 1.4 },
    ],
    respawn: { x: 68, y: 23.8, rangerAt: { x: 70.5, y: 24.6 } },
    rangerSpawns: [{ x: W - 1, y: 24.6 }],
    rangersRespond: false,
    scatter: { seed: 21 },
};
