import { TUNING } from '../config/tuning';

/**
 * UI is authored in "ref px" — pixels on the 3024x1898 reference captures the
 * measurements in `your research/video-notes/` were taken from. `L.s` converts
 * ref px to canvas px for the current window size.
 */
export const L = {
    W: 3024,
    H: 1898,
    s: 1,
    update(width: number, height: number) {
        this.W = width;
        this.H = height;
        const { refWidth, refHeight } = TUNING.render;
        this.s = Math.min(height / refHeight, (width / refWidth) * 1.2);
    },
    /** ref px → canvas px */
    r(v: number) {
        return v * this.s;
    },
    /** x measured from the left of the reference frame, keeping centre-relative layout */
    cx(refX: number) {
        return this.W / 2 + (refX - TUNING.render.refWidth / 2) * this.s;
    },
    cy(refY: number) {
        return this.H / 2 + (refY - TUNING.render.refHeight / 2) * this.s;
    },
    /** distance from the right edge in ref px */
    right(refFromRight: number) {
        return this.W - refFromRight * this.s;
    },
    bottom(refFromBottom: number) {
        return this.H - refFromBottom * this.s;
    },
    font: '"Bree Serif", Georgia, serif',
    /** font-size string for a ref-px size */
    fs(refPx: number) {
        return `${Math.round(refPx * this.s)}px`;
    },
};
