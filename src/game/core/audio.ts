import * as Phaser from 'phaser';
import { TUNING } from '../config/tuning';

/**
 * Sound effects are generated with jsfxr (see art/sfx/*.json presets) and
 * exported to public/assets/audio/sfx_<name>.wav. Missing sounds are skipped.
 */
const lastPlayed = new Map<string, number>();

export function playSfx(scene: Phaser.Scene, name: string, opts: { volume?: number; rate?: number; minGap?: number } = {}) {
    const key = 'sfx_' + name;
    if (!scene.cache.audio.exists(key)) return;
    const now = scene.time.now;
    const gap = (opts.minGap ?? 0.04) * 1000;
    if (now - (lastPlayed.get(key) ?? -1e9) < gap) return;
    lastPlayed.set(key, now);
    const A = TUNING.audio;
    scene.sound.play(key, { volume: (opts.volume ?? 1) * A.sfx * A.master, rate: opts.rate ?? 1 });
}
