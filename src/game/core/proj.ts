import { TUNING, SH_METRES } from '../config/tuning';

/**
 * World <-> screen projection for the fixed orthographic camera.
 *
 * World space: metres, x = east, y = north, z = up.
 * "World pixels" are what Phaser's world camera sees before zoom:
 *   px =  x * PPM
 *   py = -(y * sin(pitch) + z * cos(pitch)) * PPM
 * Sprites rendered in Blender with the same pitch line up exactly.
 */
export const PPM = TUNING.render.worldPPM;
const PITCH = (TUNING.camera.pitchDeg * Math.PI) / 180;
export const SIN_P = Math.sin(PITCH);
export const COS_P = Math.cos(PITCH);

/** Scale to apply to a sprite rendered at `spritePPM` so it matches the world. */
export const spriteScale = (spritePPM: number = TUNING.render.spritePPM) => PPM / spritePPM;

export function wx(x: number): number {
    return x * PPM;
}

export function wy(y: number, z = 0): number {
    return -(y * SIN_P + z * COS_P) * PPM;
}

/** Ground point under a world-pixel position. */
export function groundFromWorldPx(px: number, py: number): { x: number; y: number } {
    return { x: px / PPM, y: -py / (PPM * SIN_P) };
}

/** Depth used for y-sorting: objects nearer the camera (further south) draw on top. */
export function depthFor(y: number): number {
    return -y * SIN_P * PPM;
}

export const SH = SH_METRES;
