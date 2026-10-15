import * as Phaser from 'phaser';
import { L } from '../ui/layout';
import type { World } from './World';

/**
 * Title screen (your research/video-notes/tutorial-and-cutscene.md §3.1):
 * the live forest scene (World in attract mode) with the logo, "PLAY", the exit
 * icon top-left, a rocket badge top-right and "v2.2" bottom-right. The sasquatch
 * wanders past and hides; a ranger patrols across.
 */
export class Title extends Phaser.Scene {
    private ui!: Phaser.GameObjects.Container;
    private world!: World;
    private loopT = 0;
    private rangerT = 2;
    private leaving = false;

    constructor() {
        super('Title');
    }

    create() {
        L.update(this.scale.width, this.scale.height);
        this.leaving = false;
        this.loopT = 0;
        this.rangerT = 2;
        this.scene.launch('World', { attract: true });
        this.world = this.scene.get('World') as World;
        this.scene.bringToTop();
        this.buildUI();
        this.scale.on('resize', this.onResize, this);
        this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this));
    }

    private onResize() {
        L.update(this.scale.width, this.scale.height);
        this.ui.destroy();
        this.buildUI();
    }

    private buildUI() {
        const W = L.W, H = L.H, s = L.s;
        this.ui = this.add.container(0, 0);
        // logo: five white peaks with "SNEAKY" knocked out in grass green, big italic "SASQUATCH" below
        const g = this.add.graphics();
        g.fillStyle(0xf1f2f1, 1);
        // five peaks measured from t000.5: x offset from centre (fraction of W), height above the base (fraction of H)
        const base = H * 0.478, cx = W * 0.499;
        const peaks: [number, number][] = [[-0.119, 0.139], [-0.06, 0.199], [0, 0.159], [0.055, 0.223], [0.121, 0.135]];
        for (const [px, ph] of peaks) {
            const x = cx + px * W, top = base - ph * H, half = ph * H * 0.74;
            g.fillTriangle(x - half, base, x + half, base, x, top);
        }
        const sneaky = this.add.text(cx, base - H * 0.038, 'SNEAKY', { fontFamily: 'Montserrat', fontStyle: 'italic 900', fontSize: `${Math.round(H * 0.105)}px`, color: '#3fa13a' }).setOrigin(0.5);
        sneaky.setScale(Math.min(1.2, (W * 0.26) / sneaky.width), 1);
        const sas = this.add.text(cx, H * 0.567, 'SASQUATCH', { fontFamily: 'Montserrat', fontStyle: 'italic 900', fontSize: `${Math.round(H * 0.17)}px`, color: '#f1f2f1' }).setOrigin(0.5);
        sas.setScale((W * 0.707) / sas.width, 1);
        const play = this.add.text(W * 0.484, H * 0.804, 'PLAY', { fontFamily: L.font, fontStyle: 'bold', fontSize: `${Math.round(H * 0.058)}px`, color: '#ffffff' }).setOrigin(0.5);
        play.setShadow(0, Math.round(3 * s), 'rgba(0,0,0,0.25)', Math.round(6 * s), true, true);
        play.setInteractive({ useHandCursor: false });
        play.on('pointerover', () => this.tweens.add({ targets: play, scale: 1.08, duration: 120 }));
        play.on('pointerout', () => this.tweens.add({ targets: play, scale: 1, duration: 120 }));
        play.on('pointerdown', () => this.toSlots());
        // also accept a click anywhere near PLAY / Enter
        this.input.keyboard?.once('keydown-ENTER', () => this.toSlots());
        const exit = this.add.image(W * 0.045, H * 0.075, 'ui_door').setDisplaySize(H * 0.075, H * 0.075).setTint(0xffffff);
        const rocketBg = this.add.circle(W * 0.969, H * 0.048, H * 0.034, 0x356533, 1);
        const rocket = this.add.image(W * 0.969, H * 0.048, 'ui_rocket').setDisplaySize(H * 0.04, H * 0.04);
        const ver = this.add.text(W * 0.958, H * 0.951, 'v2.2', { fontFamily: L.font, fontSize: `${Math.round(H * 0.027)}px`, color: '#9fc39b' }).setOrigin(1, 0.5).setAlpha(0.85);
        this.ui.add([g, sneaky, sas, play, exit, rocketBg, rocket, ver]);
    }

    private toSlots() {
        if (this.leaving) return;
        this.leaving = true;
        this.world.sfx('click');
        // logo + PLAY go away, the cards drop in over the same backdrop
        // the logo pieces and PLAY are the first four children of the UI container
        this.tweens.add({ targets: this.ui.list.slice(0, 4), alpha: 0, duration: 260 });
        this.scene.launch('SlotSelect');
        this.scene.bringToTop('SlotSelect');
    }

    /** attract loop: the sasquatch runs past PLAY and ducks behind the bushes; a ranger patrols */
    update(_t: number, deltaMs: number) {
        const w = this.world;
        if (!w || !w.player || w.zone?.id !== 'title') return;
        const dt = Math.min(0.05, deltaMs / 1000);
        const p = w.player;
        this.loopT -= dt;
        if (this.loopT <= 0 && !p.scriptTarget) {
            const step = Math.floor(this.sasStep++ % 4);
            // runs left past PLAY, ducks into the berry bushes, peeks out tip-toeing, then bolts off right
            if (step === 0) { p.setPosition(23.5, 5.6); p.walkTo({ x: 6.5, y: 5.8 }, undefined, 1); this.loopT = 1; }
            else if (step === 1) { p.walkTo({ x: 8.0, y: 13.4 }, undefined, 0.9); this.loopT = 3.5; }
            else if (step === 2) { p.walkTo({ x: 12.4, y: 11.6 }, undefined, 0.4, true); this.loopT = 2; }
            else { p.walkTo({ x: 23.5, y: 8.6 }, undefined, 1); this.loopT = 3; }
        }
        this.rangerT -= dt;
        if (this.rangerT <= 0) {
            this.rangerT = 16;
            const r = w.spawnHuman('titleRanger', 'ranger', '', 3.0, 7.8, 0, 'idle');
            r.state = 'scripted';
            void w.walkHuman(r, { x: 23.5, y: 7.4 }, 0.42).then(() => w.removeHuman('titleRanger'));
        }
    }

    private sasStep = 0;
}
