import type { BuildingDef, PropPlacement, ZoneDef, GroundPatch } from '../types';
import { DECAL_MIX, forest, pts, rect, scatter } from './helpers';

/**
 * RACE TRACK — the big parking lot tile (outside-park t46-232, o04-o25; full map
 * x 1140-1340, y 165-290 at ≈0.5 m/px).
 *   A two-lane boulevard (≈5.2 m of asphalt, sandy shoulders, a tree median with a
 *   post rail on its west side) comes up from the highway in the south-east; the
 *   RACE TRACK monument stands on the lawn east of it, tiki torches along the
 *   forest edge (the respawn forest). The lot (≈60 x 36 m) has five double rows
 *   of stalls. Along its north edge, behind a concrete sidewalk: Automotive
 *   CUSTOMS and the GARAGE (west), the entrance road north to the circuit
 *   through the ENTRANCE gantry, LICENSING with go-karts on its sidewalk, a lawn
 *   with the red-roofed map kiosk and a hydrant, and the CAR DEALERSHIP with a
 *   row of RESERVED stalls in front (east). Parked cars in the lot are locked.
 */
const W = 100, H = 82;
const BX = 76;          // boulevard centre
const LOT = { x0: 8, x1: 68, y0: 8, y1: 44 };
const SIDEWALK = { y0: 44, y1: 46.4 };
const ENTR = 46;        // entrance road centre (north to the circuit)

const stallRows: GroundPatch[] = [];
for (const cx of [16, 26, 36, 46, 56]) {
    stallRows.push({ kind: 'lineWhite', pts: pts(cx, 12, cx, 40), width: 0.14, sharp: true });
    for (let y = 12; y <= 40.01; y += 2.45) stallRows.push({ kind: 'lineWhite', pts: pts(cx - 4.8, y, cx + 4.8, y), width: 0.12, sharp: true });
}
// RESERVED stalls in front of the dealership (o05)
const reserved: GroundPatch[] = [];
const reservedPaint: PropPlacement[] = [];
for (let i = 0; i <= 9; i++) {
    const x = 70 + i * 2.43;
    reserved.push({ kind: 'lineWhite', pts: pts(x, 38.8, x, 43.4), width: 0.14, sharp: true });
    if (i < 9) reservedPaint.push({ type: 'paintReserved', x: x + 1.215, y: 39.6 });
}

// ---- the building row ----------------------------------------------------------
// Every building's art (Blender: art/blender/props_lot.py) is anchored on the centre of its wall
// bounding box; walls, rooms, doors and furniture below are copied from the sprites' JSON sidecars
// (metres from that anchor). The fronts all sit on ROW, just behind the sidewalk. Order from the
// full map: Automotive CUSTOMS, GARAGE, the ENTRANCE road, LICENSING, a lawn with the map kiosk,
// then the CAR DEALERSHIP with its RESERVED stalls.
const ROW = 46.6;
const CUS = { x: 21.13, y: ROW + 3.1 };     // 13.06 x 6.2
const GAR = { x: 34.475, y: ROW + 3.025 };  // 12.55 x 6.05
const LIC = { x: 55.825, y: ROW + 3.5 };    // 7.65 x 7.0, exterior only
const DEA = { x: 81.0, y: ROW + 4.505 };    // 22.71 x 9.01

/** a prop inside building `id`, placed by its offset from that building's anchor */
const inB = (id: string, o: { x: number; y: number }, type: string, dx: number, dy: number, extra: Partial<PropPlacement> = {}): PropPlacement =>
    ({ type, x: o.x + dx, y: o.y + dy, in: id, ...extra });

const dealership: BuildingDef = {
    id: 'dealership', x: DEA.x, y: DEA.y, w: 22.71, d: 9.01,
    doorX: 3.93, doorW: 0.95,
    exterior: 'dealership', interior: 'dealership_interior',
    interiorFront: 'dealership_interior_front', frontSortY: -4.505,
    walls: [
        { x0: -11.355, x1: -10.405, y0: -4.505, y1: -4.305 },
        { x0: -6.705, x1: -6.285, y0: -4.505, y1: -4.305 },
        { x0: -2.585, x1: -2.165, y0: -4.505, y1: -4.305 },
        { x0: 1.535, x1: 1.955, y0: -4.505, y1: -4.305 },
        { x0: 7.455, x1: 7.915, y0: -4.505, y1: -4.305 },
        { x0: 10.415, x1: 11.355, y0: -4.505, y1: -4.305 },
        { x0: -10.405, x1: -6.705, y0: -4.505, y1: -4.305 },
        { x0: -6.285, x1: -2.585, y0: -4.505, y1: -4.305 },
        { x0: -2.165, x1: 1.535, y0: -4.505, y1: -4.305 },
        { x0: 7.915, x1: 10.415, y0: -4.505, y1: -4.305 },
        { x0: 2.385, x1: 3.455, y0: -4.505, y1: -4.305 },
        { x0: 4.405, x1: 5.465, y0: -4.505, y1: -4.305 },
        { x0: 1.955, x1: 2.385, y0: -4.735, y1: -4.305 },
        { x0: 5.465, x1: 7.455, y0: -4.735, y1: -4.305 },
        { x0: -11.355, x1: -11.155, y0: -4.505, y1: 4.505 },
        { x0: 11.155, x1: 11.355, y0: -4.505, y1: 4.505 },
        { x0: -11.355, x1: 11.355, y0: 4.305, y1: 4.505 },
        // the sales office in the NE corner (glass wall with a door)
        { x0: 6.945, x1: 7.055, y0: -0.905, y1: 4.305 },
        { x0: 6.945, x1: 9.045, y0: -0.905, y1: -0.755 },
        { x0: 9.945, x1: 11.155, y0: -0.905, y1: -0.755 },
    ],
    rooms: [
        { x0: -11.155, x1: 11.155, y0: -4.305, y1: 4.305 },
    ],
    layers: [{ key: 'dealership_interior_mid', sortY: -0.905 }],
    innerDoors: [
        { closed: 'dealership_door', open: 'dealership_door_open', sortY: -4.505, openSortY: -5.105, x0: 3.455, x1: 4.405, y: -4.505 },
        { closed: 'dealership_office_door', open: 'dealership_office_door_open', sortY: -0.905, openSortY: -1.405, x0: 9.045, x1: 9.945, y: -0.905 },
    ],
};

const garage: BuildingDef = {
    id: 'garage', x: GAR.x, y: GAR.y, w: 12.55, d: 6.05,
    // the east bay stands open (the walk/drive-in entrance); the door is the annex side door
    doorX: 4.935, doorW: 0.88,
    exterior: 'garage', interior: 'garage_interior',
    interiorFront: 'garage_interior_front', frontSortY: -3.025,
    walls: [
        { x0: -6.275, x1: -5.655, y0: -3.025, y1: -2.825 },
        { x0: -1.825, x1: -1.455, y0: -3.025, y1: -2.825 },
        { x0: 2.375, x1: 3.725, y0: -3.025, y1: -2.825 },
        { x0: -5.655, x1: -1.825, y0: -3.025, y1: -2.825 },
        { x0: -6.275, x1: -6.075, y0: -3.025, y1: 3.025 },
        { x0: 6.075, x1: 6.275, y0: -1.185, y1: 3.025 },
        { x0: 3.525, x1: 3.725, y0: -3.025, y1: -0.985 },
        { x0: -6.275, x1: 6.275, y0: 2.825, y1: 3.025 },
        { x0: 3.725, x1: 4.495, y0: -1.185, y1: -0.985 },
        { x0: 5.375, x1: 6.275, y0: -1.185, y1: -0.985 },
        // car-lift posts (cars drive between them)
        { x0: -5.42, x1: -4.98, y0: -0.76, y1: -0.29 },
        { x0: -2.51, x1: -2.07, y0: -0.76, y1: -0.29 },
        { x0: -1.22, x1: -0.78, y0: -0.76, y1: -0.29 },
        { x0: 1.69, x1: 2.13, y0: -0.76, y1: -0.29 },
    ],
    rooms: [
        { x0: -6.075, x1: 3.525, y0: -2.825, y1: 2.825 },
        { x0: 3.525, x1: 6.075, y0: -0.985, y1: 2.825 },
    ],
    layers: [{ key: 'garage_interior_front_annex', sortY: -1.185 }],
    innerDoors: [
        { closed: 'garage_door', open: 'garage_door_open', sortY: -1.185, openSortY: -1.685, x0: 4.495, x1: 5.375, y: -1.185 },
    ],
};

const customs: BuildingDef = {
    id: 'customs', x: CUS.x, y: CUS.y, w: 13.06, d: 6.2,
    doorX: 2.8, doorW: 0.92,
    exterior: 'customs', interior: 'customs_interior',
    interiorFront: 'customs_interior_front', frontSortY: -3.1,
    walls: [
        { x0: -6.53, x1: -5.66, y0: -3.1, y1: -2.9 },
        { x0: -1.66, x1: 0.46, y0: -3.1, y1: -2.9 },
        { x0: 5.14, x1: 6.53, y0: -3.1, y1: -2.9 },
        { x0: 0.46, x1: 2.34, y0: -3.1, y1: -2.9 },
        { x0: 3.26, x1: 5.14, y0: -3.1, y1: -2.9 },
        { x0: -6.53, x1: -6.33, y0: -3.1, y1: 3.1 },
        { x0: 6.33, x1: 6.53, y0: -3.1, y1: 3.1 },
        { x0: -6.53, x1: 6.53, y0: 2.9, y1: 3.1 },
        // partition between the open work bay (west) and the showroom
        { x0: -1.04, x1: -0.84, y0: -2.9, y1: 2.9 },
        // car-lift posts
        { x0: -5.335, x1: -4.895, y0: -0.735, y1: -0.265 },
        { x0: -2.425, x1: -1.985, y0: -0.735, y1: -0.265 },
    ],
    rooms: [
        { x0: -6.33, x1: -1.04, y0: -2.9, y1: 2.9 },
        { x0: -0.84, x1: 6.33, y0: -2.9, y1: 2.9 },
    ],
    innerDoors: [
        { closed: 'customs_door', open: 'customs_door_open', sortY: -3.1, openSortY: -3.6, x0: 2.34, x1: 3.26, y: -3.1 },
    ],
};

const furniture: PropPlacement[] = [
    // dealership (dealership_interior.json); price plates stand at each plinth's front-right corner
    inB('dealership', DEA, 'dealerDesk', 3.895, -1.805),
    inB('dealership', DEA, 'pottedPalm', 2.205, -1.705),
    inB('dealership', DEA, 'pottedPalm', 5.545, -1.705),
    inB('dealership', DEA, 'pottedPalm', 10.345, 3.895),
    inB('dealership', DEA, 'brochureStand', 7.995, -1.175),
    inB('dealership', DEA, 'computerDesk', 5.845, 2.475),
    inB('dealership', DEA, 'benchRed', 10.865, -2.105),
    inB('dealership', DEA, 'pricePlate', -6.505, -3.105, { v: 2 }),
    inB('dealership', DEA, 'pricePlate', -0.885, -3.105, { v: 0 }),
    inB('dealership', DEA, 'pricePlate', -6.505, 0.945, { v: 1 }),
    inB('dealership', DEA, 'pricePlate', 1.255, 0.995, { v: 3 }),
    inB('dealership', DEA, 'pricePlate', 8.975, 1.645, { v: 4 }),
    // garage bay (garage_interior.json): two lifts, an ATM and a vending machine in the annex
    inB('garage', GAR, 'carLift', -3.745, -0.525),
    inB('garage', GAR, 'carLift', 0.455, -0.525),
    inB('garage', GAR, 'atm', 4.275, 2.375),
    inB('garage', GAR, 'vendingMachine', 5.375, 2.405),
    // customs (customs_interior.json): lift in the work bay, desk and armchairs in the showroom
    inB('customs', CUS, 'carLift', -3.66, -0.5),
    inB('customs', CUS, 'customsDesk', 0.41, 1.43),
    inB('customs', CUS, 'armchairOrange', -0.46, -1.48),
    inB('customs', CUS, 'armchairOrange', -0.46, -2.42),
];

const forestE = pts(84.6, 0, W, 0, W, 64, 94.6, 64, 94.6, 35.4, 84.6, 35.4);
const forestW = pts(0, 0, 6.6, 0, 6.6, 58, 0, 58);
const forestS = pts(6.6, 0, 70, 0, 70, 5.4, 6.6, 5.4);
const forestN = pts(0, 57, 40, 57, 42.4, 62, 42.4, H, 0, H);
const forestNE = pts(50, 59, W, 59, W, H, 50, H);

export const raceLotZone: ZoneDef = {
    id: 'raceLot',
    name: 'Race Track',
    w: W,
    h: H,
    zoom: 1.12,
    groundColor: 0x3f9c37,
    ground: [
        // boulevard + its shoulders, turning west along the top of the lot
        { kind: 'shoulder', pts: pts(BX, -1, BX, 46.6), width: 7.0, sharp: true },
        { kind: 'asphalt', pts: pts(BX, -1, BX, 46.6), width: 5.2, sharp: true },
        { kind: 'lineYellow', pts: pts(BX, -1, BX, 36), width: 0.16, sharp: true },
        { kind: 'dirt', pts: pts(BX - 4.4, 0, BX - 4.4, 36), width: 1.8, sharp: true },
        // the lot
        { kind: 'asphalt', pts: pts(LOT.x0, LOT.y0, LOT.x1 + 4.8, LOT.y0, LOT.x1 + 4.8, SIDEWALK.y0, LOT.x0, SIDEWALK.y0), sharp: true },
        { kind: 'asphalt', pts: pts(LOT.x1, 36, W - 6, 36, W - 6, SIDEWALK.y0, LOT.x1, SIDEWALK.y0), sharp: true },
        ...stallRows,
        ...reserved,
        // concrete sidewalk along the buildings
        { kind: 'gravel', pts: pts(LOT.x0, SIDEWALK.y0, W - 6, SIDEWALK.y0, W - 6, SIDEWALK.y1, LOT.x0, SIDEWALK.y1), sharp: true },
        // entrance road north to the circuit
        { kind: 'asphalt', pts: pts(ENTR, SIDEWALK.y1, ENTR, H + 1), width: 5.0, sharp: true },
        // lawn strip with the kiosk between LICENSING and the dealership
        { kind: 'grassLight', pts: pts(62.6, 46.6, 68.6, 46.6, 68.6, 56, 62.6, 56), sharp: true },
    ],
    props: [
        ...forest(forestE, 161),
        ...forest(forestW, 162),
        ...forest(forestS, 163),
        ...forest(forestN, 164),
        ...forest(forestNE, 165),
        // median trees + post rail (o04)
        ...[4, 12, 20, 28].map((y) => ({ type: 'roundTree', x: BX - 4.4, y, v: y % 2 })),
        ...Array.from({ length: 8 }, (_, i) => ({ type: 'fencePost', x: BX - 3.5, y: 1 + i * 4.6 })),
        ...scatter(rect(78, 4, 6, 31), DECAL_MIX, 26, 166, { minGap: 0.7 }),
        { type: 'raceTrackSign', x: 82.4, y: 31.0 },
        ...[8, 14, 20, 26].map((y) => ({ type: 'tikiTorch', x: 84.2, y })),
        ...reservedPaint,
        // the building row (BuildingDefs supply walls & cut-aways; LICENSING is exterior only)
        { type: 'customsBuilding', x: CUS.x, y: CUS.y, id: 'customs' },
        { type: 'garageBuilding', x: GAR.x, y: GAR.y, id: 'garage' },
        { type: 'entranceGantry', x: ENTR, y: 50.4 },
        { type: 'licensingBuilding', x: LIC.x, y: LIC.y },
        { type: 'mapKiosk', x: 65.4, y: 50.6 },
        { type: 'fireHydrant', x: 63.0, y: 47.6 },
        { type: 'dealershipBuilding', x: DEA.x, y: DEA.y, id: 'dealership' },
        ...furniture,
    ],
    buildings: [dealership, garage, customs],
    vehicles: [
        // go-karts on the LICENSING sidewalk (o15) and one by the gantry
        { id: 'kartL1', kind: 'kart', x: 52.6, y: 45.3, facing: -90 },
        { id: 'kartL2', kind: 'kart', x: 55.2, y: 45.3, facing: -90 },
        { id: 'kartL3', kind: 'kart', x: 57.8, y: 45.3, facing: -90 },
        { id: 'kartG', kind: 'kart', x: ENTR + 3.4, y: 48.0, facing: 90 },
        // parked, locked (o14: padlock prompt on the blue sedan)
        { id: 'pkBlue', kind: 'car_compact_blue', x: 56 + 2.4, y: 33.2, facing: 0, locked: true },
        { id: 'pkMag', kind: 'car_compact_magenta', x: 56 + 2.4, y: 28.3, facing: 0, locked: true },
        { id: 'pkRed', kind: 'car_pickup_red', x: 46 - 2.4, y: 23.4, facing: 180, locked: true },
        { id: 'pkBrown', kind: 'car_pickup_brown', x: 36 + 2.4, y: 18.5, facing: 0, locked: true },
        { id: 'pkCyan', kind: 'car_pickup_cyan', x: 72.4, y: 41.0, facing: 90, locked: true },
        // for sale in the showroom, noses east (o38, dealership_interior.json displays). Buying is not built yet
        { id: 'saleSedan', kind: 'car_compact_magenta', x: DEA.x - 8.005, y: DEA.y - 1.905, facing: 0, locked: true },
        { id: 'saleTeal', kind: 'car_sedan_teal', x: DEA.x - 2.44, y: DEA.y - 1.905, facing: 0, locked: true },
        { id: 'salePickup', kind: 'car_pickup_cyan', x: DEA.x - 8.005, y: DEA.y + 2.345, facing: 0, locked: true },
        { id: 'saleSports', kind: 'car_sports_red', x: DEA.x - 0.32, y: DEA.y + 2.545, facing: 0, locked: true },
        { id: 'saleMoto', kind: 'motorcycle_red', x: DEA.x + 8.945, y: DEA.y + 2.895, facing: 0, locked: true },
        // the black sports car on show at Automotive CUSTOMS (o32)
        { id: 'customsCar', kind: 'car_sports_black', x: CUS.x + 5.07, y: CUS.y, facing: -90, locked: true },
    ],
    cover: [forestE, forestW, forestN, forestNE],
    walls: [],
    exits: [
        { rect: { x: BX - 3.5, y: 0, w: 7, h: 1.2 }, to: 'highway', entry: 'north' },
        { rect: { x: ENTR - 2.5, y: H - 1.2, w: 5, h: 1.2 }, to: 'circuit', entry: 'south' },
    ],
    entries: {
        default: { x: BX + 1.6, y: 2.6, facing: 90 },
        south: { x: BX + 1.6, y: 2.6, facing: 90 },
        north: { x: ENTR, y: H - 2.6, facing: -90 },
    },
    npcs: [
        // staff and customers (E07, E15, E16): they raise the alarm, rangers come by jeep
        // the salesman behind his reception counter ("Welcome!", o38), the clerk outside LICENSING,
        // the mechanic at the garage's side door (E14), the CUSTOMS owner behind his desk
        { id: 'salesman', kind: 'camper', look: 'camper_blond', x: DEA.x + 3.9, y: DEA.y - 1.0, facing: -90, behaviour: 'idle' },
        { id: 'clerk', kind: 'camper', look: 'camper_d', x: 53.9, y: 46.0, facing: -90, behaviour: 'idle' },
        { id: 'mechanic', kind: 'camper', look: 'camper_bluehat', x: GAR.x + 4.935, y: GAR.y - 2.2, facing: -90, behaviour: 'idle' },
        { id: 'customsOwner', kind: 'camper', look: 'camper_a', x: CUS.x + 0.41, y: CUS.y + 2.15, facing: -90, behaviour: 'idle' },
        { id: 'shopper', kind: 'camper', look: 'camper_a', x: 30, y: 30, facing: 0, behaviour: 'wander' },
    ],
    jeepRoutes: [[{ x: BX - 1.3, y: -3 }, { x: BX - 1.3, y: 30 }, { x: 70, y: 41.2 }]],
    interactables: [],
    respawn: { x: 90, y: 14, rangerAt: { x: 87, y: 14.6 } },
    rangerSpawns: [{ x: BX, y: 1 }, { x: ENTR, y: H - 1 }],
    rangersRespond: true,
    scatter: { seed: 160 },
};
