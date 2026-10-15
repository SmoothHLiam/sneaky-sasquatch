import type { PlaceholderSpec } from '../core/assets';

/**
 * Static world props. `sprite` is the asset key rendered from Blender
 * (art/blender/props.py); `ph` describes the coloured placeholder used until a
 * render exists. Colliders/footprints are in metres relative to the prop's
 * ground anchor (the point the sprite's anchor sits on).
 */
export interface PropDef {
    sprite: string | string[];          // several = variants (picked by placement.v or seeded)
    ph: PlaceholderSpec;
    /** circle collider radius (m) */
    r?: number;
    /** box collider (m): width (x), depth (y), centred on anchor + offset */
    box?: { w: number; d: number; ox?: number; oy?: number };
    /** blocks NPC line of sight */
    blocksSight?: boolean;
    /** player can hide here by standing still inside it */
    hide?: boolean;
    /** flat decal: drawn into the ground layer, never sorted above actors */
    decal?: boolean;
    /** extra depth offset (m, +north) so tall/deep props sort against their back edge */
    sortOffset?: number;
    /** vegetation: blocks people, but karts plough straight through (outside-park §4.2) */
    veg?: boolean;
    /** tint/scale jitter for variety */
    jitter?: { scale?: number };
}

const tree = (color: number, h: number, w: number): PlaceholderSpec => ({ w, h, color, shape: 'tree' });
const blob = (color: number, w: number, h: number): PlaceholderSpec => ({ w, h, color, shape: 'blob' });
const boxp = (color: number, w: number, h: number): PlaceholderSpec => ({ w, h, color, shape: 'box' });

export const PROP_DEFS: Record<string, PropDef> = {
    // ---- vegetation -------------------------------------------------------
    pine: { sprite: ['pine_a', 'pine_b', 'pine_c'], ph: tree(0x2f7a34, 9, 4), r: 0.35, blocksSight: true, jitter: { scale: 0.12 }, veg: true },
    pineDark: { sprite: ['pine_dark_a', 'pine_dark_b'], ph: tree(0x1f5a2a, 8, 4.2), r: 0.35, blocksSight: true, jitter: { scale: 0.12 }, veg: true },
    pineSmall: { sprite: ['pine_small_a', 'pine_small_b'], ph: tree(0x347f38, 4, 2.2), r: 0.22, blocksSight: true, jitter: { scale: 0.15 }, veg: true },
    roundTree: { sprite: ['round_tree_a', 'round_tree_b'], ph: blob(0x3e9a3c, 4, 6), r: 0.3, blocksSight: true, jitter: { scale: 0.12 }, veg: true },
    birch: { sprite: ['birch_a', 'birch_b'], ph: blob(0x5c8c2d, 3.2, 4.8), r: 0.25, blocksSight: true, jitter: { scale: 0.12 }, veg: true },
    autumnTree: { sprite: ['autumn_maroon', 'autumn_olive', 'autumn_orange'], ph: blob(0x7f3233, 3.4, 4.6), r: 0.3, blocksSight: true, jitter: { scale: 0.12 }, veg: true },
    bush: { sprite: ['bush_a', 'bush_b', 'bush_c'], ph: blob(0x3a8f37, 2.2, 1.6), r: 0.75, hide: true, jitter: { scale: 0.15 } },
    /** movable "dried" bush you can climb into and carry around (wiki: Movable bush) */
    hideBush: { sprite: 'hide_bush', ph: blob(0x8a8a3a, 2.0, 1.6), r: 0.6, jitter: { scale: 0.05 } },
    berryBush: { sprite: ['berry_bush_a', 'berry_bush_b'], ph: blob(0x2c6e2e, 2.4, 1.8), r: 0.8, hide: true, jitter: { scale: 0.12 } },
    fern: { sprite: ['fern_a', 'fern_b'], ph: blob(0x2f8a35, 1.2, 0.6), jitter: { scale: 0.2 } },
    grassTuft: { sprite: ['tuft_a', 'tuft_b'], ph: blob(0x4fae40, 0.5, 0.3), decal: true },
    flowersYellow: { sprite: 'flowers_yellow', ph: blob(0xf2c230, 0.6, 0.3), decal: true },
    flowersWhite: { sprite: 'flowers_white', ph: blob(0xf0e8d8, 0.6, 0.3), decal: true },
    mushrooms: { sprite: 'mushrooms', ph: blob(0xe8c070, 0.5, 0.3), decal: true },
    cattails: { sprite: 'cattails', ph: boxp(0x8a6a3a, 0.5, 1.2) },
    lilypad: { sprite: 'lilypad', ph: blob(0x52b04a, 0.6, 0.3), decal: true },
    // ---- rocks & wood ------------------------------------------------------
    rock: { sprite: ['rock_a', 'rock_b'], ph: blob(0x8a8f8c, 1.2, 0.7), r: 0.45, jitter: { scale: 0.2 } },
    rockBig: { sprite: ['rock_big_a'], ph: blob(0x7d8380, 3, 1.8), box: { w: 2.2, d: 1.3 }, blocksSight: true },
    pebble: { sprite: ['pebble_a', 'pebble_b'], ph: blob(0x888d8a, 0.3, 0.15), decal: true },
    stick: { sprite: ['stick_a', 'stick_b'], ph: boxp(0x7a4a26, 0.7, 0.1), decal: true },
    stump: { sprite: 'stump', ph: boxp(0x7b5230, 0.8, 0.6), r: 0.25 },
    log: { sprite: 'log', ph: boxp(0x7b5230, 2.2, 0.5), box: { w: 2.0, d: 0.5 } },
    firewood: { sprite: 'firewood', ph: boxp(0xb07a40, 1.45, 1.2), box: { w: 1.45, d: 0.7 } },
    // ---- structures --------------------------------------------------------
    /** the cabin is also a BuildingDef (walls + roof cut-away are handled by World) */
    cabin: { sprite: 'cabin', ph: boxp(0x8a5a32, 3.3, 5), blocksSight: true, sortOffset: -1.4 },
    shopTree: { sprite: 'shop_tree', ph: tree(0x2f7a34, 12, 5), r: 1.1, blocksSight: true },
    tent: { sprite: ['tent_green', 'tent_orange', 'tent_blue'], ph: { w: 2.0, h: 1.9, color: 0x2e8a48, shape: 'cone' }, box: { w: 2.0, d: 1.3 }, blocksSight: true },
    cooler: { sprite: 'cooler', ph: boxp(0x5ec8d0, 0.8, 0.6), box: { w: 0.8, d: 0.5 } },
    foodbox: { sprite: 'foodbox', ph: boxp(0x6e7471, 1.36, 1.0), box: { w: 1.36, d: 0.76 } },
    // only the table top blocks: you stand on the bench line to eat (t095.5)
    picnicTable: { sprite: 'picnic_table', ph: boxp(0xa0703a, 1.75, 0.8), box: { w: 1.75, d: 0.75 } },
    picnicTableEW: { sprite: 'picnic_table_ew', ph: boxp(0xa0703a, 1.35, 0.8), box: { w: 0.75, d: 1.75 } },
    firepit: { sprite: 'firepit', ph: blob(0x9a9a9a, 1.15, 0.4), r: 0.55 },
    firepitLit: { sprite: 'firepit_lit', ph: blob(0xe8a030, 1.15, 0.8), r: 0.55 },
    campSign: { sprite: 'camp_sign', ph: boxp(0x3d6a3d, 0.6, 1.3), r: 0.15 },
    campSignA: { sprite: 'camp_sign_a', ph: boxp(0x2d6226, 0.6, 1.3), r: 0.15 },
    campSignB: { sprite: 'camp_sign_b', ph: boxp(0x2d6226, 0.6, 1.3), r: 0.15 },
    campSignC: { sprite: 'camp_sign_c', ph: boxp(0x2d6226, 0.6, 1.3), r: 0.15 },
    campSignD: { sprite: 'camp_sign_d', ph: boxp(0x2d6226, 0.6, 1.3), r: 0.15 },
    woodSign: { sprite: 'wood_sign', ph: boxp(0x8a5a32, 2.2, 1.4), box: { w: 2.2, d: 0.3 } },
    woodSignCampsites: { sprite: 'wood_sign_campsites', ph: boxp(0x9b6f2a, 2.2, 1.4), box: { w: 2.2, d: 0.3 } },
    noticeBoard: { sprite: 'notice_board', ph: boxp(0xd9454c, 1.9, 2.1), box: { w: 2.0, d: 0.4 } },
    noticeBoardMaps: { sprite: 'notice_board_maps', ph: boxp(0xd9454c, 1.9, 2.1), box: { w: 2.0, d: 0.4 } },
    gatePost: { sprite: 'gate_post', ph: boxp(0x2a2a2a, 0.4, 1.0), r: 0.22 },
    gateClosed: { sprite: 'gate_closed', ph: boxp(0xe8d020, 0.5, 1.2), r: 0.22 },
    parkingPad: { sprite: 'parking_pad', ph: boxp(0x736e70, 2.45, 0.3), decal: true },
    bbqGrill: { sprite: 'bbq_grill', ph: boxp(0x333333, 1.15, 0.8), r: 0.55 },
    lantern: { sprite: 'lantern', ph: boxp(0xf0d060, 0.3, 0.5), r: 0.15 },
    woodStove: { sprite: 'wood_stove', ph: boxp(0x222222, 0.6, 2.2), box: { w: 0.6, d: 0.6 } },
    rugRed: { sprite: 'rug_red', ph: boxp(0xc8475a, 2.4, 0.1), decal: true },
    shopShelf: { sprite: 'shop_shelf', ph: boxp(0xe8c27a, 4.2, 1.6), box: { w: 4.2, d: 0.7 } },
    /** ground decal; the curved wall ring (r 4.9-5.3 m, open to the south) gets arc colliders from the zone */
    shopInteriorFloor: { sprite: 'shop_interior_floor', ph: boxp(0xb98a4c, 10.6, 0.1), decal: true },
    gate: { sprite: 'gate', ph: boxp(0xe8d020, 4.0, 1.2), r: 0.22 },
    outhouse: { sprite: 'outhouse', ph: boxp(0xc83a3a, 1.4, 2.6), box: { w: 1.4, d: 1.4 }, blocksSight: true },
    outhouseOpen: { sprite: 'outhouse_door_open', ph: boxp(0xc83a3a, 1.4, 2.6), box: { w: 1.4, d: 1.4 }, blocksSight: true },
    cacheChest: { sprite: 'cache_chest', ph: boxp(0x8a5a32, 1.1, 0.6), box: { w: 1.1, d: 0.6 } },
    signpostRvLake: { sprite: 'signpost_rv_lake', ph: boxp(0x8a5a32, 2.7, 1.6), box: { w: 2.7, d: 0.3 } },
    signpostBlank: { sprite: 'signpost_blank', ph: boxp(0x8a5a32, 2.7, 1.6), box: { w: 2.7, d: 0.3 } },
    warningSign: { sprite: 'warning_sign', ph: boxp(0xe8c020, 0.5, 1.2), r: 0.12 },
    /** one 2.13 m bay along x; place runs every 2.13 m and cap them with fencePost */
    fence: { sprite: 'fence', ph: boxp(0x8a5a32, 2.13, 1.0), box: { w: 2.13, d: 0.2 } },
    fencePost: { sprite: 'fence_post', ph: boxp(0x8a5a32, 0.26, 1.1), r: 0.13 },
    /** walkable decks: drawn on the ground layer; the zone adds the railing colliders */
    bridgeWood: { sprite: 'bridge_wood', ph: boxp(0x9b6f3a, 3.7, 0.3), decal: true },
    bridgeWoodNS: { sprite: 'bridge_wood_ns', ph: boxp(0x9b6f3a, 2.9, 0.3), decal: true },
    rvTeal: { sprite: 'rv_teal', ph: boxp(0x3aa6a0, 8.3, 3.2), box: { w: 8.3, d: 1.72 }, blocksSight: true },
    /** dark opening in the cliff face (Blender, props_park.py) */
    caveMouth: { sprite: 'cave_mouth', ph: boxp(0x161412, 3.0, 2.4), sortOffset: 0.6 },
    /** 6 m chunks of the grey cliff face, tiled along x (the zone's walls do the colliding) */
    cliffRocks: { sprite: ['cliff_rocks_a', 'cliff_rocks_b'], ph: boxp(0x8a8584, 6.0, 7.2), blocksSight: true },
    /** the enterable teal RV (a BuildingDef supplies the walls; no box collider here) */
    rvTealBuilding: { sprite: 'rv_teal', ph: boxp(0x3aa6a0, 8.3, 3.2), blocksSight: true, sortOffset: -0.86 },
    rvWhite: { sprite: 'rv_white', ph: boxp(0xeeeeee, 3.36, 2.6), box: { w: 3.36, d: 1.57 }, blocksSight: true },
    rvYellow: { sprite: 'rv_yellow', ph: boxp(0xf0c840, 3.36, 2.6), box: { w: 3.36, d: 1.57 }, blocksSight: true },
    trashCan: { sprite: 'trash_can', ph: boxp(0x9aa0a0, 0.66, 1.3), r: 0.33 },
    blanket: { sprite: 'blanket', ph: boxp(0xe03a3a, 1.42, 0.2), decal: true },
    umbrella: { sprite: 'umbrella', ph: { w: 2.0, h: 3.7, color: 0x58b8e0, shape: 'cone' }, r: 0.1 },
    chair: { sprite: ['camp_chair', 'camp_chair_e', 'camp_chair_n', 'camp_chair_w'], ph: boxp(0x3a6ab0, 0.5, 0.9), r: 0.25 },
    bed: { sprite: 'bed', ph: boxp(0x6ac46a, 0.85, 0.8), box: { w: 0.85, d: 1.5 } },
    // ---- Raccoon Shop display items (art/tools/gen-shop-items.mjs); placed on shelves with z
    shopMap: { sprite: 'shop_map', ph: boxp(0x2f7a33, 0.34, 0.12) },
    shopShovel: { sprite: 'shop_shovel', ph: boxp(0x5e6b6d, 0.34, 1.1) },
    shopHat: { sprite: 'shop_hat', ph: boxp(0xd33b45, 0.4, 0.25) },
    shopPaddle: { sprite: 'shop_paddle', ph: boxp(0x3b281d, 0.36, 1.2) },
    shopRod: { sprite: 'shop_rod', ph: boxp(0x1f2123, 0.1, 1.16) },
    shopGolf: { sprite: 'shop_golf', ph: boxp(0x3a3d40, 0.14, 0.96) },
    shopFlashlight: { sprite: 'shop_flashlight', ph: boxp(0x2b2f32, 0.45, 0.3) },
    shopKeys: { sprite: 'shop_keys', ph: boxp(0xc7ccce, 0.5, 0.35) },
    shopSkis: { sprite: 'shop_skis', ph: boxp(0xd83c4c, 0.7, 1.27) },
    posterPizza: { sprite: 'poster_pizza', ph: boxp(0x3e8b3a, 0.72, 1.0) },
    // ---- roads & outside the park (Blender: props_park.py / props_roads.py / props_racetrack.py)
    powerPole: { sprite: 'power_pole', ph: boxp(0x6a4a2a, 0.3, 8.6), r: 0.2 },
    powerPolePoster: { sprite: 'power_pole_poster', ph: boxp(0x6a4a2a, 0.3, 8.6), r: 0.2 },
    stopSign: { sprite: 'stop_sign', ph: boxp(0xc8202a, 0.7, 2.2), r: 0.08 },
    signHighway: { sprite: 'sign_highway', ph: boxp(0x2f7a3f, 2.8, 2.6), box: { w: 2.8, d: 0.3 } },
    signCampgroundLeft: { sprite: 'sign_campground_left', ph: boxp(0x9b6f2a, 2.4, 1.6), box: { w: 2.4, d: 0.3 } },
    signCampgroundGreen: { sprite: 'sign_campground_green', ph: boxp(0x2f7a3f, 2.2, 1.8), box: { w: 2.2, d: 0.3 } },
    signRacetrackUp: { sprite: 'sign_racetrack_up', ph: boxp(0x9b6f2a, 2.2, 1.6), box: { w: 2.2, d: 0.3 } },
    signRacetrackPodium: { sprite: 'sign_racetrack_podium', ph: boxp(0x9b6f2a, 2.6, 1.8), box: { w: 2.6, d: 0.3 } },
    signExit: { sprite: 'sign_exit', ph: boxp(0x9b6f2a, 2.2, 1.6), box: { w: 2.2, d: 0.3 } },
    busStop: { sprite: 'bus_stop', ph: boxp(0x2f6fd0, 0.5, 2.6), r: 0.1 },
    fireHydrant: { sprite: 'fire_hydrant', ph: boxp(0xc8202a, 0.4, 0.8), r: 0.18 },
    payphone: { sprite: 'payphone', ph: boxp(0x2f6fd0, 1.0, 2.4), box: { w: 1.0, d: 0.5 } },
    carWhite: { sprite: 'car_white', ph: boxp(0xeeeeee, 3.1, 1.6), box: { w: 3.1, d: 1.15 }, blocksSight: true },
    paintReserved: { sprite: 'paint_reserved', ph: boxp(0xaab3b0, 2.2, 0.1), decal: true },
    // ---- race track (Blender: props_racetrack.py)
    raceTrackSign: { sprite: 'race_track_sign', ph: boxp(0xa3303a, 4.6, 3.0), box: { w: 4.6, d: 0.5 } },
    tikiTorch: { sprite: 'tiki_torch', ph: boxp(0x8a5a32, 0.3, 1.8), r: 0.1 },
    mapKiosk: { sprite: 'map_kiosk', ph: boxp(0xd9454c, 1.6, 2.4), box: { w: 1.6, d: 0.5 } },
    entranceGantry: { sprite: 'entrance_gantry', ph: boxp(0xb8303a, 8.0, 5.0), sortOffset: -0.2 },
    startGantry: { sprite: 'start_gantry', ph: boxp(0x8a2a30, 12, 5.0), sortOffset: -0.2 },
    startLights: { sprite: 'start_lights', ph: boxp(0x333333, 0.4, 3.0), r: 0.15 },
    bleachersLong: { sprite: 'bleachers_long', ph: boxp(0xe8c84a, 12, 3), box: { w: 12, d: 3.2 }, blocksSight: true },
    bleachersShort: { sprite: 'bleachers_short', ph: boxp(0xe8c84a, 6, 3), box: { w: 6, d: 3.2 }, blocksSight: true },
    podium123: { sprite: 'podium_123', ph: boxp(0xeeeeee, 4.2, 1.4), box: { w: 4.2, d: 1.4 } },
    tyreStackRed: { sprite: 'tyre_stack_red', ph: boxp(0xd0303a, 0.8, 0.9), r: 0.4 },
    tyreStackWhite: { sprite: 'tyre_stack_white', ph: boxp(0xeeeeee, 0.8, 0.9), r: 0.4 },
    guardRail: { sprite: 'guard_rail', ph: boxp(0xb0b6b8, 2, 0.7), box: { w: 2, d: 0.2 } },
    trafficCone: { sprite: 'traffic_cone', ph: boxp(0xf0802a, 0.4, 0.6), r: 0.15 },
    hedge: { sprite: 'hedge', ph: boxp(0x2f7a33, 2, 1.0), box: { w: 2, d: 0.9 }, blocksSight: true },
    acUnit: { sprite: 'ac_unit', ph: boxp(0xb0b6b8, 1.0, 0.9), box: { w: 1.0, d: 0.7 } },
    // ---- race-track lot buildings (Blender: props_lot.py). Enterable ones get their walls from
    //      BuildingDefs (zones/raceLot.ts); each exterior sorts at its northernmost front face so you
    //      can walk in front of set-back parts (the garage annex)
    dealershipBuilding: { sprite: 'dealership', ph: boxp(0xeeeeee, 22.7, 7.0), blocksSight: true, sortOffset: -4.5 },
    garageBuilding: { sprite: 'garage', ph: boxp(0x61b4b2, 12.55, 5.75), blocksSight: true, sortOffset: -1.185 },
    customsBuilding: { sprite: 'customs', ph: boxp(0x8a9498, 13.06, 6.4), blocksSight: true, sortOffset: -3.1 },
    /** exterior only (its door is decorative): a solid box */
    licensingBuilding: { sprite: 'licensing', ph: boxp(0x9aa0a0, 7.65, 4.26), box: { w: 7.65, d: 7.0 }, blocksSight: true, sortOffset: -3.5 },
    dealerDesk: { sprite: 'dealer_desk', ph: boxp(0xc03040, 2.1, 1.0), box: { w: 2.1, d: 1.0 } },
    brochureStand: { sprite: 'brochure_stand', ph: boxp(0xeeeeee, 0.7, 1.32), box: { w: 0.7, d: 0.42 } },
    computerDesk: { sprite: 'computer_desk', ph: boxp(0xeeeeee, 0.8, 1.3), box: { w: 0.8, d: 3.65 } },
    benchRed: { sprite: 'bench_red', ph: boxp(0xc03040, 0.55, 0.88), box: { w: 0.55, d: 2.0 } },
    pottedPalm: { sprite: 'potted_palm', ph: blob(0x2f8a35, 0.6, 1.35), r: 0.28 },
    /** only the two posts collide (BuildingDef walls); the arms lie on the floor */
    carLift: { sprite: 'car_lift', ph: boxp(0xc03040, 3.35, 4.75) },
    customsDesk: { sprite: 'customs_desk', ph: boxp(0xeeeeee, 2.4, 1.4), box: { w: 2.4, d: 0.74 } },
    armchairOrange: { sprite: 'armchair_orange', ph: boxp(0xe08030, 0.62, 0.95), box: { w: 0.62, d: 0.75 } },
    /** showroom price plates; v picks the price */
    pricePlate: { sprite: ['price_plate_250', 'price_plate_350', 'price_plate_500', 'price_plate_2500', 'price_plate_50000'], ph: boxp(0x161616, 1.3, 0.72) },
    // ---- Ranger Station (Blender: props_station.py). The building's walls come from its BuildingDef;
    //      the exterior sorts against the east wing's front so you can walk in front of the wing
    stationBuilding: { sprite: 'station', ph: boxp(0x7a5230, 8.0, 6.0), blocksSight: true, sortOffset: -1.755 },
    bedTeal: { sprite: 'bed_teal', ph: boxp(0x3aa6a0, 0.83, 0.7), box: { w: 0.83, d: 1.37 } },
    cabinetWood: { sprite: 'cabinet_wood', ph: boxp(0x8a5a32, 0.82, 1.88), box: { w: 0.82, d: 0.48 } },
    mooseHead: { sprite: 'moose_head', ph: boxp(0x7a5230, 0.62, 0.6) },
    tableYellow: { sprite: 'table_yellow', ph: boxp(0xe8c870, 0.93, 0.76), box: { w: 0.93, d: 0.71 } },
    tableYellowLong: { sprite: 'table_yellow_long', ph: boxp(0xe8c870, 0.78, 0.74), box: { w: 0.78, d: 1.34 } },
    chairCyan: { sprite: ['chair_cyan', 'chair_cyan_e', 'chair_cyan_n', 'chair_cyan_w'], ph: boxp(0x58c8d8, 0.5, 0.9), r: 0.2 },
    tvCrt: { sprite: 'tv_crt', ph: boxp(0x3a3a3a, 1.0, 1.73), box: { w: 1.0, d: 0.56 } },
    fridge: { sprite: 'fridge', ph: boxp(0xf2f2f2, 0.82, 1.78), box: { w: 0.82, d: 0.5 } },
    kitchenCounter: { sprite: 'kitchen_counter', ph: boxp(0xd8c8a8, 1.25, 0.8), box: { w: 1.25, d: 0.56 } },
    stoveRange: { sprite: 'stove_range', ph: boxp(0xf2f2f2, 0.77, 0.86), box: { w: 0.77, d: 0.565 } },
    smokeDetector: { sprite: 'smoke_detector', ph: boxp(0xf2f2f2, 0.24, 0.12) },
    /** rugs lie on the interior floor sprite (objLayer), so placements give them sort ≈ just in front of it */
    rugRedStation: { sprite: 'rug_red_station', ph: boxp(0xc83a48, 3.37, 0.05) },
    rugRedStationB: { sprite: 'rug_red_station_b', ph: boxp(0xc83a48, 2.4, 0.05) },
    atm: { sprite: 'atm', ph: boxp(0x8a9498, 0.82, 2.28), box: { w: 0.82, d: 0.4 } },
    vendingMachine: { sprite: 'vending_machine', ph: boxp(0x2f6fd0, 1.16, 2.32), box: { w: 1.16, d: 0.73 }, blocksSight: true },
    /** the Duck's hat lying on the RV table (rendered 1.85 m up; origin = the floor below it) */
    duckHatItem: { sprite: 'duck_hat_item', ph: boxp(0xf2c94a, 0.6, 0.3) },
    pottedPlant: { sprite: 'potted_plant', ph: blob(0x2f8a35, 1.0, 1.1), r: 0.24 },
    newspaperBox: { sprite: 'newspaper_box', ph: boxp(0xeeeeee, 0.67, 1.24), box: { w: 0.67, d: 0.46 } },
    // ---- small campsite bits (art/tools/gen-small-props.mjs)
    newspaperFolded: { sprite: 'newspaper_folded', ph: boxp(0xe9eaea, 0.5, 0.1) },
    picnicBasket: { sprite: 'picnic_basket', ph: boxp(0xe9b968, 0.66, 0.6), box: { w: 0.66, d: 0.45 } },
    radioSmall: { sprite: 'radio_small', ph: boxp(0xd8313f, 0.44, 0.3) },
    /** the RV-park boombox on its wooden post (Blender, props_park.py) */
    boomboxPost: { sprite: 'boombox_post', ph: boxp(0xd8313f, 0.6, 1.3), r: 0.2 },
};

export function propSpriteKey(def: PropDef, v: number): string {
    if (Array.isArray(def.sprite)) return def.sprite[((v % def.sprite.length) + def.sprite.length) % def.sprite.length];
    return def.sprite;
}
