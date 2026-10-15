import { TUNING } from '../config/tuning';

/**
 * Player preferences from the pause menu (Esc). Stored in the browser apart from the
 * save slots, so they apply to every game.
 */
const KEY = 'sneaky-sasquatch/settings';

export const Settings = {
    /** master volume 0..1 (multiplies the mix in TUNING.audio) */
    volume: 1,
    /** field-of-view slider 0..1; see TUNING.camera.fov */
    fov: TUNING.camera.fov.defaultSlider as number,

    load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (!raw) return;
            const d = JSON.parse(raw) as Partial<{ volume: number; fov: number }>;
            if (typeof d.volume === 'number') this.volume = Math.min(1, Math.max(0, d.volume));
            if (typeof d.fov === 'number') this.fov = Math.min(1, Math.max(0, d.fov));
        } catch {
            /* storage unavailable: defaults */
        }
    },

    save() {
        try {
            localStorage.setItem(KEY, JSON.stringify({ volume: this.volume, fov: this.fov }));
        } catch {
            /* ignore */
        }
    },

    /** camera zoom multiplier for the FOV slider (1 at the default position) */
    fovZoom(slider?: number) {
        const v = slider ?? Settings.fov;
        const F = TUNING.camera.fov;
        const d = F.defaultSlider;
        if (v <= d) return Math.exp(Math.log(F.zoomAtMin) * (1 - v / d));
        return Math.exp(Math.log(F.zoomAtMax) * ((v - d) / (1 - d)));
    },
};

Settings.load();
