import * as Phaser from 'phaser';
import { Manifest, queueManifestAssets, setManifest } from '../core/assets';
import { L } from '../ui/layout';
import { Settings } from '../core/settings';
import { optimizeText, pillButton } from '../ui/widgets';

/** Loads the asset manifest, then every asset it lists, then goes to the title screen. */
export class Boot extends Phaser.Scene {
    constructor() {
        super('Boot');
    }

    preload() {
        this.load.json('manifest', 'assets/manifest.json');
    }

    create() {
        setManifest((this.cache.json.get('manifest') as Partial<Manifest>) ?? {});
        // the player's volume from the pause menu
        this.sound.volume = Settings.volume;
        L.update(this.scale.width, this.scale.height);
        // everything sits in one container around the screen centre, so a resize (switching
        // optimization mode changes the canvas resolution) only re-centres and rescales it
        const s0 = L.s, barW = this.scale.width * 0.3, barH = L.r(12);
        const bar = this.add.rectangle(0, 0, 0, barH, 0xffffff).setOrigin(0.5);
        this.load.on('progress', (v: number) => bar.setSize(barW * v, barH));
        // optimization mode can be switched on before the game even starts (also in the pause menu)
        const opt = pillButton(this, 0, L.r(220), 1000, 130, optimizeText(), () => {
            Settings.setOptimize(!Settings.optimize);
            (opt.getAt(1) as Phaser.GameObjects.Text).setText(optimizeText());
        });
        const hint = this.add.text(0, L.r(345), 'Smoother on slower computers: lower resolution, fewer effects', { fontFamily: L.font, fontSize: L.fs(44), color: '#a9b3a8' }).setOrigin(0.5);
        const ui = this.add.container(this.scale.width / 2, this.scale.height / 2, [bar, opt, hint]);
        const onResize = () => {
            L.update(this.scale.width, this.scale.height);
            ui.setPosition(this.scale.width / 2, this.scale.height / 2).setScale(L.s / s0);
        };
        this.scale.on('resize', onResize);
        this.events.once('shutdown', () => this.scale.off('resize', onResize));
        queueManifestAssets(this);
        // load-time profiling (open the console and run __loadTimes)
        const t0 = performance.now();
        const times: [string, number][] = [];
        (window as unknown as { __loadTimes: [string, number][] }).__loadTimes = times;
        this.load.on('filecomplete', (key: string) => times.push([key, Math.round(performance.now() - t0)]));
        this.load.once('complete', () => {
            const params = new URLSearchParams(location.search);
            // ?zone=<id> jumps straight into a zone for testing
            if (params.get('zone')) this.scene.start('World', { debugZone: params.get('zone') });
            else if (params.has('tutorial')) this.scene.start('World', { slot: 9, fresh: true, stage: params.get('stage') ?? undefined });
            else this.scene.start('Title');
        });
        this.load.start();
    }
}
