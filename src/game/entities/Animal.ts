import * as Phaser from 'phaser';
import { TUNING } from '../config/tuning';
import { Actor } from './Actor';
import { DEG, Vec, approachAngle, dist } from '../core/math';
import { SH } from '../core/proj';
import type { NavGrid } from '../world/nav';
import type { CollisionWorld } from '../world/collision';

export type AnimalKind = 'raccoon' | 'bear' | 'duck' | 'fox' | 'rabbit' | 'bluejay';

/** Friendly animals (raccoon guide, bear, ...). Never detect the player. */
export class Animal extends Actor {
    goal: Vec | null = null;
    goalSpeed = 1;
    onGoal?: () => void;
    sleeping = false;
    speech: { text: string; t: number } | null = null;
    /** idle marker over the head: '?' = has something to say, '!' = quest */
    marker: '?' | '!' | null = null;
    markerColor = '#ffffff';
    /** keep facing the player when idle */
    watchPlayer = false;
    path: Vec[] | null = null;
    private pathT = 0;
    /** anim shown while standing around ('sit' for the bear by the cave) */
    idleAnim = 'idle';
    /** small birds: hop about, take off when the sasquatch comes close (inside-park §5) */
    private bird = { flying: false, hopT: 1, hop: 0, vx: 0, vy: 0, goneT: 0, home: { x: 0, y: 0 } };

    constructor(
        scene: Phaser.Scene,
        layer: Phaser.GameObjects.Layer,
        public id: string,
        public kind: AnimalKind,
        x: number,
        y: number,
        facingDeg = -90,
        /** rendered look, if not the kind's default atlas (e.g. 'bear_brown') */
        atlas?: string,
    ) {
        const size = kind === 'bear' ? 2.2 : kind === 'raccoon' ? 0.9 : kind === 'bluejay' ? 0.35 : 0.7;
        super(scene, layer, atlas ?? kind, { shadowW: size, placeholderColor: kind === 'bear' ? 0x2a1a12 : 0x6f6f72, height: size });
        this.x = x;
        this.y = y;
        this.facing = facingDeg * DEG;
        this.radius = kind === 'bear' ? 0.7 : kind === 'bluejay' ? 0.08 : 0.22;
        this.headHeight = kind === 'bear' ? 1.6 : kind === 'raccoon' ? 0.55 : kind === 'bluejay' ? 0.3 : 0.45;
        this.bird.home = { x, y };
    }

    private updateBird(dt: number, player: Vec) {
        const b = this.bird;
        if (!this.visible) {
            // land again somewhere near home a while later, out of the sasquatch's way
            b.goneT -= dt;
            if (b.goneT <= 0 && dist(b.home, player) > 9) {
                this.visible = true;
                b.flying = false;
                this.z = 0;
                this.setPosition(b.home.x, b.home.y);
            }
            return;
        }
        if (!b.flying && dist(this, player) < 2.6) {
            b.flying = true;
            const a = Math.atan2(this.y - player.y, this.x - player.x) + (Math.random() - 0.5) * 0.8;
            b.vx = Math.cos(a) * 5.5;
            b.vy = Math.sin(a) * 5.5;
            this.facing = a;
        }
        if (b.flying) {
            this.x += b.vx * dt;
            this.y += b.vy * dt;
            this.z += 2.6 * dt;
            this.anim = this.has('fly') ? 'fly' : 'idle';
            this.animPhase += dt * 12;
            if (this.z > 7) {
                this.visible = false;
                b.goneT = 25;
            }
        } else {
            b.hopT -= dt;
            if (b.hopT <= 0) {
                b.hopT = 0.8 + Math.random() * 2.2;
                this.facing += (Math.random() - 0.5) * 2.2;
                b.hop = 0.25;
            }
            if (b.hop > 0) {
                b.hop = Math.max(0, b.hop - dt);
                this.x += Math.cos(this.facing) * 0.6 * dt;
                this.y += Math.sin(this.facing) * 0.6 * dt;
                if (this.has('hop')) {
                    // the rendered hop carries its own little jump
                    this.anim = 'hop';
                    this.animPhase = (1 - b.hop / 0.25) * 3.99;
                } else {
                    this.z = Math.sin((b.hop / 0.25) * Math.PI) * 0.12;
                    this.anim = 'idle';
                }
            } else {
                this.z = 0;
                this.anim = 'idle';
                this.animPhase += dt * 1.5;
            }
        }
        this.render();
    }

    say(text: string, t: number = TUNING.ui.bubbleTime) {
        this.speech = { text, t };
    }

    walkTo(p: Vec, speedFactor = 1, onGoal?: () => void) {
        this.goal = { ...p };
        this.goalSpeed = speedFactor;
        this.onGoal = onGoal;
        this.path = null;
    }

    update(dt: number, nav: NavGrid, world: CollisionWorld, player: Vec) {
        if (this.speech) {
            this.speech.t -= dt;
            if (this.speech.t <= 0) this.speech = null;
        }
        if (this.kind === 'bluejay') return this.updateBird(dt, player);
        if (this.sleeping) {
            this.anim = 'sleep';
            this.render();
            return;
        }
        if (this.goal) {
            const speed = TUNING.player.walkSpeedSH * SH * this.goalSpeed;
            let aim = this.goal;
            if (!nav.clearLine(this, this.goal)) {
                this.pathT -= dt;
                if (!this.path || this.pathT <= 0) {
                    this.path = nav.path(this, this.goal);
                    this.pathT = 0.8;
                }
                while (this.path && this.path.length > 1 && dist(this, this.path[0]) < 0.3) this.path.shift();
                if (this.path && this.path.length) aim = this.path[0];
            }
            const dx = aim.x - this.x, dy = aim.y - this.y;
            const d = Math.hypot(dx, dy);
            if (dist(this, this.goal) < 0.12) {
                this.goal = null;
                this.anim = 'idle';
                const cb = this.onGoal;
                this.onGoal = undefined;
                cb?.();
            } else {
                const step = Math.min(d, speed * dt);
                const n = world.resolve({ x: this.x + (dx / d) * step, y: this.y + (dy / d) * step }, this.radius);
                const moved = Math.hypot(n.x - this.x, n.y - this.y);
                this.x = n.x;
                this.y = n.y;
                this.facing = approachAngle(this.facing, Math.atan2(dy, dx), 720 * DEG * dt);
                this.anim = 'walk';
                this.animPhase += moved * (this.kind === 'raccoon' ? 6 : 2.4);
            }
        } else {
            this.anim = this.has(this.idleAnim) ? this.idleAnim : 'idle';
            this.animPhase += dt * 2;
            if (this.watchPlayer) {
                this.facing = approachAngle(this.facing, Math.atan2(player.y - this.y, player.x - this.x), 360 * DEG * dt);
            }
        }
        this.render();
    }
}
