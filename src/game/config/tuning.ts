/**
 * ============================================================================
 *  TUNING — every number that affects game feel lives here.
 * ============================================================================
 *
 *  Units
 *  -----
 *  - World positions are in METRES on the ground plane (x = east, y = north).
 *  - Most distances below are in "SH" = Sasquatch-Heights, the unit used when
 *    measuring the original game from video: 1 SH = how tall the sasquatch
 *    looks on screen (285 px on a 3024x1898 capture). `SH_METRES` converts.
 *  - Times are in seconds. Meter values are 0..1 (1 = a full ring).
 *  - "ref px" = pixels on the 3024x1898 reference capture. UI is authored in
 *    ref px and scaled to the window, so the numbers can be compared directly
 *    to the measurements in `your research/video-notes/`.
 *
 *  Each value notes where it came from:
 *    [measured]  timed/measured from the gameplay videos
 *    [wiki]      from the fan wiki / guides (your research/mechanics-research.md)
 *    [guess]     not observable yet — a reasonable default, tune by feel
 *
 *  NOTE: `camera.pitchDeg` and `render.spritePPM` are baked into the Blender
 *  sprite renders (art/blender/lib_toon.py). Change them only together with a
 *  re-render of the sprites.
 * ============================================================================
 */

/** Metres per Sasquatch-Height (apparent on-screen height of the 2 m tall model). */
export const SH_METRES = 1.56;
const SH = SH_METRES;

export const TUNING = {
    // ------------------------------------------------------------------ render
    render: {
        /** Internal world scale: world pixels per metre before camera zoom. */
        worldPPM: 100,
        /** Pixels-per-metre the Blender sprites were rendered at (see art/blender/lib_toon.py). */
        spritePPM: 200,
        /** Reference capture size that all UI "ref px" values are measured on. */
        refWidth: 3024,
        refHeight: 1898,
    },

    // ------------------------------------------------------------------ camera
    camera: {
        /** Camera pitch above the horizon. Ground is foreshortened by sin(pitch) = 0.79. [measured] */
        pitchDeg: 52,
        /** On-screen sasquatch height at normal zoom, in ref px. [measured: 285 px] */
        sasquatchScreenHeightRef: 285,
        /** Zoom multipliers relative to normal outdoor zoom. [measured] */
        zoom: {
            outdoor: 1.0,
            interior: 1.65,       // cabin t208: 3.27 m wide = 997 ref px → 1.67x; garage 1.67, dealership ~1.5-1.6
            dialogue: 2.0,        // NPC dialogue close-up [measured 2.0x tutorial, 2.2x self-talk]
            tutorialIntro: 1.7,   // waking up at the cabin [measured ≈1.7x]
            vehicleStopped: 0.91,
            vehicleTopSpeed: 0.66,
        },
        /** Player "Field of view" setting (pause menu slider, 0..1). The default position is the
         *  measured zoom; lower = zoomed out (see more), higher = zoomed in. The zoom multiplier is
         *  log-interpolated: slider 0 → zoomAtMin, default → 1.0, slider 1 → zoomAtMax. */
        fov: {
            defaultSlider: 0.55,
            zoomAtMin: 0.45,
            zoomAtMax: 1.6,
        },
        /** Seconds for zoom changes to ease in/out. [measured ~0.3 s for dialogue] */
        zoomEase: 0.35,
        /** Follow smoothing time constant (exponential). [measured τ ≈ 0.10-0.15 s] */
        followTau: 0.12,
    },

    // ------------------------------------------------------------------ player
    player: {
        /** Walk (the original's single "run") speed, SH per second. [measured: 2.64 SH/s outside, 2.4 SH/s inside-park] */
        walkSpeedSH: 2.55,
        /** Sneak (tiptoe) speed as a fraction of walk. [guess — wiki: "slower walk"] */
        sneakSpeedFactor: 0.45,
        /** Seconds to reach full speed. [measured: 0.4-0.6 s to full speed, ~0.2 s to stop] */
        accelTime: 0.14,
        decelTime: 0.07,
        /** Speed while carrying a bush you're hiding in (fraction of walk). [measured ~75%] */
        bushSpeedFactor: 0.75,
        /** Swimming speed (fraction of walk). [measured 0.7-1.1 SH/s ≈ 30-45%] */
        swimSpeedFactor: 0.38,
        /** Footprints: one print per this many metres, lasting this long. [measured: fade after a few seconds] */
        footprintSpacing: 0.62,
        footprintLife: 6,
        /** Collision radius in metres. */
        radius: 0.32,
        /** Turn speed for the visual facing, degrees per second. [guess] */
        turnSpeedDeg: 900,
        /** Walk-cycle playback: animation frames per metre travelled. */
        walkFramesPerMetre: 2.6,
        sneakFramesPerMetre: 4.2,
        /** Click/hold-to-move: stop within this many metres of the target. */
        arriveRadius: 0.12,
        /** Mouse rapid-click within this many seconds = sneak (touch rule from the wiki). */
        rapidClickSneakWindow: 0.33,
    },

    // ---------------------------------------------------------------- detection
    /**
     * THE STEALTH MODEL (measured from `outside park 1.mov`, see GDD §Detection)
     *
     *  Each human has ONE suspicion meter (0..2):
     *    0..1  WHITE stage — fills while the NPC sees OR hears you.
     *    1..2  RED stage   — fills only while the NPC SEES you (hearing caps at 1).
     *    2     ALARM       — "RANGER DANGER!", rangers dispatched.
     *  Fill speed falls off with distance:  rate = fillConstant / max(d, minDist)  (per second, d in SH)
     *  When the stimulus stops: hold, then decay. An interrupted red stage aborts back to white.
     */
    detection: {
        /** White fill: 480°/s divided by distance in SH → 1.333 rings/s at 1 SH. [measured] */
        whiteFillConstant: 480 / 360,
        /** Red stage fills this many times faster than white. [measured 2.0-2.5x] */
        redFillMultiplier: 2.25,
        /** Distances closer than this count as this (prevents infinite rates). [guess] */
        minDistanceSH: 0.75,
        /** Hold the meter this long after losing the stimulus, then decay. [measured: 2.0 s, up to 6 s in "?" search] */
        holdTime: 2.0,
        /** Hold time while the NPC shows "?" (lost you after watching you). [measured 2-6.5 s] */
        searchHoldTime: 4.0,
        /** Meter must be at least this full when you vanish for the NPC to go "?". [guess] */
        searchThreshold: 0.35,
        /** Decay speed in rings/s (185°/s ≈ 0.5/s). [measured] */
        decayPerSecond: 185 / 360,
        /** Rangers searching ("?") decay much slower. [measured 0.17/s] */
        rangerSearchDecayPerSecond: 0.17,
        /** An aborted red stage drains back to white at this speed (rings/s). [guess] */
        redAbortDrainPerSecond: 2.0,

        /** Vision. Cone half-angle is not directly measurable; 70° fits all observed eye/ear switches. */
        visionRangeSH: 4.8,           // [measured: furthest eye 4.3-4.8 SH]
        visionHalfAngleDeg: 75,       // [measured bounds: seen at 58°, not seen at 141° → 60-140°]
        /** Hearing: omnidirectional radius, only while the player is on foot and moving. */
        hearingRadiusSH: 3.5,         // [measured 3-4 SH while moving]
        /** Hearing radius multipliers by movement mode. */
        hearingMultiplier: {
            walk: 1.0,
            sneak: 0.0,               // [wiki] sneaking is silent
            idle: 0.0,                // [wiki] stand still and the ear drains
            vehicle: 0.0,             // [measured] no ear icons while driving
            swim: 0.8,                // [guess]
            bush: 0.8,                // [measured: a moving bush is heard]
            /** TV static etc.: heard as far as footsteps... */
            appliance: 1.0,
        },
        /** ...but some noises fill the ear slower than footsteps (multiplies the fill rate).
         *  [measured: inside-park E11 648-652, the sleeping station ranger's ear rose only to 0.48 in
         *  ≈4 s of TV static from ≈2.3 SH (≈0.12/s vs 0.57/s for walking there) → 0.21] */
        hearingFillMultiplier: { appliance: 0.21 } as Record<string, number>,
        /** Sleeping NPCs only hear; fill-rate multiplier while asleep. [measured: tutorial 144.57-145.20,
         *  the sleeping ranger's ear filled in 0.63 s while the player walked in from 2 SH to ~1 SH → ≈1.0] */
        sleepingHearingFillMultiplier: 1.0,
        /** A full ear meter makes the NPC turn toward the sound after this delay. [measured ~0.3 s] */
        turnToSoundDelay: 0.3,
        /** Turn speed of NPC heads/bodies when reacting, degrees per second. [guess] */
        npcTurnSpeedDeg: 360,
        /** Do tree trunks, buildings, tents, rocks block line of sight? [wiki/prototype: yes for solids] */
        solidsBlockSight: true,
        /** Standing still inside a bush = invisible. Moving in a bush is still seen & heard. [measured] */
        bushHidesWhenStill: true,
        /** Outhouses / RV interiors / tents hide you completely. [measured] */
        hidingSpotsConceal: true,
        /** Alerted NPCs that lose sight remember you this long (red ring unwinds 36°/s). [measured ~10 s] */
        alertedMemoryTime: 10,
        /** Banner appears this long after a meter turns fully red. [measured 0.1 s] */
        alarmBannerDelay: 0.1,
        /** Dialogue freezes all meters [measured: outside-park, an ear stayed at 58.1 % through a dialogue].
         *  Close-ups do NOT: NPCs keep walking and watching; the sasquatch counts as standing still
         *  [inside-park rule 11, medium confidence]. */
        freezeDuringDialogue: true,
    },

    // -------------------------------------------------------------- ranger danger
    rangerDanger: {
        banner: { popIn: 0.2, overshoot: 0.07, hold: 3.0, fade: 1.0 },  // [measured]
        /** Rangers dispatched per alarm. [measured 1-2] */
        rangersDispatched: [1, 2] as [number, number],
        /** Seconds before an on-foot ranger walks on screen. [measured 1.6 s] */
        footArrivalDelay: 1.6,
        /** Seconds before a jeep arrives. [measured 3.4-4.6 s] */
        jeepArrivalDelay: [3.4, 4.6] as [number, number],
        /** Chance a dispatched ranger comes by jeep (where a road exists). [guess] */
        jeepChance: 0.5,
        /** Jeep driving speed, SH/s. [measured: ≈ traffic speed] */
        jeepSpeedSH: 5.4,
        /** Ranger chase speed as a fraction of player walk speed. [measured ≈ 1.0 — gap held 1-2 SH] */
        chaseSpeedFactor: 0.97,
        /** Capture when the ranger is this close. [measured ≤0.5 SH; an alarmed ranger within ~1 SH grabs instantly] */
        captureDistanceSH: 0.45,
        instantGrabDistanceSH: 1.0,
        /** Ranger search behaviour after losing sight. [wiki: look around then give up] */
        searchTime: 6,
        /** Danger state ends once no ranger has seen you for this long. [measured: memory ~10 s] */
        clearAfterUnseen: 10,
        /** Civilians back away then flee at player base speed during Ranger Danger. [wiki] */
        civilianFleeSpeedFactor: 1.0,
    },

    // ------------------------------------------------------------------ capture
    capture: {
        /** "Gotcha!" bubble + tackle. [measured] */
        tackleFlingSH: 1.2,
        lieDownTime: 3.4,
        gotchaBeforeIris: 3.3,
        /** Line said by the ranger at the respawn point. [measured] */
        respawnLine: 'Stay out of trouble, Sasquatch!',
        respawnLineTime: 5.0,
        /** Coins lost on capture. [measured: nothing lost] */
        coinPenalty: 0,
    },

    // ----------------------------------------------------------------- transitions
    transitions: {
        /** Iris wipe between zones. [measured: close 0.55, black 0.40, open 0.47] */
        irisClose: 0.55,
        irisBlack: 0.40,
        irisOpen: 0.47,
        /** Close-up screens (cooler, eating) use a faster iris. [guess] */
        closeUpIris: 0.35,
    },

    // ------------------------------------------------------------------ hunger
    hunger: {
        /** Pie segments. [wiki + measured: 6] */
        max: 6,
        /** Real seconds per segment lost while awake. [measured ≈190-206 s] */
        secondsPerPoint: 230,          // [measured ≈200 s outside, ≈260 s inside-park]
        /** Points lost overnight. [wiki: -2, or -1 if only 1 left] */
        overnightLoss: 2,
        /** Meter is shown permanently at or below this many points. [measured] */
        alwaysShowAtOrBelow: 2,
        /** Pop-up time when a point changes. [measured ~4 s] */
        popupTime: 4.0,
        /** Blink period at 1 point. [measured on 0.6 / off 0.65] */
        blinkOn: 0.6,
        blinkOff: 0.65,
        /** Pass out after this many in-game hours at 0. [wiki] */
        passOutAfterHoursAtZero: 4,
        passOutFee: 20,
    },

    // -------------------------------------------------------------------- time
    time: {
        /** Real seconds per in-game hour. [wiki: ~40 s] */
        secondsPerHour: 40,
        wakeHour: 8,
        zzzHour: 24 + 50 / 60,      // 12:50 AM [wiki]
        passOutHour: 24 + 3 + 10 / 60, // 3:10 AM [wiki]
        /** Lighting keyframes (hour → darkness 0..1, tint). [guess, to be matched to footage] */
        dusk: { start: 19.5, end: 21.5, maxDarkness: 0.55 },
        dawn: { start: 5.5, end: 7.5 },
    },

    // ---------------------------------------------------------------- vehicles
    /** Go-kart handling (outside-park §4). Speeds in SH/s, times in seconds. */
    vehicles: {
        kart: {
            /** [measured 5.2-6.3 SH/s on the track straights, 2.0-2.4x walking] */
            topSpeedSH: 5.75,
            /** standstill → cruising [measured ≈1 s]; stopping [measured < 0.5 s] */
            accelTime: 1.0,
            brakeTime: 0.45,
            /** heading turn rate at speed (deg/s): donuts within ~2 kart lengths [measured] */
            turnRateDeg: 230,
            /** how quickly the velocity swings round to the heading (1/s); lower = more drift [guess] */
            grip: 4.2,
            /** slip angle (deg) above which tyres leave skid marks [guess] */
            skidSlipDeg: 14,
            /** collision radius (m) and the distance at which the steering-wheel prompt shows (m) */
            radius: 0.62,
            promptRange: 0.5 * SH + 0.62,
        },
        /** Skid marks persist at least 20-40 s [measured]; tyre ruts on grass/dirt. */
        skidLife: 40,
        skidAsphalt: 0x4f5856,
        skidDirt: 0x8a5a3a,
        /** Fuel gauge flash on getting in [measured: slides in, ≈0.15-0.3 s, ≈40 % full]. */
        fuelFlash: 0.3,
        fuelLevel: 0.4,
        /** Getting in takes ≈0.2 s [measured]. */
        enterTime: 0.2,
    },

    // ----------------------------------------------------------------- traffic
    /** NPC cars on the roads (outside-park §1, §4.4). */
    traffic: {
        /** cruising speed [measured ≈1500-1600 px/s ≈ 2.0-2.1x walk ≈ 5.4 SH/s] */
        speedSH: 5.4,
        accelTime: 1.2,
        brakeTime: 0.6,
        /** brake for anything this far ahead in the lane (m) [guess: the pickup stopped right behind the kart, E14] */
        brakeDistance: 4.5,
        /** race cars on the circuit [measured: ≈39 s lap; our loop is 303 m → ≈5.0 SH/s, a touch under the kart's top speed so you can catch and ram them] */
        raceSpeedSH: 5.0,
    },

    // ---------------------------------------------------------------- lighting
    lighting: {
        /** Caves without a flashlight: black except a soft glow around the sasquatch,
         *  clear out to `caveInnerH`, fully dark by `caveOuterH` (fractions of screen
         *  height). [measured: glow ≈15 %H radius, inside-park t0380] */
        caveInnerH: 0.09,
        caveOuterH: 0.24,
    },

    // --------------------------------------------------------------------- npcs
    npc: {
        /** Camper walk speed as a fraction of player walk. [guess] */
        camperWalkFactor: 0.45,
        rangerPatrolFactor: 0.4,
        /** A ranger following your footprints walks briskly. [measured 1.3-1.6 SH/s, inside-park E11] */
        trackSpeedFactor: 0.57,
        /** Prints a tracker will pick up: first within this radius, then the next in the trail within `trackStepM`. [guess] */
        trackPickupM: 6,
        trackStepM: 8,
        /** Idle look-around: turn every N seconds (random in range). [guess] */
        lookAroundInterval: [3, 7] as [number, number],
        lookAroundMaxDeg: 75,
    },

    // ---------------------------------------------------------------------- ui
    ui: {
        /** Dialogue typewriter speed, characters per second. [measured 34-40] */
        typewriterCps: 36,
        /** Dialogue box slide in/out. [measured ~0.3 s] */
        dialogSlide: 0.28,
        /** Speech bubble default lifetime. [measured 3-5 s] */
        bubbleTime: 4.0,
        /** Interaction prompt pop + pulse. [measured] */
        promptPopTime: 0.17,
        promptPulsePeriod: 0.65,
        promptPulseAmount: 0.05,
        /** Show an interaction prompt within this distance of an interactable (metres). [measured ≈0.5 SH] */
        interactRadiusSH: 0.6,
        /** Indicator ring geometry, ref px. [measured] */
        indicator: { radius: 120, ringRadius: 105, ringWidth: 12, edgeInset: { left: 172, top: 172, right: 174, bottom: 210 } },
    },

    // -------------------------------------------------------------------- audio
    audio: {
        master: 0.8,
        sfx: 1.0,
        music: 0.6,
    },
} as const;

export type Tuning = typeof TUNING;

/** Convenience: convert SH to metres. */
export const sh = (v: number) => v * SH;
