import type { ZoneDef } from '../types';
import { DECAL_MIX, forest, pts, rect, scatter } from './helpers';

/**
 * RV PARK (south half) — inside-park 255-271 s (1000-px frames, 60.5 px/m across,
 * 47.7 px/m down). A wide brown dirt road runs north; the footpath from the
 * junction curves into it from the south-west.
 *   Site A (west): white RV with the green-hat man standing in its doorway, fire
 *   ring with blue chairs on a dirt pad, "A" post by the road; across the road a
 *   berry thicket and the RV dump station (concrete pad).
 *   Site B (east): yellow trailer, fire ring with red chairs on a dirt pad, a
 *   pink-haired kid, "B" post; a picnic table across the road.
 */
const W = 44, H = 56;
const A = { x: 18.4, y: 21.0 };   // A post
const B = { x: 26.2, y: 38.0 };   // B post
const atA = (dx: number, dy: number) => ({ x: A.x + dx, y: A.y + dy });
const atB = (dx: number, dy: number) => ({ x: B.x + dx, y: B.y + dy });

const road = pts(23.5, -1, 22.6, 12, 21.4, 24, 22.4, 36, 23.8, 48, 23.2, H + 1);
const padA = pts(8.6, 23.4, 14.2, 23.8, 16.2, 20.2, 14.4, 17.2, 9.6, 17.0, 7.8, 19.8);
const padB = pts(28.6, 39.0, 34.4, 39.6, 36.4, 36.0, 34.6, 32.6, 29.6, 32.4, 27.8, 35.4);
const thicketA = pts(28.6, 26.4, 34.4, 26.8, 36.0, 23.0, 33.2, 20.6, 28.8, 21.6);

const forestW = pts(0, 0, 18.4, 0, 17.0, 8, 9.0, 12.4, 5.6, 16, 5.0, 30, 7.6, 34, 6.4, 46, 8.0, 52, 6.0, H, 0, H);
const forestE = pts(28.8, 0, W, 0, W, H, 37.6, H, 38.4, 48, 37.0, 30, 38.8, 16, 33.6, 10.4);

export const rvParkSZone: ZoneDef = {
    id: 'rvParkS',
    name: 'RV Park',
    w: W,
    h: H,
    zoom: 1.12,
    groundColor: 0x3f9c37,
    ground: [
        { kind: 'dirt', pts: padA },
        { kind: 'dirt', pts: padB },
        { kind: 'path', pts: pts(14, -1, 14.6, 6, 17.4, 10.4, 21.0, 12.4), width: 1.7 },
        { kind: 'dirt', pts: road, width: 5.2 },
    ],
    props: [
        ...forest(forestW, 91),
        ...forest(forestE, 92),
        ...scatter(thicketA, [{ type: 'berryBush', weight: 1 }], 6, 93, { minGap: 1.4 }),
        ...scatter(rect(6, 6, 32, 46), DECAL_MIX, 140, 94, { minGap: 0.6, avoid: [rect(19, 0, 7.6, H)] }),
        // site A
        { type: 'campSignA', x: A.x, y: A.y },
        { type: 'rvWhite', x: atA(-4.0, 4.8).x, y: atA(-4.0, 4.8).y, flip: true },
        { type: 'firepitLit', x: atA(-5.6, -0.4).x, y: atA(-5.6, -0.4).y },
        { type: 'chair', x: atA(-4.6, -0.3).x, y: atA(-4.6, -0.3).y, v: 3 },
        { type: 'chair', x: atA(-6.8, 1.1).x, y: atA(-6.8, 1.1).y, v: 1 },
        { type: 'rock', x: atA(-1.6, -2.0).x, y: atA(-1.6, -2.0).y },
        { type: 'parkingPad', x: atA(10.4, -3.8).x, y: atA(10.4, -3.8).y },
        // site B
        { type: 'campSignB', x: B.x, y: B.y },
        { type: 'rvYellow', x: atB(5.5, 5.2).x, y: atB(5.5, 5.2).y },
        { type: 'firepitLit', x: atB(5.6, -0.8).x, y: atB(5.6, -0.8).y },
        { type: 'chair', x: atB(4.4, -0.8).x, y: atB(4.4, -0.8).y, v: 0 },
        { type: 'chair', x: atB(6.8, -0.8).x, y: atB(6.8, -0.8).y, v: 0 },
        { type: 'picnicTable', x: atB(-9.8, 4.6).x, y: atB(-9.8, 4.6).y, id: 'tableRvB' },
        { type: 'stump', x: atB(2.3, 7.8).x, y: atB(2.3, 7.8).y },
        { type: 'fern', x: atB(1.0, -2.6).x, y: atB(1.0, -2.6).y },
    ],
    cover: [forestW, forestE],
    walls: [],
    exits: [
        { rect: { x: 12.0, y: 0, w: 14, h: 1.2 }, to: 'junction', entry: 'north' },
        { rect: { x: 19.6, y: H - 1.2, w: 7.2, h: 1.2 }, to: 'rvParkN', entry: 'south' },
    ],
    entries: {
        default: { x: 14.4, y: 2.6, facing: 90 },
        south: { x: 14.4, y: 2.6, facing: 90 },
        north: { x: 23.2, y: H - 2.6, facing: -90 },
    },
    npcs: [
        // green-hat man in the white RV's doorway; pink-haired kid at site B
        { id: 'greenhat', kind: 'camper', look: 'greenhat', x: atA(-2.6, 3.9).x, y: atA(-2.6, 3.9).y, facing: -60, behaviour: 'idle' },
        { id: 'jayRv1', kind: 'bluejay', x: 33.4, y: 25.4, facing: 120 },
        { id: 'kidPink', kind: 'camper', look: 'kid_pink', x: atB(4.4, -3.3).x, y: atB(4.4, -3.3).y, facing: -90, behaviour: 'wander' },
    ],
    interactables: [{ id: 'tableRvB', kind: 'table', x: atB(-9.8, 4.6).x, y: atB(-9.8, 4.6).y, radius: 1.9 }],
    // caught anywhere in the campground: you wake outside the gate (inside-park t138.6)
    respawn: { zone: 'home', x: 69.4, y: 24.4, rangerAt: { x: 71.2, y: 25.6 } },
    rangerSpawns: [{ x: 23.4, y: 1 }, { x: 23.2, y: H - 1 }],
    rangersRespond: true,
    scatter: { seed: 90 },
};
