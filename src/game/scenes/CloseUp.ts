import * as Phaser from 'phaser';
import { TUNING } from '../config/tuning';
import { L } from '../ui/layout';
import { UI } from '../ui/widgets';
import { G } from '../core/state';
import { BACKPACK_CAPACITY, itemDef } from '../data/items';
import { clamp, easeOut } from '../core/math';
import type { World } from './World';


/** items on the eat table are drawn larger than in containers: a hot dog is ~14 %W (t097.4) */
const EAT_ITEM_SCALE = 1.7;
/**
 * Close-up screens (all over the zoomed, darkened world view):
 *   cooler / foodbox / basket / trash / cache — rummage: open the lid, drag items
 *       to the backpack mouth that slides into the bottom-left (tutorial §7.3)
 *   eat — front view behind the picnic table; the backpack is dumped out and you
 *       drag food to the mouth (tutorial §7.4, inside-park §4.2)
 *   backpack — inventory overview
 */
type Kind = 'cooler' | 'foodbox' | 'basket' | 'trash' | 'cache' | 'eat' | 'backpack' | 'card';

interface Item {
    id: string;
    img: Phaser.GameObjects.Image;
    home: { x: number; y: number };
    bob: number;
    taken: boolean;
}

export class CloseUp extends Phaser.Scene {
    world!: World;
    kind!: Kind;
    containerId = '';
    private items: Item[] = [];
    private held: Item | null = null;
    private heldOffset = { x: 0, y: 0 };
    /** eat: which hand picked the held item up (kept until it is put down) */
    private heldSide: 'L' | 'R' = 'L';
    private hand!: Phaser.GameObjects.Image;
    private arm!: Phaser.GameObjects.Image;
    private closeBtn!: Phaser.GameObjects.Container;
    private vignette!: Phaser.GameObjects.Graphics;
    private panel!: Phaser.GameObjects.Container;
    private bag!: Phaser.GameObjects.Image;
    private bagT = 0;
    private lidOpen = false;
    private lidClosed?: Phaser.GameObjects.Image;
    private lidOpenImg?: Phaser.GameObjects.Image;
    private artScale = 1;
    private bodyPos = { x: 0, y: 0 };
    private t = 0;
    private closing = false;
    private tutorial = false;
    private onDone?: () => void;
    // eat
    private body?: Phaser.GameObjects.Image;
    private eatMeta?: { w: number; h: number; mouth: number[]; shoulderL: number[]; shoulderR: number[]; headTop: number[] };
    private arms?: Phaser.GameObjects.Graphics;
    private handL?: Phaser.GameObjects.Image;
    private handR?: Phaser.GameObjects.Image;
    private handTargets = { L: { x: 0, y: 0 }, R: { x: 0, y: 0 } };
    private handCur = { L: { x: 0, y: 0 }, R: { x: 0, y: 0 } };
    private busyAnim = false;
    private chew = 0;
    private splats: Phaser.GameObjects.GameObject[] = [];
    private prevZoom = 1;

    constructor() {
        super('CloseUp');
    }

    create(data: { world: World; kind: Kind; id?: string; loot?: string[]; tutorial?: boolean; card?: string; onDone?: () => void }) {
        L.update(this.scale.width, this.scale.height);
        this.world = data.world;
        this.kind = data.kind;
        this.containerId = data.id ?? '';
        this.tutorial = !!data.tutorial;
        this.onDone = data.onDone;
        this.items = [];
        this.held = null;
        this.lidOpen = false;
        this.closing = false;
        this.t = 0;
        this.bagT = 0;
        this.splats = [];
        this.world.inCloseUp = true;
        this.world.player.target = null;
        this.input.setDefaultCursor('default');

        // world behind: containers zoom in on the object and darken with a vertical
        // vignette; eating leaves the world exactly as it was (t095.5 vs t096.4)
        this.prevZoom = this.world.zoomGoal;
        this.vignette = this.add.graphics().setDepth(0);
        if (this.kind === 'card') {
            // readable cards: the world closes in a little behind the card, no darkening (inside-park t68.9)
            this.world.setZoom(1.6);
        } else if (this.kind !== 'eat') {
            const wp = this.world.promptTarget ?? { x: this.world.player.x, y: this.world.player.y };
            this.world.camFocus = { x: wp.x, y: wp.y };
            this.world.camFocusZ = 0.4;
            this.world.setZoom(2.5);
            this.drawVignette();
        }
        this.buildCloseButton();

        if (this.kind === 'eat') this.buildEat();
        else if (this.kind === 'backpack') this.buildBackpack();
        else if (this.kind === 'card') this.buildCard(data.card ?? '');
        else this.buildContainer(data.loot ?? []);
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
        this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
        this.input.keyboard?.on('keydown-ESC', () => this.close());
        this.world.hud.hunger.forceVisible = this.kind === 'eat' || this.kind === 'backpack';
        this.world.hud.coins.forceVisible = this.kind === 'backpack' || this.kind === 'cache';
    }

    // ===================================================================== shared
    private drawVignette() {
        const g = this.vignette;
        g.clear();
        const steps = 16;
        for (let i = 0; i < steps; i++) {
            const a = 0.32 * Math.pow(1 - i / steps, 2);
            const h = (L.H * 0.35) / steps;
            g.fillStyle(0x0a1a08, a);
            g.fillRect(0, i * h, L.W, h + 1);
            g.fillRect(0, L.H - (i + 1) * h, L.W, h + 1);
        }
        g.fillStyle(0x0a1a08, 0.12);
        g.fillRect(0, 0, L.W, L.H);
    }

    private buildCloseButton() {
        const R = L.r(130);
        const g = this.add.graphics();
        g.fillStyle(0x2d2f2e, 1).fillCircle(0, 0, R);
        g.fillStyle(0xebebeb, 1).fillCircle(0, 0, R - L.r(14));
        const x = this.add.image(0, 0, 'ui_close').setTint(0x313131).setDisplaySize(L.r(150), L.r(150));
        this.closeBtn = this.add.container(L.W * 0.938, L.H * 0.902, [g, x]).setDepth(50);
        this.closeBtn.setInteractive(new Phaser.Geom.Circle(0, 0, R), Phaser.Geom.Circle.Contains);
        this.closeBtn.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
            e.stopPropagation();
            this.close();
        });
        this.closeBtn.setVisible(false).setScale(0);
    }

    private showClose(v: boolean) {
        if (v === this.closeBtn.visible) return;
        this.closeBtn.setVisible(v);
        if (v) this.tweens.add({ targets: this.closeBtn, scale: { from: 0, to: 1 }, duration: 200, ease: 'Back.Out' });
    }

    close(force = false) {
        if (this.closing || (this.busyAnim && !force)) return;
        this.closing = true;
        this.world.sfx('close');
        const done = () => {
            this.world.inCloseUp = false;
            this.world.camFocus = null;
            this.world.setZoom(this.prevZoom);
            this.world.hud.hunger.forceVisible = false;
            this.world.hud.coins.forceVisible = false;
            if (this.containerId && this.kind !== 'eat') {
                const left = this.items.filter((i) => !i.taken).map((i) => i.id);
                G.setFlag('cont_' + this.containerId, `${G.save.day}:${left.join(',')}`);
                if (!left.length) G.save.looted[this.containerId] = G.save.day;
            }
            const cb = this.onDone;
            this.scene.stop();
            cb?.();
        };
        if (this.panel) {
            // slide back down (~0.23 s); the eat view scales away (~0.1 s)
            if (this.kind === 'eat') this.tweens.add({ targets: this.panel, scale: 0.2, alpha: 0, duration: 110, onComplete: done });
            else this.tweens.add({ targets: this.panel, y: L.H, duration: 230, ease: 'Quad.In', onComplete: done });
            this.tweens.add({ targets: [this.hand, this.arm, this.closeBtn, this.bag].filter(Boolean), alpha: 0, duration: 150 });
        } else done();
    }

    // ============================================================ containers
    private buildContainer(loot: string[]) {
        const K = this.kind === 'basket' ? 'cooler' : this.kind;
        this.artScale = (L.W * 0.6) / 1100;
        const s = this.artScale;
        this.panel = this.add.container(0, L.H).setDepth(10);
        this.bodyPos = { x: L.W / 2, y: L.H * 0.47 };
        const body = this.add.image(this.bodyPos.x, this.bodyPos.y, `cu_${K}_body`).setScale(s);
        this.panel.add(body);
        // item slots inside the opening (art coords 150..950 x 340..560 of the 1100x900 art)
        const n = loot.length;
        loot.forEach((id, i) => {
            const def = itemDef(id);
            const ax = n === 1 ? 550 : 200 + (700 * i) / Math.max(1, n - 1);
            const ay = 430 + (i % 2) * 70;
            const x = this.bodyPos.x + (ax - 550) * s, y = this.bodyPos.y + (ay - 450) * s;
            const img = this.add.image(x, y, 'cu_item_' + def.icon).setDisplaySize(L.r(def.size), L.r(def.size) * (this.textures.get('cu_item_' + def.icon).getSourceImage().height / this.textures.get('cu_item_' + def.icon).getSourceImage().width));
            img.setRotation((i % 2 ? -1 : 1) * 0.35 + (K === 'trash' ? 0.2 : 0));
            this.panel.add(img);
            img.setVisible(false); // hidden under the closed lid
            this.items.push({ id, img, home: { x, y }, bob: i * 1.7, taken: false });
        });
        // lid (closed) on top; the open lid is a slab along the top edge
        this.lidClosed = this.add.image(this.bodyPos.x, this.bodyPos.y, `cu_${K}_lid${K === 'cooler' ? '_closed' : ''}`).setScale(s);
        if (K !== 'cooler') this.lidClosed.setPosition(this.bodyPos.x, this.bodyPos.y - 175 * s);
        this.panel.add(this.lidClosed);
        if (K === 'cooler') {
            this.lidOpenImg = this.add.image(this.bodyPos.x, this.bodyPos.y - 290 * s, 'cu_cooler_lid_open').setScale(s).setVisible(false);
            this.panel.add(this.lidOpenImg);
        }
        // backpack mouth (drop target), hidden off the bottom-left until an item is held
        this.bag = this.add.image(-L.r(400), L.H + L.r(400), 'cu_bag_mouth').setDisplaySize(L.r(700), L.r(560)).setDepth(20);
        // the sasquatch's furry arm + hand follow the cursor
        this.arm = this.add.image(0, 0, 'cu_arm_fur').setOrigin(0.5, 0).setDepth(30);
        this.hand = this.add.image(L.W / 2, L.H * 0.8, 'cu_hand_open').setDepth(31).setDisplaySize(L.r(300), L.r(340));
        this.world.sfx('open');
        this.tweens.add({ targets: this.panel, y: 0, duration: 230, ease: 'Quad.Out' });
        if (this.tutorial) {
            // ghost pointer shows tapping the latch
            this.time.delayedCall(280, () => {
                if (!this.lidOpen) this.world.hud.ghost.show(this.bodyPos.x + 20 * s, this.bodyPos.y + 10 * s, 'click');
            });
        } else {
            this.showClose(true);
        }
    }

    private openLid() {
        if (this.lidOpen) return;
        this.lidOpen = true;
        this.world.hud.ghost.hide();
        this.world.sfx('lid');
        const K = this.kind === 'basket' ? 'cooler' : this.kind;
        if (K === 'cooler') {
            this.lidClosed?.setVisible(false);
            this.lidOpenImg?.setVisible(true).setScale(this.artScale, 0.2 * this.artScale);
            this.tweens.add({ targets: this.lidOpenImg, scaleY: this.artScale, duration: 140, ease: 'Back.Out' });
        } else {
            // trash/cache/foodbox lids are lifted off and parked to the side
            this.tweens.add({ targets: this.lidClosed, x: L.W * 0.86, y: L.H * 0.2, angle: 18, duration: 320, ease: 'Quad.Out' });
        }
        for (const it of this.items) it.img.setVisible(true);
        if (!this.items.length) this.showClose(true);
    }

    private itemAt(x: number, y: number): Item | null {
        let best: Item | null = null, bd = Infinity;
        for (const it of this.items) {
            if (it.taken) continue;
            const d = Math.hypot(it.img.x - x, it.img.y - y);
            const r = Math.max(it.img.displayWidth, it.img.displayHeight) * 0.55;
            if (d < r && d < bd) { bd = d; best = it; }
        }
        return best;
    }

    private inBag(x: number, y: number) {
        if (this.bagT < 0.5) return false;
        const dx = (x - this.bag.x) / (this.bag.displayWidth * 0.55), dy = (y - this.bag.y) / (this.bag.displayHeight * 0.6);
        return dx * dx + dy * dy < 1;
    }

    // ================================================================== eat
    private buildEat() {
        const meta = this.cache.json.get('cu_eat_body') as CloseUp['eatMeta'];
        this.eatMeta = meta ?? { w: 1814, h: 1400, mouth: [907, 573.9], shoulderL: [1206.9, 782.9], shoulderR: [607.1, 782.9], headTop: [907, 20.1] };
        const m = this.eatMeta!;
        this.panel = this.add.container(0, 0).setDepth(10);
        const s = (L.W * 0.6) / m.w;
        this.artScale = s;
        const bx = L.W / 2, by = L.H * 0.03 - (m.headTop[1] - m.h / 2) * s;
        this.bodyPos = { x: bx, y: by };
        this.body = this.add.image(bx, by, 'cu_eat_body_closed').setScale(s);
        this.arms = this.add.graphics();
        this.handL = this.add.image(0, 0, 'cu_hand_open').setDisplaySize(L.r(170), L.r(190));
        this.handR = this.add.image(0, 0, 'cu_hand_open').setDisplaySize(L.r(170), L.r(190)).setFlipX(true);
        const table = this.add.image(L.W / 2, L.H, 'cu_eat_table').setOrigin(0.5, 1).setDisplaySize(L.W, L.H * 0.324);
        this.panel.add([this.body, this.arms, table, this.handL, this.handR]);
        const rest = this.restPose();
        this.handCur = { L: { ...rest.L }, R: { ...rest.R } };
        this.handTargets = { L: { ...rest.L }, R: { ...rest.R } };
        // enter: scale up from the table (~0.13 s)
        this.panel.setScale(0.3).setAlpha(0);
        this.panel.setPosition(L.W * 0.35, L.H * 0.35);
        this.tweens.add({ targets: this.panel, scale: 1, alpha: 1, x: 0, y: 0, duration: 130, ease: 'Quad.Out' });
        this.time.delayedCall(250, () => this.dumpBackpack());
        this.showClose(false);
    }

    private shoulder(side: 'L' | 'R') {
        const m = this.eatMeta!;
        const p = side === 'L' ? m.shoulderL : m.shoulderR;
        return { x: this.bodyPos.x + (p[0] - m.w / 2) * this.artScale, y: this.bodyPos.y + (p[1] - m.h / 2) * this.artScale };
    }

    private mouth() {
        const m = this.eatMeta!;
        return { x: this.bodyPos.x + (m.mouth[0] - m.w / 2) * this.artScale, y: this.bodyPos.y + (m.mouth[1] - m.h / 2) * this.artScale };
    }

    private restPose() {
        // hands rest on the table's front edge, wide apart (t098.9)
        return { L: { x: L.W * 0.74, y: L.H * 0.715 }, R: { x: L.W * 0.26, y: L.H * 0.715 } };
    }

    private async dumpBackpack() {
        this.busyAnim = true;
        const items = G.save.items.filter((id) => itemDef(id).food > 0 || itemDef(id).condiment);
        // lift the backpack over the head, mouth down: the pack is ~20 %W, held a
        // little left of centre and tilted, one hand on each side (t096.4)
        const top = { x: L.W * 0.43, y: L.H * 0.15 };
        const pack = this.add.image(L.W / 2, L.H * 0.75, 'cu_pack_dump_' + (G.save.backpackColor ?? 'red')).setDisplaySize(L.r(600), L.r(620)).setDepth(12);
        pack.setAngle(-10);
        // in front of the head, behind the arms and hands
        this.panel.addAt(pack, this.panel.getIndex(this.arms!));
        this.handTargets.L = { x: top.x + L.r(300), y: top.y - L.r(20) };
        this.handTargets.R = { x: top.x - L.r(300), y: top.y + L.r(90) };
        this.world.sfx('backpack');
        await this.tween(pack, { x: top.x, y: top.y }, 420);
        await this.tween(pack, { angle: -22 }, 120);
        await this.tween(pack, { angle: 4 }, 120);
        // contents fall onto the table
        const n = items.length;
        items.forEach((id, i) => {
            const def = itemDef(id);
            // items land in a loose row on the slab, a little left of centre (t097.4)
            const tx = L.W * 0.3 + (L.W * 0.38 * (i + 0.5)) / Math.max(1, n) + (Math.random() - 0.5) * L.r(40);
            const ty = L.H * 0.765 + (i % 2) * L.r(80);
            const tex = this.textures.get('cu_item_' + def.icon).getSourceImage();
            const dw = L.r(def.size * EAT_ITEM_SCALE);
            const img = this.add.image(top.x, top.y + L.r(80), 'cu_item_' + def.icon).setDisplaySize(dw, (dw * tex.height) / tex.width).setDepth(15);
            img.setRotation(def.condiment ? 1.4 : (Math.random() - 0.5) * 0.5);
            this.items.push({ id, img, home: { x: tx, y: ty }, bob: 0, taken: false });
            this.tweens.add({ targets: img, x: tx, y: ty, duration: 520, delay: i * 140, ease: 'Bounce.Out', onStart: () => this.world.sfx('drop') });
        });
        await this.wait(260 + n * 140 + 300);
        await this.tween(pack, { x: L.W / 2, y: -L.r(500) }, 300);
        pack.destroy();
        const rest = this.restPose();
        this.handTargets = { L: { ...rest.L }, R: { ...rest.R } };
        this.busyAnim = false;
        if (!this.items.length) this.close();
        // the tutorial meal has no ✕: you finish everything (t098.9-t108.6)
        else this.showClose(G.flag('tutorialDone'));
    }

    private eatItem(it: Item) {
        const def = itemDef(it.id);
        this.busyAnim = true;
        it.taken = true;
        const mouth = this.mouth();
        const side = this.heldSide;
        this.body?.setTexture('cu_eat_body_open');
        const consume = () => {
            it.img.destroy();
            const idx = G.save.items.indexOf(it.id);
            if (idx >= 0) G.save.items.splice(idx, 1);
            if (def.food > 0) {
                G.save.hunger = Math.min(TUNING.hunger.max, G.save.hunger + def.food);
                this.world.hud.hunger.pop();
            }
            G.save.stats.eaten++;
            this.chew = 0.75;
        };
        if (def.condiment) {
            // the bottle is held nozzle-first at the mouth and squeezed a few times,
            // spraying the chin and fur (t102.6-t108.6)
            // the bottle art stands cap-up, so a small tilt points the nozzle at the mouth
            const sd = side === 'L' ? 1 : -1;
            this.handTargets[side] = { x: mouth.x + sd * L.r(95), y: mouth.y + L.r(215) };
            this.tweens.add({ targets: it.img, x: mouth.x + sd * L.r(70), y: mouth.y + L.r(150), rotation: -sd * 0.5, duration: 200, ease: 'Quad.Out' });
            const sx = it.img.scaleX;
            for (let k = 0; k < 3; k++) {
                this.time.delayedCall(320 + k * 520, () => {
                    this.tweens.add({ targets: it.img, scaleX: sx * 0.78, duration: 90, yoyo: true });
                    this.world.sfx('squirt');
                    this.splat(k === 0 ? 2 : 1);
                });
            }
            this.time.delayedCall(320 + 3 * 520, () => {
                this.tweens.add({ targets: it.img, alpha: 0, scale: it.img.scale * 0.6, duration: 160, onComplete: consume });
            });
            return;
        }
        this.handTargets[side] = { x: mouth.x, y: mouth.y + L.r(60) };
        this.tweens.add({
            targets: it.img, x: mouth.x, y: mouth.y, scale: it.img.scale * 0.2, duration: 220, onComplete: () => {
                consume();
                this.world.sfx('chomp');
            },
        });
    }

    /** ketchup lands on the fur: drips from the mouth corners and splats down the chest (t105.6) */
    private splat(n = 1) {
        const m = this.mouth();
        const at = this.panel.getIndex(this.arms!);
        for (let i = 0; i < n; i++) {
            const a = this.add.image(m.x + (Math.random() - 0.5) * L.r(240), m.y + L.r(260 + Math.random() * 180), 'cu_splat_' + Math.floor(Math.random() * 4));
            const sz = L.r(70 + Math.random() * 45);
            a.setDisplaySize(sz, sz).setRotation(Math.random() * 6);
            this.panel.addAt(a, at);
            this.splats.push(a);
            const drip = this.add.rectangle(m.x + (Math.random() < 0.5 ? -1 : 1) * L.r(70 + Math.random() * 60), m.y + L.r(30), L.r(18), L.r(70 + Math.random() * 70), 0xd8333b).setOrigin(0.5, 0);
            drip.setScale(1, 0.1);
            this.tweens.add({ targets: drip, scaleY: 1, duration: 600, ease: 'Quad.Out' });
            this.panel.addAt(drip, at);
            this.splats.push(drip);
        }
    }

    // ================================================================== card
    /**
     * A readable card (newspaper, LOST DOG poster): slides up from the bottom, held
     * by the sasquatch's hand at the lower right; ✕ to put it away. Card spans
     * 13-85.5 %W, 12-90 %H on inside-park t68.9. Art: cu_<name> (+ optional json
     * `slots` for text the game fills in, e.g. the day number).
     */
    private buildCard(name: string) {
        this.panel = this.add.container(0, 0).setDepth(10);
        const W = L.W, H = L.H;
        const cx = W * 0.494, cy = H * 0.51, cw = W * 0.725, ch = H * 0.78;
        const key = 'cu_' + name;
        const hand = this.add.image(W * 0.9, H * 0.93, 'cu_hand_open').setDisplaySize(L.r(330), L.r(380)).setAngle(-20);
        if (this.textures.exists(key) && this.textures.get(key).key !== '__MISSING') {
            const img = this.add.image(cx, cy, key);
            img.setScale(cw / img.width);
            this.panel.add(img);
            const meta = this.cache.json.get(key) as { slots?: Record<string, { x: number; y: number; size: number; color?: string; align?: number }> } | undefined;
            const left = cx - img.displayWidth / 2, top = cy - img.displayHeight / 2, k = img.displayWidth / img.width;
            const text: Record<string, string> = { day: `DAY ${G.save.day}` };
            for (const [id, slot] of Object.entries(meta?.slots ?? {})) {
                if (!text[id]) continue;
                const t = this.add.text(left + slot.x * k, top + slot.y * k, text[id], { fontFamily: L.font, fontStyle: 'bold', fontSize: `${Math.round(slot.size * k)}px`, color: slot.color ?? '#2d2d2d' });
                t.setOrigin(slot.align ?? 0, 0.5);
                this.panel.add(t);
            }
        } else {
            // placeholder until the close-up art exists
            const g = this.add.graphics();
            g.fillStyle(0x6f6f6f, 1).fillRect(cx - cw / 2 + L.r(14), cy - ch / 2 + L.r(14), cw, ch);
            g.fillStyle(0xe8e8e8, 1).fillRect(cx - cw / 2, cy - ch / 2, cw, ch);
            const title = name === 'newspaper' ? 'The Newspaper' : name.replace(/_/g, ' ').toUpperCase();
            const head = name === 'newspaper' ? 'MYSTERY BEAST SPOTTED' : '';
            const t1 = this.add.text(cx, cy - ch * 0.38, title, { fontFamily: L.font, fontStyle: 'bold', fontSize: `${Math.round(L.r(120))}px`, color: '#2d2d2d' }).setOrigin(0.5);
            const t2 = this.add.text(cx, cy - ch * 0.2, head, { fontFamily: L.font, fontStyle: 'bold', fontSize: `${Math.round(L.r(150))}px`, color: '#2d2d2d' }).setOrigin(0.5);
            const t3 = this.add.text(cx - cw * 0.45, cy - ch * 0.37, `DAY ${G.save.day}`, { fontFamily: L.font, fontStyle: 'bold', fontSize: `${Math.round(L.r(55))}px`, color: '#2d2d2d' }).setOrigin(0, 0.5);
            this.panel.add([g, t1, t2, t3]);
        }
        this.panel.add(hand);
        this.panel.y = H;
        this.tweens.add({ targets: this.panel, y: 0, duration: 300, ease: 'Quad.Out' });
        this.world.sfx('grab');
        this.showClose(true);
    }

    // ============================================================== backpack
    private buildBackpack() {
        this.panel = this.add.container(0, 0).setDepth(10);
        const g = this.add.graphics();
        g.fillStyle(0x000000, 0.45).fillRect(0, 0, L.W, L.H);
        const pw = L.W * 0.62, ph = L.H * 0.56, px = L.W / 2 - pw / 2, py = L.H * 0.3;
        g.fillStyle(UI.dialog, 0.92).fillRoundedRect(px, py, pw, ph, L.r(40));
        g.fillStyle(0x533928, 1).fillEllipse(L.W / 2, py + ph * 0.55, pw * 0.86, ph * 0.74);
        g.lineStyle(L.r(30), 0xca3535, 1).strokeEllipse(L.W / 2, py + ph * 0.55, pw * 0.86, ph * 0.74);
        this.panel.add(g);
        const items = G.save.items;
        const cols = 8;
        items.forEach((id, i) => {
            const def = itemDef(id);
            const c = i % cols, r = Math.floor(i / cols);
            const x = px + pw * 0.16 + c * (pw * 0.68) / (cols - 1), y = py + ph * 0.32 + r * L.r(150);
            const tex = this.textures.get('cu_item_' + def.icon).getSourceImage();
            const s = L.r(def.size * 0.55) / tex.width;
            this.panel.add(this.add.image(x, y, 'cu_item_' + def.icon).setScale(s).setRotation((i % 3 - 1) * 0.3));
        });
        const cap = this.add.text(L.W / 2, py + ph - L.r(70), `${items.length} / ${BACKPACK_CAPACITY}`, { fontFamily: L.font, fontSize: L.fs(52), color: '#cccccc' }).setOrigin(0.5);
        this.panel.add(cap);
        this.showClose(true);
    }

    // ================================================================ input
    private onDown(p: Phaser.Input.Pointer) {
        if (this.closing || this.busyAnim || this.kind === 'backpack' || this.kind === 'card') return;
        if (this.kind !== 'eat' && !this.lidOpen) {
            // click the latch / lid to open
            const lid = this.lidClosed!;
            if (Math.abs(p.x - lid.x) < lid.displayWidth / 2 && Math.abs(p.y - lid.y) < lid.displayHeight / 2) this.openLid();
            return;
        }
        const it = this.itemAt(p.x, p.y);
        if (!it) return;
        this.held = it;
        this.heldOffset = { x: it.img.x - p.x, y: it.img.y - p.y };
        this.heldSide = it.img.x > L.W / 2 ? 'L' : 'R';
        this.world.sfx('grab');
        if (this.kind !== 'eat') this.panel.bringToTop(it.img);
    }

    private onUp(p: Phaser.Input.Pointer) {
        const it = this.held;
        if (!it) return;
        this.held = null;
        if (this.kind === 'eat') {
            const m = this.mouth();
            if (Math.hypot(p.x - m.x, p.y - m.y) < L.W * 0.13) this.eatItem(it);
            else this.tweens.add({ targets: it.img, x: it.home.x, y: it.home.y, duration: 220, ease: 'Quad.Out' });
            return;
        }
        if (this.inBag(p.x, p.y)) {
            if (it.id === 'coinBag') {
                G.save.coins += 10;
            } else if (G.save.items.length < BACKPACK_CAPACITY) {
                G.save.items.push(it.id);
            } else {
                this.tweens.add({ targets: it.img, x: it.home.x, y: it.home.y, duration: 220 });
                return;
            }
            it.taken = true;
            this.world.sfx('stash');
            this.tweens.add({ targets: it.img, x: this.bag.x, y: this.bag.y, scale: it.img.scale * 0.3, alpha: 0, duration: 180, onComplete: () => it.img.destroy() });
            if (this.items.every((i) => i.taken)) this.showClose(true);
        } else {
            this.tweens.add({ targets: it.img, x: it.home.x, y: it.home.y, duration: 240, ease: 'Quad.Out' });
        }
    }

    // ================================================================ update
    update(_t: number, deltaMs: number) {
        const dt = Math.min(0.05, deltaMs / 1000);
        this.t += dt;
        L.update(this.scale.width, this.scale.height);
        const p = this.input.activePointer;
        if (this.kind === 'eat') return this.updateEat(dt, p);
        if (this.kind === 'backpack' || this.kind === 'card') return;

        // items bob in the cooler water
        for (const it of this.items) {
            if (it.taken || it === this.held) continue;
            if (this.kind === 'cooler' || this.kind === 'basket') it.img.y = it.home.y + Math.sin(this.t * 2 + it.bob) * L.r(5);
        }
        // held item follows the cursor
        if (this.held) this.held.img.setPosition(p.x + this.heldOffset.x * 0.3, p.y + this.heldOffset.y * 0.3);
        // backpack mouth slides in while holding something
        this.bagT = clamp(this.bagT + (this.held ? dt : -dt) / 0.18, 0, 1);
        const k = easeOut(this.bagT);
        this.bag.setPosition(-L.r(200) + k * L.r(530), L.H + L.r(300) - k * L.r(480));
        // arm from below the screen to the hand
        const hx = p.x, hy = p.y + L.r(90);
        this.hand.setPosition(hx, hy).setTexture(this.held ? 'cu_hand_grab' : 'cu_hand_open').setDisplaySize(L.r(300), L.r(340));
        // the arm rises from below the screen, leaning slightly toward the middle
        const ox = hx + (L.W * 0.55 - hx) * 0.3, oy = L.H * 1.45;
        const ang = Math.atan2(hy - oy, hx - ox);
        const len = Math.hypot(hx - ox, hy - oy);
        this.arm.setPosition(hx, hy + L.r(100)).setRotation(ang - Math.PI / 2 + Math.PI).setDisplaySize(L.r(150), len);
        this.arm.setOrigin(0.5, 0);
        if (this.held) this.hand.setDepth(31);
    }

    private updateEat(dt: number, p: Phaser.Input.Pointer) {
        // chewing: alternate open/closed mouth
        if (this.chew > 0) {
            this.chew -= dt;
            this.body?.setTexture(this.chew > 0 && Math.floor(this.chew * 8) % 2 === 0 ? 'cu_eat_body_open' : 'cu_eat_body_closed');
            if (this.chew <= 0) {
                this.busyAnim = false;
                if (this.items.every((i) => i.taken)) this.time.delayedCall(450, () => this.close());
            }
        }
        // the hand that picked the item up carries it; the other rests on the table
        if (this.held) {
            this.held.img.setPosition(p.x, p.y);
            const rest = this.restPose();
            const other = this.heldSide === 'L' ? 'R' : 'L';
            this.handTargets[this.heldSide] = { x: p.x, y: p.y + L.r(30) };
            this.handTargets[other] = { ...rest[other] };
        } else if (!this.busyAnim) {
            const rest = this.restPose();
            this.handTargets = { L: { ...rest.L }, R: { ...rest.R } };
        }
        const k = Math.min(1, dt * 14);
        for (const s of ['L', 'R'] as const) {
            this.handCur[s].x += (this.handTargets[s].x - this.handCur[s].x) * k;
            this.handCur[s].y += (this.handTargets[s].y - this.handCur[s].y) * k;
        }
        this.drawArms();
    }

    /** 2-bone IK arms from the shoulders to the hands, elbows bent outward. */
    private drawArms() {
        const g = this.arms!;
        g.clear();
        const l1 = L.H * 0.2, l2 = L.H * 0.2;
        for (const s of ['L', 'R'] as const) {
            const sh = this.shoulder(s), h = this.handCur[s];
            let dx = h.x - sh.x, dy = h.y - sh.y;
            let d = Math.hypot(dx, dy);
            const maxD = (l1 + l2) * 0.999;
            if (d > maxD) { dx *= maxD / d; dy *= maxD / d; d = maxD; }
            const a = Math.atan2(dy, dx);
            const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
            // of the two IK solutions, take the one whose elbow hangs down and away from the body
            // (t104: even with the hand up at the mouth the elbow points down, never over the face)
            const out = s === 'L' ? 1 : -1;
            const bend = Math.acos(cosA);
            const score = (t: number) => Math.sin(t) + 0.6 * Math.cos(t) * out;
            const b1 = score(a + bend) >= score(a - bend) ? a + bend : a - bend;
            const ex = sh.x + Math.cos(b1) * l1, ey = sh.y + Math.sin(b1) * l1;
            const hx = sh.x + dx, hy = sh.y + dy;
            // thick furry arms, ~83 ref px wide (t104.0)
            g.lineStyle(L.r(82), 0x3f2a1f, 1);
            g.beginPath(); g.moveTo(sh.x, sh.y); g.lineTo(ex, ey); g.lineTo(hx, hy); g.strokePath();
            g.fillStyle(0x3f2a1f, 1).fillCircle(ex, ey, L.r(41)).fillCircle(sh.x, sh.y, L.r(44));
            const hand = s === 'L' ? this.handL! : this.handR!;
            hand.setPosition(hx, hy).setRotation(Math.atan2(hy - ey, hx - ex) - Math.PI / 2 + Math.PI);
            hand.setTexture(this.held && this.heldSide === s ? 'cu_hand_grab' : 'cu_hand_open');
        }
    }

    // ================================================================ helpers
    private tween(target: object, props: Record<string, number>, ms: number): Promise<void> {
        return new Promise((res) => this.tweens.add({ targets: target, ...props, duration: ms, ease: 'Quad.Out', onComplete: () => res() }));
    }

    private wait(ms: number): Promise<void> {
        return new Promise((res) => this.time.delayedCall(ms, () => res()));
    }
}
