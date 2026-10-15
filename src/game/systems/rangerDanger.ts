import { TUNING } from '../config/tuning';
import { Vec, dist, rng } from '../core/math';
import { SH } from '../core/proj';
import { Actor } from '../entities/Actor';
import type { World } from '../scenes/World';
import type { Human } from '../entities/Human';

/**
 * Area-wide "RANGER DANGER!" state (measured behaviour):
 *  - banner 0.1 s after a meter turns fully red (pop 0.2 / hold 3 / fade 1 s)
 *  - 1–2 rangers dispatched from off-screen (on foot ~1.6 s, or by jeep ~4 s)
 *  - rangers chase at ~walk speed; contact = capture
 *  - alarmed NPCs forget ~10 s after losing sight; leaving the area clears it
 */
export class RangerDanger {
    active = false;
    unseen = 0;
    private pending: { t: number; spawn: { x: number; y: number } }[] = [];
    /** ranger jeeps on their way in (outside-park t69.0: drives in, ranger jumps out) */
    private jeeps: { actor: Actor; route: Vec[]; seg: number; t: number; wait: number }[] = [];
    private r = rng(4242);
    private bannerT = -1;

    constructor(private w: World) {}

    trigger(witness: Human | null) {
        const RD = TUNING.rangerDanger;
        const p = this.w.player;
        // every human in the area now knows where the sasquatch is
        for (const h of this.w.humans) {
            if (h.kind === 'ranger' && h.state !== 'scripted') {
                h.perc.alarmed = true;
                h.perc.memory = TUNING.detection.alertedMemoryTime;
                h.perc.lastSeen = { x: p.x, y: p.y };
                h.wake();
                h.state = 'chase';
            }
        }
        if (this.active) return;
        this.active = true;
        this.unseen = 0;
        this.bannerT = TUNING.detection.alarmBannerDelay;
        this.w.sfx('ranger_danger');
        if (witness) witness.perc.lastSeen = { x: p.x, y: p.y };
        if (this.w.zone.rangersRespond === false) return;
        const [lo, hi] = RD.rangersDispatched;
        const n = this.r.int(lo, hi);
        const spawns = this.w.rangerSpawnPoints();
        const routes = this.w.zone.jeepRoutes ?? [];
        let jeepSent = false;
        for (let i = 0; i < n && spawns.length; i++) {
            // one ranger may come by jeep where there's a road in [guess: jeepChance]
            if (!jeepSent && routes.length && this.r.next() < RD.jeepChance) {
                jeepSent = true;
                const route = routes[Math.floor(this.r.next() * routes.length)];
                this.sendJeep(route);
                continue;
            }
            // prefer spawn points away from the player but not absurdly far
            spawns.sort((a, b) => dist(a, p) - dist(b, p));
            const s = spawns[Math.min(i, spawns.length - 1)];
            this.pending.push({ t: RD.footArrivalDelay * this.r.range(0.4, 0.8), spawn: s });
        }
    }

    /** the jeep sets off so that it pulls up 3.4-4.6 s after the alarm [measured] */
    private sendJeep(route: Vec[]) {
        const RD = TUNING.rangerDanger;
        let len = 0;
        for (let i = 1; i < route.length; i++) len += dist(route[i - 1], route[i]);
        const arrive = this.r.range(RD.jeepArrivalDelay[0], RD.jeepArrivalDelay[1]);
        const wait = Math.max(0, arrive - len / (RD.jeepSpeedSH * SH));
        const actor = new Actor(this.w, this.w.objLayer, 'jeep_ranger', { shadowW: 2.3, shadowH: 0.6, placeholderColor: 0x2e6a35, height: 1.6 });
        actor.x = route[0].x;
        actor.y = route[0].y;
        actor.facing = Math.atan2(route[1].y - route[0].y, route[1].x - route[0].x);
        actor.visible = false;
        actor.render();
        this.jeeps.push({ actor, route, seg: 0, t: 0, wait });
    }

    private updateJeeps(dt: number) {
        const v = TUNING.rangerDanger.jeepSpeedSH * SH;
        for (const j of this.jeeps.slice()) {
            if (j.wait > 0) {
                j.wait -= dt;
                continue;
            }
            j.actor.visible = true;
            if (j.seg >= j.route.length - 1) continue; // parked
            const a = j.route[j.seg], b = j.route[j.seg + 1];
            const L = dist(a, b) || 1;
            j.t += v * dt;
            if (j.t >= L) {
                j.t -= L;
                j.seg++;
                if (j.seg >= j.route.length - 1) {
                    // pulled up: the ranger jumps out and gives chase
                    const end = j.route[j.route.length - 1];
                    j.actor.setPosition(end.x, end.y);
                    j.actor.render();
                    const side = j.actor.facing + Math.PI / 2;
                    const h = this.w.spawnRanger(end.x + Math.cos(side) * 1.2, end.y + Math.sin(side) * 1.2, true);
                    h.state = 'chase';
                    h.perc.alarmed = true;
                    h.perc.memory = TUNING.detection.alertedMemoryTime;
                    h.perc.lastSeen = { x: this.w.player.x, y: this.w.player.y };
                    continue;
                }
            }
            const A = j.route[j.seg], B = j.route[j.seg + 1];
            const k = Math.min(1, j.t / (dist(A, B) || 1));
            j.actor.setPosition(A.x + (B.x - A.x) * k, A.y + (B.y - A.y) * k);
            j.actor.facing = Math.atan2(B.y - A.y, B.x - A.x);
            j.actor.render();
        }
    }

    update(dt: number) {
        if (this.bannerT >= 0) {
            this.bannerT -= dt;
            if (this.bannerT < 0) this.w.hud.banner.show('RANGER DANGER!');
        }
        this.updateJeeps(dt);
        if (!this.active) return;
        for (const pd of this.pending) {
            pd.t -= dt;
            if (pd.t <= 0) {
                const h = this.w.spawnRanger(pd.spawn.x, pd.spawn.y, true);
                h.state = 'chase';
                h.perc.alarmed = true;
                h.perc.memory = TUNING.detection.alertedMemoryTime;
                h.perc.lastSeen = { x: this.w.player.x, y: this.w.player.y };
            }
        }
        this.pending = this.pending.filter((p) => p.t > 0);

        const anySee = this.w.humans.some((h) => h.kind === 'ranger' && h.seesPlayer);
        this.unseen = anySee ? 0 : this.unseen + dt;
        const chasing = this.w.humans.some((h) => h.kind === 'ranger' && (h.state === 'chase' || h.state === 'search'));
        if (this.unseen >= TUNING.rangerDanger.clearAfterUnseen && !chasing && !this.pending.length) this.end();
    }

    /** Clears everything (area change, capture, timeout). */
    end() {
        this.active = false;
        this.pending = [];
        // jeeps still on the way turn back (parked ones stay till the area unloads)
        this.jeeps = this.jeeps.filter((j) => {
            if (j.wait > 0 || j.seg < j.route.length - 1) {
                j.actor.destroy();
                return false;
            }
            return true;
        });
        this.unseen = 0;
        for (const h of this.w.humans) {
            h.perc.alarmed = false;
            h.perc.meter = 0;
            h.perc.glyph = null;
            if (h.state === 'chase' || h.state === 'search' || h.state === 'watch' || h.state === 'flee') h.state = 'return';
        }
    }

    /** new area: forget any jeeps (their sprites went with the old area) */
    clearJeeps() {
        this.jeeps = [];
    }

    /** distance within which a chasing ranger catches the player (metres) */
    get captureDistance() {
        return TUNING.rangerDanger.captureDistanceSH * SH;
    }
}
