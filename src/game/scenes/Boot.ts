import * as Phaser from 'phaser';
import { Manifest, queueManifestAssets, setManifest } from '../core/assets';
import { L } from '../ui/layout';
import { Settings } from '../core/settings';

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
        const bar = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, 0, L.r(12), 0xffffff).setOrigin(0.5);
        this.load.on('progress', (v: number) => bar.setSize(this.scale.width * 0.3 * v, L.r(12)));
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
