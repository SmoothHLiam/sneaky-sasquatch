import type { GroundPatch, PropPlacement, ZoneDef } from '../types';
import { smoothPath } from '../../core/math';
import { TUNING } from '../../config/tuning';
import { DECAL_MIX, forest, pts, rect, scatter } from './helpers';

/**
 * RACE CIRCUIT — outside-park t259-406 (o26-o29; full map x 1215-1360, y 18-160).
 *   The entrance road comes up from the lot (raceLot) on the west. A dirt spectator
 *   road runs east behind a guard rail, with bleachers on its south side; cones line
 *   a connector onto the circuit. The circuit is one S-shaped loop: the start
 *   straight runs north up the west side under the dark-red start/finish gantry
 *   (chequered line, grid brackets, start-light poles), then wiggles east along the
 *   top, comes down the east side and back west along the bottom. Pond in the
 *   infield, red/white tyre wall beside the start straight, red/white kerbs on the
 *   corners. NPC race cars (pink #4, purple, light blue) lap it non-stop (≈39 s a
 *   lap); there is no race HUD in the recording, so none here either.
 */
const W = 124, H = 112;
const EX = 12;            // entrance road centre (lines up with raceLot's exit)
const SY = 15;            // spectator road centre
const TW = 7.4;           // track width between the white edge lines (o27: ≈4 SH)
const SX = 26;            // start straight centre
const FINISH = 50;        // start/finish line

// track centre line, driving order (north up the start straight first)
const CTRL = pts(
    SX, 34, SX, 84, 31, 95, 44, 99.5, 57, 96, 66, 87, 78, 83.5, 91, 90, 104, 95, 113, 88,
    114, 62, 110, 38, 101, 27.5, 84, 25, 62, 26.5, 42, 25, 31, 26.5,
);
const LOOP = smoothPath(CTRL, true, 10);
LOOP.push({ ...LOOP[0] });

/** a closed ribbon as overlapping open chunks (one ring polygon wouldn't triangulate) */
function ring(kind: GroundPatch['kind'], width: number, path = LOOP): GroundPatch[] {
    const out: GroundPatch[] = [];
    for (let i = 0; i < path.length - 1; i += 16) out.push({ kind, pts: path.slice(Math.max(0, i - 1), i + 18), width, sharp: true });
    return out;
}

/** the loop shifted sideways by d metres (+ = left of the driving direction) */
function offsetLoop(d: number) {
    const n = LOOP.length - 1;
    return LOOP.map((_, i) => {
        const a = LOOP[(i - 1 + n) % n], b = LOOP[(i + 1) % n], p = LOOP[i % n];
        const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        return { x: p.x - ((b.y - a.y) / l) * d, y: p.y + ((b.x - a.x) / l) * d };
    });
}

/** red/white kerb blocks on the outside of every bend */
function kerbs(): GroundPatch[] {
    const out: GroundPatch[] = [];
    const n = LOOP.length - 1;
    for (let i = 0; i < n; i++) {
        const a = LOOP[i], b = LOOP[i + 1], c = LOOP[(i + 2) % n];
        const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
        const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        if (Math.abs(cross) / (l * l) < 0.05) continue; // straight enough
        const side = cross > 0 ? -1 : 1; // outside of the bend
        const nx = (-(b.y - a.y) / l) * side, ny = ((b.x - a.x) / l) * side;
        const o = TW / 2 + 0.25;
        out.push({ kind: i % 2 ? 'kerbRed' : 'lineWhite', pts: pts(a.x + nx * o, a.y + ny * o, b.x + nx * o, b.y + ny * o), width: 0.6, sharp: true });
    }
    return out;
}

// chequered start/finish line (two rows of squares) and the starting-grid brackets
const chequer: GroundPatch[] = [{ kind: 'lineWhite', pts: pts(SX - TW / 2, FINISH, SX + TW / 2, FINISH), width: 1.5, sharp: true }];
for (let i = 0; i < 12; i++) {
    const x = SX - TW / 2 + 0.3 + i * 0.6;
    const y = FINISH + (i % 2 ? 0 : -0.6);
    chequer.push({ kind: 'chequer', pts: pts(x, y, x + 0.6, y, x + 0.6, y + 0.6, x, y + 0.6), sharp: true });
}
const grid: GroundPatch[] = [];
for (let i = 0; i < 4; i++) {
    const x = SX + (i % 2 ? 1.6 : -1.6), y = FINISH + 4 + i * 3.2;
    grid.push({ kind: 'lineWhite', pts: pts(x - 1.1, y + 1, x - 1.1, y, x + 1.1, y, x + 1.1, y + 1), width: 0.16, sharp: true });
}

// red/white tyre wall between the start straight and the infield (o27, o28)
const tyres: PropPlacement[] = [];
for (let y = 36, i = 0; y <= 82; y += 0.8, i++) tyres.push({ type: i % 2 ? 'tyreStackRed' : 'tyreStackWhite', x: SX + TW / 2 + 2.6, y });
// guard rail along the north side of the spectator road (o26)
const rail: PropPlacement[] = [];
for (let x = 22; x < W - 3; x += 2) rail.push({ type: 'guardRail', x, y: SY + 2.7 });
// cones lining both sides of the connector from the entrance road onto the circuit
const CONNECTOR = pts(EX, 18, EX + 4, 23, SX - 3, 30, SX, 36);
const cones: PropPlacement[] = [];
const conn = smoothPath(CONNECTOR, false, 4);
for (let i = 1; i < conn.length - 4; i++) {
    const a = conn[i - 1], b = conn[i + 1], l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    for (const d of [-3.0, 3.0]) cones.push({ type: 'trafficCone', x: conn[i].x - ((b.y - a.y) / l) * d, y: conn[i].y + ((b.x - a.x) / l) * d });
}

const POND = pts(52, 52, 60, 46, 74, 47, 84, 54, 86, 66, 76, 72, 62, 71, 53, 63);
const forestW = pts(0, 0, 8.8, 0, 8.8, 18, 15, 30, 15, H, 0, H);
const forestN = pts(15, 104, 50, 107, 70, 102, 90, 102, W, 103, W, H, 15, H);
const forestE = pts(119, 20, W, 20, W, 103, 119.5, 100);
const forestS = pts(15.6, 0, W, 0, W, 4.6, 15.6, 4.6);
const infield = pts(36, 36, 100, 36, 104, 60, 100, 82, 88, 80, 76, 76, 64, 80, 54, 86, 40, 86);

export const circuitZone: ZoneDef = {
    id: 'circuit',
    name: 'Race Track',
    w: W,
    h: H,
    zoom: 1.12,
    groundColor: 0x3f9c37,
    ground: [
        // entrance road and the dirt spectator road (o26)
        { kind: 'asphalt', pts: pts(EX, -1, EX, 20), width: 5.0, sharp: true },
        { kind: 'path', pts: pts(EX + 2, SY, W + 1, SY), width: 4.2, sharp: true },
        // connector onto the circuit
        { kind: 'asphalt', pts: CONNECTOR, width: 5.0 },
        // the circuit: sandy run-off, white edges, asphalt
        ...ring('shoulder', TW + 3.0),
        ...ring('asphalt', TW + 0.4),
        ...ring('lineWhite', 0.4, offsetLoop(TW / 2)),
        ...ring('lineWhite', 0.4, offsetLoop(-TW / 2)),
        { kind: 'water', pts: POND },
        ...kerbs(),
        ...chequer,
        ...grid,
    ],
    props: [
        ...forest(forestW, 171),
        ...forest(forestN, 172),
        ...forest(forestE, 173),
        ...forest(forestS, 174),
        ...scatter(infield, DECAL_MIX, 70, 175, { minGap: 0.8, avoid: [POND] }),
        ...scatter(infield, [{ type: 'pineSmall', weight: 2 }, { type: 'bush', weight: 2 }, { type: 'fern', weight: 3 }], 14, 176, { minGap: 3, avoid: [POND] }),
        { type: 'startGantry', x: SX, y: FINISH + 0.2 },
        { type: 'startLights', x: SX - TW / 2 - 1.0, y: FINISH + 16 },
        { type: 'startLights', x: SX + TW / 2 + 1.0, y: FINISH + 16 },
        ...tyres,
        ...rail,
        ...cones,
        { type: 'bleachersLong', x: 40, y: SY - 4.6 },
        { type: 'bleachersLong', x: 60, y: SY - 4.6 },
        { type: 'bleachersShort', x: 76, y: SY - 4.6 },
        ...[90, 98, 106].map((x, i) => ({ type: i % 2 ? 'tyreStackWhite' : 'tyreStackRed', x, y: SY - 3.4 })),
        { type: 'signRacetrackPodium', x: EX + 4.2, y: 6.4 },
        ...[30, 48, 66, 84, 102].map((x) => ({ type: 'rock', x, y: 103.6 })),
    ],
    cover: [forestW, forestN, forestE, forestS],
    walls: [POND, rect(0, H - 0.8, W, 0.8), rect(W - 0.8, 0, 0.8, H)],
    exits: [
        { rect: { x: EX - 2.5, y: 0, w: 5, h: 1.2 }, to: 'raceLot', entry: 'north' },
    ],
    entries: {
        default: { x: EX, y: 2.6, facing: 90 },
        south: { x: EX, y: 2.6, facing: 90 },
    },
    lanes: [
        // shortcut: fixed field of three cars at one speed, no racing lines or overtaking
        { id: 'race', pts: LOOP, every: [0, 0], loop: true, count: 3, speedSH: TUNING.traffic.raceSpeedSH, looks: ['race_car_pink', 'race_car_purple', 'race_car_blue'] },
    ],
    npcs: [
        // spectators on the road in front of the bleachers, watching the track (E16)
        { id: 'fan1', kind: 'camper', look: 'camper_a', x: 37, y: SY - 1.2, facing: 90, behaviour: 'idle' },
        { id: 'fan2', kind: 'camper', look: 'camper_blond', x: 43, y: SY - 1.4, facing: 90, behaviour: 'idle' },
        { id: 'fan3', kind: 'camper', look: 'camper_d', x: 61, y: SY - 1.2, facing: 90, behaviour: 'idle' },
    ],
    jeepRoutes: [[{ x: EX - 1.3, y: -3 }, { x: EX - 1.3, y: 10 }]],
    interactables: [],
    respawn: { zone: 'raceLot', x: 90, y: 14, rangerAt: { x: 87, y: 14.6 } },
    rangerSpawns: [{ x: EX, y: 1 }],
    rangersRespond: true,
    scatter: { seed: 170 },
};
