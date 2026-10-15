import * as Phaser from 'phaser';
import { L } from '../ui/layout';
import { G } from '../core/state';
import { clamp, easeOut } from '../core/math';
import { BACKPACK_CAPACITY, itemDef } from '../data/items';
import type { World } from './World';

/**
 * Layout-driven close-ups from inside the park (art: art/tools/gen-closeup-park.mjs;
 * every part, pivot and hit box comes from public/assets/closeup/<name>.json in
 * 3024x1898 reference px, mechanics from inside-park §4.3):
 *   newspaper, lost_dog   readable cards that slide up from below
 *   newsbox               the newspaper box front → its paper
 *   radio                 fiddle the antenna/knobs and the music stops
 *   stove                 knobs light burners, the oven door drops, food on a lit burner smokes
 *   fridge                swing the door open, drag the food into the bag
 *   vending               5 coins a button, the item drops into the tray
 *   tv                    bend the antenna / turn the dial for static (it's noisy)
 *   payphone              coin → pick up → dial → call
 * Like the containers, the world keeps running behind (inside-park rule 11).
 */
export type MiniKind = 'newspaper' | 'lost_dog' | 'newsbox' | 'radio' | 'stove' | 'fridge' | 'vending' | 'tv' | 'payphone';

interface PartDef {
    key: string;
    x: number;
    y: number;
    w: number;
    h: number;
    origin?: [number, number];
    pivot?: [number, number];
    angle?: number;
    hit?: number[] | { cx: number; cy: number; r: number };
    capsule?: { r: number; len: number };
    frames?: string[];
    controls?: string;
    row?: string;
    price?: number;
    downKey?: string;
    handle?: number[];
}
interface LayoutDef {
    parts: Record<string, PartDef>;
    order: string[];
    slots?: Record<string, unknown>;
    [k: string]: unknown;
}
interface Loose {
    id: string;
    img: Phaser.GameObjects.Image;
    home: { x: number; y: number };
    taken: boolean;
}

export interface MiniOpts {
    /** radio: called once when the music is cut */
    onRadioOff?: () => void;
    /** stove: food dropped on a lit burner / taken off again */
    onBurn?: (itemId: string) => void;
    onUnburn?: () => void;
    /** tv: static is noisy — called every frame while it hisses */
    onStatic?: (dt: number) => void;
    /** payphone: a full number was dialled */
    onDial?: (number: string) => Promise<void>;
    /** fridge: what's inside today and where to record what's left */
    loot?: string[];
    containerId?: string;
    onDone?: () => void;
}

export class Minigame extends Phaser.Scene {
    private world!: World;
    private kind: MiniKind = 'newspaper';
    private opts: MiniOpts = {};
    private lay!: LayoutDef;
    private parts: Record<string, Phaser.GameObjects.Image> = {};
    private root!: Phaser.GameObjects.Container;
    private closeBtn!: Phaser.GameObjects.Container;
    private prevZoom = 1;
    private closing = false;
    private t = 0;
    // dragging a rotating part
    private turning: { name: string; startAngle: number; startPtr: number } | null = null;
    // loose items you can drag to the bag (fridge food, vended snacks, the backpack tray at the stove)
    private loose: Loose[] = [];
    private held: Loose | null = null;
    private bag?: Phaser.GameObjects.Image;
    private bagT = 0;
    // per-kind state
    private radioOn = true;
    private noteT = 0;
    private knobs: Record<string, number> = {};
    private ovenOpen = false;
    private flameT = 0;
    private onBurner: { burner: string; item: Loose; smokeT: number } | null = null;
    private doorOpen = false;
    private staticK = 0;
    private staticT = 0;
    private screenOn = true;
    private ticker?: Phaser.GameObjects.Image;
    private phone = { coin: false, offHook: false, digits: '', busy: false };
    private display?: Phaser.GameObjects.Text;
    private displaySmall?: Phaser.GameObjects.Text;
    private cord?: Phaser.GameObjects.Graphics;
    private trayOpen = false;
    private trayBtn?: Phaser.GameObjects.Image;
    /** the sasquatch's hand: rests at the bottom, reaches up while working something (t0288) */
    private hand?: Phaser.GameObjects.Image;

    constructor() {
        super('Minigame');
    }

    // ---------------------------------------------------------------- coordinates
    /** reference px → screen px (the reference frame is centred on the window) */
    private sx(x: number) {
        return L.W / 2 + (x - 1512) * L.s;
    }
    private sy(y: number) {
        return L.H / 2 + (y - 949) * L.s;
    }
    private rx(px: number) {
        return (px - L.W / 2) / L.s + 1512;
    }
    private ry(py: number) {
        return (py - L.H / 2) / L.s + 949;
    }

    private inHit(hit: PartDef['hit'] | undefined, px: number, py: number) {
        if (!hit) return false;
        const x = this.rx(px), y = this.ry(py);
        if (Array.isArray(hit)) return x >= hit[0] && x <= hit[2] && y >= hit[1] && y <= hit[3];
        return Math.hypot(x - hit.cx, y - hit.cy) <= hit.r;
    }

    private part(name: string, visible = true) {
        const d = this.lay.parts[name];
        const img = this.add.image(0, 0, d.key);
        img.setDisplaySize(d.w * L.s, d.h * L.s);
        if (d.origin && d.pivot) {
            img.setOrigin(d.origin[0], d.origin[1]).setPosition(this.sx(d.pivot[0]), this.sy(d.pivot[1]));
        } else img.setPosition(this.sx(d.x), this.sy(d.y));
        if (d.angle) img.setAngle(d.angle);
        img.setVisible(visible);
        this.root.add(img);
        this.parts[name] = img;
        return img;
    }

    // ---------------------------------------------------------------- lifecycle
    create(data: { world: World; kind: MiniKind; opts?: MiniOpts }) {
        L.update(this.scale.width, this.scale.height);
        this.world = data.world;
        this.kind = data.kind;
        this.opts = data.opts ?? {};
        this.parts = {};
        this.loose = [];
        this.held = null;
        this.turning = null;
        this.closing = false;
        this.t = 0;
        this.bagT = 0;
        this.radioOn = true;
        this.knobs = {};
        this.ovenOpen = false;
        this.onBurner = null;
        this.doorOpen = false;
        this.staticK = 0;
        this.screenOn = true;
        this.phone = { coin: false, offHook: false, digits: '', busy: false };
        this.trayOpen = false;
        this.world.inCloseUp = true;
        this.world.player.target = null;
        this.lay = (this.cache.json.get('cu_' + (this.kind === 'newsbox' ? 'newspaper_box' : this.kind)) as LayoutDef) ?? { parts: {}, order: [] };

        // world behind: cards just close in a little; objects zoom right in and darken (like the containers)
        this.prevZoom = this.world.zoomGoal;
        const card = this.kind === 'newspaper' || this.kind === 'lost_dog';
        if (card) this.world.setZoom(1.6);
        else {
            const wp = this.world.promptTarget ?? { x: this.world.player.x, y: this.world.player.y };
            this.world.camFocus = { x: wp.x, y: wp.y };
            this.world.camFocusZ = 0.8;
            // the world closes in ≈1.5x behind the object, undimmed (inside-park t0288)
            this.world.setZoom(1.5);
        }
        this.root = this.add.container(0, 0).setDepth(10);
        this.buildClose();
        switch (this.kind) {
            case 'newspaper': this.buildNewspaper(); break;
            case 'lost_dog': this.buildCard(); break;
            case 'newsbox': this.buildNewsbox(); break;
            case 'radio': this.buildRadio(); break;
            case 'stove': this.buildStove(); break;
            case 'fridge': this.buildFridge(); break;
            case 'vending': this.buildVending(); break;
            case 'tv': this.buildTv(); break;
            case 'payphone': this.buildPayphone(); break;
        }
        if (!card && this.textures.exists('cu_hand_open')) {
            this.hand = this.add.image(L.W / 2, L.H * 1.02, 'cu_hand_open').setDisplaySize(L.r(300), L.r(340)).setOrigin(0.5, 0.35).setDepth(32);
        }
        if (card) {
            // slide up from below (~0.3 s)
            this.root.y = L.H;
            this.tweens.add({ targets: this.root, y: 0, duration: 320, ease: 'Quad.Out' });
        } else {
            this.root.setScale(0.9).setAlpha(0);
            this.root.setPosition(L.W * 0.05, L.H * 0.05);
            this.tweens.add({ targets: this.root, scale: 1, alpha: 1, x: 0, y: 0, duration: 160, ease: 'Quad.Out' });
        }
        this.world.sfx('open');
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
        this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
        this.input.keyboard?.on('keydown-ESC', () => this.close());
        this.world.hud.coins.forceVisible = this.kind === 'vending' || this.kind === 'payphone' || this.kind === 'newsbox';
    }

    private buildClose() {
        const R = L.r(130);
        const g = this.add.graphics();
        g.fillStyle(0x2d2f2e, 1).fillCircle(0, 0, R);
        g.fillStyle(0xebebeb, 1).fillCircle(0, 0, R - L.r(14));
        const x = this.add.image(0, 0, 'ui_close').setTint(0x313131).setDisplaySize(L.r(150), L.r(150));
        this.closeBtn = this.add.container(L.W * 0.938, L.H * 0.902, [g, x]).setDepth(50);
        this.closeBtn.setInteractive(new Phaser.Geom.Circle(0, 0, R), Phaser.Geom.Circle.Contains);
        this.closeBtn.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
            ev.stopPropagation();
            this.close();
        });
    }

    close() {
        if (this.closing) return;
        this.closing = true;
        this.world.sfx('close');
        const card = this.kind === 'newspaper' || this.kind === 'lost_dog';
        const done = () => {
            this.world.inCloseUp = false;
            this.world.camFocus = null;
            this.world.setZoom(this.prevZoom);
            this.world.hud.coins.forceVisible = false;
            if (this.kind === 'fridge' && this.opts.containerId) {
                const left = this.loose.filter((i) => !i.taken).map((i) => i.id);
                G.setFlag('cont_' + this.opts.containerId, `${G.save.day}:${left.join(',')}`);
                if (!left.length) G.save.looted[this.opts.containerId] = G.save.day;
            }
            const cb = this.opts.onDone;
            this.scene.stop();
            cb?.();
        };
        if (card) this.tweens.add({ targets: this.root, y: L.H, duration: 260, ease: 'Quad.In', onComplete: done });
        else this.tweens.add({ targets: this.root, alpha: 0, scale: 0.92, duration: 120, onComplete: done });
    }

    // ---------------------------------------------------------------- cards
    private buildCard() {
        for (const n of this.lay.order) this.part(n);
        this.addHand();
    }

    private buildNewspaper() {
        this.buildCard();
        const slot = this.lay.slots?.day as { x: number; baseline: number; capTop: number; fontSize: number; color: string } | undefined;
        if (slot) {
            const t = this.add.text(this.sx(slot.x), this.sy(slot.baseline), String(G.save.day), {
                fontFamily: 'Bree Serif', fontStyle: 'bold', fontSize: `${Math.round(slot.fontSize * L.s * 1.38)}px`, color: slot.color,
            }).setOrigin(0, 0.86);
            this.root.add(t);
        }
    }

    /** the sasquatch's hand holding the card at the lower right (t68.9) */
    private addHand() {
        if (!this.textures.exists('cu_hand_open')) return;
        const hand = this.add.image(L.W * 0.9, L.H * 0.93, 'cu_hand_open').setDisplaySize(L.r(330), L.r(380)).setAngle(-20);
        this.root.add(hand);
    }

    private buildNewsbox() {
        const paper = this.lay.paper as { key: string; x: number; y: number; scale: number };
        if (paper && this.textures.exists(paper.key)) {
            const card = this.cache.json.get('cu_newspaper') as LayoutDef | undefined;
            const c = card?.parts?.card;
            const img = this.add.image(this.sx(paper.x), this.sy(paper.y), paper.key);
            if (c) img.setDisplaySize(c.w * L.s * paper.scale, c.h * L.s * paper.scale);
            this.root.add(img);
        }
        for (const n of this.lay.order) if (this.lay.parts[n]) this.part(n);
    }

    // ---------------------------------------------------------------- radio
    private buildRadio() {
        for (const n of this.lay.order) this.part(n);
    }

    private radioOff() {
        if (!this.radioOn) return;
        this.radioOn = false;
        this.world.sfx('click');
        this.opts.onRadioOff?.();
    }

    private emitRadioNote() {
        const p = this.lay.particles as { notes: { keys: string[]; emitter: [number, number]; h: number } } | undefined;
        if (!p) return;
        const k = p.notes.keys[Math.floor(Math.random() * p.notes.keys.length)];
        const img = this.add.image(this.sx(p.notes.emitter[0] + (Math.random() - 0.5) * 80), this.sy(p.notes.emitter[1]), k);
        const src = this.textures.get(k).getSourceImage();
        img.setDisplaySize((p.notes.h * L.s * src.width) / src.height, p.notes.h * L.s);
        this.root.add(img);
        this.tweens.add({ targets: img, y: img.y - 250 * L.s, x: img.x + (Math.random() - 0.5) * 60 * L.s, alpha: 0, duration: 1500, ease: 'Sine.Out', onComplete: () => img.destroy() });
    }

    // ---------------------------------------------------------------- stove
    private buildStove() {
        for (const n of this.lay.order) this.part(n);
        // flames sit between each burner and its grate, hidden until lit
        for (const b of ['burnerTL', 'burnerTR', 'burnerBL', 'burnerBR']) {
            const flame = this.part(b + '_flame', false);
            this.root.moveAbove(flame, this.parts[b]);
        }
        const open = this.part('doorOpen', false);
        this.root.moveAbove(open, this.parts.oven);
        for (const k of ['knob1', 'knob2', 'knob3', 'knob4', 'knob5']) this.knobs[k] = 0;
        this.addBagTray();
    }

    private litBurner(name: string) {
        for (const [k, a] of Object.entries(this.knobs)) if (this.lay.parts[k].controls === name && a > 15) return true;
        return false;
    }

    private updateStove(dt: number) {
        this.flameT += dt;
        const f = Math.floor(this.flameT / 0.12) % 2;
        for (const b of ['burnerTL', 'burnerTR', 'burnerBL', 'burnerBR']) {
            const flame = this.parts[b + '_flame'];
            const knob = Object.keys(this.knobs).find((k) => this.lay.parts[k].controls === b);
            const a = knob ? this.knobs[knob] : 0;
            const lit = a > 15;
            flame.setVisible(lit);
            if (lit) {
                const d = this.lay.parts[b + '_flame'];
                flame.setTexture(d.frames?.[f] ?? d.key);
                const k = 0.75 + 0.25 * clamp((a - 15) / 75, 0, 1);
                flame.setDisplaySize(d.w * L.s * k, d.h * L.s * k);
            }
        }
        // food on a burner smokes while the burner's lit
        if (this.onBurner) {
            if (!this.litBurner(this.onBurner.burner)) {
                this.opts.onUnburn?.();
            } else {
                this.onBurner.smokeT -= dt;
                if (this.onBurner.smokeT <= 0) {
                    this.onBurner.smokeT = 0.4;
                    const it = this.onBurner.item.img;
                    const sm = this.add.image(it.x, it.y - L.r(60), 'cu_stove_smoke').setDisplaySize(200 * L.s, 520 * L.s).setAlpha(0.8).setOrigin(0.5, 1);
                    this.root.add(sm);
                    this.tweens.add({ targets: sm, y: sm.y - 300 * L.s, alpha: 0, duration: 1600, onComplete: () => sm.destroy() });
                }
            }
        }
    }

    /** a backpack button at the lower left: tap it to tip your food out along the bottom (t0767) */
    private addBagTray() {
        const key = 'ui_backpack_' + (G.save.backpackColor ?? 'red');
        if (!this.textures.exists(key)) return;
        this.trayBtn = this.add.image(L.r(150), L.H - L.r(190), key).setDisplaySize(L.r(206), L.r(290)).setDepth(40);
        this.trayBtn.setInteractive();
        this.trayBtn.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
            ev.stopPropagation();
            this.toggleTray();
        });
    }

    private toggleTray() {
        this.trayOpen = !this.trayOpen;
        this.world.sfx('backpack');
        for (const l of this.loose) if (!l.taken) l.img.destroy();
        this.loose = this.loose.filter((l) => l.taken);
        if (!this.trayOpen) return;
        const food = G.save.items.filter((id) => itemDef(id).food > 0 || itemDef(id).condiment);
        food.slice(0, 8).forEach((id, i) => {
            const def = itemDef(id);
            const x = L.r(430) + i * L.r(240), y = L.H - L.r(150);
            const img = this.add.image(x, y, 'cu_item_' + def.icon).setDepth(30);
            const src = this.textures.get('cu_item_' + def.icon).getSourceImage();
            const w = L.r(def.size * 0.9);
            img.setDisplaySize(w, (w * src.height) / src.width);
            this.loose.push({ id, img, home: { x, y }, taken: false });
        });
    }

    // ---------------------------------------------------------------- fridge
    private buildFridge() {
        for (const n of this.lay.order) this.part(n);
        this.part('doorOpen', false);
        const shelves = (this.lay.shelves as { itemBaseline: number; x0: number; x1: number }[]) ?? [];
        const loot = this.opts.loot ?? [];
        loot.forEach((id, i) => {
            const sh = shelves[i % Math.max(1, shelves.length)];
            if (!sh) return;
            const def = itemDef(id);
            const per = Math.ceil(loot.length / shelves.length);
            const slot = Math.floor(i / shelves.length);
            const x = sh.x0 + ((slot + 0.5) * (sh.x1 - sh.x0)) / per;
            const src = this.textures.get('cu_item_' + def.icon).getSourceImage();
            const w = def.size * 1.1 * L.s;
            const h = (w * src.height) / src.width;
            const img = this.add.image(this.sx(x), this.sy(sh.itemBaseline) - h / 2, 'cu_item_' + def.icon).setDisplaySize(w, h).setVisible(false);
            this.root.addAt(img, this.root.getIndex(this.parts.door));
            this.loose.push({ id, img, home: { x: img.x, y: img.y }, taken: false });
        });
        this.addBagMouth();
    }

    private openFridge() {
        if (this.doorOpen) return;
        this.doorOpen = true;
        this.world.sfx('lid');
        const door = this.parts.door;
        this.tweens.add({
            targets: door, scaleX: door.scaleX * 0.07, duration: 220, ease: 'Quad.In', onComplete: () => {
                door.setVisible(false);
                this.parts.doorOpen.setVisible(true);
            },
        });
        for (const l of this.loose) l.img.setVisible(true);
    }

    // ---------------------------------------------------------------- vending
    private buildVending() {
        this.part('body');
        const slots = (this.lay.slots as unknown as { item: string; key: string; x: number; y: number; h: number }[]) ?? [];
        for (const s of slots) {
            if (!this.textures.exists(s.key)) continue;
            const src = this.textures.get(s.key).getSourceImage();
            const img = this.add.image(this.sx(s.x), this.sy(s.y), s.key).setDisplaySize((s.h * L.s * src.width) / src.height, s.h * L.s);
            this.root.add(img);
        }
        this.part('tray');
        for (const b of ['button0', 'button1', 'button2']) this.part(b);
        this.addBagMouth();
    }

    private vend(button: string) {
        const d = this.lay.parts[button];
        const btn = this.parts[button];
        const price = d.price ?? 5;
        if (G.save.coins < price) {
            this.tweens.add({ targets: btn, x: btn.x + L.r(10), duration: 50, yoyo: true, repeat: 3 });
            return;
        }
        G.save.coins -= price;
        this.world.sfx('coins');
        if (d.downKey) {
            btn.setTexture(d.downKey);
            this.time.delayedCall(160, () => btn.setTexture(d.key));
        }
        const slots = (this.lay.slots as unknown as { row: string; item: string; key: string; x: number; y: number; h: number }[]) ?? [];
        const s = slots.find((q) => q.row === d.row);
        if (!s) return;
        const tray = this.lay.tray as { itemY: number; dropX: [number, number] };
        const src = this.textures.get(s.key).getSourceImage();
        const h = s.h * L.s * 0.8, w = (h * src.width) / src.height;
        const img = this.add.image(this.sx(s.x), this.sy(s.y), s.key).setDisplaySize(w, h);
        this.root.addAt(img, this.root.getIndex(this.parts.tray));
        const tx = this.sx(tray.dropX[0] + Math.random() * (tray.dropX[1] - tray.dropX[0])), ty = this.sy(tray.itemY);
        const l: Loose = { id: s.item, img, home: { x: tx, y: ty }, taken: false };
        this.loose.push(l);
        this.tweens.add({ targets: img, x: tx, y: ty, duration: 500, ease: 'Bounce.Out', onComplete: () => this.world.sfx('drop') });
    }

    // ---------------------------------------------------------------- tv
    private buildTv() {
        for (const n of this.lay.order) this.part(n);
        this.part('screenAnchor', false);
        for (const s of ['static0', 'static1', 'static2']) this.part(s, false);
        for (const s of ['static0', 'static1', 'static2']) this.root.moveAbove(this.parts[s], this.parts.screenNews);
        const tick = this.lay.slots?.ticker as { rect: number[]; key: string; w: number; h: number } | undefined;
        if (tick && this.textures.exists(tick.key)) {
            const r = tick.rect;
            this.ticker = this.add.image(this.sx(r[2]), this.sy(r[1]), tick.key).setOrigin(0, 0).setDisplaySize(tick.w * L.s, tick.h * L.s);
            const m = this.make.graphics({}, false);
            m.fillRect(this.sx(r[0]), this.sy(r[1]), (r[2] - r[0]) * L.s, (r[3] - r[1]) * L.s);
            this.ticker.setMask(m.createGeometryMask());
            this.root.add(this.ticker);
        }
        // the channel changes between the title card and the anchor now and then
        this.time.addEvent({ delay: 4000, loop: true, callback: () => {
            if (!this.screenOn) return;
            const a = this.parts.screenAnchor.visible;
            this.parts.screenAnchor.setVisible(!a);
            this.parts.screenNews.setVisible(a);
        } });
    }

    private updateTv(dt: number) {
        const tick = this.lay.slots?.ticker as { rect: number[]; w: number; speed: number } | undefined;
        if (this.ticker && tick) {
            this.ticker.x -= tick.speed * L.s * dt;
            if (this.ticker.x < this.sx(tick.rect[0]) - tick.w * L.s) this.ticker.x = this.sx(tick.rect[2]);
            this.ticker.setVisible(this.screenOn);
        }
        // static while the antennas or the dial are off-tune
        const turning = !!this.turning && this.turning.name !== 'volume' && this.turning.name !== 'power';
        this.staticK = clamp(this.staticK + (turning ? dt * 6 : -dt * 1.5), 0, 1);
        this.staticT -= dt;
        const f = Math.floor(this.t / 0.07) % 3;
        ['static0', 'static1', 'static2'].forEach((s, i) => this.parts[s].setVisible(this.screenOn && this.staticK > 0.05 && i === f).setAlpha(0.5 + 0.5 * this.staticK));
        if (this.screenOn && this.staticK > 0.3) this.opts.onStatic?.(dt);
    }

    // ---------------------------------------------------------------- payphone
    private buildPayphone() {
        for (const n of this.lay.order) this.part(n);
        const disp = this.lay.slots?.display as { rect: number[]; color: string; mainLine: { centerY: number; capHeight: number }; smallLine: { centerY: number } };
        if (disp) {
            const cx = this.sx((disp.rect[0] + disp.rect[2]) / 2);
            this.display = this.add.text(cx, this.sy(disp.mainLine.centerY), 'COIN', {
                fontFamily: '"Courier New", monospace', fontStyle: 'bold', fontSize: `${Math.round(disp.mainLine.capHeight * 1.45 * L.s)}px`, color: disp.color,
            }).setOrigin(0.5);
            this.displaySmall = this.add.text(cx, this.sy(disp.smallLine.centerY), '- - -', {
                fontFamily: '"Courier New", monospace', fontSize: `${Math.round(26 * L.s)}px`, color: disp.color,
            }).setOrigin(0.5);
            this.root.add([this.display, this.displaySmall]);
        }
        this.cord = this.add.graphics();
        this.root.addAt(this.cord, this.root.getIndex(this.parts.handset));
    }

    private setDisplay(main: string, small = '') {
        this.display?.setText(main);
        this.displaySmall?.setText(small);
    }

    private async pressKey(k: string) {
        if (!this.phone.offHook || this.phone.busy) return;
        this.world.sfx('tick');
        const rect = (this.lay.keys as Record<string, number[]>)[k];
        if (rect) {
            const fl = this.add.rectangle(this.sx((rect[0] + rect[2]) / 2), this.sy((rect[1] + rect[3]) / 2), (rect[2] - rect[0]) * L.s, (rect[3] - rect[1]) * L.s, 0x000000, 0.18);
            this.root.add(fl);
            this.time.delayedCall(120, () => fl.destroy());
        }
        if (k === '<') this.phone.digits = this.phone.digits.slice(0, -1);
        else if (k !== '*' && this.phone.digits.length < 7) this.phone.digits += k;
        const d = this.phone.digits;
        const shown = d.length > 3 ? d.slice(0, 3) + '-' + d.slice(3) : d;
        this.setDisplay(shown || 'PHONE');
        if (d.length === 7) {
            this.phone.busy = true;
            this.setDisplay(shown, 'CALLING');
            await new Promise<void>((r) => this.time.delayedCall(1400, () => r()));
            if (this.opts.onDial) {
                // the call's dialogue box sits over the phone (inside-park t0856.5)
                this.scene.bringToTop('Hud');
                await this.opts.onDial(shown);
                this.scene.bringToTop();
            }
            this.phone.digits = '';
            this.phone.busy = false;
            if (!this.closing) this.setDisplay('PHONE');
        }
    }

    private hangUp() {
        if (!this.phone.offHook) return;
        this.phone.offHook = false;
        this.phone.coin = false;
        this.phone.digits = '';
        const d = this.lay.parts.handset;
        const piv = d.pivot ?? [d.x, d.y];
        this.parts.handset.setPosition(this.sx(piv[0]), this.sy(piv[1])).setAngle(0);
        this.parts.cord?.setVisible(true);
        this.cord?.clear();
        this.world.sfx('click');
        this.setDisplay('COIN');
        const lever = this.parts.lever;
        this.tweens.add({ targets: lever, angle: 20, duration: 90, yoyo: true });
    }

    private drawCord() {
        if (!this.cord || !this.phone.offHook) return;
        const a = this.lay.cordAnchor as [number, number];
        const h = this.parts.handset;
        const d = this.lay.parts.handset as PartDef & { cordAttach?: [number, number] };
        const att = d.cordAttach ?? [d.x, d.y];
        const piv = d.pivot ?? [d.x, d.y];
        // the attach point turns with the handset about its pivot
        const r = Phaser.Math.DegToRad(h.angle);
        const ax = (att[0] - piv[0]) * L.s, ay = (att[1] - piv[1]) * L.s;
        const ex = h.x + ax * Math.cos(r) - ay * Math.sin(r), ey = h.y + ax * Math.sin(r) + ay * Math.cos(r);
        const sx = this.sx(a[0]), sy = this.sy(a[1]);
        const mx = (sx + ex) / 2, my = Math.max(sy, ey) + L.r(260);
        const c = this.cord;
        c.clear();
        c.lineStyle(44 * L.s, 0xa5a5a5, 1);
        const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(sx, sy), new Phaser.Math.Vector2(mx, my), new Phaser.Math.Vector2(ex, ey));
        curve.draw(c, 24);
    }

    // ---------------------------------------------------------------- bag (drag food in)
    private addBagMouth() {
        if (!this.textures.exists('cu_bag_mouth')) return;
        this.bag = this.add.image(-L.r(400), L.H + L.r(400), 'cu_bag_mouth').setDisplaySize(L.r(700), L.r(560)).setDepth(20);
    }

    private inBag(x: number, y: number) {
        if (!this.bag || this.bagT < 0.5) return false;
        const dx = (x - this.bag.x) / (this.bag.displayWidth * 0.55), dy = (y - this.bag.y) / (this.bag.displayHeight * 0.6);
        return dx * dx + dy * dy < 1;
    }

    // ---------------------------------------------------------------- input
    private onDown(p: Phaser.Input.Pointer) {
        if (this.closing) return;
        const P = this.lay.parts;
        // loose items first
        for (let i = this.loose.length - 1; i >= 0; i--) {
            const l = this.loose[i];
            if (l.taken || !l.img.visible) continue;
            if (Math.abs(p.x - l.img.x) < l.img.displayWidth * 0.6 && Math.abs(p.y - l.img.y) < l.img.displayHeight * 0.6) {
                this.held = l;
                this.world.sfx('grab');
                l.img.setDepth(35);
                if (this.onBurner?.item === l) {
                    this.onBurner = null;
                    this.opts.onUnburn?.();
                }
                return;
            }
        }
        switch (this.kind) {
            case 'radio':
                for (const n of ['antenna', 'knobL', 'knobR']) if (this.grabTurn(n, p)) return;
                break;
            case 'stove':
                for (const n of ['knob1', 'knob2', 'knob3', 'knob4', 'knob5']) {
                    if (this.inHit(P[n].hit, p.x, p.y)) {
                        // tap a knob: off → full → off (dragging also works)
                        this.knobs[n] = this.knobs[n] > 15 ? 0 : 90;
                        this.parts[n].setAngle(this.knobs[n]);
                        this.world.sfx('click');
                        if (P[n].controls === 'oven') this.toggleOven(this.knobs[n] > 15);
                        return;
                    }
                }
                if (this.inHit(this.ovenOpen ? P.doorOpen.hit : P.door.hit, p.x, p.y)) this.toggleOven(!this.ovenOpen);
                break;
            case 'fridge':
                if (!this.doorOpen && this.inHit(P.door.hit, p.x, p.y)) this.openFridge();
                break;
            case 'vending':
                for (const b of ['button0', 'button1', 'button2']) if (this.inHit(P[b].hit, p.x, p.y)) return this.vend(b);
                break;
            case 'tv':
                for (const n of ['antennaL', 'antennaR', 'dial', 'volume']) if (this.grabTurn(n, p)) return;
                if (this.inHit(P.power.hit, p.x, p.y)) {
                    this.screenOn = !this.screenOn;
                    this.parts.power.setAngle(this.screenOn ? P.power.angle ?? 0 : (P.power.angle ?? 0) + 90);
                    this.parts.screenNews.setVisible(this.screenOn);
                    this.parts.screenAnchor.setVisible(false);
                    this.world.sfx('click');
                }
                break;
            case 'payphone': {
                const cs = this.lay.coinSlot as { hit: number[] };
                if (!this.phone.coin && this.inHit(cs.hit, p.x, p.y)) {
                    if (G.save.coins < 1) return;
                    G.save.coins -= 1;
                    this.phone.coin = true;
                    this.world.sfx('coins');
                    this.setDisplay('PICK UP');
                    return;
                }
                if (this.inHit(P.lever.hit ?? [0, 0, 0, 0], p.x, p.y)) return this.hangUp();
                if (this.inHit(P.handset.hit, p.x, p.y)) {
                    if (!this.phone.offHook) {
                        if (!this.phone.coin) return;
                        this.phone.offHook = true;
                        this.parts.cord?.setVisible(false);
                        this.setDisplay('PHONE');
                        this.world.sfx('click');
                        // lift it off the cradle, tilted toward the keypad
                        this.tweens.add({ targets: this.parts.handset, x: this.parts.handset.x - L.r(80), y: this.parts.handset.y + L.r(380), angle: -12, duration: 220 });
                    } else this.hangUp();
                    return;
                }
                for (const [k, r] of Object.entries(this.lay.keys as Record<string, number[]>)) if (this.inHit(r, p.x, p.y)) return void this.pressKey(k);
                break;
            }
            case 'newsbox':
                // the window, coin slot or handle opens the paper (viewing was free, inside-park §4.3)
                this.scene.restart({ world: this.world, kind: 'newspaper', opts: this.opts });
                break;
        }
    }

    private toggleOven(open: boolean) {
        if (open === this.ovenOpen) return;
        this.ovenOpen = open;
        this.world.sfx('lid');
        this.parts.door.setVisible(!open);
        this.parts.doorOpen.setVisible(open);
    }

    /** start rotating a part about its pivot if the pointer is on it */
    private grabTurn(name: string, p: Phaser.Input.Pointer) {
        const d = this.lay.parts[name];
        if (!d?.pivot) return false;
        let hit = false;
        if (d.capsule) {
            // within r of the rod from the pivot along its current angle
            const a = Phaser.Math.DegToRad(this.parts[name].angle) - Math.PI / 2;
            const x = this.rx(p.x) - d.pivot[0], y = this.ry(p.y) - d.pivot[1];
            const along = x * Math.cos(a) + y * Math.sin(a), off = Math.abs(-x * Math.sin(a) + y * Math.cos(a));
            hit = along > 0 && along < d.capsule.len && off < d.capsule.r;
        } else hit = this.inHit(d.hit, p.x, p.y);
        if (!hit) return false;
        const ptr = Math.atan2(p.y - this.sy(d.pivot[1]), p.x - this.sx(d.pivot[0]));
        this.turning = { name, startAngle: this.parts[name].angle, startPtr: ptr };
        if (this.kind === 'radio') this.radioOff();
        this.world.sfx('click');
        return true;
    }

    private onUp(p: Phaser.Input.Pointer) {
        this.turning = null;
        const l = this.held;
        if (!l) return;
        this.held = null;
        l.img.setDepth(30);
        // food onto a lit burner (stove)
        if (this.kind === 'stove') {
            for (const b of ['burnerTL', 'burnerTR', 'burnerBL', 'burnerBR']) {
                if (this.inHit(this.lay.parts[b].hit, p.x, p.y) && this.litBurner(b)) {
                    const d = this.lay.parts[b];
                    l.taken = true;
                    l.img.setPosition(this.sx(d.x), this.sy(d.y) - l.img.displayHeight * 0.3);
                    this.root.add(l.img);
                    const idx = G.save.items.indexOf(l.id);
                    if (idx >= 0) G.save.items.splice(idx, 1);
                    this.onBurner = { burner: b, item: l, smokeT: 0 };
                    this.world.sfx('squirt');
                    this.opts.onBurn?.(l.id);
                    return;
                }
            }
        }
        if (this.inBag(p.x, p.y) && (this.kind === 'fridge' || this.kind === 'vending')) {
            if (G.save.items.length >= BACKPACK_CAPACITY) {
                this.tweens.add({ targets: l.img, x: l.home.x, y: l.home.y, duration: 220 });
                return;
            }
            G.save.items.push(l.id);
            l.taken = true;
            this.world.sfx('stash');
            this.tweens.add({ targets: l.img, x: this.bag!.x, y: this.bag!.y, scale: l.img.scale * 0.3, alpha: 0, duration: 180, onComplete: () => l.img.destroy() });
            return;
        }
        this.tweens.add({ targets: l.img, x: l.home.x, y: l.home.y, duration: 240, ease: 'Quad.Out' });
    }

    // ---------------------------------------------------------------- update
    update(_t: number, deltaMs: number) {
        const dt = Math.min(0.05, deltaMs / 1000);
        this.t += dt;
        L.update(this.scale.width, this.scale.height);
        const p = this.input.activePointer;
        if (this.held) this.held.img.setPosition(p.x, p.y);
        if (this.hand) {
            const busy = !!this.held || !!this.turning || p.isDown;
            const tx = busy ? p.x : L.W / 2 + (p.x - L.W / 2) * 0.25;
            const ty = busy ? p.y + L.r(40) : L.H * 0.97;
            const k = Math.min(1, dt * 14);
            this.hand.x += (tx - this.hand.x) * k;
            this.hand.y += (ty - this.hand.y) * k;
            this.hand.setTexture(this.held || this.turning ? 'cu_hand_grab' : 'cu_hand_open');
        }
        if (this.bag) {
            this.bagT = clamp(this.bagT + (this.held ? dt : -dt) / 0.18, 0, 1);
            const k = easeOut(this.bagT);
            this.bag.setPosition(-L.r(200) + k * L.r(530), L.H + L.r(300) - k * L.r(480));
        }
        if (this.turning) {
            const d = this.lay.parts[this.turning.name];
            const ptr = Math.atan2(p.y - this.sy(d.pivot![1]), p.x - this.sx(d.pivot![0]));
            let a = this.turning.startAngle + Phaser.Math.RadToDeg(Phaser.Math.Angle.Wrap(ptr - this.turning.startPtr));
            if (this.kind === 'stove') {
                a = clamp(a, 0, 90);
                this.knobs[this.turning.name] = a;
                if (d.controls === 'oven') this.toggleOven(a > 15);
            } else if (this.turning.name.startsWith('antenna')) a = clamp(a, -85, 85);
            this.parts[this.turning.name].setAngle(a);
        }
        if (this.kind === 'radio' && this.radioOn) {
            this.noteT -= dt;
            if (this.noteT <= 0) {
                this.noteT = 0.6;
                this.emitRadioNote();
            }
        }
        if (this.kind === 'stove') this.updateStove(dt);
        if (this.kind === 'tv') this.updateTv(dt);
        if (this.kind === 'payphone') this.drawCord();
    }
}
