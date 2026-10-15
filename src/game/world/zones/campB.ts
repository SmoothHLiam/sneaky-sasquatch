import type { PropPlacement, ZoneDef } from '../types';
import type { ZoneScript } from './index';
import type { World } from '../../scenes/World';
import { G } from '../../core/state';
import { DECAL_MIX, forest, pts, rect, scatter } from './helpers';

/**
 * CAMPSITE B — layout measured on inside-park t0066.5 (default zoom ≈121 px/m
 * across, 95 px/m down on the 2000-px still) and the 56-110 s run (b61-b91):
 *   The footpath comes in from Campsite A in the west, runs straight, then bends
 *   south-east at the "B" post. South of the straight part: orange tent, a kid on a
 *   red-check blanket with a little radio (music notes), a teal umbrella, a picnic
 *   basket, and a firewood stack with the newspaper on it ("?" marker, eye prompt).
 *   A pond lies south-west of the camp on a dirt shore; a berry thicket east.
 *   North of the bend: the red outhouse (hide spot). Further north through the
 *   trees: the secret cache by a tall grey rock, then a raised dirt road (edge).
 */
const W = 70, H = 44;
const TENT = { x: 20, y: 19 };

const path = pts(-1, 24.4, 12, 24.2, 22.2, 23.7, 25.6, 22.6, 30.4, 20.7, 35, 18.6, 40, 17.6, 50, 17.4, W + 1, 17.4);
const clearing = pts(13.6, 18.6, 17.5, 17.2, 23.6, 16.4, 25.2, 13.2, 22.2, 10.8, 15.4, 10.6, 11.6, 13.4);
const pond = pts(10.2, 13.2, 15.6, 12.6, 18.4, 10.2, 17.2, 7.2, 12.8, 6.0, 8.6, 7.4, 7.6, 10.4);
const thicketSE = pts(25.6, 19.4, 30.2, 18.4, 31.8, 15.4, 29.8, 13.0, 25.8, 13.6, 24.6, 16.6);
const thicketN1 = pts(13.4, 25.8, 19.4, 25.6, 21.2, 27.8, 18.6, 29.6, 13.6, 29.2);
const thicketN2 = pts(21.8, 25.8, 27.2, 25.0, 28.6, 27.2, 26.2, 29.4, 21.6, 28.8);
const CACHE = { x: 36.2, y: 33.6 };
const ROCK = { x: 38.6, y: 32.2 };
const trail = pts(32.4, 22.4, 34.0, 22.4, 36.4, 32.4, 35.0, 32.6);

const north = pts(0, 30, 12, 30.2, 20, 31.4, 30, 30.4, 34, 26.4, 40, 22.8, 50, 21.8, 60, 22.6, W, 22.4, W, 39, 0, 39);
const south = pts(19.2, 0, W, 0, W, 13.6, 60, 14.0, 50, 13.4, 42, 12.0, 36, 9.8, 30, 9.0, 26.4, 8.8, 22.6, 6.4, 20.6, 3.0);
const southWest = pts(0, 0, 19.2, 0, 20.6, 3.0, 17.4, 4.6, 10.4, 4.4, 6.0, 6.0, 4.0, 10.2, 3.2, 16.0, 0, 18.0);

/** keep the cache nook and the trail to it open */
const open = (p: PropPlacement) =>
    Math.hypot(p.x - CACHE.x, p.y - CACHE.y) > 2.0 && Math.hypot(p.x - ROCK.x, p.y - ROCK.y) > 2.2 && !(p.x > 32 && p.x < 37.4 && p.y < 32.6);

export const campBZone: ZoneDef = {
    id: 'campB',
    name: 'Campsite B',
    w: W,
    h: H,
    zoom: 1.12,
    groundColor: 0x3f9c37,
    ground: [
        { kind: 'grassLight', pts: trail },
        { kind: 'dirt', pts: clearing },
        { kind: 'water', pts: pond },
        // raised dirt road along the top edge (b86, b91): the area boundary
        { kind: 'dirt', pts: pts(-1, 39.6, W + 1, 39.0, W + 1, H + 1, -1, H + 1) },
        { kind: 'path', pts: path, width: 2.4 },
    ],
    props: [
        ...forest(north, 61).filter(open),
        ...forest(south, 62),
        ...forest(southWest, 63),
        ...forest(thicketSE, 64, { trees: 0, under: 6, mix: [{ type: 'berryBush', weight: 1 }] }),
        ...scatter(thicketSE, [{ type: 'berryBush', weight: 1 }], 6, 65, { minGap: 1.5 }),
        ...scatter(thicketN1, [{ type: 'berryBush', weight: 1 }], 5, 66, { minGap: 1.5 }),
        ...scatter(thicketN2, [{ type: 'berryBush', weight: 1 }], 5, 67, { minGap: 1.5 }),
        ...scatter(rect(2, 14, 66, 12), DECAL_MIX, 200, 68, { minGap: 0.55, avoid: [rect(12, 10, 14, 10)] }),
        ...scatter(rect(4, 16, 60, 8), [{ type: 'fern', weight: 3 }, { type: 'rock', weight: 1 }, { type: 'stick', weight: 1 }], 14, 69, {
            minGap: 2.4,
            avoid: [rect(0, 22, W, 4), rect(12, 10, 16, 11), rect(24, 12, 9, 9)],
        }),
        // the camp (offsets from the tent measured on t0066.5)
        { type: 'tent', x: TENT.x, y: TENT.y, v: 1 },
        { type: 'umbrella', x: TENT.x + 1.36, y: TENT.y - 3.58 },
        { type: 'blanket', x: TENT.x - 0.06, y: TENT.y - 3.68 },
        { type: 'radioSmall', x: TENT.x - 1.59, y: TENT.y - 3.66 },
        { type: 'picnicBasket', x: TENT.x - 2.52, y: TENT.y - 1.47, id: 'basketB' },
        { type: 'firewood', x: TENT.x + 2.89, y: TENT.y - 0.53 },
        { type: 'newspaperFolded', x: TENT.x + 2.85, y: TENT.y - 0.56, z: 0.62 },
        { type: 'fern', x: TENT.x - 2.8, y: TENT.y + 0.4 },
        { type: 'fern', x: TENT.x - 3.6, y: TENT.y - 3.0 },
        { type: 'rock', x: TENT.x - 1.16, y: TENT.y + 3.31 },
        { type: 'rock', x: TENT.x + 4.88, y: TENT.y + 3.16 },
        { type: 'campSignB', x: TENT.x + 5.6, y: TENT.y + 1.63 },
        { type: 'flowersYellow', x: TENT.x + 6.0, y: TENT.y + 5.6 },
        { type: 'cattails', x: 17.6, y: 8.0 },
        { type: 'cattails', x: 9.0, y: 7.8 },
        { type: 'lilypad', x: 13.0, y: 9.6 },
        // north of the bend
        { type: 'outhouse', x: 31.1, y: 23.6, id: 'outhouseB' },
        { type: 'rockBig', x: 6.0, y: 34.4 },
        // the secret cache nook (b91)
        { type: 'cacheChest', x: CACHE.x, y: CACHE.y, id: 'cacheB' },
        { type: 'rockBig', x: ROCK.x, y: ROCK.y },
    ],
    cover: [north, south, southWest],
    walls: [rect(0, H - 4.6, W, 4.6), rect(0, 0, W, 2)],
    exits: [
        { rect: { x: 0, y: 21.0, w: 1.2, h: 7 }, to: 'campA', entry: 'east' },
        { rect: { x: W - 1.2, y: 14.4, w: 1.2, h: 6.4 }, to: 'campCD', entry: 'west' },
    ],
    entries: {
        default: { x: 2.6, y: 24.3, facing: 0 },
        west: { x: 2.6, y: 24.3, facing: 0 },
        east: { x: W - 2.6, y: 17.4, facing: 180 },
    },
    npcs: [
        // kid on the blanket with the radio (E1, t60-75): yellow shirt, sitting
        { id: 'kidB', kind: 'camper', look: 'kid_radio', x: TENT.x + 0.05, y: TENT.y - 3.55, facing: -110, behaviour: 'sit' },
        // a fisher walking the path east of the bend toward D (E2, t102-110)
        { id: 'jayB1', kind: 'bluejay', x: 25.0, y: 22.4, facing: 160 },
        { id: 'jayB2', kind: 'bluejay', x: 30.6, y: 24.6, facing: 20 },
        { id: 'fisherB', kind: 'camper', look: 'fisher', x: 52, y: 17.5, facing: 180, behaviour: 'patrol', route: [{ x: 44, y: 17.6 }, { x: 64, y: 17.4 }] },
    ],
    interactables: [
        { id: 'newspaperB', kind: 'sign', x: TENT.x + 2.89, y: TENT.y - 1.2, radius: 1.1, icon: 'eye' },
        { id: 'basketB', kind: 'basket', x: TENT.x - 2.52, y: TENT.y - 2.0, radius: 0.9, loot: ['sandwich', 'chips'] },
        { id: 'outhouseB', kind: 'hide', x: 31.1, y: 22.7, radius: 0.9 },
        { id: 'cacheB', kind: 'cache', x: CACHE.x, y: CACHE.y - 0.6, radius: 1.0, loot: ['coinBag', 'coinBag'] },
    ],
    // caught anywhere in the campground: you wake outside the gate (inside-park t138.6)
    respawn: { zone: 'home', x: 69.4, y: 24.4, rangerAt: { x: 71.2, y: 25.6 } },
    rangerSpawns: [{ x: 1, y: 24.4 }, { x: W - 1, y: 17.4 }],
    rangersRespond: true,
    scatter: { seed: 60 },
};

// --------------------------------------------------------------------- script
const RADIO = { x: TENT.x - 1.59, y: TENT.y - 3.66 };
let noteT = 0;

export const campBScript: ZoneScript = {
    onEnter(w: World) {
        noteT = 0;
        // the newspaper's "?" point-of-interest marker until you've read today's paper
        if (G.save.flags.paperRead !== G.save.day) w.markers.push({ id: 'newspaperB', x: TENT.x + 2.85, y: TENT.y - 0.56, z: 1.5, glyph: '?' });
        w.handlers['newspaperB'] = () => {
            G.setFlag('paperRead', G.save.day);
            w.markers = w.markers.filter((m) => m.id !== 'newspaperB');
            w.openCard('newspaper');
        };
    },
    onUpdate(w: World, dt: number) {
        // the kid's radio plays: music notes drift up from it (t0066.5)
        noteT -= dt;
        if (noteT <= 0) {
            noteT = 0.75;
            w.emitNote(RADIO.x, RADIO.y, 0.35);
        }
    },
};
