import { TUNING } from '../config/tuning';
import { Vec } from '../core/math';
import { Settings } from '../core/settings';
import { SH, depthFor, wx, wy } from '../core/proj';
import { Actor } from '../entities/Actor';
import { Human } from '../entities/Human';
import type { World } from '../scenes/World';
import type { ZoneDef } from '../world/types';

/**
 * NPC road traffic (outside-park §1, §4.4): cars spawn at a lane's start, drive
 * its polyline at ≈2× walking speed and vanish at the end. Each car carries a
 * hidden driver — an ordinary Human perceiver riding along, so drivers get the
 * usual eye icons and can raise the alarm (E01-E06, E14). A car brakes for
 * anything standing or parked in its lane and pulls away again once it's clear.
 */
export interface Lane {
    id: string;
    pts: Vec[];
    /** seconds between cars (random in range) */
    every: [number, number];
    /** body colours to pick from */
    colors?: number[];
    /** atlas keys to pick from (when rendered); falls back to a coloured placeholder */
    looks?: string[];
    /** closed circuit (race track): `count` cars spread round it from the start, lapping for ever */
    loop?: boolean;
    count?: number;
    /** cruising speed override (SH/s) */
    speedSH?: number;
}

interface Car {
    actor: Actor;
    driver: Human;
    lane: Lane;
    seg: number;
    t: number;          // distance along the current segment (m)
    speed: number;
    puffT: number;
    /** seconds until this driver can complain about being rammed again */
    rammed: number;
}

const RAM_LINES = ['Stop ramming into my vehicle!', 'FENDER BENDER!'];

export class TrafficSystem {
    private lanes: Lane[] = [];
    private timers: number[] = [];
    cars: Car[] = [];
    private n = 0;

    constructor(private w: World) {}

    spawn(def: ZoneDef) {
        this.cars = [];
        this.lanes = def.lanes ?? [];
        // stagger the first cars so the road isn't empty when you arrive
        this.timers = this.lanes.map((l) => (l.loop ? Infinity : Math.random() * l.every[0]));
        for (const l of this.lanes) {
            for (let i = 0; i < (l.loop ? l.count ?? 1 : 0); i++) this.addCar(l, Math.floor(((l.pts.length - 1) * i) / (l.count ?? 1)));
        }
    }

    private addCar(lane: Lane, seg = 0) {
        const T = TUNING.traffic;
        const p0 = lane.pts[seg], p1 = lane.pts[seg + 1];
        const h = Math.atan2(p1.y - p0.y, p1.x - p0.x);
        const look = lane.looks?.length ? lane.looks[Math.floor(Math.random() * lane.looks.length)] : 'car_sedan';
        const color = lane.colors?.length ? lane.colors[Math.floor(Math.random() * lane.colors.length)] : 0x8a8f96;
        const actor = new Actor(this.w, this.w.objLayer, look, { shadowW: 2.2, shadowH: 0.55, placeholderColor: color, height: 1.4 });
        actor.x = p0.x;
        actor.y = p0.y;
        actor.facing = h;
        actor.radius = 0.9;
        const driver = new Human(this.w, this.w.objLayer, `driver_${lane.id}_${this.n++}`, 'camper', 'camper_b', p0.x, p0.y, (h * 180) / Math.PI, 'scripted');
        driver.ghost = true;
        driver.state = 'normal';
        driver.headHeight = 1.5;
        this.w.humans.push(driver);
        this.cars.push({ actor, driver, lane, seg, t: 0, speed: (lane.speedSH ?? T.speedSH) * SH, puffT: 0, rammed: 0 });
    }

    /** is anything in the way just ahead of this car? */
    private blocked(c: Car, hx: number, hy: number) {
        const T = TUNING.traffic;
        const things: Vec[] = [this.w.player, ...this.w.vehicles.list];
        for (const o of [...things, ...this.cars.filter((q) => q !== c).map((q) => q.actor)]) {
            const dx = o.x - c.actor.x, dy = o.y - c.actor.y;
            const ahead = dx * hx + dy * hy;
            const side = Math.abs(-dx * hy + dy * hx);
            if (ahead > 0.4 && ahead < T.brakeDistance && side < 1.3) return true;
        }
        return false;
    }

    update(dt: number, frozen: boolean) {
        if (frozen) return;
        const T = TUNING.traffic;
        this.lanes.forEach((l, i) => {
            this.timers[i] -= dt;
            if (this.timers[i] <= 0) {
                this.timers[i] = l.every[0] + Math.random() * (l.every[1] - l.every[0]);
                this.addCar(l);
            }
        });
        for (const c of this.cars.slice()) {
            const pts = c.lane.pts;
            const a = pts[c.seg], b = pts[c.seg + 1];
            const segLen = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            const hx = (b.x - a.x) / segLen, hy = (b.y - a.y) / segLen;
            const cruise = (c.lane.speedSH ?? T.speedSH) * SH;
            const want = this.blocked(c, hx, hy) ? 0 : cruise;
            const acc = cruise / (want > c.speed ? T.accelTime : T.brakeTime);
            c.speed = want > c.speed ? Math.min(want, c.speed + acc * dt) : Math.max(want, c.speed - acc * dt);
            c.t += c.speed * dt;
            while (c.t >= segLen && (c.lane.loop || c.seg < pts.length - 2)) {
                c.t -= segLen;
                c.seg = (c.seg + 1) % (pts.length - 1);
            }
            const A = pts[c.seg], B = pts[c.seg + 1];
            const L = Math.hypot(B.x - A.x, B.y - A.y) || 1;
            if (c.seg >= pts.length - 2 && c.t >= L) {
                // off the end of the road
                c.actor.destroy();
                this.w.removeHuman(c.driver.id);
                this.cars.splice(this.cars.indexOf(c), 1);
                continue;
            }
            const k = Math.min(1, c.t / L);
            c.actor.x = A.x + (B.x - A.x) * k;
            c.actor.y = A.y + (B.y - A.y) * k;
            const h = Math.atan2(B.y - A.y, B.x - A.x);
            c.actor.facing = h;
            c.actor.render();
            // the driver rides along, looking where the car goes
            c.driver.setPosition(c.actor.x, c.actor.y);
            if (c.driver.state === 'normal') c.driver.facing = h;
            this.ram(c, dt);
            // exhaust puffs (outside-park §4.2)
            c.puffT -= dt;
            if (c.puffT <= 0 && !Settings.optimize) {
                c.puffT = 0.14;
                const bx = c.actor.x - Math.cos(h) * 1.6, by = c.actor.y - Math.sin(h) * 1.6;
                const p = this.w.add.circle(wx(bx), wy(by, 0.35), 8, 0xe8ecec, 0.55);
                this.w.objLayer.add(p);
                p.setDepth(depthFor(by) + 1);
                this.w.tweens.add({ targets: p, y: p.y - 26, scale: 2.2, alpha: 0, duration: 650, onComplete: () => p.destroy() });
            }
        }
    }

    /** the sasquatch's kart bumping a car: shove the kart off and the driver complains (o28, o29) */
    private ram(c: Car, dt: number) {
        c.rammed -= dt;
        const v = this.w.vehicles.driving;
        if (!v) return;
        const dx = v.x - c.actor.x, dy = v.y - c.actor.y;
        const d = Math.hypot(dx, dy) || 1, min = v.radius + c.actor.radius + 0.3;
        if (d >= min) return;
        v.x += (dx / d) * (min - d);
        v.y += (dy / d) * (min - d);
        if (c.rammed <= 0 && v.groundSpeed > 2) {
            c.rammed = 6;
            c.driver.say(RAM_LINES[Math.floor(Math.random() * RAM_LINES.length)]);
        }
    }

    unload() {
        for (const c of this.cars) c.actor.destroy();
        this.cars = [];
    }
}

