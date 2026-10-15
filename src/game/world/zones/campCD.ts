import type { PropPlacement, ZoneDef } from '../types';
import type { ZoneScript } from './index';
import type { World } from '../../scenes/World';
import { DECAL_MIX, forest, pts, rect, scatter } from './helpers';

/**
 * CAMPSITES D & C — one area split by the river (no iris between them in the
 * video). Layout measured on inside-park 111-134 s and 214-244 s (1000-px frames:
 * ≈60.5 px/m across, 47.7 px/m down), relative to the bridge centre:
 *   West bank (D): the footpath climbs north-east past the red outhouse and a
 *   walk-in bush to the D post and the bridge. North of the post: the big teal
 *   dome tent (a camper napping inside, "It's time for a nap"), grill on a dirt
 *   pad, firewood, red-check blanket, a round tree and stump by the bank; a picnic
 *   table further north. Berry thickets between the path and the river.
 *   River: comes in from the north-east, bends south at the bridge (wooden arched,
 *   a ranger stands on it) and runs off south. ~3.6 m wide at the bridge.
 *   East bank (C): trash can on a concrete pad right by the bank, the C post south
 *   of the path, a yellow tent further south; the path follows the river's south
 *   bank east toward the junction. Campers stroll the path.
 */
const W = 84, H = 46;
const BR = { x: 40, y: 20 };   // bridge centre (bridge_wood: 3.7 × 2.9 m, deck along x)
const at = (dx: number, dy: number) => ({ x: BR.x + dx, y: BR.y + dy });

const path = pts(-1, 9.8, 10, 10.6, 21.4, 12.9, 29.7, 17.6, 36.2, 19.9, 38.4, 20.1);
const pathEast = pts(41.6, 20.1, 44, 20.4, 48, 21.6, 56, 25.0, 64, 28.2, 72, 31.0, W + 1, 33.6);
const riverSouth = pts(39.9, -1, 40.0, 10, 40.0, 18.5);
const riverNorth = pts(40.0, 21.5, 40.6, 23.6, 43.4, 26.8, 50, 29.6, 58, 32.4, 66, 35.8, 74, 39.4, W + 1, 43);
const dPad = pts(28.4, 27.6, 33.6, 27.4, 35.0, 24.4, 33.2, 22.6, 28.8, 22.8, 27.4, 25.0);
const tPad = at(5.0, 2.4);     // C trash pad, north of the path right by the bank (c218)

const thicketS = pts(25.6, 14.8, 31.6, 16.4, 37.0, 18.2, 37.6, 13.0, 33.0, 9.8, 26.6, 11.4);
const thicketNW = pts(14.6, 16.8, 20.4, 18.0, 22.6, 21.8, 18.8, 24.6, 14.0, 22.2);
const thicketNE = pts(47.0, 33.0, 53.0, 34.4, 56.4, 38.0, 50.4, 39.4, 45.6, 36.6);

const forestNW = pts(0, 26, 8, 25.4, 14, 27.6, 22, 31.6, 30, 33.6, 36, 33.0, 40.2, 31.2, 44.6, 35.4, 48, 42, 52, H, 0, H);
const forestW = pts(0, 12.2, 8, 13.0, 12.6, 16.0, 12.0, 21.4, 6.0, 24.0, 0, 24.4);
const forestSW = pts(0, 0, 37.6, 0, 37.8, 8.0, 30, 7.4, 22, 9.6, 12, 7.8, 4, 7.0, 0, 8.4);
const forestSE = pts(42.4, 0, W, 0, W, 28.6, 72, 26.4, 64, 22.6, 56, 18.8, 54, 12.0, 48, 10.6, 44.2, 12.0, 42.4, 8.0);
const forestNE = pts(56, 41, 66, 39.6, 74, 42.6, W, 46, W, H, 56, H);

/** keep the camp, bridge approach and trash pad clear of trees */
const clearOf = (p: PropPlacement) => Math.hypot(p.x - 50, p.y - 15.4) > 3.2;

export const campCDZone: ZoneDef = {
    id: 'campCD',
    name: 'Campsites D & C',
    w: W,
    h: H,
    zoom: 1.12,
    groundColor: 0x3f9c37,
    ground: [
        { kind: 'dirt', pts: dPad },
        { kind: 'water', pts: riverSouth, width: 3.6 },
        { kind: 'water', pts: riverNorth, width: 5.2 },
        { kind: 'path', pts: path, width: 2.3 },
        { kind: 'path', pts: pathEast, width: 2.3 },
    ],
    props: [
        ...forest(forestNW, 71),
        ...forest(forestW, 72),
        ...forest(forestSW, 73),
        ...forest(forestSE, 74).filter(clearOf),
        ...forest(forestNE, 75),
        ...scatter(thicketS, [{ type: 'berryBush', weight: 1 }], 9, 76, { minGap: 1.5 }),
        ...scatter(thicketNW, [{ type: 'berryBush', weight: 1 }], 6, 77, { minGap: 1.5 }),
        ...scatter(thicketNE, [{ type: 'berryBush', weight: 1 }], 6, 78, { minGap: 1.5 }),
        ...scatter(rect(2, 8, 80, 26), DECAL_MIX, 260, 79, { minGap: 0.55, avoid: [rect(37.4, 0, 6, H)] }),
        // ---- D (west bank)
        { type: 'outhouse', x: at(-16, -3.6).x, y: at(-16, -3.6).y, id: 'outhouseD' },
        { type: 'hideBush', x: at(-10.4, -1.0).x, y: at(-10.4, -1.0).y },
        { type: 'campSignD', x: at(-5.8, 2.3).x, y: at(-5.8, 2.3).y },
        { type: 'tent', x: at(-8.9, 8.6).x, y: at(-8.9, 8.6).y, v: 2 },
        { type: 'bbqGrill', x: at(-8.9, 5.0).x, y: at(-8.9, 5.0).y },
        { type: 'firewood', x: at(-12.5, 5.2).x, y: at(-12.5, 5.2).y },
        { type: 'blanket', x: at(-5.5, 6.1).x, y: at(-5.5, 6.1).y },
        { type: 'roundTree', x: at(-3.5, 4.6).x, y: at(-3.5, 4.6).y, v: 0 },
        { type: 'stump', x: at(-1.8, 3.8).x, y: at(-1.8, 3.8).y },
        { type: 'picnicTable', x: at(-1.3, 9.3).x, y: at(-1.3, 9.3).y, id: 'tableD' },
        { type: 'fern', x: at(-13.6, 7.6).x, y: at(-13.6, 7.6).y },
        { type: 'flowersYellow', x: at(-7.4, 0.8).x, y: at(-7.4, 0.8).y },
        // ---- river & bridge
        { type: 'bridgeWood', x: BR.x, y: BR.y },
        { type: 'rock', x: 44.2, y: 30.6 },
        { type: 'rock', x: 46.6, y: 31.4 },
        { type: 'cattails', x: 38.2, y: 6.0 },
        { type: 'lilypad', x: 39.4, y: 4.2 },
        // ---- C (east bank)
        { type: 'parkingPad', x: tPad.x, y: tPad.y },
        { type: 'trashCan', x: tPad.x - 0.5, y: tPad.y + 0.2, id: 'trashC' },
        { type: 'campSignC', x: at(10.2, 0.8).x, y: at(10.2, 0.8).y },
        { type: 'tent', x: 50, y: 15.4, v: 0 },
        { type: 'picnicTable', x: 54.6, y: 17.8, id: 'tableC' },
        { type: 'fern', x: 45.4, y: 18.4 },
        { type: 'hideBush', x: 47.6, y: 18.0 },
    ],
    cover: [forestNW, forestW, forestSW, forestSE, forestNE],
    walls: [
        rect(0, H - 2, W, 2),
        // bridge railings: the deck is only open east-west
        rect(BR.x - 1.85, BR.y + 1.3, 3.7, 0.25),
        rect(BR.x - 1.85, BR.y - 1.55, 3.7, 0.25),
    ],
    exits: [
        { rect: { x: 0, y: 7.2, w: 1.2, h: 5.4 }, to: 'campB', entry: 'east' },
        { rect: { x: W - 1.2, y: 30.6, w: 1.2, h: 6 }, to: 'junction', entry: 'west' },
    ],
    entries: {
        default: { x: 2.6, y: 10.0, facing: 0 },
        west: { x: 2.6, y: 10.0, facing: 0 },
        east: { x: W - 2.6, y: 33.4, facing: 180 },
    },
    npcs: [
        // R2 stands guard on the bridge, R1 patrols the D side of the path (E3, t120.8-134)
        { id: 'rangerBridge', kind: 'ranger', x: BR.x + 0.2, y: BR.y + 0.3, facing: 180, behaviour: 'idle' },
        { id: 'rangerD', kind: 'ranger', x: 33.0, y: 18.8, facing: 200, behaviour: 'patrol', route: [{ x: 25.0, y: 15.0 }, { x: 36.0, y: 19.8 }] },
        // napping inside the teal tent: only hears, Zs rise from the tent
        { id: 'napperD', kind: 'camper', look: 'b', x: at(-8.9, 8.4).x, y: at(-8.9, 8.4).y, facing: -90, behaviour: 'sleep' },
        // C: a camper in a red cap and a kid stroll by the trash can (E5, t217-240)
        { id: 'jayD1', kind: 'bluejay', x: 36.4, y: 23.0, facing: 200 },
        { id: 'jayC1', kind: 'bluejay', x: 52.0, y: 28.2, facing: 30 },
        { id: 'redcapC', kind: 'camper', look: 'camper_redcap', x: 47, y: 21.4, facing: 0, behaviour: 'patrol', route: [{ x: 44, y: 20.6 }, { x: 58, y: 25.6 }] },
        { id: 'kidC', kind: 'camper', look: 'hiker', x: 52, y: 22.8, facing: 180, behaviour: 'patrol', route: [{ x: 60, y: 26.4 }, { x: 46, y: 21.0 }] },
    ],
    interactables: [
        { id: 'outhouseD', kind: 'hide', x: at(-16, -4.5).x, y: at(-16, -4.5).y, radius: 0.9 },
        { id: 'tableD', kind: 'table', x: at(-1.3, 9.3).x, y: at(-1.3, 9.3).y, radius: 1.9 },
        { id: 'trashC', kind: 'trash', x: tPad.x - 0.5, y: tPad.y - 0.5, radius: 1.0, loot: ['stinkyFood'] },
        { id: 'tableC', kind: 'table', x: 54.6, y: 17.8, radius: 1.9 },
    ],
    // caught anywhere in the campground: you wake outside the gate (inside-park t138.6)
    respawn: { zone: 'home', x: 69.4, y: 24.4, rangerAt: { x: 71.2, y: 25.6 } },
    rangerSpawns: [{ x: 1, y: 10 }, { x: W - 1, y: 33.6 }],
    rangersRespond: true,
    scatter: { seed: 70 },
};

// --------------------------------------------------------------------- script
let napSaid = false;

export const campCDScript: ZoneScript = {
    onEnter(w: World) {
        napSaid = false;
        // the napper is inside the tent: you only see the Zs
        const napper = w.human('napperD');
        if (napper) napper.ghost = true;
    },
    onUpdate(w: World) {
        // "It's time for a nap" (t115.5) the first time you come by the D camp
        const napper = w.human('napperD');
        if (!napSaid && napper && Math.hypot(w.player.x - napper.x, w.player.y - napper.y) < 12) {
            napSaid = true;
            napper.say('It\'s time for a nap', 5);
        }
    },
};
