import type { ZoneDef } from '../types';
import { DECAL_MIX, forest, pts, rect, scatter } from './helpers';

/**
 * HIGHWAY JUNCTION — outside-park t11-45 (o02, o03, o33-o37) and the full map.
 *   The campground dirt road meets a paved north-south road ("Campground ←").
 *   North of it: birches and pines to the west, autumn trees to the east, a
 *   power line across. ≈62 m on, the E-W highway crosses at a stop-sign junction
 *   (white stop bars, green "Race Track ↑ / Ski Resort → / Farm Valley →" sign);
 *   the bus stop "Highway Intersection" is on the south side east of the junction.
 *   North of the highway a forest road ("Race Track ↑") runs ≈37 m to the next tile.
 *   On foot the highway itself is off limits: "It's too dangerous to go on the
 *   highway without a car!" / "The car dealership at the Race Track might have some for sale."
 */
const W = 64, H = 112;
const RX = 34;          // paved road centre
const HY = 66;          // highway centre
const DY = 8.8;         // dirt road centre

const westWood = pts(0, 13.6, 28.6, 13.6, 28.6, 60.2, 0, 60.2);
const eastWood = pts(39.6, 13.2, W, 13.2, W, 60.2, 39.6, 60.2);
const southWest = pts(0, 0, 28.6, 0, 28.6, 4.6, 0, 4.6);
const southEast = pts(39.6, 0, W, 0, W, 4.4, 39.6, 4.4);
const northWest = pts(0, 71.8, 29.4, 71.8, 29.4, H, 0, H);
const northEast = pts(38.6, 71.8, W, 71.8, W, H, 38.6, H);

const BLOCKED = ["It's too dangerous to go on the highway without a {r}car{/}!", 'The car dealership at the {g}Race Track{/} might have some for sale.'];

export const highwayZone: ZoneDef = {
    id: 'highway',
    name: 'Highway Intersection',
    w: W,
    h: H,
    zoom: 1.12,
    groundColor: 0x3f9c37,
    ground: [
        { kind: 'shoulder', pts: pts(-1, DY, RX - 2, DY), width: 6.6, sharp: true },
        { kind: 'dirt', pts: pts(-1, DY, RX - 2, DY), width: 5.6, sharp: true },
        { kind: 'shoulder', pts: pts(RX, -1, RX, H + 1), width: 9.2, sharp: true },
        { kind: 'shoulder', pts: pts(-1, HY, W + 1, HY), width: 9.6, sharp: true },
        { kind: 'asphalt', pts: pts(RX, -1, RX, H + 1), width: 8.0, sharp: true },
        { kind: 'asphalt', pts: pts(-1, HY, W + 1, HY), width: 8.4, sharp: true },
        // centre lines, broken at the junction
        { kind: 'lineYellow', pts: pts(RX, -1, RX, HY - 5.2), width: 0.18, sharp: true },
        { kind: 'lineYellow', pts: pts(RX, HY + 5.2, RX, H + 1), width: 0.18, sharp: true },
        { kind: 'lineYellow', pts: pts(-1, HY, RX - 5, HY), width: 0.18, sharp: true },
        { kind: 'lineYellow', pts: pts(RX + 5, HY, W + 1, HY), width: 0.18, sharp: true },
        // stop bars on the N-S approaches (o03)
        { kind: 'lineWhite', pts: pts(RX, HY - 4.8, RX + 4, HY - 4.8), width: 0.4, sharp: true },
        { kind: 'lineWhite', pts: pts(RX - 4, HY + 4.8, RX, HY + 4.8), width: 0.4, sharp: true },
    ],
    props: [
        ...forest(westWood, 151, { mix: [{ type: 'birch', weight: 3 }, { type: 'pine', weight: 3 }, { type: 'pineSmall', weight: 1 }] }),
        ...forest(eastWood, 152, { mix: [{ type: 'autumnTree', weight: 5 }, { type: 'birch', weight: 1 }] }),
        ...forest(southWest, 153),
        ...forest(southEast, 154, { mix: [{ type: 'autumnTree', weight: 1 }] }),
        ...forest(northWest, 155),
        ...forest(northEast, 156),
        ...scatter(rect(0, 13, W, 50), DECAL_MIX, 60, 157, { minGap: 0.7, avoid: [rect(28, 0, 12, H)] }),
        { type: 'signCampgroundLeft', x: 27.4, y: 12.4 },
        { type: 'stopSign', x: 29.4, y: 60.8 },
        { type: 'stopSign', x: 38.6, y: 71.2 },
        { type: 'signHighway', x: 41.6, y: 59.6 },
        { type: 'busStop', x: 47.0, y: 60.8, id: 'busStop' },
        { type: 'signRacetrackUp', x: 40.2, y: 97.0 },
        { type: 'signRacetrackUp', x: 40.2, y: 78.0 },
        { type: 'powerPole', x: 8.0, y: 4.2 },
        { type: 'powerPole', x: 28.8, y: 4.6 },
        { type: 'powerPole', x: 40.6, y: 18.0 },
        { type: 'powerPole', x: 40.6, y: 40.0 },
        { type: 'rock', x: 30.0, y: 26.0 },
    ],
    wires: [[{ x: -16, y: 4.2 }, { x: 8.0, y: 4.2 }, { x: 28.8, y: 4.6 }, { x: 40.6, y: 18.0 }, { x: 40.6, y: 40.0 }, { x: 40.6, y: 62.0 }]],
    cover: [westWood, eastWood, northWest, northEast],
    walls: [rect(0, 0, W, 1.0)],
    exits: [
        { rect: { x: 0, y: 5.5, w: 1.2, h: 6.6 }, to: 'campEdge', entry: 'east' },
        { rect: { x: RX - 4.6, y: H - 1.2, w: 9.2, h: 1.2 }, to: 'raceLot', entry: 'south' },
        // the highway east and west, and the paved road south, are off limits on foot
        { rect: { x: 0, y: HY - 4.8, w: 1.4, h: 9.6 }, to: 'highwayWest', entry: 'east', blockedLine: BLOCKED },
        { rect: { x: W - 1.4, y: HY - 4.8, w: 1.4, h: 9.6 }, to: 'highwayEast', entry: 'west', blockedLine: BLOCKED },
    ],
    entries: {
        default: { x: 2.6, y: DY, facing: 0 },
        west: { x: 2.6, y: DY, facing: 0 },
        north: { x: RX - 1.8, y: H - 2.6, facing: -90 },
    },
    lanes: [
        { id: 'nb', pts: [{ x: RX + 2, y: -3 }, { x: RX + 2, y: H + 3 }], every: [9, 16], looks: ['car_sedan_black', 'car_sedan_purple', 'car_pickup_red', 'car_sedan_white'] },
        { id: 'sb', pts: [{ x: RX - 2, y: H + 3 }, { x: RX - 2, y: -3 }], every: [10, 18], looks: ['car_sedan_white', 'car_sedan_lime', 'car_pickup_grey'] },
        { id: 'eb', pts: [{ x: -3, y: HY - 2 }, { x: W + 3, y: HY - 2 }], every: [7, 13], looks: ['jeep_olive', 'car_sedan_yellow', 'van_olive', 'car_sedan_orange'] },
        { id: 'wb', pts: [{ x: W + 3, y: HY + 2 }, { x: -3, y: HY + 2 }], every: [8, 14], looks: ['truck_box_white', 'car_compact_cyan', 'car_sedan_black'] },
    ],
    jeepRoutes: [
        [{ x: RX - 2, y: H + 3 }, { x: RX - 2, y: 78 }],
        [{ x: RX + 2, y: -3 }, { x: RX + 2, y: 22 }],
    ],
    npcs: [],
    interactables: [],
    respawn: { zone: 'raceLot', x: 74, y: 14, rangerAt: { x: 70.4, y: 14.6 } },
    rangerSpawns: [{ x: RX, y: H - 1 }, { x: RX, y: 1 }],
    rangersRespond: true,
    scatter: { seed: 150 },
};
