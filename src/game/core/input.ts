import * as Phaser from 'phaser';

/**
 * Unified controls (Mac build of the original: mouse + keyboard).
 *  - Mouse: hold the left button to walk toward the cursor; click to walk to a
 *    spot. Rapid repeated clicks = sneak (the original's touch rule).
 *  - Keyboard: WASD / arrows to move, hold Shift to sneak,
 *    E / Space / Enter to interact, Tab or B for the backpack, Esc to close.
 */
export class Controls {
    private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
    pointerDown = false;
    /** screen position of the pointer (canvas px) */
    pointerX = 0;
    pointerY = 0;
    /** set on a click; consumed by the player */
    clickTarget: { sx: number; sy: number } | null = null;
    private clickTimes: number[] = [];
    rapidSneak = false;
    private pressed = new Set<string>();
    private uiCapture = false;

    constructor(private scene: Phaser.Scene) {
        const kb = scene.input.keyboard!;
        const K = Phaser.Input.Keyboard.KeyCodes;
        const map: Record<string, number> = {
            W: K.W, A: K.A, S: K.S, D: K.D, UP: K.UP, DOWN: K.DOWN, LEFT: K.LEFT, RIGHT: K.RIGHT,
            SHIFT: K.SHIFT, E: K.E, SPACE: K.SPACE, ENTER: K.ENTER, TAB: K.TAB, B: K.B, ESC: K.ESC, I: K.I,
        };
        for (const [n, c] of Object.entries(map)) this.keys[n] = kb.addKey(c, true, false);
        kb.on('keydown', (e: KeyboardEvent) => this.pressed.add(e.code));

        scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
            if (this.uiCapture || p.rightButtonDown()) return;
            this.pointerDown = true;
            this.pointerX = p.x; this.pointerY = p.y;
            this.clickTarget = { sx: p.x, sy: p.y };
            const now = scene.time.now / 1000;
            this.clickTimes = this.clickTimes.filter((t) => now - t < 0.9);
            this.clickTimes.push(now);
        });
        scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            this.pointerX = p.x; this.pointerY = p.y;
        });
        scene.input.on('pointerup', () => {
            this.pointerDown = false;
        });
    }

    /** UI widgets call this so clicks on buttons don't also move the player. */
    captureUI(v: boolean) {
        this.uiCapture = v;
        if (v) { this.pointerDown = false; this.clickTarget = null; }
    }

    keyVector(): { x: number; y: number } {
        const k = this.keys;
        let x = 0, y = 0;
        if (k.A.isDown || k.LEFT.isDown) x -= 1;
        if (k.D.isDown || k.RIGHT.isDown) x += 1;
        if (k.W.isDown || k.UP.isDown) y += 1;
        if (k.S.isDown || k.DOWN.isDown) y -= 1;
        const l = Math.hypot(x, y);
        return l > 0 ? { x: x / l, y: y / l } : { x: 0, y: 0 };
    }

    get shift() {
        return this.keys.SHIFT.isDown;
    }

    /** True if the user is clicking rapidly (≥3 clicks within ~0.9 s). */
    get rapidClicks() {
        const now = this.scene.time.now / 1000;
        return this.clickTimes.filter((t) => now - t < 0.9).length >= 3;
    }

    /** Edge-triggered key check (any of the given KeyboardEvent.code values). */
    justPressed(...codes: string[]) {
        for (const c of codes) if (this.pressed.has(c)) return true;
        return false;
    }

    get interact() {
        return this.justPressed('KeyE', 'Space', 'Enter');
    }
    get backpack() {
        return this.justPressed('Tab', 'KeyB', 'KeyI');
    }
    get escape() {
        return this.justPressed('Escape');
    }

    /** Call at the end of each frame. */
    endFrame() {
        this.pressed.clear();
    }
}
