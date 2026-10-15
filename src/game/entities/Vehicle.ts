import * as Phaser from 'phaser';
import { TUNING } from '../config/tuning';
import { Actor } from './Actor';
import { DEG, Vec, approachAngle, len } from '../core/math';
import { SH } from '../core/proj';
import type { Controls } from '../core/input';
import type { CollisionWorld } from '../world/collision';

/** atlas key of the vehicle: 'kart', or a car look like 'car_sedan_black' (parked, locked) */
export type VehicleKind = string;

/**
 * A drivable vehicle (outside-park §4). Rendered like characters: a Blender atlas
 * in 9 directions mirrored to 16 (`idle_<dir>_0`). Handling is a simple arcade
 * model: the heading swings toward where you steer, speed eases to the top speed
 * while you hold the throttle, and the velocity follows the heading with limited
 * grip — the slip in between is the drift that leaves skid marks.
 */
export class Vehicle extends Actor {
    vx = 0;
    vy = 0;
    /** forward speed setpoint (m/s) */
    speed = 0;
    occupied = false;
    locked = false;
    /** set each frame: tyres are sliding */
    skidding = false;
    readonly spec: { topSpeedSH: number; accelTime: number; brakeTime: number; turnRateDeg: number; grip: number; skidSlipDeg: number; radius: number; promptRange: number };

    constructor(
        scene: Phaser.Scene,
        layer: Phaser.GameObjects.Layer,
        public id: string,
        public kind: VehicleKind,
        x: number,
        y: number,
        facingDeg = 0,
    ) {
        const isKart = kind === 'kart';
        super(scene, layer, kind, { shadowW: isKart ? 1.3 : 2.4, shadowH: isKart ? 0.7 : 0.6, placeholderColor: isKart ? 0x5fd8cf : 0x8a8f96, height: isKart ? 0.9 : 1.5 });
        this.spec = isKart ? TUNING.vehicles.kart : { ...TUNING.vehicles.kart, radius: 1.0, promptRange: TUNING.vehicles.kart.promptRange + 0.5 };
        this.x = x;
        this.y = y;
        this.facing = facingDeg * DEG;
        this.radius = this.spec.radius;
        this.headHeight = 1.4;
    }

    get topSpeed() {
        return this.spec.topSpeedSH * SH;
    }

    /** current ground speed (m/s) */
    get groundSpeed() {
        return len(this.vx, this.vy);
    }

    /**
     * Steering input comes from the keys, or from holding the pointer: drive toward
     * the cursor, like walking. `pointerGround` gives the cursor on the ground.
     */
    drive(dt: number, controls: Controls | null, world: CollisionWorld, pointerGround: () => Vec | null) {
        const S = this.spec;
        let dir: Vec | null = null;
        if (controls) {
            const k = controls.keyVector();
            if (k.x || k.y) dir = k;
            else if (controls.pointerDown) {
                const g = pointerGround();
                if (g) {
                    const dx = g.x - this.x, dy = g.y - this.y, d = len(dx, dy);
                    if (d > 0.6) dir = { x: dx / d, y: dy / d };
                }
            }
        }
        const top = this.topSpeed;
        if (dir) {
            const want = Math.atan2(dir.y, dir.x);
            // tighter at low speed, still donut-capable at full speed
            const rate = S.turnRateDeg * DEG * (0.6 + 0.4 * Math.min(1, this.groundSpeed / top + 0.3));
            this.facing = approachAngle(this.facing, want, rate * dt);
            this.speed = Math.min(top, this.speed + (top / S.accelTime) * dt);
        } else {
            this.speed = Math.max(0, this.speed - (top / S.brakeTime) * dt);
        }
        // velocity chases the heading: limited grip = drift
        const hx = Math.cos(this.facing) * this.speed, hy = Math.sin(this.facing) * this.speed;
        const g = 1 - Math.exp(-S.grip * dt * (dir ? 1 : 3));
        this.vx += (hx - this.vx) * g;
        this.vy += (hy - this.vy) * g;
        const sp = this.groundSpeed;
        const slip = sp > 0.5 ? Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(this.vy, this.vx) - this.facing)) : 0;
        this.skidding = sp > 3 && slip > S.skidSlipDeg * DEG;
        // move, sliding along obstacles. The recording shows karts ploughing through trees
        // (outside-park §4.2); we make vegetation solid on request
        const want = { x: this.x + this.vx * dt, y: this.y + this.vy * dt };
        const n = world.resolve(want, this.radius);
        this.bounce(n.x - want.x, n.y - want.y);
        this.x = n.x;
        this.y = n.y;
        this.anim = 'idle';
        this.render();
    }

    /** we were pushed out by (px, py): drop the velocity into the obstacle (with a little bounce); only a hard knock costs forward speed */
    bounce(px: number, py: number) {
        const pl = Math.hypot(px, py);
        if (pl < 1e-3) return;
        const nx = px / pl, ny = py / pl;
        const vn = this.vx * nx + this.vy * ny;
        if (vn < 0) {
            this.vx -= vn * nx * 1.25;
            this.vy -= vn * ny * 1.25;
            if (-vn > 3) this.speed *= 0.55;
        }
    }

    /** parked: bleed off any leftover motion */
    coast(dt: number, world: CollisionWorld) {
        if (this.groundSpeed < 0.01) {
            this.vx = this.vy = 0;
            this.render();
            return;
        }
        this.speed = 0;
        this.drive(dt, null, world, () => null);
    }
}
