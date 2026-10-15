import * as Phaser from 'phaser';
import { TUNING } from '../config/tuning';
import { L } from '../ui/layout';
import { BackpackButton, BackpackPicker, BadgeToast, Banner, Bubble, CoinCounter, DialogBox, GhostPointer, HungerMeter, Indicator, Iris, Prompt, ThoughtBubble, Toast, ObjectiveBanner, RewardToast, FuelGauge, ExitButton } from '../ui/widgets';
import { G } from '../core/state';
import { clamp } from '../core/math';
import type { World } from './World';

/**
 * Screen-space overlay running on top of the World scene: detection
 * indicators, prompts, bubbles, dialogue, banner, hunger, backpack, iris.
 */
export class Hud extends Phaser.Scene {
    world!: World;
    dialog!: DialogBox;
    prompt!: Prompt;
    banner!: Banner;
    hunger!: HungerMeter;
    backpack!: BackpackButton;
    iris!: Iris;
    toast!: Toast;
    objective!: ObjectiveBanner;
    fuel!: FuelGauge;
    exitBtn!: ExitButton;
    reward!: RewardToast;
    ghost!: GhostPointer;
    picker!: BackpackPicker;
    thought!: ThoughtBubble;
    badge!: BadgeToast;
    coins!: CoinCounter;
    private indicators = new Map<string, Indicator>();
    private bubbles = new Map<string, Bubble>();
    /** hide the gameplay HUD (cutscenes, vehicles, menus) */
    hideHud = false;
    private irisAnim: { from: number; to: number; t: number; dur: number; res: () => void } | null = null;
    private fadeRect!: Phaser.GameObjects.Rectangle;
    private fadeAnim: { from: number; to: number; t: number; dur: number; res: () => void; ease: (k: number) => number } | null = null;

    constructor() {
        super('Hud');
    }

    create(data: { world: World; black?: boolean }) {
        this.world = data.world;
        L.update(this.scale.width, this.scale.height);
        this.dialog = new DialogBox(this);
        this.prompt = new Prompt(this);
        this.banner = new Banner(this);
        this.hunger = new HungerMeter(this);
        this.toast = new Toast(this);
        this.backpack = new BackpackButton(this, () => this.world.openBackpack());
        this.iris = new Iris(this);
        this.fadeRect = this.add.rectangle(0, 0, 10, 10, 0x000000, 0).setOrigin(0).setDepth(99);
        this.ghost = new GhostPointer(this);
        this.picker = new BackpackPicker(this);
        this.thought = new ThoughtBubble(this);
        this.badge = new BadgeToast(this);
        this.objective = new ObjectiveBanner(this);
        this.reward = new RewardToast(this);
        this.fuel = new FuelGauge(this);
        this.exitBtn = new ExitButton(this, () => this.world.vehicles.exit());
        this.coins = new CoinCounter(this);
        this.coins.set(G.save.coins, true);
        if (data.black) {
            this.iris.radius = 0;
            this.iris.draw();
        }
        this.scale.on('resize', () => L.update(this.scale.width, this.scale.height));
        // a click anywhere advances dialogue
        this.input.on('pointerdown', () => {
            if (this.dialog.open) this.dialog.advance();
        });
    }

    /** Promise-based iris: close (to black) or open. */
    irisTo(close: boolean, dur: number, cx = L.W / 2, cy = L.H / 2): Promise<void> {
        this.iris.cx = cx;
        this.iris.cy = cy;
        const max = this.iris.maxRadius;
        const from = close ? (this.iris.radius < 0 ? max : this.iris.radius) : 0;
        const to = close ? 0 : max;
        this.iris.radius = from;
        return new Promise((res) => {
            this.irisAnim = { from, to, t: 0, dur, res };
        });
    }

    /** Fade the whole screen to/from black (intro uses a slow ~3.7 s ease-in fade). */
    fadeTo(alpha: number, dur: number, ease: (k: number) => number = (k) => k): Promise<void> {
        return new Promise((res) => {
            this.fadeAnim = { from: this.fadeRect.fillAlpha, to: alpha, t: 0, dur, res, ease };
        });
    }

    setBlack(alpha: number) {
        this.fadeAnim = null;
        this.fadeRect.setFillStyle(0x000000, alpha);
    }

    irisOff() {
        this.iris.radius = -1;
        this.iris.draw();
    }

    indicatorFor(id: string) {
        let ind = this.indicators.get(id);
        if (!ind) this.indicators.set(id, (ind = new Indicator(this)));
        return ind;
    }

    bubbleFor(id: string) {
        let b = this.bubbles.get(id);
        if (!b) this.bubbles.set(id, (b = new Bubble(this)));
        return b;
    }

    clearWorldWidgets() {
        for (const i of this.indicators.values()) i.destroy();
        for (const b of this.bubbles.values()) b.destroy();
        this.indicators.clear();
        this.bubbles.clear();
        this.prompt.hide();
    }

    update(_t: number, deltaMs: number) {
        const dt = Math.min(0.05, deltaMs / 1000);
        L.update(this.scale.width, this.scale.height);
        const w = this.world;
        if (!w || !w.player) return;


        // ---- detection indicators ------------------------------------------
        const I = TUNING.ui.indicator;
        const seen = new Set<string>();
        const hudHidden = this.hideHud || w.inCloseUp;
        for (const h of w.humans) {
            const p = h.perc;
            const glyph = p.alarmed
                ? h.seesPlayer ? 'eye' : h.kind === 'ranger' ? '!' : 'eye'
                : p.meter > 0.001 ? (p.searching ? '?' : p.glyph) : p.idleGlyph;
            if (!glyph || hudHidden) continue;
            seen.add(h.id);
            const head = w.worldToScreen(h.x, h.y, h.headHeight + 0.75);
            let x = head.x, y = head.y - L.r(I.radius);
            const inset = I.edgeInset;
            const offscreen = x < 0 || y < 0 || x > L.W || y > L.H;
            if (offscreen && !p.alarmed && p.meter < 0.02) continue;
            x = clamp(x, L.r(inset.left), L.W - L.r(inset.right));
            y = clamp(y, L.r(inset.top), L.H - L.r(inset.bottom));
            this.indicatorFor(h.id).update(x, y, {
                glyph,
                meter: p.meter,
                alarmed: p.alarmed,
                memory: p.memory / TUNING.detection.alertedMemoryTime,
                seeing: h.seesPlayer,
            });
            this.indicatorFor(h.id).setVisible(true);
        }
        for (const a of w.animals) {
            if (!a.marker || hudHidden || a.speech || this.dialog.open) continue;
            const id = 'animal_' + a.id;
            seen.add(id);
            const head = w.worldToScreen(a.x, a.y, a.headHeight + 0.75);
            const b = this.bubbleFor(id);
            b.markerColor = a.markerColor;
            b.set(a.marker);
            b.show(head.x, head.y, dt);
        }
        for (const h of w.humans) {
            if (!h.marker || hudHidden || h.speech || this.dialog.open || h.perc.meter > 0 || h.perc.alarmed) continue;
            const id = 'human_' + h.id;
            seen.add(id);
            const head = w.worldToScreen(h.x, h.y, h.headHeight + 0.75);
            const b = this.bubbleFor(id);
            b.markerColor = h.markerColor;
            b.set(h.marker);
            b.show(head.x, head.y, dt);
        }
        for (const m of w.markers) {
            if (hudHidden || this.dialog.open) continue;
            const id = 'marker_' + m.id;
            seen.add(id);
            const p = w.worldToScreen(m.x, m.y, m.z);
            const b = this.bubbleFor(id);
            b.markerColor = m.color ?? '#ffffff';
            b.set(m.glyph);
            b.show(p.x, p.y, dt);
        }
        for (const [id, ind] of this.indicators) if (!seen.has(id)) ind.setVisible(false);

        // ---- speech bubbles ---------------------------------------------------
        const talkers: { id: string; x: number; y: number; z: number; text: string; right: boolean }[] = [];
        for (const h of w.humans) if (h.speech) talkers.push({ id: 'h_' + h.id, x: h.x, y: h.y, z: h.headHeight + 0.4, text: h.speech.text, right: false });
        for (const a of w.animals) if (a.speech) talkers.push({ id: 'animal_' + a.id, x: a.x, y: a.y, z: a.headHeight + 0.35, text: a.speech.text, right: false });
        if (w.playerSpeech) talkers.push({ id: 'player', x: w.player.x, y: w.player.y, z: 2.2, text: w.playerSpeech.text, right: false });
        const talking = new Set<string>();
        for (const t of talkers) {
            if (hudHidden && !w.cutsceneBubbles) continue;
            talking.add(t.id);
            const s = w.worldToScreen(t.x, t.y, t.z);
            const b = this.bubbleFor(t.id);
            b.tailRight = s.x > L.W * 0.62;
            b.set(t.text);
            // cutscene bubbles are drawn larger: "Oh no!!" is 10.9 %H tall vs 7.6 %H in play (cutscene t11.0)
            b.show(clamp(s.x, L.r(300), L.W - L.r(300)), clamp(s.y, L.r(260), L.H - L.r(40)), dt, w.cutsceneBubbles ? 1.43 : 1);
        }
        for (const [id, b] of this.bubbles) if (!talking.has(id) && !seen.has(id)) b.hide();

        // ---- prompt ---------------------------------------------------------
        const pt = w.promptTarget;
        if (pt && !hudHidden && !this.dialog.open && !G.frozen) {
            this.prompt.show(pt.icon);
            this.prompt.onClick = () => w.interact();
            const s = w.worldToScreen(pt.x, pt.y, 0);
            this.prompt.update(dt, s.x, s.y + L.r(150));
        } else {
            this.prompt.hide();
        }

        // ---- other widgets --------------------------------------------------
        this.dialog.update(dt);
        this.banner.update(dt);
        this.ghost.update(dt);
        this.picker.update(dt);
        this.badge.update(dt);
        this.objective.update(dt, hudHidden || this.dialog.open || this.badge.root.visible);
        this.reward.update(dt);
        this.fuel.update(dt);
        const drv = w.vehicles?.driving;
        this.exitBtn.update(dt, !!drv && drv.groundSpeed < 0.3 && !hudHidden && !this.dialog.open && !w.busy);
        const head = w.worldToScreen(w.player.x, w.player.y, 2.1);
        this.thought.update(dt, head.x, head.y);
        this.coins.set(G.save.coins);
        this.coins.update(dt, hudHidden && !w.inCloseUp);
        this.hunger.value = G.save.hunger;
        this.hunger.update(dt, hudHidden && !w.inCloseUp && !this.hunger.forceVisible);
        // bottom-centre box, y 1180-1437 on the 1898-px reference (inside-park t98.9)
        this.toast.update(dt, L.W / 2, L.r(1308));
        this.backpack.setColor(G.save.backpackColor ?? 'red');
        this.backpack.update(!!G.save.backpackColor && !hudHidden && !this.dialog.open && !this.picker.open && w.player.mode !== 'lying' && w.player.mode !== 'vehicle' && this.iris.radius < 0 && !this.ghost.root.visible);

        // ---- fade -----------------------------------------------------------
        this.fadeRect.setSize(L.W, L.H);
        if (this.fadeAnim) {
            const f = this.fadeAnim;
            f.t += dt;
            const k = clamp(f.t / f.dur, 0, 1);
            this.fadeRect.setFillStyle(0x000000, f.from + (f.to - f.from) * f.ease(k));
            if (k >= 1) {
                this.fadeAnim = null;
                f.res();
            }
        }

        // ---- iris -----------------------------------------------------------
        if (this.irisAnim) {
            const a = this.irisAnim;
            a.t += dt;
            const k = clamp(a.t / a.dur, 0, 1);
            this.iris.radius = a.from + (a.to - a.from) * k;
            if (k >= 1) {
                this.irisAnim = null;
                if (a.to > 0) this.iris.radius = -1;
                a.res();
            }
        }
        this.iris.draw();
    }
}
