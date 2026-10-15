import type { Vec } from '../core/math';

/**
 * A Zone is one "area" of the world (the original game splits the map into
 * separate screens joined by iris-wipe transitions). Everything is in metres.
 */
export type GroundKind =
    | 'grassLight'   // lighter worn-grass patches / trails
    | 'dirt'         // bare earth patches (garden, campsite pads)
    | 'path'         // packed dirt road/trail (orange-brown)
    | 'water'        // ponds, lake, river
    | 'sand'
    | 'asphalt'
    | 'gravel'
    | 'snow'
    | 'wood'         // decks/floors
    | 'shoulder'     // sandy road shoulders
    | 'lineYellow'   // road centre line
    | 'lineWhite'    // road edge lines, stall lines
    | 'kerbRed'      // circuit kerbs
    | 'chequer';     // start/finish squares

export interface GroundPatch {
    kind: GroundKind;
    /** control points; smoothed with Catmull-Rom unless `sharp` */
    pts: Vec[];
    sharp?: boolean;
    /** path ribbons: centre-line points + width instead of a polygon */
    width?: number;
    /** draw order within the ground layer */
    z?: number;
}

export interface PropPlacement {
    type: string;          // key into PROP_DEFS (world/props.ts)
    x: number;
    y: number;
    /** variant index / rotation step if the prop has several renders */
    v?: number;
    /** height above the ground (m) for props resting on furniture; such props get no collider */
    z?: number;
    flip?: boolean;
    /** extra per-instance data (e.g. sign text, cooler contents id) */
    data?: Record<string, unknown>;
    id?: string;
    /** furniture inside this building (BuildingDef id): only drawn while the sasquatch is inside */
    in?: string;
    /** depth-sort offset override (m, +north), e.g. rugs that must sit just above an interior floor */
    sort?: number;
}

export interface ZoneExit {
    /** rectangle (metres) that triggers the transition when the player walks into it */
    rect: { x: number; y: number; w: number; h: number };
    to: string;            // target zone id
    entry: string;         // entry point id in the target zone
    /** if set, the exit is blocked and this self-talk plays instead (one or more pages) */
    blockedLine?: string | string[];
    /** exits only active once this flag is set */
    requiresFlag?: string;
}

export interface NpcSpawn {
    id: string;
    kind: 'camper' | 'ranger' | 'raccoon' | 'bear' | 'duck' | 'fox' | 'rabbit' | 'bluejay';
    x: number;
    y: number;
    facing?: number;          // degrees, 0 = east, 90 = north
    look?: string;            // atlas key (e.g. 'reader') or camper letter 'a'..'d'
    behaviour?: 'idle' | 'patrol' | 'sleep' | 'sit' | 'read' | 'wander' | 'scripted';
    route?: Vec[];
    /** point-of-interest marker over the head, e.g. "?" */
    marker?: string;
    /** animation used while asleep (default 'sleep'; 'sleepBed' = tucked into the bed it's placed on) */
    sleepAnim?: string;
    /** only spawn when these flags are (not) set */
    ifFlag?: string;
    ifNotFlag?: string;
}

export interface Interactable {
    id: string;
    kind: 'cooler' | 'foodbox' | 'basket' | 'trash' | 'table' | 'bed' | 'door' | 'sign' | 'shop' | 'cache' | 'talk' | 'hide';
    x: number;
    y: number;
    /** radius in metres within which the prompt appears */
    radius?: number;
    /** icon shown in the prompt bubble */
    icon?: 'hand' | 'fork' | 'door' | 'bed' | 'talk' | 'wheel' | 'lock' | 'hide' | 'eye' | 'coin';
    /** contents for containers */
    loot?: string[];
    ifFlag?: string;
    ifNotFlag?: string;
}

/**
 * Enterable building: the exterior sprite (with roof) is swapped for the
 * interior cut-away (no roof / front wall) while the player stands inside.
 */
export interface BuildingDef {
    id: string;
    /** footprint centre and size (metres) */
    x: number;
    y: number;
    w: number;
    d: number;
    /** door: x offset from centre (m) and opening width, on the front (south) wall */
    doorX: number;
    doorW: number;
    exterior: string;
    interior: string;
    /** low cut-away front wall drawn in front of actors while inside */
    interiorFront?: string;
    frontSortY?: number;
    /** open-door layer shown while the sasquatch is in the doorway / inside */
    doorOpen?: string;
    doorSortY?: number;
    /** wall thickness (m) */
    wall?: number;
    /** irregular buildings (relative to the centre, m): explicit wall boxes replace the generated four walls */
    walls?: Rect4[];
    /** irregular buildings: the floor rects that count as "inside" (default: the w x d box) */
    rooms?: Rect4[];
    /** extra cut-away layers shown while inside (e.g. a partition wall), sorted at centre y + sortY */
    layers?: { key: string; sortY: number }[];
    /** inner doors: closed leaf shown while inside, swapped for the open leaf while someone passes through */
    innerDoors?: { closed: string; open: string; sortY: number; openSortY: number; x0: number; x1: number; y: number }[];
}

/** axis-aligned box given by its edges (m) */
export interface Rect4 { x0: number; x1: number; y0: number; y1: number }

export interface ZoneDef {
    id: string;
    name: string;
    /** playable bounds (metres): x 0..w, y 0..h */
    w: number;
    h: number;
    /** base ground colour */
    groundColor: number;
    ground: GroundPatch[];
    props: PropPlacement[];
    /** non-walkable polygons (forest edges, cliffs, water you can't enter) */
    walls: Vec[][];
    exits: ZoneExit[];
    entries: Record<string, { x: number; y: number; facing?: number }>;
    npcs: NpcSpawn[];
    interactables: Interactable[];
    /** where the player is put after being caught by a ranger in this zone */
    respawn?: { x: number; y: number; rangerAt?: Vec; /** respawn in another area (the campground sends you out past the gate) */ zone?: string };
    /** camera may not show outside these bounds (defaults to w/h) */
    camBounds?: { x: number; y: number; w: number; h: number };
    music?: string;
    /** whether rangers come here when Ranger Danger triggers (wiki: not at Sasquatch House) */
    rangersRespond?: boolean;
    buildings?: BuildingDef[];
    /** dense forest / undergrowth areas: walkable, but standing inside hides you from sight */
    cover?: Vec[][];
    /** camera zoom multiplier for this area (the original varies slightly per area) */
    zoom?: number;
    /** keep the coin counter on screen while here (shops) */
    showCoins?: boolean;
    /** draw the grass-blade tile over the base colour (default true; off for interiors in void) */
    grass?: boolean;
    /** pitch-dark area (caves): only a glow around the sasquatch is visible */
    dark?: boolean;
    /** power lines: each chain lists pole positions; wires sag between their insulators (outside-park o01/o02) */
    wires?: Vec[][];
    /** roads a ranger jeep can drive in on during Ranger Danger (start off-screen → parking spot) */
    jeepRoutes?: Vec[][];
    /** NPC traffic lanes (systems/traffic.ts) */
    lanes?: import('../systems/traffic').Lane[];
    /** drivable / parked vehicles that live here (outside-park §4) */
    vehicles?: { id: string; kind: string; x: number; y: number; facing?: number; locked?: boolean }[];
    /** points where dispatched rangers enter the area */
    rangerSpawns?: Vec[];
    /** decorative scatter config for grass tufts / flowers / pebbles */
    scatter?: { seed: number; flowers?: number; pebbles?: number; ferns?: number; sticks?: number; tufts?: number };
}
