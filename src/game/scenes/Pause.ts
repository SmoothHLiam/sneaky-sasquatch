import * as Phaser from 'phaser';
import { G } from '../core/state';
import { Settings } from '../core/settings';
import { playSfx } from '../core/audio';
import { L } from '../ui/layout';
import { UI, optimizeText, pillButton } from '../ui/widgets';
import { TUNING } from '../config/tuning';
import type { World } from './World';

/**
 * Pause menu (Esc). Not in the original's recordings — built in the game's own UI language:
 * the dark rounded dialog panel, Bree Serif, light pill buttons with a dark ring like the
 * interaction prompts. The World and Hud are frozen underneath (World.openPause).
 *   - Volume: master volume (Phaser sound manager)
 *   - Field of view: camera zoom; the default (55 %) is the measured zoom, lower sees more.
 *     It previews live behind the menu while you drag.
 *   - Controls page, Fullscreen, Optimization mode, Resume, Save & quit to title.
 * All sizes are ref px (3024 x 1898 reference) through L.r().
 */
const PANEL = { w: 1500, h: 1470 };
const MUTED = '#a9b3a8';

interface Slider {
    set(v: number): void;
    drag(px: number): void;
}

export class Pause extends Phaser.Scene {
    private world!: World;
    private root!: Phaser.GameObjects.Container;
    private main!: Phaser.GameObjects.Container;
    private controlsPage!: Phaser.GameObjects.Container;
    private dragging: Slider | null = null;
    private closing = false;
    private fsLabel: Phaser.GameObjects.Text | null = null;

    constructor() {
        super('Pause');
    }

    create(data: { world: World }) {
        this.world = data.world;
        this.closing = false;
        this.dragging = null;
        L.update(this.scale.width, this.scale.height);
        this.build();
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.dragging?.drag(p.x));
        this.input.on('pointerup', () => {
            if (!this.dragging) return;
            this.dragging = null;
            Settings.save();
        });
        this.input.keyboard?.on('keydown-ESC', () => (this.controlsPage.visible ? this.showPage('main') : this.close()));
        const onResize = () => {
            L.update(this.scale.width, this.scale.height);
            const page = this.controlsPage?.visible ? 'controls' : 'main';
            this.root.destroy();
            this.build();
            this.showPage(page);
        };
        const onFs = () => this.fsLabel?.setText(this.fsText());
        this.scale.on('resize', onResize);
        this.scale.on('enterfullscreen', onFs);
        this.scale.on('leavefullscreen', onFs);
        this.events.once('shutdown', () => {
            this.scale.off('resize', onResize);
            this.scale.off('enterfullscreen', onFs);
            this.scale.off('leavefullscreen', onFs);
        });
        // pop in
        this.root.setAlpha(0);
        this.tweens.add({ targets: this.root, alpha: 1, duration: 140, ease: 'Quad.Out' });
        playSfx(this, 'click');
    }

    // ------------------------------------------------------------------ layout
    private build() {
        const W = L.W, H = L.H;
        this.root = this.add.container(0, 0);
        // dim the frozen game and swallow clicks
        const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0.45).setOrigin(0).setInteractive();
        const pw = L.r(PANEL.w), ph = L.r(PANEL.h);
        const px = W / 2 - pw / 2, py = H / 2 - ph / 2;
        const panel = this.add.graphics();
        panel.fillStyle(UI.dialog, 0.94).fillRoundedRect(px, py, pw, ph, L.r(64));
        this.root.add([dim, panel]);

        this.main = this.add.container(0, 0);
        this.controlsPage = this.add.container(0, 0).setVisible(false);
        this.root.add([this.main, this.controlsPage]);
        this.buildMain(px, py, pw);
        this.buildControls(px, py, pw);
    }

    private buildMain(px: number, py: number, pw: number) {
        const cx = px + pw / 2;
        const c = this.main;
        c.add(this.text(cx, py + L.r(140), 'Paused', 120).setOrigin(0.5));

        const labelX = px + L.r(130);
        const trackX = px + L.r(560), trackW = L.r(640);
        // volume
        const volY = py + L.r(345);
        c.add(this.text(labelX, volY, 'Volume', 70).setOrigin(0, 0.5));
        this.slider(c, trackX, volY, trackW, Settings.volume, (v) => {
            Settings.volume = v;
            this.sound.volume = v;
        }, (v) => `${Math.round(v * 100)}%`);
        // field of view
        const fovY = py + L.r(530);
        c.add(this.text(labelX, fovY, 'Field of view', 70).setOrigin(0, 0.5));
        this.slider(c, trackX, fovY, trackW, Settings.fov, (v) => {
            Settings.fov = v;
            this.world.refreshZoom();
        }, (v) => `${Math.round(v * 100)}%`, TUNING.camera.fov.defaultSlider);
        c.add(this.text(trackX, fovY + L.r(88), 'Lower to see more around you', 44, MUTED).setOrigin(0, 0.5));

        // controls / fullscreen
        const rowY = py + L.r(790), bw = L.r(560), gap = L.r(56);
        c.add(this.button(cx - bw / 2 - gap / 2, rowY, 560, 136, 'Controls', () => this.showPage('controls')));
        const fs = this.button(cx + bw / 2 + gap / 2, rowY, 560, 136, this.fsText(), () => this.toggleFullscreen());
        this.fsLabel = fs.getAt(1) as Phaser.GameObjects.Text;
        c.add(fs);
        // optimization mode (also offered on the loading screen)
        const opt = this.button(cx, rowY + L.r(180), 1176, 136, optimizeText(), () => {
            // label first: the switch resizes the canvas, which rebuilds this menu
            Settings.optimize = !Settings.optimize;
            (opt.getAt(1) as Phaser.GameObjects.Text).setText(optimizeText());
            Settings.setOptimize(Settings.optimize);
        });
        c.add(opt);
        // resume / quit
        c.add(this.button(cx, py + L.r(1170), 1176, 150, 'Resume', () => this.close(), { primary: true }));
        c.add(this.button(cx, py + L.r(1350), 1176, 118, 'Save & quit to title', () => this.quitToTitle(), { danger: true }));
    }

    private buildControls(px: number, py: number, pw: number) {
        const cx = px + pw / 2;
        const c = this.controlsPage;
        c.add(this.text(cx, py + L.r(140), 'Controls', 120).setOrigin(0.5));
        const rows: [string, string][] = [
            ['Walk', 'Hold the mouse button where you want to go, or click a spot · WASD / arrow keys'],
            ['Sneak', 'Click rapidly, or hold Shift while moving'],
            ['Interact', 'Click the bubble that pops up · E, Space or Enter'],
            ['Backpack', 'Click the backpack · B, Tab or I'],
            ['Yes / No', 'Click ✓ or ✗ · Y / N'],
            ['Close', 'Click ✕ · Esc closes close-ups'],
            ['Pause', 'Esc'],
        ];
        const x0 = px + L.r(130), x1 = px + L.r(450);
        rows.forEach(([k, v], i) => {
            const y = py + L.r(310 + i * 116);
            c.add(this.text(x0, y, k, 58, UI.highlightMint).setOrigin(0, 0.5));
            c.add(this.text(x1, y, v, 46, '#e8ece7', { wordWrap: { width: pw - L.r(560) }, lineSpacing: -L.r(4) }).setOrigin(0, 0.5));
        });
        c.add(this.button(cx, py + L.r(1350), 1176, 118, 'Back', () => this.showPage('main')));
    }

    private showPage(page: 'main' | 'controls') {
        this.main.setVisible(page === 'main');
        this.controlsPage.setVisible(page === 'controls');
    }

    // ------------------------------------------------------------------ widgets
    private text(x: number, y: number, s: string, refSize: number, color = '#ffffff', extra: Phaser.Types.GameObjects.Text.TextStyle = {}) {
        return this.add.text(x, y, s, { fontFamily: L.font, fontSize: L.fs(refSize), color, ...extra });
    }

    private button(x: number, y: number, wRef: number, hRef: number, label: string, onClick: () => void, opts: { primary?: boolean; danger?: boolean } = {}) {
        return pillButton(this, x, y, wRef, hRef, label, onClick, opts);
    }

    /** track + fill + knob; drag anywhere on the row. `tick` marks the default position */
    private slider(parent: Phaser.GameObjects.Container, x0: number, y: number, w: number, value: number, onChange: (v: number) => void, fmt: (v: number) => string, tick?: number): Slider {
        const g = this.add.graphics();
        const val = this.text(x0 + w + L.r(70), y, '', 60, '#ffffff').setOrigin(0, 0.5);
        const th = L.r(22), kr = L.r(38);
        let v = value;
        const draw = () => {
            g.clear();
            g.fillStyle(UI.hungerEmpty, 1).fillRoundedRect(x0, y - th / 2, w, th, th / 2);
            g.fillStyle(0x6cc63a, 1).fillRoundedRect(x0, y - th / 2, Math.max(th, w * v), th, th / 2);
            if (tick !== undefined) {
                g.fillStyle(0xffffff, 0.55).fillRect(x0 + w * tick - L.r(3), y - L.r(34), L.r(6), L.r(68));
            }
            g.fillStyle(UI.promptRing, 1).fillCircle(x0 + w * v, y, kr);
            g.fillStyle(UI.promptFill, 1).fillCircle(x0 + w * v, y, kr - L.r(8));
            val.setText(fmt(v));
        };
        const s: Slider = {
            set: (nv: number) => {
                v = Math.min(1, Math.max(0, nv));
                draw();
                onChange(v);
            },
            drag: (px: number) => s.set((px - x0) / w),
        };
        draw();
        const hit = this.add.zone(x0 + w / 2, y, w + kr * 3, L.r(130)).setInteractive({ useHandCursor: true });
        hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
            this.dragging = s;
            s.drag(p.x);
        });
        parent.add([g, val, hit]);
        return s;
    }

    // ------------------------------------------------------------------ actions
    private fsText() {
        return this.scale.isFullscreen ? 'Exit fullscreen' : 'Fullscreen';
    }

    private toggleFullscreen() {
        if (this.scale.isFullscreen) this.scale.stopFullscreen();
        else this.scale.startFullscreen();
    }

    private close() {
        if (this.closing) return;
        this.closing = true;
        Settings.save();
        this.tweens.add({
            targets: this.root, alpha: 0, duration: 110,
            onComplete: () => {
                this.world.resumeFromPause();
                this.scene.stop();
            },
        });
    }

    private quitToTitle() {
        if (this.closing) return;
        this.closing = true;
        Settings.save();
        G.persist();
        for (const k of ['CloseUp', 'Minigame', 'Hud', 'World']) if (this.scene.isActive(k) || this.scene.isPaused(k)) this.scene.stop(k);
        this.scene.start('Title');
    }
}
