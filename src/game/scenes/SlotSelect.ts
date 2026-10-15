import * as Phaser from 'phaser';
import { L } from '../ui/layout';
import { SaveData, deleteSlot, loadSlot } from '../core/state';
import { atlasMeta } from '../core/assets';
import type { World } from './World';
import type { Hud } from './Hud';

/**
 * Save-slot picker (tutorial §3.2): three portrait cards drop in from above with
 * an overshoot; hover scales 1.13x; press squashes; on pick the cards rise then
 * fall away, the iris closes on the title scene, and the game starts.
 * Right-click a used card to delete that save.
 */
const CARD = [
    { x0: 0.097, x1: 0.357 },
    { x0: 0.369, x1: 0.63 },
    { x0: 0.642, x1: 0.902 },
];

export class SlotSelect extends Phaser.Scene {
    private cards: Phaser.GameObjects.Container[] = [];
    private picked = false;

    constructor() {
        super('SlotSelect');
    }

    create() {
        L.update(this.scale.width, this.scale.height);
        this.picked = false;
        this.cards = [];
        for (let i = 0; i < 3; i++) this.cards.push(this.buildCard(i, loadSlot(i + 1)));
        // drop in from above with one bounce (≈0.47 s)
        this.cards.forEach((c, i) => {
            const y = c.y;
            c.y = -L.H;
            this.tweens.add({ targets: c, y, duration: 470, delay: i * 40, ease: 'Back.Out', easeParams: [1.4] });
        });
    }

    private buildCard(i: number, save: SaveData | null): Phaser.GameObjects.Container {
        const W = L.W, H = L.H;
        const x0 = W * CARD[i].x0, x1 = W * CARD[i].x1, y0 = H * 0.126, y1 = H * 0.872;
        const cw = x1 - x0, ch = y1 - y0;
        const c = this.add.container(x0 + cw / 2, y0 + ch / 2);
        const border = Math.max(6, H * 0.0095), rad = H * 0.016;
        const bg = this.add.graphics();
        bg.fillStyle(0x223120, 1).fillRoundedRect(-cw / 2, -ch / 2, cw, ch, rad);
        if (save) {
            bg.fillStyle(0x46a83a, 1).fillRoundedRect(-cw / 2 + border, -ch / 2 + border, cw - border * 2, ch - border * 2, rad * 0.7);
        } else {
            bg.fillStyle(0x0a9a98, 1).fillRoundedRect(-cw / 2 + border, -ch / 2 + border, cw - border * 2, ch - border * 2, rad * 0.7);
        }
        c.add(bg);
        if (save) {
            // little framed scene: grass, a fern, a pine edge, the sasquatch standing front-on
            const inner = { x: -cw / 2 + border, y: -ch / 2 + border, w: cw - border * 2, h: ch - border * 2 };
            if (this.textures.exists('grass_tile')) {
                const grass = this.add.tileSprite(inner.x, inner.y, inner.w, inner.h * 0.82, 'grass_tile').setOrigin(0).setTileScale(0.35);
                c.add(grass);
            }
            const deco = (key: string, x: number, y: number, sc: number) => {
                if (!this.textures.exists(key)) return;
                const img = this.add.image(x, y, key).setOrigin(0.5, 1).setScale(sc * (H / 1898));
                c.add(img);
            };
            deco('fern_a', inner.x + inner.w * 0.72, inner.y + inner.h * 0.27, 0.55);
            deco('fern_b', inner.x + inner.w * 0.18, inner.y + inner.h * 0.22, 0.45);
            deco('pine_small_a', inner.x + inner.w * 0.14, inner.y + inner.h * 0.8, 0.5);
            deco('fern_a', inner.x + inner.w * 0.66, inner.y + inner.h * 0.66, 0.4);
            const meta = atlasMeta('sasquatch');
            if (meta && this.textures.exists('sasquatch')) {
                const sh = this.add.ellipse(0, inner.y + inner.h * 0.6, cw * 0.4, cw * 0.15, 0x000000, 0.12);
                const sas = this.add.sprite(0, inner.y + inner.h * 0.6, 'sasquatch', 'idle_0_0');
                sas.setOrigin(meta.anchorX / meta.cellW, meta.anchorY / meta.cellH).setScale((H / 1898) * 1.4);
                c.add([sh, sas]);
            }
            // bottom strip: coins | calendar(day)
            const sy = ch / 2 - border - H * 0.122, sh2 = H * 0.112;
            const strip = this.add.graphics();
            strip.fillStyle(0x1c281d, 1).fillRoundedRect(-cw / 2 + border * 2, sy, cw * 0.55, sh2, rad * 0.5);
            strip.fillRoundedRect(-cw / 2 + border * 2 + cw * 0.565, sy, cw * 0.355, sh2, rad * 0.5);
            const coinsT = this.add.text(-cw / 2 + border * 2 + cw * 0.06, sy + sh2 / 2, String(save.coins), { fontFamily: L.font, fontStyle: 'bold', fontSize: `${Math.round(H * 0.045)}px`, color: '#eab229' }).setOrigin(0, 0.5);
            const coin = this.add.image(coinsT.x + coinsT.width + H * 0.035, sy + sh2 / 2, 'ui_coin').setDisplaySize(H * 0.06, H * 0.06);
            const calX = -cw / 2 + border * 2 + cw * 0.565 + cw * 0.355 / 2, calY = sy + sh2 / 2;
            const cal = this.add.graphics();
            const cs = H * 0.07;
            cal.fillStyle(0xa9a592, 1).fillRoundedRect(calX - cs * 0.62, calY - cs * 0.48, cs * 1.24, cs * 1.06, cs * 0.12);
            cal.fillStyle(0xeeeed3, 1).fillRoundedRect(calX - cs * 0.62, calY - cs * 0.5, cs * 1.24, cs * 0.98, cs * 0.12);
            cal.fillStyle(0xd74351, 1).fillRoundedRect(calX - cs * 0.62, calY - cs * 0.5, cs * 1.24, cs * 0.24, { tl: cs * 0.12, tr: cs * 0.12, bl: 0, br: 0 });
            cal.fillStyle(0x9a9a9a, 1).fillRect(calX - cs * 0.32, calY - cs * 0.62, cs * 0.07, cs * 0.2).fillRect(calX + cs * 0.25, calY - cs * 0.62, cs * 0.07, cs * 0.2);
            const day = this.add.text(calX, calY + cs * 0.1, String(save.day), { fontFamily: L.font, fontSize: `${Math.round(cs * 0.62)}px`, color: '#1c1c19' }).setOrigin(0.5);
            c.add([strip, coinsT, coin, cal, day]);
        } else {
            const ng = this.add.text(0, -ch * 0.04, 'New Game', { fontFamily: L.font, fontSize: `${Math.round(H * 0.052)}px`, color: '#ffffff' }).setOrigin(0.5);
            c.add(ng);
        }
        // slot number badge
        const br = H * 0.058;
        const badge = this.add.circle(-cw / 2 + border + br * 1.05, -ch / 2 + border + br * 1.05, br, save ? 0x212c1e : 0x173031, 1);
        const num = this.add.text(badge.x, badge.y, String(i + 1), { fontFamily: L.font, fontStyle: 'bold', fontSize: `${Math.round(br * 1.15)}px`, color: '#ffffff' }).setOrigin(0.5);
        c.add([badge, num]);

        c.setSize(cw, ch);
        c.setInteractive(new Phaser.Geom.Rectangle(-cw / 2, -ch / 2, cw, ch), Phaser.Geom.Rectangle.Contains);
        c.on('pointerover', () => !this.picked && this.tweens.add({ targets: c, scale: 1.13, duration: 130, ease: 'Quad.Out' }));
        c.on('pointerout', () => !this.picked && this.tweens.add({ targets: c, scale: 1, duration: 130, ease: 'Quad.Out' }));
        c.on('pointerdown', (p: Phaser.Input.Pointer) => {
            if (this.picked) return;
            if (p.rightButtonDown() && save) {
                if (window.confirm(`Delete save ${i + 1}?`)) {
                    deleteSlot(i + 1);
                    this.scene.restart();
                }
                return;
            }
            this.pick(i, c);
        });
        return c;
    }

    private pick(i: number, card: Phaser.GameObjects.Container) {
        this.picked = true;
        const world = this.scene.get('World') as World;
        world.sfx('click');
        // press squash (≈1.03x and back), cards rise ~5 %H then fall off the bottom
        this.tweens.add({ targets: card, scale: 1.03, duration: 70, yoyo: true, onComplete: () => card.setScale(1.13) });
        this.time.delayedCall(250, () => {
            for (const c of this.cards) {
                this.tweens.chain({
                    targets: c,
                    tweens: [
                        { y: c.y - L.H * 0.05, duration: 200, ease: 'Quad.Out' },
                        { y: L.H * 1.6, duration: 300, ease: 'Quad.In' },
                    ],
                });
            }
        });
        this.time.delayedCall(1000, async () => {
            const hud = this.scene.get('Hud') as Hud;
            await hud.irisTo(true, 0.43, L.W * 0.499, L.H * 0.442);
            this.scene.stop('Title');
            this.scene.stop();
            world.scene.restart({ slot: i + 1, irisIn: true });
        });
    }
}
