import { TUNING } from '../config/tuning';
import { DEG, wrapAngle } from '../core/math';
import { SH } from '../core/proj';
import type { CollisionWorld } from '../world/collision';
import type { Player } from '../entities/Player';

/**
 * Suspicion meter (one per human), as measured from the original
 * (your research/video-notes/outside-park.md §3, inside-park.md §3):
 *
 *   0 ──white── 1 ──red── 2 → ALARM ("RANGER DANGER!")
 *
 *  - Sight or hearing fills the white stage at  rate = K / max(d, dMin)  rings/s
 *    (K = 480°/s per SH of distance, d in SH).
 *  - Only SIGHT fills the red stage (2.25x faster). Hearing alone caps at 1 and
 *    makes the NPC turn toward the sound; if it then sees you, red starts.
 *  - Hearing needs the sasquatch to be MOVING (standing still is silent).
 *  - Losing the stimulus: the meter holds (2 s, or ~4 s while the NPC shows "?"
 *    because you vanished into a hiding spot), then drains linearly (red first)
 *    at ~0.5 rings/s — rangers searching drain at only 0.17/s.
 *  - Reaching 2 = alarm. Alarmed NPCs keep a red eye while they see you and
 *    remember you for ~10 s after losing sight.
 */
export type Glyph = 'eye' | 'ear' | '!' | '?' | 'foot' | null;

export interface Senses {
    see: boolean;
    hear: boolean;
    /** how fast what's heard fills the ear (1 = footsteps) */
    loudness?: number;
    /** the player would be perceivable but is concealed (bush/outhouse/...) */
    concealed: boolean;
    /** distance to the player in SH */
    d: number;
    /** bearing from NPC to player (radians) */
    bearing: number;
}

export interface PerceptionState {
    meter: number;
    hold: number;
    glyph: Glyph;
    /** alarmed: red state */
    alarmed: boolean;
    /** seconds of memory left after an alarmed NPC loses sight */
    memory: number;
    /** last seen player position (metres) */
    lastSeen: { x: number; y: number } | null;
    /** pending turn toward a heard sound */
    turnTimer: number;
    /** idle marker shown when nothing is being detected (quest "!" / readable "?") */
    idleGlyph: Glyph;
    /** NPC lost you after watching: shows "?" */
    searching: boolean;
}

export function newPerception(): PerceptionState {
    return { meter: 0, hold: 0, glyph: null, alarmed: false, memory: 0, lastSeen: null, turnTimer: 0, idleGlyph: null, searching: false };
}

export interface PerceiverInfo {
    x: number;
    y: number;
    facing: number;
    sleeping: boolean;
    /** true for authority figures (rangers) */
    authority: boolean;
    visionRangeSH?: number;
    halfAngleDeg?: number;
    /** NPC cannot perceive at all (reading a newspaper, scripted...) */
    blind?: boolean;
}

/** Can this observer recognise the sasquatch given the current disguise? (wiki rules) */
export function seesThroughDisguise(observerAuthority: boolean, disguise: string | null, rangerDanger: boolean): boolean {
    if (!disguise) return true;
    if (rangerDanger) return true;
    if (observerAuthority) return !(disguise === 'ranger' || disguise === 'police');
    return false;
}

export function sense(npc: PerceiverInfo, player: Player, world: CollisionWorld, disguise: string | null, rangerDanger: boolean): Senses {
    const T = TUNING.detection;
    const dx = player.x - npc.x, dy = player.y - npc.y;
    const d = Math.hypot(dx, dy) / SH;
    const bearing = Math.atan2(dy, dx);
    const out: Senses = { see: false, hear: false, concealed: false, d, bearing };
    if (npc.blind || !player.visible) return out;
    if (!seesThroughDisguise(npc.authority, disguise, rangerDanger)) return out;

    const range = npc.visionRangeSH ?? T.visionRangeSH;
    const half = (npc.halfAngleDeg ?? T.visionHalfAngleDeg) * DEG;
    const inCone = !npc.sleeping && d <= range && Math.abs(wrapAngle(bearing - npc.facing)) <= half;
    if (inCone && (!T.solidsBlockSight || world.lineOfSight(npc, player))) {
        if (player.concealed || player.inCover) out.concealed = true;
        else out.see = true;
    }
    const mode = player.noiseMode as keyof typeof T.hearingMultiplier;
    const hm = T.hearingMultiplier[mode] ?? 0;
    if (hm > 0 && d <= T.hearingRadiusSH * hm) {
        out.hear = true;
        out.loudness = T.hearingFillMultiplier[mode] ?? 1;
    }
    if (player.concealed && player.stillTime > 0.2) {
        out.hear = false;
        if (d <= T.hearingRadiusSH) out.concealed = true;
    }
    return out;
}

/**
 * Advance one NPC's meter. Returns 'alarm' on the frame the meter completes.
 * `turnToward` is called when the NPC should rotate to face the sound.
 */
export function stepPerception(
    p: PerceptionState,
    s: Senses,
    npc: PerceiverInfo,
    dt: number,
    turnToward: (bearing: number) => void,
    wake: () => void,
): 'alarm' | null {
    const T = TUNING.detection;

    if (p.alarmed) {
        if (s.see) {
            p.memory = T.alertedMemoryTime;
            p.glyph = 'eye';
        } else {
            p.memory = Math.max(0, p.memory - dt);
            if (p.memory <= 0) {
                p.alarmed = false;
                p.meter = 0;
                p.glyph = null;
            }
        }
        return null;
    }

    const rate = (T.whiteFillConstant / Math.max(s.d, T.minDistanceSH)) * (npc.sleeping ? T.sleepingHearingFillMultiplier : 1);

    if (s.see) {
        p.searching = false;
        if (p.meter < 1) {
            p.meter += rate * dt;
            if (p.meter > 1) p.meter = 1 + (p.meter - 1) * T.redFillMultiplier;
        } else {
            p.meter += rate * T.redFillMultiplier * dt;
        }
        p.glyph = 'eye';
        p.hold = T.holdTime;
        p.turnTimer = 0;
        if (p.meter >= 2) {
            p.meter = 2;
            p.alarmed = true;
            p.memory = T.alertedMemoryTime;
            return 'alarm';
        }
        return null;
    }

    if (s.hear) {
        p.searching = false;
        // red never advances on hearing alone; it simply holds
        if (p.meter < 1) p.meter = Math.min(1, p.meter + rate * (s.loudness ?? 1) * dt);
        p.glyph = 'ear';
        p.hold = T.holdTime;
        if (p.meter >= 1) {
            if (npc.sleeping) wake();
            p.turnTimer += dt;
            if (p.turnTimer >= T.turnToSoundDelay) turnToward(s.bearing);
        }
        return null;
    }

    // no stimulus
    p.turnTimer = 0;
    if (s.concealed && p.meter >= T.searchThreshold && !p.searching) {
        // the sasquatch vanished into a hiding spot right in front of them
        p.searching = true;
        p.glyph = '?';
        p.hold = T.searchHoldTime;
    }
    if (p.hold > 0) {
        p.hold -= dt;
    } else if (p.meter > 0) {
        const decay = p.searching && npc.authority ? T.rangerSearchDecayPerSecond : T.decayPerSecond;
        p.meter = Math.max(0, p.meter - decay * dt);
        if (p.meter === 0) {
            p.glyph = null;
            p.searching = false;
        }
    }
    return null;
}
