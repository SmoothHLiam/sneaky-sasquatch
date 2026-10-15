import * as Phaser from 'phaser';
import type { PropPlacement, ZoneDef } from '../types';
import type { ZoneScript } from './index';
import type { World } from '../../scenes/World';
import { G } from '../../core/state';
import { depthFor, wx, wy } from '../../core/proj';
import { RACCOON_SHOP, ShopItem } from '../../data/shop';

/**
 * RACCOON SHOP interior — the hollow inside of the shop tree: a round sandy room
 * in black void, the trunk wall ring around the back, three counters of tools
 * with prices, lanterns, a wood stove and a pizza poster
 * (tutorial t235-t252, your research/frames/tutorial/t246.5_shop_interior_prices_coin_hud.jpg).
 *
 * Layout measured on t246.5 (shop zoom ≈1.75x): counters 4.2 m long, 2.6-2.8 m
 * apart, the back counter ≈2.3 m in front of the wall; lanterns 2.6 m either
 * side of the back counter; stove against the east wall.
 */
const W = 16, H = 15;
const C = { x: 8, y: 7.6 };          // floor centre (shop_interior_floor anchor)
const WALL_R0 = 4.95, WALL_R1 = 5.9; // collider ring just outside the drawn wall (r 4.9-5.3)
const DOOR_HALF_DEG = 8;              // gap in the ring at the south (≈1.5 m wide)
const ROWS = [5.4, 8.0, 10.6];        // counter centres, door → back wall
const SHELF_X = 8;
const PLAQUE_DX = [-1.38, 0, 1.38];   // from shop_shelf.json "plaques"
const PLAQUE_Y = -0.27, PLAQUE_Z = 0.505;
const SHELF_TOP_Z = 0.85;

/** ring of wall quads around the room, leaving the door gap at the south */
function wallRing(): { x: number; y: number }[][] {
    const out: { x: number; y: number }[][] = [];
    const step = 12;
    for (let a = 0; a < 360; a += step) {
        const a0 = a, a1 = a + step;
        const mid = (a0 + a1) / 2;
        if (Math.abs(mid - 270) < DOOR_HALF_DEG + step / 2) continue;
        const p = (r: number, d: number) => ({ x: C.x + Math.cos((d * Math.PI) / 180) * r, y: C.y + Math.sin((d * Math.PI) / 180) * r });
        out.push([p(WALL_R0, a0), p(WALL_R1, a0), p(WALL_R1, a1), p(WALL_R0, a1)]);
    }
    return out;
}

const shelfProps: PropPlacement[] = ROWS.map((y, r) => ({ type: 'shopShelf', x: SHELF_X, y, id: 'shelf' + r }));
const itemProps: PropPlacement[] = RACCOON_SHOP.flatMap((row, r) =>
    row.map((item, i) => ({ type: item.prop, x: SHELF_X + PLAQUE_DX[i], y: ROWS[r] - 0.05, z: SHELF_TOP_Z, id: 'item_' + item.id })),
);

export const shopZone: ZoneDef = {
    id: 'shop',
    name: 'Raccoon Shop',
    w: W,
    h: H,
    zoom: 1.75, // [measured t246.5: sasquatch ≈498 ref px tall vs 285 outdoors]
    showCoins: true,
    grass: false,
    groundColor: 0x000000,
    ground: [],
    props: [
        { type: 'shopInteriorFloor', x: C.x, y: C.y },
        { type: 'rugRed', x: 8, y: 3.5 },
        ...shelfProps,
        ...itemProps,
        { type: 'lantern', x: SHELF_X - 2.6, y: ROWS[2] + 0.3, z: 0.85 },
        { type: 'lantern', x: SHELF_X + 2.6, y: ROWS[2] + 0.3, z: 0.85 },
        { type: 'woodStove', x: 12.7, y: 6.6 },
        { type: 'posterPizza', x: 12.5, y: 8.7 },
    ],
    walls: wallRing(),
    exits: [{ rect: { x: 7.0, y: 1.4, w: 2.0, h: 1.0 }, to: 'home', entry: 'shopDoor' }],
    entries: {
        default: { x: 8, y: 2.9, facing: 90 },
        door: { x: 8, y: 2.9, facing: 90 },
    },
    // the raccoon keeps shop on the left, by the door (t235.5-239.9)
    npcs: [{ id: 'raccoon', kind: 'raccoon', x: 5.0, y: 3.9, facing: 0, ifFlag: 'raccoonInShop' }],
    interactables: RACCOON_SHOP.flatMap((row, r) =>
        row.map((item, i) => ({
            id: 'buy_' + item.id,
            kind: 'shop' as const,
            x: SHELF_X + PLAQUE_DX[i],
            y: ROWS[r] - 0.75,
            radius: 0.7,
            icon: 'coin' as const,
            ifNotFlag: 'own_' + item.id,
        })),
    ),
    respawn: { x: 8, y: 3 },
    camBounds: { x: 1, y: 0.5, w: W - 2, h: H - 1 },
    rangersRespond: false,
    scatter: { seed: 51 },
};

// --------------------------------------------------------------------- script
let busy = false;

function priceLabel(w: World, x: number, y: number, price: number): Phaser.GameObjects.GameObject[] {
    // gold numerals + coin on the counter's dark plaque; drawn large and scaled down so it stays crisp
    const px = wx(x), py = wy(y + PLAQUE_Y, PLAQUE_Z);
    const t = w.add.text(px - 4, py, String(price), { fontFamily: 'Bree Serif', fontStyle: 'bold', fontSize: '96px', color: '#e8b230' }).setOrigin(1, 0.5).setScale(0.25);
    const coin = w.add.image(px + 9, py, 'ui_coin').setDisplaySize(22, 22);
    const depth = depthFor(y + PLAQUE_Y) + 0.5;
    for (const o of [t, coin]) {
        w.objLayer.add(o);
        o.setDepth(depth);
    }
    // centre the pair on the plaque
    const wTotal = t.displayWidth + 26;
    t.x = px - wTotal / 2 + t.displayWidth;
    coin.x = t.x + 4 + 11;
    return [t, coin];
}

function removeItemProp(w: World, id: string) {
    const i = w.props.findIndex((o) => o.p.id === 'item_' + id);
    if (i < 0) return null;
    const [o] = w.props.splice(i, 1);
    return o.img;
}

async function buy(w: World, item: ShopItem, labels: Phaser.GameObjects.GameObject[]) {
    if (busy || G.flag('own_' + item.id)) return;
    busy = true;
    const p = w.player;
    p.locked = true;
    p.stop();
    // [guess] purchase wording — no purchase is shown in the reference videos
    if (G.save.coins < item.price) {
        await w.say(null, ["You don't have enough coins!"], { zoom: 1 });
    } else if (await w.ask(null, `Buy the {g}${item.name}{/} for ${item.price} coins?`)) {
        G.save.coins -= item.price;
        G.setFlag('own_' + item.id);
        w.sfx('coins');
        const img = removeItemProp(w, item.id);
        if (img) w.tweens.add({ targets: img, y: img.y - 40, alpha: 0, duration: 380, ease: 'Quad.In', onComplete: () => img.destroy() });
        w.tweens.add({ targets: labels, alpha: 0, duration: 250, onComplete: () => labels.forEach((l) => l.destroy()) });
        G.persist();
    }
    p.locked = false;
    busy = false;
}

/** dim lantern-lit falloff over the floor: the still reads #9d793f at the middle, darker at the walls */
function addShade(w: World) {
    const key = 'shop_shade';
    if (!w.textures.exists(key)) {
        const c = w.textures.createCanvas(key, 256, 256)!;
        const ctx = c.getContext();
        const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
        g.addColorStop(0, 'rgba(40,24,8,0.12)');
        g.addColorStop(0.6, 'rgba(40,24,8,0.22)');
        g.addColorStop(1, 'rgba(20,12,4,0.55)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 256);
        c.refresh();
    }
    // an ellipse covering the floor disc as projected (x radius 5.3 m, y foreshortened)
    const img = w.add.image(wx(C.x), wy(C.y), key).setDisplaySize(wx(11.4) - wx(0), wy(0) - wy(11.4));
    w.groundLayer.add(img);
    img.setDepth(1.5e6);
}

export const shopScript: ZoneScript = {
    onEnter(w: World) {
        busy = false;
        addShade(w);
        RACCOON_SHOP.forEach((row, r) =>
            row.forEach((item, i) => {
                if (G.flag('own_' + item.id)) {
                    removeItemProp(w, item.id)?.destroy();
                    return;
                }
                const labels = priceLabel(w, SHELF_X + PLAQUE_DX[i], ROWS[r], item.price);
                w.handlers['buy_' + item.id] = () => void buy(w, item, labels);
            }),
        );
    },
};
