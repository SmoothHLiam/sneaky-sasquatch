import * as Phaser from 'phaser';
import { TUNING } from '../config/tuning';
import { Actor } from './Actor';
import { atlasMeta } from '../core/assets';
import { Vec, approachAngle, len } from '../core/math';
import { SH } from '../core/proj';
import type { CollisionWorld } from '../world/collision';
import type { Controls } from '../core/input';

export type MoveMode = 'idle' | 'walk' | 'sneak' | 'swim' | 'vehicle' | 'lying' | 'hiding';

/** The sasquatch. */
export class Player extends Actor {
    mode: MoveMode = 'idle';
    vx = 0;
    vy = 0;
    /** walk-to target from a click */
    target: Vec | null = null;
    /** inputs disabled (cutscenes, dialogue) */
    locked = false;
    /** carrying a movable bush (hiding inside it) */
    bush: { img: Phaser.GameObjects.Image; baseScale: number } | null = null;
    /** inside an outhouse / tent / RV */
    hidingIn: string | null = null;
    swimming = false;
    /** sleeping in bed: Z's rise */
    sleepingZ = false;
    /** late at night: Zs rise from him while he's still up (12:50 AM) */
    sleepyZ = false;
    /** standing inside dense forest / undergrowth (hidden from sight, not from hearing) */
    inCover = false;
    /** time spent standing still */
    stillTime = 0;
    /** scripted move (cutscenes) */
    scriptTarget: Vec | null = null;
    scriptSpeed = 1;
    onArrive?: () => void;
    /** force sneak animation/speed during scripted moves */
    scriptSneak = false;
    /** called every footprint step on land (x, y, left foot?, facing) */
    onStep?: (x: number, y: number, left: boolean, facing: number) => void;
    /** backpack overlay (rendered with the body as a holdout, so it occludes correctly) */
    packSprite: Phaser.GameObjects.Sprite | null = null;
    private lastSneakClick = false;
    private blockedTime = 0;
    private stepDist = 0;
    private stepLeft = false;

    constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer, atlas = 'sasquatch') {
        super(scene, layer, atlas, { shadowW: 0.95, placeholderColor: 0x4a3122, height: 2 });
        this.radius = TUNING.player.radius;
        this.headHeight = 2.0;
    }

    /** Show the chosen backpack on the sasquatch (null = no backpack yet). */
    setPack(color: string | null) {
        const key = color ? 'pack_' + color : '';
        if (this.packSprite && this.packSprite.texture.key === key) return;
        this.packSprite?.destroy();
        this.packSprite = null;
        if (!color || !this.scene.textures.exists(key)) return;
        const meta = atlasMeta(key)!;
        this.packSprite = this.scene.add.sprite(0, 0, key, this.sprite.frame.name);
        this.packSprite.setOrigin(meta.anchorX / meta.cellW, meta.anchorY / meta.cellH).setScale(this.sprite.scaleX, this.sprite.scaleY);
        this.layer.add(this.packSprite);
    }

    override destroy() {
        this.packSprite?.destroy();
        super.destroy();
    }

    get walkSpeed() {
        return TUNING.player.walkSpeedSH * SH;
    }

    /** a held pose shown while standing still (e.g. 'get': an item raised overhead) */
    pose: string | null = null;

    /** seconds left of a racket the sasquatch is making with something (TV static...) */
    applianceNoise = 0;

    /** concealed from sight (still inside a bush, or inside a hiding spot) */
    get concealed() {
        return !!this.hidingIn || (!!this.bush && this.stillTime > 0.2);
    }

    /** what kind of noise the sasquatch is making right now (keys of detection.hearingMultiplier) */
    get noiseMode(): string {
        if (this.applianceNoise > 0) return 'appliance';
        if (this.hidingIn || this.mode === 'lying' || this.mode === 'idle') return 'idle';
        if (this.bush) return 'bush';
        return this.mode;
    }

    walkTo(p: Vec, onArrive?: () => void, speedFactor = 1, sneak = false) {
        this.scriptTarget = { ...p };
        this.scriptSpeed = speedFactor;
        this.scriptSneak = sneak;
        this.onArrive = onArrive;
    }

    /** drop any click-to-move or scripted walk target */
    stop() {
        this.target = null;
        this.scriptTarget = null;
        this.onArrive = undefined;
    }

    update(dt: number, controls: Controls, world: CollisionWorld, pointerGround: () => Vec | null, inWater: (p: Vec) => boolean) {
        const T = TUNING.player;
        let dx = 0, dy = 0;
        let sneak = false;
        let wantsMove = false;

        if (this.mode === 'lying' || this.hidingIn) {
            this.vx = this.vy = 0;
            this.stillTime += dt;
            this.render();
            return;
        }

        if (this.scriptTarget) {
            const tx = this.scriptTarget.x - this.x, ty = this.scriptTarget.y - this.y;
            const d = len(tx, ty);
            if (d < T.arriveRadius + 0.05) {
                this.scriptTarget = null;
                const cb = this.onArrive;
                this.onArrive = undefined;
                cb?.();
            } else {
                dx = tx / d; dy = ty / d;
                wantsMove = true;
                sneak = this.scriptSneak;
            }
        } else if (!this.locked) {
            const k = controls.keyVector();
            if (k.x || k.y) {
                dx = k.x; dy = k.y; wantsMove = true;
                this.target = null;
                sneak = controls.shift;
            } else {
                if (controls.clickTarget) {
                    const g = pointerGround();
                    if (g) this.target = g;
                    this.lastSneakClick = controls.rapidClicks || controls.shift;
                    controls.clickTarget = null;
                }
                if (controls.pointerDown) {
                    const g = pointerGround();
                    if (g) this.target = g;
                    if (controls.shift) this.lastSneakClick = true;
                }
                if (this.target) {
                    const tx = this.target.x - this.x, ty = this.target.y - this.y;
                    const d = len(tx, ty);
                    if (d < T.arriveRadius) {
                        this.target = null;
                    } else {
                        dx = tx / d; dy = ty / d; wantsMove = true;
                        sneak = this.lastSneakClick;
                    }
                }
            }
        }

        this.swimming = inWater(this);
        let factor = sneak ? T.sneakSpeedFactor : 1;
        if (this.bush) factor = Math.min(factor, T.bushSpeedFactor);
        if (this.swimming) factor = T.swimSpeedFactor;
        const speed = this.scriptTarget ? this.walkSpeed * this.scriptSpeed : this.walkSpeed * factor;
        const tvx = wantsMove ? dx * speed : 0;
        const tvy = wantsMove ? dy * speed : 0;
        const a = Math.min(1, dt / Math.max(0.001, wantsMove ? T.accelTime : T.decelTime));
        this.vx += (tvx - this.vx) * a;
        this.vy += (tvy - this.vy) * a;

        const ox = this.x, oy = this.y;
        const next = world.resolve({ x: this.x + this.vx * dt, y: this.y + this.vy * dt }, this.radius);
        this.x = next.x;
        this.y = next.y;
        const moved = len(this.x - ox, this.y - oy);
        const expected = len(this.vx, this.vy) * dt;
        if (this.target && wantsMove && expected > 1e-5 && moved < expected * 0.25) {
            this.blockedTime += dt;
            if (this.blockedTime > 0.3) this.target = null;
        } else {
            this.blockedTime = 0;
        }

        if (moved > 1e-4 && (wantsMove || len(this.vx, this.vy) > 0.3)) {
            if (wantsMove) this.facing = approachAngle(this.facing, Math.atan2(dy, dx), (T.turnSpeedDeg * Math.PI / 180) * dt);
            this.mode = this.swimming ? 'swim' : sneak ? 'sneak' : 'walk';
            this.anim = sneak && !this.swimming ? 'sneak' : 'walk';
            this.animPhase += moved * (this.swimming ? T.walkFramesPerMetre * 1.6 : sneak ? T.sneakFramesPerMetre : T.walkFramesPerMetre);
            this.stillTime = 0;
            if (!this.swimming) {
                this.stepDist += moved;
                if (this.stepDist >= T.footprintSpacing) {
                    this.stepDist = 0;
                    this.stepLeft = !this.stepLeft;
                    this.onStep?.(this.x, this.y, this.stepLeft, this.facing);
                }
            }
        } else {
            this.mode = this.swimming ? 'swim' : 'idle';
            this.anim = this.pose && this.frames[this.pose] ? this.pose : 'idle';
            this.animPhase += dt * 2;
            this.stillTime += dt;
        }
        this.render();
    }

    override render() {
        super.render();
        const hidden = !!this.hidingIn;
        this.sprite.setAlpha(hidden ? 0 : 1);
        this.shadow.setAlpha(hidden || this.swimming ? 0 : 1);
        // swimming: only the upper body shows above the water line
        if (this.swimming) {
            const f = this.sprite.frame;
            const keep = Math.max(8, f.cutHeight * 0.58);
            this.sprite.setCrop(0, 0, f.cutWidth, keep);
        } else if (this.sprite.isCropped) {
            this.sprite.setCrop();
        }
        const ps = this.packSprite;
        if (ps) {
            ps.setPosition(this.sprite.x, this.sprite.y).setDepth(this.sprite.depth + 0.05);
            ps.setFlipX(this.sprite.flipX).setRotation(this.sprite.rotation).setVisible(this.sprite.visible).setAlpha(this.sprite.alpha);
            const fname = this.sprite.frame.name;
            if (ps.frame.name !== fname && ps.texture.has(fname)) ps.setFrame(fname);
            if (this.sprite.isCropped) {
                const f = ps.frame;
                ps.setCrop(0, 0, f.cutWidth, Math.max(1, f.cutHeight * 0.58));
            } else if (ps.isCropped) ps.setCrop();
        }
        if (this.bush) {
            const b = this.bush.img;
            const still = this.stillTime > 0.2;
            // a carried bush is lifted so the legs show while walking, and crouches over him when still
            b.setPosition(this.shadow.x, this.shadow.y - (still ? 0 : 0.5 * 100 * 0.62));
            b.setDepth(this.sprite.depth + 0.1);
            this.sprite.setVisible(!still);
            const wob = still ? 0 : Math.sin(this.animPhase * 1.6) * 0.04;
            b.setScale(this.bush.baseScale * (1 + wob), this.bush.baseScale * (1 - wob));
        }
    }
}
