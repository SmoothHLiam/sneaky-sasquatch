import type { ZoneDef } from '../types';
import { DECAL_MIX, forest, pts, rect, scatter } from './helpers';

/**
 * JUNCTION — crossroads east of Campsite C (inside-park t0250.0, offsets measured
 * from the crossing at 121 px/m across, 95 px/m down): the footpath from the west
 * meets a north-south trail (RV Park ↑ / Lake ↓) and carries on east to the Ranger
 * Station. "RV Park / Lake" signpost north-west of the crossing, the red-roofed
 * map board north-east, berry thicket + stump + rock south-west, picnic table
 * south-east, a split-rail fence along the south-west edge (t248).
 */
const W = 56, H = 44;
const X = { x: 30, y: 22 };
const at = (dx: number, dy: number) => ({ x: X.x + dx, y: X.y + dy });

const forestNW = pts(0, 26.4, 12, 26.2, 20, 28.6, 24, 32, 26, H, 0, H);
const forestNE = pts(35.6, H, 37.4, 31, 42, 27.4, 50, 26.2, W, 26.4, W, H);
const forestSW = pts(0, 0, 25.2, 0, 25.0, 12.6, 18, 16.6, 8, 17.6, 0, 18.4);
const forestSE = pts(33.8, 0, W, 0, W, 17.4, 46, 16.6, 40, 13.6, 34.2, 10.4);
const thicket = pts(22.8, 20.4, 27.4, 20.2, 28.2, 17.6, 26.4, 15.8, 22.6, 16.6);

export const junctionZone: ZoneDef = {
    id: 'junction',
    name: 'Junction',
    w: W,
    h: H,
    zoom: 1.12,
    groundColor: 0x3f9c37,
    ground: [
        { kind: 'path', pts: pts(-1, 22.6, 20, 22.4, 30, 22.0, 42, 21.4, W + 1, 21.6), width: 2.0 },
        { kind: 'path', pts: pts(30, 22, 31.2, 30, 31.6, 38, 31.6, H + 1), width: 1.7 },
        { kind: 'path', pts: pts(30, 22, 29.4, 14, 29.0, 6, 29.0, -1), width: 1.6 },
    ],
    props: [
        ...forest(forestNW, 81),
        ...forest(forestNE, 82),
        ...forest(forestSW, 83),
        ...forest(forestSE, 84),
        ...scatter(thicket, [{ type: 'berryBush', weight: 1 }], 6, 85, { minGap: 1.4 }),
        ...scatter(rect(2, 14, 52, 14), DECAL_MIX, 150, 86, { minGap: 0.55 }),
        { type: 'signpostRvLake', x: at(-4.05, 2.84).x, y: at(-4.05, 2.84).y },
        { type: 'noticeBoardMaps', x: at(2.9, 2.6).x, y: at(2.9, 2.6).y, id: 'mapBoard' },
        { type: 'stump', x: at(-7.7, -1.9).x, y: at(-7.7, -1.9).y },
        { type: 'rock', x: at(-2.9, -4.7).x, y: at(-2.9, -4.7).y },
        { type: 'picnicTable', x: at(3.6, -3.8).x, y: at(3.6, -3.8).y, id: 'tableJ' },
        { type: 'fern', x: at(6.2, -2.6).x, y: at(6.2, -2.6).y },
        { type: 'flowersYellow', x: at(-0.6, 4.6).x, y: at(-0.6, 4.6).y },
        // split-rail fence along the south-west (t248)
        ...[8, 10.13, 12.26, 14.39, 16.52, 18.65].map((x) => ({ type: 'fence', x, y: 15.2 })),
        { type: 'fencePost', x: 6.9, y: 15.2 },
        { type: 'fencePost', x: 19.8, y: 15.2 },
    ],
    cover: [forestNW, forestNE, forestSW, forestSE],
    walls: [],
    exits: [
        { rect: { x: 0, y: 19.6, w: 1.2, h: 6 }, to: 'campCD', entry: 'east' },
        { rect: { x: 28.4, y: H - 1.2, w: 6.4, h: 1.2 }, to: 'rvParkS', entry: 'south' },
        { rect: { x: W - 1.2, y: 18.6, w: 1.2, h: 6 }, to: 'station', entry: 'west' },
        { rect: { x: 26.0, y: 0, w: 6.4, h: 1.2 }, to: 'lake', entry: 'north' },
    ],
    entries: {
        default: { x: 2.6, y: 22.6, facing: 0 },
        west: { x: 2.6, y: 22.6, facing: 0 },
        north: { x: 31.6, y: H - 2.6, facing: -90 },
        east: { x: W - 2.6, y: 21.6, facing: 180 },
        south: { x: 29.0, y: 2.6, facing: 90 },
    },
    npcs: [],
    interactables: [
        { id: 'tableJ', kind: 'table', x: at(3.6, -3.8).x, y: at(3.6, -3.8).y, radius: 1.9 },
        { id: 'mapBoard', kind: 'sign', x: at(2.9, 1.8).x, y: at(2.9, 1.8).y, radius: 1.1, icon: 'eye' },
    ],
    // caught anywhere in the campground: you wake outside the gate (inside-park t138.6)
    respawn: { zone: 'home', x: 69.4, y: 24.4, rangerAt: { x: 71.2, y: 25.6 } },
    rangerSpawns: [{ x: W - 1, y: 21.6 }, { x: 1, y: 22.6 }],
    rangersRespond: true,
    scatter: { seed: 80 },
};
