import * as Phaser from 'phaser';
import { TUNING } from '../config/tuning';
import { G } from '../core/state';
import { Settings } from '../core/settings';
import { DEG, Vec, pointInPoly } from '../core/math';
import { wx, wy } from '../core/proj';
import { patchPolygon } from '../world/ground';
import { Vehicle, VehicleKind } from '../entities/Vehicle';
import type { World } from '../scenes/World';
import type { ZoneDef } from '../world/types';

/**
 * Vehicles in the current area: parked karts, the one the sasquatch is driving,
 * skid marks, exhaust puffs and dust (outside-park §4). The kart you drive goes
 * with you through area exits; one you leave behind stays where you parked it.
 */
export class VehicleSystem {
    list: Vehicle[] = [];
    driving: Vehicle | null = null;
    private marks: { img: Phaser.GameObjects.Rectangle; t: number }[] = [];
    private asphalt: Vec[][] = [];
    private puffT = 0;
    private dustT = 0;
    private markT = 0;

    constructor(private w: World) {}

    /** called by World.loadZone once the player exists */
    spawn(def: ZoneDef) {
        this.list = [];
        this.driving = null;
        this.marks = [];
        this.asphalt = def.ground.filter((g) => g.kind === 'asphalt').map((g) => patchPolygon(g));
        const parked = G.save.parked;
        for (const v of def.vehicles ?? []) {
            const rec = parked[v.id];
            if (rec && rec.zone !== def.id) continue; // left in another area
            if (G.save.driving === v.id) continue; // arriving with us below
            const veh = this.add(v.id, v.kind, rec?.x ?? v.x, rec?.y ?? v.y, rec ? rec.h : v.facing ?? 0);
            veh.locked = !!v.locked;
        }
        for (const [id, rec] of Object.entries(parked)) {
            if (rec.zone !== def.id || this.list.some((q) => q.id === id) || G.save.driving === id) continue;
            this.add(id, rec.kind as VehicleKind, rec.x, rec.y, rec.h);
        }
        if (G.save.driving) {
            // drove in through the exit: we arrive seated
            const kind = (parked[G.save.driving]?.kind ?? 'kart') as VehicleKind;
            const p = this.w.player;
            const v = this.add(G.save.driving, kind, p.x, p.y, (p.facing * 180) / Math.PI);
            this.seat(v, false);
        }
    }

    add(id: string, kind: VehicleKind, x: number, y: number, facingDeg: number) {
        const v = new Vehicle(this.w, this.w.objLayer, id, kind, x, y, facingDeg);
        this.list.push(v);
        v.render();
        return v;
    }

    /** the nearest kart you could get into, for the interaction prompt */
    candidate(p: Vec) {
        if (this.driving) return null;
        let best: Vehicle | null = null, bd = Infinity;
        for (const v of this.list) {
            const d = Math.hypot(v.x - p.x, v.y - p.y);
            if (d < v.spec.promptRange && d < bd) {
                bd = d;
                best = v;
            }
        }
        return best ? { v: best, d: bd } : null;
    }

    enter(v: Vehicle) {
        if (v.locked || this.driving) return;
        this.w.sfx('door');
        this.seat(v, true);
    }

    private seat(v: Vehicle, flash: boolean) {
        const p = this.w.player;
        this.driving = v;
        v.occupied = true;
        p.stop();
        p.mode = 'vehicle';
        p.ghost = true;
        p.setPosition(v.x, v.y);
        G.save.driving = v.id;
        delete G.save.parked[v.id];
        if (flash) this.w.hud.fuel.flash(TUNING.vehicles.fuelLevel, TUNING.vehicles.fuelFlash);
    }

    /** step out on the kart's left side (outside-park t406.6) */
    exit() {
        const v = this.driving;
        if (!v) return;
        const p = this.w.player;
        const sides = [Math.PI / 2, -Math.PI / 2, Math.PI, 0];
        let spot = { x: v.x, y: v.y };
        for (const a of sides) {
            const c = { x: v.x + Math.cos(v.facing + a) * 1.1, y: v.y + Math.sin(v.facing + a) * 1.1 };
            if (this.w.collision.isFree(c, p.radius)) {
                spot = c;
                break;
            }
        }
        this.driving = null;
        v.occupied = false;
        v.vx = v.vy = v.speed = 0;
        p.setPosition(spot.x, spot.y);
        p.facing = v.facing;
        p.mode = 'idle';
        p.ghost = false;
        G.save.driving = null;
        G.save.parked[v.id] = { kind: v.kind, zone: this.w.zone.id, x: v.x, y: v.y, h: (v.facing * 180) / Math.PI };
        this.w.sfx('door');
    }

    get speedFrac() {
        const v = this.driving;
        return v ? Math.min(1, v.groundSpeed / v.topSpeed) : 0;
    }

    update(dt: number, frozen: boolean) {
        const w = this.w;
        for (const v of this.list) {
            if (v === this.driving) {
                if (frozen) {
                    v.render();
                    continue;
                }
                v.drive(dt, w.inCloseUp ? null : w.controls, w.collision, () => w.pointerGround());
                this.bump(v);
                w.player.setPosition(v.x, v.y);
                w.player.facing = v.facing;
                w.player.render();
            } else if (!frozen) v.coast(dt, w.collision);
        }
        // exhaust, skid marks and dust are cosmetic: skipped in optimization mode
        if (!frozen && !Settings.optimize) this.effects(dt);
        for (const m of this.marks) {
            m.t -= dt;
            if (m.t < 5) m.img.setAlpha(0.55 * Math.max(0, m.t / 5));
        }
        while (this.marks.length && this.marks[0].t <= 0) this.marks.shift()!.img.destroy();
    }

    /** the driven kart against the other vehicles here: it's pushed out, and parked karts get shoved (outside-park §4.2) */
    private bump(v: Vehicle) {
        for (const o of this.list) {
            if (o === v) continue;
            const light = o.kind === 'kart' && !o.locked;
            // cars are long: two circles along the body instead of one
            const cx = Math.cos(o.facing) * 0.8, cy = Math.sin(o.facing) * 0.8;
            const parts = o.kind === 'kart' ? [{ x: o.x, y: o.y, r: o.radius }] : [-1, 1].map((k) => ({ x: o.x + cx * k, y: o.y + cy * k, r: 0.8 }));
            for (const c of parts) {
                const dx = v.x - c.x, dy = v.y - c.y;
                const d = Math.hypot(dx, dy) || 1, min = v.radius + c.r;
                if (d >= min) continue;
                const mine = light ? (min - d) * 0.5 : min - d;
                v.x += (dx / d) * mine;
                v.y += (dy / d) * mine;
                v.bounce(dx, dy);
                if (light) {
                    o.vx -= (dx / d) * 2;
                    o.vy -= (dy / d) * 2;
                }
            }
        }
    }

    private onAsphalt(p: Vec) {
        return this.asphalt.some((poly) => pointInPoly(p, poly));
    }

    private effects(dt: number) {
        const V = TUNING.vehicles;
        const w = this.w;
        for (const v of this.list) {
            const moving = v.groundSpeed > 0.3;
            if (!v.occupied && !moving) continue;
            const back = { x: v.x - Math.cos(v.facing) * 0.6, y: v.y - Math.sin(v.facing) * 0.6 };
            // exhaust: a constant trail of small grey-white puffs
            this.puffT -= dt;
            if (this.puffT <= 0) {
                this.puffT = 0.12;
                const c = w.add.circle(wx(back.x), wy(back.y, 0.35), 7, 0xe8ecec, 0.6);
                w.objLayer.add(c);
                c.setDepth(1e7 - 1);
                w.tweens.add({ targets: c, y: c.y - 26, scale: 2.2, alpha: 0, duration: 650, onComplete: () => c.destroy() });
            }
            const asphalt = this.onAsphalt(v);
            // skid marks from both rear tyres while sliding
            if (v.skidding) {
                this.markT -= dt;
                if (this.markT <= 0) {
                    this.markT = 0.03;
                    for (const side of [-1, 1]) {
                        const sx = back.x + Math.cos(v.facing + Math.PI / 2) * 0.32 * side;
                        const sy = back.y + Math.sin(v.facing + Math.PI / 2) * 0.32 * side;
                        const r = w.add.rectangle(wx(sx), wy(sy), 8, 22, asphalt ? V.skidAsphalt : V.skidDirt, 0.55);
                        r.setRotation(Math.atan2(Math.cos(v.facing), Math.sin(v.facing) * 0.79));
                        w.groundLayer.add(r);
                        r.setDepth(1.9e6);
                        this.marks.push({ img: r, t: V.skidLife });
                        if (this.marks.length > 600) this.marks.shift()!.img.destroy();
                    }
                }
            }
            // dust on dirt/grass when sliding or pulling away hard
            if (!asphalt && moving && (v.skidding || (v.occupied && v.speed > v.groundSpeed + 1.5))) {
                this.dustT -= dt;
                if (this.dustT <= 0) {
                    this.dustT = 0.08;
                    const c = w.add.circle(wx(back.x) + (Math.random() - 0.5) * 30, wy(back.y, 0.2), 30 + Math.random() * 20, 0xb07a40, 0.35);
                    w.objLayer.add(c);
                    c.setDepth(1e7 - 2);
                    w.tweens.add({ targets: c, scale: 1.8, alpha: 0, y: c.y - 20, duration: 900, onComplete: () => c.destroy() });
                }
            }
        }
    }

    /** heading in degrees for spawn bookkeeping */
    static deg(rad: number) {
        return rad / DEG;
    }
}
