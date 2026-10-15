import * as Phaser from 'phaser';
import { TUNING } from '../config/tuning';
import { Actor } from './Actor';
import { DEG, Vec, approachAngle, dist, rng } from '../core/math';
import { SH } from '../core/proj';
import { PerceptionState, newPerception } from '../systems/perception';
import type { NavGrid } from '../world/nav';
import type { CollisionWorld } from '../world/collision';

export type HumanKind = 'camper' | 'ranger';
export type HumanState = 'normal' | 'investigate' | 'watch' | 'chase' | 'search' | 'return' | 'flee' | 'scripted' | 'capturing' | 'track';

let seedCounter = 1;

export class Human extends Actor {
    perc: PerceptionState = newPerception();
    state: HumanState = 'normal';
    behaviour: 'idle' | 'patrol' | 'sleep' | 'sit' | 'read' | 'wander' | 'scripted';
    sleeping = false;
    home: Vec;
    homeFacing: number;
    route: Vec[] = [];
    routeIdx = 0;
    wait = 0;
    lookTimer = 2;
    lookGoal: number;
    path: Vec[] | null = null;
    pathTimer = 0;
    pathGoal: Vec | null = null;
    searchTimer = 0;
    /** set by scripts: walk here then call back */
    goal: Vec | null = null;
    goalSpeed = 1;
    onGoal?: () => void;
    speech: { text: string; t: number } | null = null;
    /** did this NPC see the player this frame */
    seesPlayer = false;
    /** tutorial ranger: touching the player doesn't catch him */
    noCapture = false;
    /** behaviour at spawn (a woken sleeper lies back down when he gets home) */
    homeBehaviour: Human['behaviour'] = 'idle';
    /** seconds since being woken by noise, counting down; tracking starts if you're not in sight by then */
    wokeT = 0;
    /** footprint tracking: timestamp of the last print reached */
    trackStamp = 0;
    /** point-of-interest marker over the head ("?" / "!") while the NPC isn't sensing you */
    marker: string | null = null;
    markerColor = '#ffffff';
    /** give up a chase once this far (m) from home; 0 = no leash */
    leash = 0;
    /** multiplies TUNING.rangerDanger.chaseSpeedFactor for this NPC */
    chaseFactor = 1;
    private r = rng(seedCounter++ * 977);

    constructor(
        scene: Phaser.Scene,
        layer: Phaser.GameObjects.Layer,
        public id: string,
        public kind: HumanKind,
        atlas: string,
        x: number,
        y: number,
        facingDeg: number,
        behaviour: Human['behaviour'],
    ) {
        super(scene, layer, atlas, { shadowW: 0.8, placeholderColor: kind === 'ranger' ? 0x5a7a3a : 0x3a6ab0, height: 1.8 });
        this.x = x;
        this.y = y;
        this.facing = facingDeg * DEG;
        this.home = { x, y };
        this.homeFacing = this.facing;
        this.lookGoal = this.facing;
        this.behaviour = behaviour;
        this.homeBehaviour = behaviour;
        this.sleeping = behaviour === 'sleep';
        this.radius = 0.28;
        this.headHeight = 1.75;
        if (this.sleeping) this.anim = 'sleep';
    }

    /** asleep in a chair / on the ground ('sleep') or tucked into a bed ('sleepBed') */
    sleepAnim = 'sleep';

    get authority() {
        return this.kind === 'ranger';
    }

    get walkSpeed() {
        return TUNING.player.walkSpeedSH * SH;
    }

    say(text: string, t: number = TUNING.ui.bubbleTime) {
        this.speech = { text, t };
    }

    /** Move toward a point using the nav grid when the direct line is blocked. Returns true on arrival. */
    moveToward(target: Vec, speed: number, dt: number, nav: NavGrid, world: CollisionWorld, arrive = 0.25): boolean {
        const d = dist(this, target);
        if (d <= arrive) return true;
        let aim = target;
        if (!nav.clearLine(this, target)) {
            this.pathTimer -= dt;
            if (!this.path || this.pathTimer <= 0 || !this.pathGoal || dist(this.pathGoal, target) > 1) {
                this.path = nav.path(this, target);
                this.pathGoal = { ...target };
                this.pathTimer = 0.6;
            }
            while (this.path && this.path.length && dist(this, this.path[0]) < 0.3) this.path.shift();
            if (this.path && this.path.length) aim = this.path[0];
        } else {
            this.path = null;
        }
        const ax = aim.x - this.x, ay = aim.y - this.y;
        const al = Math.hypot(ax, ay) || 1;
        const step = Math.min(speed * dt, al);
        const ox = this.x, oy = this.y;
        const next = world.resolve({ x: this.x + (ax / al) * step, y: this.y + (ay / al) * step }, this.radius);
        this.x = next.x;
        this.y = next.y;
        const moved = Math.hypot(this.x - ox, this.y - oy);
        if (moved > 1e-4) {
            this.facing = approachAngle(this.facing, Math.atan2(ay, ax), TUNING.detection.npcTurnSpeedDeg * 2 * DEG * dt);
            this.anim = 'walk';
            this.animPhase += moved * TUNING.player.walkFramesPerMetre * 1.1;
        }
        return false;
    }

    turnTo(angle: number, dt: number, speedDeg: number = TUNING.detection.npcTurnSpeedDeg) {
        this.facing = approachAngle(this.facing, angle, speedDeg * DEG * dt);
    }

    wake() {
        if (!this.sleeping) return;
        this.sleeping = false;
        this.anim = 'idle';
        this.behaviour = 'idle';
        this.wokeT = 0.8;
    }

    /** Normal (non-alert) behaviour. */
    updateNormal(dt: number, nav: NavGrid, world: CollisionWorld) {
        const N = TUNING.npc;
        if (this.goal) {
            if (this.moveToward(this.goal, this.walkSpeed * this.goalSpeed, dt, nav, world, 0.15)) {
                this.goal = null;
                this.anim = 'idle';
                const cb = this.onGoal;
                this.onGoal = undefined;
                cb?.();
            }
            return;
        }
        switch (this.behaviour) {
            case 'sleep':
                this.anim = this.sleepAnim;
                return;
            case 'sit':
                this.anim = 'sit';
                this.lookAround(dt, 40);
                return;
            case 'read':
                // nose in the newspaper: no looking around
                this.anim = this.has('read') ? 'read' : 'sit';
                return;
            case 'patrol': {
                if (!this.route.length) return this.lookAround(dt, N.lookAroundMaxDeg);
                if (this.wait > 0) {
                    this.wait -= dt;
                    this.anim = 'idle';
                    this.lookAround(dt, N.lookAroundMaxDeg);
                    return;
                }
                const t = this.route[this.routeIdx];
                const speed = this.walkSpeed * (this.kind === 'ranger' ? N.rangerPatrolFactor : N.camperWalkFactor);
                if (this.moveToward(t, speed, dt, nav, world)) {
                    this.routeIdx = (this.routeIdx + 1) % this.route.length;
                    this.wait = this.r.range(1.5, 4);
                    this.lookGoal = this.facing;
                }
                return;
            }
            case 'wander': {
                if (this.wait > 0) {
                    this.wait -= dt;
                    this.anim = 'idle';
                    this.lookAround(dt, N.lookAroundMaxDeg);
                    return;
                }
                if (!this.route.length) {
                    const a = this.r.range(0, Math.PI * 2), rr = this.r.range(1, 4);
                    this.route = [{ x: this.home.x + Math.cos(a) * rr, y: this.home.y + Math.sin(a) * rr }];
                }
                if (this.moveToward(this.route[0], this.walkSpeed * N.camperWalkFactor, dt, nav, world)) {
                    this.route = [];
                    this.wait = this.r.range(2, 6);
                    this.lookGoal = this.facing;
                }
                return;
            }
            default:
                this.anim = 'idle';
                this.lookAround(dt, N.lookAroundMaxDeg);
        }
    }

    lookAround(dt: number, maxDeg: number) {
        this.lookTimer -= dt;
        if (this.lookTimer <= 0) {
            const [a, b] = TUNING.npc.lookAroundInterval;
            this.lookTimer = this.r.range(a, b);
            const base = this.behaviour === 'patrol' ? this.facing : this.homeFacing;
            this.lookGoal = base + this.r.range(-maxDeg, maxDeg) * DEG;
        }
        this.turnTo(this.lookGoal, dt, 140);
    }

    updateSpeech(dt: number) {
        if (this.speech) {
            this.speech.t -= dt;
            if (this.speech.t <= 0) this.speech = null;
        }
    }
}
