import type { BuildingDef, Interactable, PropPlacement, ZoneDef } from '../types';
import type { World } from '../../scenes/World';
import type { ZoneScript } from './index';
import { G } from '../../core/state';
import { DECAL_MIX, forest, pts, rect, scatter } from './helpers';

/**
 * RANGER STATION — east of the junction (inside-park 417-866 s; frames t418-t466,
 * t655-t862). The dirt road comes in from the north-west, curves round the
 * payphone (blue "Phone" booth on a grey slab, hydrant by its path) and runs east
 * along the station lawn into a big dirt parking lot (white car, power line).
 * The L-shaped log cabin has a gabled main block (sign, window, door) and an east
 * wing set back 2.2 m; berry bushes either side of the door path (the sasquatch
 * hides in the one east of the door, 653-806). The Fox waits at the lawn's
 * south-east corner. South of the lot: a grass strip with the "Exit →" sign, the
 * power poles carrying the LOST DOG posters, and the fence above the forest drop.
 * Inside (station_interior.json): north room = bed (sleeping ranger), cabinet,
 * moose head, table + chairs, TV, fridge, counter, stove, smoke detector; partition
 * with a door; south room = ATM, vending machine, newspaper box, long table.
 */
const W = 50, H = 36;
/** [measured t452/t800] ≈2 m of lawn between the station front and the road's north edge; the road is ≈4 m wide */
const ROAD_Y = 14.4;
/** station anchor = centre of the 8.01 x 7.91 wall bbox (station.json) */
const S = { x: 18.0, y: 22.4 };
const at = (dx: number, dy: number) => ({ x: S.x + dx, y: S.y + dy });
const PHONE = { x: 11.0, y: 19.54 };
const POLES = [{ x: 26.1, y: 13.7 }, { x: 37.0, y: 7.0 }, { x: 47.0, y: 7.0 }];
/** [measured t825] south of the lot: a grass strip (poster pole 0.7 m in from the lot's edge), a
 *  ≈1 m dirt footpath 0.9 m south of the pole that turns up into the lot 2.5 m east of it, then the
 *  fence 2.3 m south of the pole above the forest drop */
const PATH_Y = POLES[1].y - 0.9, FENCE_Y = POLES[1].y - 2.3;

const forestN = pts(0, 29.4, 6, 29.0, 10, 30.4, 22, 31.2, 30, 31.8, 40, 32.2, W, 31.4, W, H, 0, H);
const forestSW = pts(0, 0, 6.4, 0, 6.4, 2.6, 5.0, 8.4, 3.4, 12.8, 1.6, 17.6, 0, 19.4);
/** below the fence the ground drops away: only the tops of small pines show over the rails (t825) */
const forestS = pts(6.4, -3, W, -3, W, FENCE_Y - 2.3, 6.4, FENCE_Y - 2.3);
const forestE = pts(45.2, 18.4, W, 18.0, W, 31.4, 43.4, 31.6);

const FOOTPATH = pts(4.6, PATH_Y + 0.2, 12, PATH_Y, 38.6, PATH_Y, 39.5, PATH_Y + 0.4, 39.9, POLES[1].y + 1.0);
const ROAD = pts(-1, 26, 2.4, 25.2, 4.4, 22.6, 4.6, 18.8, 6.0, 16.0, 9.0, ROAD_Y + 0.2, 12, ROAD_Y, 24, ROAD_Y);
/** the lot: east of the lawn (rounded corner at its SE), down to the grass strip by the Exit sign */
const LOT = pts(22.7, H + 1, 22.7, 17.6, 22.3, 16.9, 21.5, 16.4 - 0.3, 21.5, 12.4 + 0.3, 22.5, 11.8, 23.1, 10.6, 23.3, 8.6, 24.1, 7.7, W + 1, 7.7, W + 1, H + 1);

// ---- the building ----------------------------------------------------------
const station: BuildingDef = {
    id: 'station', x: S.x, y: S.y, w: 8.01, d: 7.91,
    doorX: -0.575, doorW: 0.83,
    exterior: 'station', interior: 'station_interior',
    interiorFront: 'station_interior_front', frontSortY: -3.955,
    walls: [
        { x0: -4.005, x1: -0.99, y0: -3.955, y1: -3.695 },
        { x0: -0.16, x1: 1.235, y0: -3.955, y1: -3.695 },
        { x0: 1.045, x1: 1.235, y0: -3.955, y1: -1.495 },
        { x0: 1.045, x1: 4.005, y0: -1.755, y1: -1.495 },
        { x0: -4.005, x1: -3.815, y0: -3.955, y1: 3.955 },
        { x0: 3.815, x1: 4.005, y0: -1.755, y1: 3.955 },
        { x0: -4.005, x1: 4.005, y0: 3.725, y1: 3.955 },
        { x0: -3.815, x1: 2.1, y0: 0.565, y1: 0.825 },
        { x0: 2.93, x1: 3.815, y0: 0.565, y1: 0.825 },
    ],
    rooms: [
        { x0: -3.815, x1: 1.045, y0: -3.695, y1: 0.565 },
        { x0: 1.045, x1: 3.815, y0: -1.495, y1: 0.565 },
        // the partition doorway counts as inside too, so the roof doesn't flash on
        { x0: 2.1, x1: 2.93, y0: 0.5, y1: 0.9 },
        { x0: -3.815, x1: 3.815, y0: 0.825, y1: 3.725 },
    ],
    layers: [
        { key: 'station_interior_front_wing', sortY: -1.755 },
        { key: 'station_interior_mid', sortY: 0.565 },
    ],
    // inside, both doors stand closed until someone walks through (t655: front door shut behind you)
    innerDoors: [
        { closed: 'station_door', open: 'station_door_open', sortY: -3.955, openSortY: -4.405, x0: -0.99, x1: -0.16, y: -3.955 },
        { closed: 'station_door_inner', open: 'station_door_inner_open', sortY: 0.565, openSortY: 1.225, x0: 2.1, x1: 2.93, y: 0.565 },
    ],
};

/** furniture from station_interior.json (offsets from the anchor) */
const F = (type: string, dx: number, dy: number, extra: Partial<PropPlacement> = {}): PropPlacement => ({ type, ...at(dx, dy), in: 'station', ...extra });
const furniture: PropPlacement[] = [
    // rugs lie on the floor sprite: sort just in front of it (anchor + 3.94)
    F('rugRedStation', -0.93, 2.03, { sort: 3.94 - 2.03 }),
    F('rugRedStationB', -0.6, -1.74, { sort: 3.94 + 1.74 }),
    F('bedTeal', -3.4, 3.04),
    F('cabinetWood', -2.385, 3.485),
    F('mooseHead', -1.075, 3.725),
    F('tableYellow', -1.11, 3.23),
    F('chairCyan', -1.785, 3.225, { v: 1 }),
    F('chairCyan', -0.435, 3.225, { v: 3 }),
    F('tvCrt', 0.25, 3.445),
    F('fridge', 1.335, 3.475),
    F('kitchenCounter', 2.38, 3.445),
    F('stoveRange', 3.4, 3.442),
    F('smokeDetector', 3.385, 3.725),
    F('atm', -2.99, 0.145),
    F('vendingMachine', -1.585, 0.2),
    F('newspaperBox', -0.25, 0.355),
    F('tableYellowLong', -2.57, -2.075),
    F('chairCyan', -3.395, -1.905, { v: 1 }),
    F('chairCyan', -1.6, -3.395, { v: 0 }),
    F('chairCyan', 0.4, -3.395, { v: 0 }),
    // [measured t0470] a potted plant in the east wing, ≈0.6 m off its east wall
    F('pottedPlant', 3.25, -1.15),
];

const STOVE = at(3.4, 3.442), FRIDGE = at(1.335, 3.475), TV = at(0.25, 3.445);
const VENDING = at(-1.585, 0.2), NEWSBOX = at(-0.25, 0.355);
/** you work the appliances from in front of them */
const front = (p: { x: number; y: number }, dy = 0.62) => ({ x: p.x, y: p.y - dy });

const interactables: Interactable[] = [
    { id: 'stove', kind: 'sign', ...front(STOVE), radius: 0.9, icon: 'hand' },
    { id: 'fridgeStation', kind: 'sign', ...front(FRIDGE), radius: 0.9, icon: 'hand', loot: ['orange', 'pepper'] },
    { id: 'tv', kind: 'sign', ...front(TV), radius: 0.9, icon: 'hand' },
    { id: 'vending', kind: 'sign', ...front(VENDING, 0.75), radius: 0.9, icon: 'coin' },
    { id: 'newsbox', kind: 'sign', ...front(NEWSBOX, 0.6), radius: 0.8, icon: 'eye' },
    { id: 'payphone', kind: 'sign', x: PHONE.x, y: PHONE.y - 0.8, radius: 0.9, icon: 'coin' },
    { id: 'posterA', kind: 'sign', x: POLES[1].x, y: POLES[1].y - 0.55, radius: 1.0, icon: 'eye' },
    { id: 'posterB', kind: 'sign', x: POLES[2].x, y: POLES[2].y - 0.55, radius: 1.0, icon: 'eye' },
];

export const stationZone: ZoneDef = {
    id: 'station',
    name: 'Ranger Station',
    w: W,
    h: H,
    zoom: 1.12,
    groundColor: 0x3f9c37,
    ground: [
        // the road in from the junction, curving round the payphone; the parking lot east of the lawn
        { kind: 'shoulder', pts: ROAD, width: 4.6 },
        { kind: 'shoulder', pts: LOT, sharp: true },
        { kind: 'dirt', pts: ROAD, width: 4.0 },
        { kind: 'dirt', pts: LOT.map((p) => ({ x: p.x + (p.x < W ? 0.3 : 0), y: p.y + (p.y < H ? 0.3 : 0) })), sharp: true },
        // the earth bank where the ground drops away below the fence
        { kind: 'dirt', pts: pts(5.6, FENCE_Y - 0.8, 14, FENCE_Y - 1.0, 18, FENCE_Y - 0.6, 28, FENCE_Y - 0.9, 36, FENCE_Y - 0.7, W + 1, FENCE_Y - 0.9, W + 1, -3, 5.6, -3) },
        // the footpath along the south edge, turning up into the lot east of the poster pole
        { kind: 'shoulder', pts: FOOTPATH, width: 1.3 },
        { kind: 'dirt', pts: FOOTPATH, width: 1.0 },
        // sandy footpaths: slab → road, door → road
        { kind: 'shoulder', pts: pts(PHONE.x, 19.0, PHONE.x, 16.0), width: 1.1, sharp: true },
        { kind: 'shoulder', pts: pts(S.x - 0.575, 18.5, S.x - 0.575, 16.0), width: 1.3, sharp: true },
    ],
    props: [
        ...forest(forestN, 171),
        ...forest(forestSW, 172),
        ...forest(forestS, 173, { mix: [{ type: 'pineSmall', weight: 1 }] }),
        ...forest(forestE, 174),
        ...scatter(rect(6, 16.6, 16.6, 13), DECAL_MIX, 36, 175, { minGap: 0.7, avoid: [rect(13.6, 17.8, 9, 9.2), rect(9.6, 18.6, 2.8, 2.2)] }),
        ...scatter(rect(6.4, FENCE_Y + 0.4, W - 6.4, 2.4), DECAL_MIX, 30, 176, { minGap: 0.6, avoid: [rect(6.4, PATH_Y - 0.7, 34, 1.4)] }),
        ...scatter(rect(6.6, PATH_Y + 0.8, 15, 4.6), DECAL_MIX, 14, 177, { minGap: 0.6 }),
        // the building + its furniture (the BuildingDef supplies walls and cut-aways)
        { type: 'stationBuilding', x: S.x, y: S.y, id: 'station' },
        ...furniture,
        // payphone, hydrant and the tree beside them (t426, t452)
        { type: 'payphone', x: PHONE.x, y: PHONE.y, id: 'payphoneProp' },
        { type: 'fireHydrant', x: 8.6, y: 17.6 },
        { type: 'roundTree', x: 8.0, y: 21.8, v: 0 },
        // berry bushes either side of the door path (t456, t800)
        // [measured cutscene t11.0] a ≈3 m cluster from the payphone path to under the window
        { type: 'berryBush', x: 13.1, y: 17.1 },
        { type: 'berryBush', x: 14.7, y: 17.5 },
        { type: 'berryBush', x: 20.0, y: 17.3 },
        { type: 'berryBush', x: 21.7, y: 18.1 },
        { type: 'bush', x: 12.6, y: 24.4 },
        { type: 'fern', x: 16.2, y: 17.3 },
        { type: 'rock', x: 15.7, y: 16.9 },
        { type: 'fern', x: 12.2, y: 18.0 },
        { type: 'rock', x: 21.4, y: 19.4 },
        // the lot: white cars parked east of the wing (t466, t812)
        { type: 'carWhite', x: 24.8, y: 21.0 },
        { type: 'carWhite', x: 31.6, y: 18.9 },
        { type: 'pineSmall', x: 14.8, y: 10.4 },
        { type: 'pineSmall', x: 27.0, y: FENCE_Y - 1.4 },
        // a dried (movable) bush beside the poster pole, berry bushes east of the path's bend (t825)
        { type: 'hideBush', x: POLES[1].x + 1.3, y: POLES[1].y - 0.1 },
        { type: 'berryBush', x: 41.8, y: 6.6 },
        { type: 'berryBush', x: 43.4, y: 6.0 },
        // power line with the LOST DOG posters by the Exit sign (t812, t822)
        { type: 'powerPole', x: POLES[0].x, y: POLES[0].y },
        { type: 'powerPolePoster', x: POLES[1].x, y: POLES[1].y },
        { type: 'powerPolePoster', x: POLES[2].x, y: POLES[2].y },
        { type: 'signExit', x: POLES[1].x - 2.8, y: POLES[1].y },
        // split-rail fence behind the station (t0476 background)
        ...Array.from({ length: 11 }, (_, i) => ({ type: 'fence', x: 7.4 + i * 2.13, y: 28.6 })),
        ...Array.from({ length: 21 }, (_, i) => ({ type: 'fence', x: 7.6 + i * 2.13, y: FENCE_Y })),
    ],
    buildings: [station],
    // the olive pickup nosed in east of the wing (t0470/t0476); locked like every parked car
    vehicles: [{ id: 'pkStation', kind: 'car_pickup_olive', x: 25.8, y: 25.5, facing: 180, locked: true }],
    wires: [[{ x: 22.6, y: 44 }, POLES[0], POLES[1], POLES[2], { x: 64, y: 7.4 }]],
    cover: [forestN, forestSW, forestS, forestE],
    walls: [rect(0, 0, W, FENCE_Y - 0.1)],
    exits: [
        { rect: { x: 0, y: 23.6, w: 1.2, h: 4.6 }, to: 'junction', entry: 'east' },
        { rect: { x: W - 1.2, y: 7.7, w: 1.2, h: 10.2 }, to: 'campEdge', entry: 'west' },
    ],
    entries: {
        default: { x: 2.6, y: 25.0, facing: -20 },
        west: { x: 2.6, y: 25.0, facing: -20 },
        east: { x: W - 2.6, y: 12.0, facing: 180 },
    },
    npcs: [
        // asleep in the north room's bed until something wakes him (E10/E11, Fox mischief)
        { id: 'stationRanger', kind: 'ranger', ...at(-3.4, 3.0), facing: -90, behaviour: 'sleep', sleepAnim: 'sleepBed' },
        { id: 'fox', kind: 'fox', x: 23.8, y: 16.0, facing: 180, behaviour: 'sit' },
    ],
    interactables,
    respawn: { zone: 'home', x: 69.4, y: 24.4, rangerAt: { x: 71.2, y: 25.6 } },
    rangerSpawns: [{ x: 1, y: 26 }, { x: W - 1, y: 12 }],
    rangersRespond: true,
    scatter: { seed: 170 },
};

// --------------------------------------------------------------------- script
/** TV static is loud: keep the sasquatch "noisy" while it hisses (inside-park E11) */
const STATIC_NOISE = 0.25;

function refreshPosterMarkers(w: World) {
    w.markers = w.markers.filter((m) => !m.id.startsWith('poster'));
    if (G.flag('lostDogPoster')) return;
    // dark "?" over each unread poster (inside-park 811-822)
    w.markers.push({ id: 'posterA', x: POLES[1].x, y: POLES[1].y - 0.12, z: 2.3, glyph: '?' });
    w.markers.push({ id: 'posterB', x: POLES[2].x, y: POLES[2].y - 0.12, z: 2.3, glyph: '?' });
}

export const stationScript: ZoneScript = {
    onEnter(w: World) {
        refreshPosterMarkers(w);
        // the stove is wired by quests/fox.ts, the payphone by quests/lostDog.ts
        w.handlers['fridgeStation'] = () => {
            const it = w.zone.interactables.find((i) => i.id === 'fridgeStation')!;
            w.openMinigame('fridge', { loot: w.containerLoot(it), containerId: it.id });
        };
        w.handlers['tv'] = () => w.openMinigame('tv', { onStatic: () => { w.player.applianceNoise = STATIC_NOISE; } });
        w.handlers['vending'] = () => w.openMinigame('vending');
        w.handlers['newsbox'] = () => w.openMinigame('newsbox');
        const poster = () => {
            G.setFlag('lostDogPoster');
            refreshPosterMarkers(w);
            w.openCard('lost_dog');
        };
        w.handlers['posterA'] = poster;
        w.handlers['posterB'] = poster;
    },
};
