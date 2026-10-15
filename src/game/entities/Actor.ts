import * as Phaser from 'phaser';
import { atlasMeta } from '../core/assets';
import { TAU, wrapAngle } from '../core/math';
import { depthFor, spriteScale, wx, wy, PPM, SIN_P } from '../core/proj';

/**
 * Anything that walks around: player, humans, animals.
 * Visuals come from a Blender-rendered atlas with 9 unique directions
 * (S → N through E); the west half is mirrored. Frame names:
 *   `${anim}_${dir}_${frame}`   e.g. walk_4_3
 */
export class Actor {
    x = 0;
    y = 0;
    z = 0;
    /** facing in radians, math convention (0 = east, PI/2 = north) */
    facing = -Math.PI / 2;
    radius = 0.3;
    /** height of the top of the head above the feet (metres) — UI anchors above it */
    headHeight = 1.9;
    anim = 'idle';
    animPhase = 0;          // fractional frame position
    visible = true;
    /** simulated but not drawn (a camper napping inside a tent) */
    ghost = false;
    /** inside a building the sasquatch is outside of: hidden behind its walls and roof */
    occluded = false;
    readonly sprite: Phaser.GameObjects.Sprite;
    readonly shadow: Phaser.GameObjects.Ellipse;
    protected frames: Record<string, number> = {};
    protected fps: Record<string, number> = {};
    protected baseScale: number;
    /** extra rotation (radians) used for tackles / lying down */
    tilt = 0;

    constructor(
        public scene: Phaser.Scene,
        public layer: Phaser.GameObjects.Layer,
        public atlas: string,
        opts: { shadowW?: number; shadowH?: number; placeholderColor?: number; height?: number } = {},
    ) {
        const meta = atlasMeta(atlas);
        const shadowW = opts.shadowW ?? 0.85;
        this.shadow = scene.add.ellipse(0, 0, shadowW * PPM, shadowW * PPM * SIN_P * (opts.shadowH ?? 0.62), 0x000000, 0.16);
        layer.add(this.shadow);
        if (meta && scene.textures.exists(atlas)) {
            this.sprite = scene.add.sprite(0, 0, atlas, this.frameName('idle', 0, 0));
            this.sprite.setOrigin(meta.anchorX / meta.cellW, meta.anchorY / meta.cellH);
            this.baseScale = spriteScale(meta.ppm);
            for (const [k, a] of Object.entries(meta.anims)) {
                this.frames[k] = a.frames;
                this.fps[k] = a.fps;
            }
        } else {
            const key = `ph_actor_${atlas}`;
            if (!scene.textures.exists(key)) {
                const h = opts.height ?? 2;
                const g = scene.make.graphics({}, false);
                const W = 60, H = Math.round(60 * h * 0.8);
                g.fillStyle(opts.placeholderColor ?? 0x5a3a28, 1);
                g.fillRoundedRect(0, 0, W, H, 24);
                g.fillStyle(0xffffff, 0.9);
                g.fillCircle(W / 2, H * 0.22, 8);
                g.generateTexture(key, W, H);
                g.destroy();
            }
            this.sprite = scene.add.sprite(0, 0, key);
            this.sprite.setOrigin(0.5, 1);
            this.baseScale = 1;
        }
        this.sprite.setScale(this.baseScale);
        layer.add(this.sprite);
    }

    /** swap to another rendered atlas (e.g. the Duck putting its hat back on) */
    setAtlas(key: string) {
        const meta = atlasMeta(key);
        if (!meta || !this.scene.textures.exists(key)) return false;
        this.atlas = key;
        this.frames = {};
        this.fps = {};
        for (const [k, a] of Object.entries(meta.anims)) {
            this.frames[k] = a.frames;
            this.fps[k] = a.fps;
        }
        this.sprite.setTexture(key, this.frameName('idle', 0, 0));
        this.sprite.setOrigin(meta.anchorX / meta.cellW, meta.anchorY / meta.cellH);
        this.baseScale = spriteScale(meta.ppm);
        this.sprite.setScale(this.baseScale);
        return true;
    }

    frameName(anim: string, dir: number, f: number) {
        return `${anim}_${dir}_${f}`;
    }

    setPosition(x: number, y: number) {
        this.x = x;
        this.y = y;
        return this;
    }

    /** 16-direction index for the current facing (0 = facing camera/south, counter-clockwise). */
    dir16(): number {
        const a = wrapAngle(this.facing + Math.PI / 2);
        let k = Math.round((a / TAU) * 16);
        k = ((k % 16) + 16) % 16;
        return k;
    }

    /** advance time-based animations (idle, sleep, sit...) */
    tickAnim(dt: number) {
        if (this.anim === 'walk' || this.anim === 'run' || this.anim === 'sneak') return;
        this.animPhase += dt * (this.fps[this.anim] ?? 2);
    }

    has(anim: string) {
        return this.frames[anim] !== undefined;
    }

    /** Sync sprite with simulation state. */
    render() {
        const px = wx(this.x);
        const py = wy(this.y);
        this.shadow.setPosition(px, py);
        this.sprite.setPosition(px, wy(this.y, this.z));
        const d = depthFor(this.y);
        this.sprite.setDepth(d);
        this.shadow.setDepth(d - 0.5);
        this.sprite.setVisible(this.visible && !this.ghost && !this.occluded);
        this.shadow.setVisible(this.visible && !this.ghost && !this.occluded && this.z < 2);
        this.sprite.setRotation(this.tilt);
        if (this.sprite.texture.key === this.atlas) {
            const k = this.dir16();
            const mirror = k > 8;
            const dir = mirror ? 16 - k : k;
            const anim = this.has(this.anim) ? this.anim : 'idle';
            const n = this.frames[anim] ?? 1;
            const f = Math.floor(this.animPhase) % n;
            const name = this.frameName(anim, dir, f < 0 ? f + n : f);
            if (this.sprite.frame.name !== name) this.sprite.setFrame(name);
            this.sprite.setFlipX(mirror);
        }
    }

    destroy() {
        this.sprite.destroy();
        this.shadow.destroy();
    }
}
