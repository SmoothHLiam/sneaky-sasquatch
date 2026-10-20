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
    /** optimization mode: render at 1x pixel density and skip cosmetic effects (exhaust, dust, skid marks, fish, grass blades) */
    optimize: false,

    load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (!raw) return;
            const d = JSON.parse(raw) as Partial<{ volume: number; fov: number; optimize: boolean }>;
            if (typeof d.volume === 'number') this.volume = Math.min(1, Math.max(0, d.volume));
            if (typeof d.fov === 'number') this.fov = Math.min(1, Math.max(0, d.fov));
            if (typeof d.optimize === 'boolean') this.optimize = d.optimize;
        } catch {
            /* storage unavailable: defaults */
        }
    },

    save() {
        try {
            localStorage.setItem(KEY, JSON.stringify({ volume: this.volume, fov: this.fov, optimize: this.optimize }));
        } catch {
            /* ignore */
        }
    },

    /** flip optimization mode; the resize handler in main.ts re-applies the pixel density */
    setOptimize(on: boolean) {
        Settings.optimize = on;
        Settings.save();
        window.dispatchEvent(new Event('resize'));
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
