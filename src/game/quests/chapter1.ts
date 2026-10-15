import { QUEST_HOOKS, type World } from '../scenes/World';
import { G } from '../core/state';
import { MAP_PIECES_TOTAL } from '../data/items';
import { spriteScale, wx, wy } from '../core/proj';
import { atlasMeta, spriteMeta } from '../core/assets';
import type { Vec } from '../core/math';
import type { Animal } from '../entities/Animal';
import type { Human } from '../entities/Human';
import type { Player } from '../entities/Player';

/**
 * CHAPTER 1 START — "the bonus park cutscene" (videos/bonus park cutscene.mov, notes §9;
 * lines verbatim from §2.2).
 * Trigger [wiki Storyline]: the morning after the sasquatch first visits the Ranger
 * Station, the Raccoon catches him leaving his cabin and they spy from the bush by the
 * station door:
 *   shot 1  station lot, static 2x: "???" (the businessman) tells the ranger 4 lines,
 *           walks back to his black car; the ranger turns to the camera; "Oh no!!" from
 *           the bush (off-screen), then an eased pan up-left onto the station (≈1.5 s),
 *           hold 2.8 s; fade to black 1.0 s, black 0.43 s.
 *   shot 2  notice-board clearing: iris open on the sasquatch, zoom 2x; Raccoon 4 lines,
 *           the Duck waddles in (2 lines, the first shaky), leaves, Raccoon 3 lines and
 *           dashes off, the Duck comes back with a map piece; item get; system box.
 *   shot 3  zoom out; the board now shows pinned map pieces with a "?" over it.
 * The set-up before the recording (the Raccoon at the cabin, the car arriving) wasn't
 * recorded: those lines are marked [guess].
 */
const RACCOON = 'Raccoon';
const DUCK = 'Duck';
const BIZ = '???';

/** [measured cutscene t0.5 against the station door: the shot is ≈1.6x normal zoom (door 9.5 %W vs
 *  6 %W in play), door centre at 10 %W] — `cam` is the dialogue focus (it looks 1.2 m up) */
const SHOT1 = {
    zoom: 1.6,
    cam: { x: 20.9, y: 15.7 },
    ranger: { x: 19.9, y: 15.6 },
    biz: { x: 21.65, y: 16.0 },
    car: { x: 25.0, y: 17.5 },
    /** inside the bush cluster's right half: the "Oh no!!" tail points there (t11.0) */
    bush: { x: 14.6, y: 17.4 },
    /** pan ≈2250 px left, 480 px up (≈6.5 m, 1.8 m at this zoom) → door 37 %W right of centre, its
     *  base on the centre line, the bush left of it (t11.0) */
    panTo: { x: 14.2, y: 17.5 },
};
/** [measured cutscene t21.0 / t29.8, 2x zoom, offsets from the notice board at (36, 29.6)] */
const SHOT2 = {
    sas: { x: 35.3, y: 27.9 },
    raccoon: { x: 37.25, y: 28.05 },
    duckIn: { x: 31.4, y: 23.2 },
    duckSpot: { x: 35.3, y: 26.4 },
    duckBack: { x: 36.3, y: 27.4 },
    raccoonOut: { x: 46, y: 28.4 },
    /** [measured k16.0] the 2x shot is centred on their feet, not their heads */
    focusZ: 0,
};

let armed = false;
let running = false;
// dev handle for the test harness
Object.assign(window, { __c1: { get armed() { return armed; }, get running() { return running; } } });

/** ease the camera focus between two points (smoothstep), like the cutscene's pan */
function panFocus(w: World, from: Vec, to: Vec, dur: number): Promise<void> {
    return new Promise((res) => {
        w.tweens.addCounter({
            from: 0, to: 1, duration: dur * 1000,
            onUpdate: (tw) => {
                const k = tw.getValue() ?? 0, e = k * k * (3 - 2 * k);
                w.camFocus = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
            },
            onComplete: () => res(),
        });
    });
}

/** palm of the raised hand in the "get" pose, from sasquatch.json meta.sas.get.hand (m from the feet);
 *  directions 9-15 are mirrors of 7-1, so their x flips */
function getHand(p: Player): number[] {
    const hands = atlasMeta('sasquatch')?.get?.hand;
    const k = p.dir16();
    const h = hands?.[String(k > 8 ? 16 - k : k)];
    if (!h) return [-0.53, 0.19, 1.53];
    return k > 8 ? [-h[0], h[1], h[2]] : h;
}

/** item get (cut033.4): he turns 3/4 to camera-left, raises his right hand, the item floats just above it */
function holdUp(w: World, key: string) {
    const p = w.player;
    p.facing = -0.75 * Math.PI;
    p.pose = 'get';
    const [hx, hy, hz] = getHand(p);
    const meta = spriteMeta(w, key);
    // the piece reads ≈0.7 m wide in the still
    const sc = (spriteScale(meta.ppm) * 0.7) / (meta.w / meta.ppm);
    const img = w.add.image(wx(p.x + hx), wy(p.y + hy, hz + 0.1), key).setOrigin(meta.anchorX / meta.w, meta.anchorY / meta.h).setScale(sc).setDepth(9e6);
    w.objLayer.add(img);
    img.setAlpha(0);
    w.tweens.add({ targets: img, alpha: 1, y: img.y - 14, duration: 280, ease: 'Back.Out' });
    return {
        destroy() {
            img.destroy();
            p.pose = null;
        },
    };
}

async function play(w: World) {
    running = true;
    const hud = w.hud;
    let p = w.player;
    p.locked = true;
    p.stop();

    // ---- the Raccoon catches him leaving his cabin [not recorded]
    let r = w.animal('raccoon') ?? (w.spawnNpc({ id: 'raccoonC1', kind: 'raccoon', x: p.x + 6, y: p.y - 1.2, facing: 180 }) as Animal);
    r.marker = null;
    await w.walkAnimal(r, { x: p.x + 1.1, y: p.y - 0.4 }, 1.4);
    await w.say(RACCOON, ['Psst! Sasquatch! Something weird is going on at the {g}Ranger Station{/}. Follow me!'], { focus: [r, p] }); // [guess]
    await hud.fadeTo(1, 1.0);

    // ---- shot 1: the Ranger Station lot
    w.loadZone('station', null);
    p = w.player;
    p.setPosition(SHOT1.bush.x, SHOT1.bush.y);
    p.locked = true;
    p.ghost = true; // the two of them hide in the berry bush by the door
    hud.hideHud = true;
    w.cutsceneBubbles = true;
    const ranger = w.human('stationRanger');
    if (ranger) {
        ranger.sleeping = false;
        ranger.behaviour = 'idle';
        ranger.anim = 'idle';
        ranger.state = 'scripted';
        ranger.setPosition(SHOT1.ranger.x, SHOT1.ranger.y);
        ranger.facing = 0;
    }
    const biz = w.spawnNpc({ id: 'pemberton', kind: 'camper', look: 'businessman', x: SHOT1.biz.x, y: SHOT1.biz.y, facing: 180 }) as Human;
    biz.state = 'scripted';
    w.vehicles.add('pembertonCar', 'car_sports_black', SHOT1.car.x, SHOT1.car.y, 180).locked = true;
    const eaves = w.spawnNpc({ id: 'raccoonBush', kind: 'raccoon', x: SHOT1.bush.x, y: SHOT1.bush.y, facing: -90 }) as Animal;
    eaves.ghost = true;
    // the Fox isn't around for this
    const fox = w.animal('fox');
    if (fox) fox.visible = false;
    w.camFocus = { ...SHOT1.cam };
    w.camFocusZ = 1.2;
    w.setZoom(SHOT1.zoom, true);
    w.snapCamera();
    await hud.fadeTo(0, 0.6);
    await w.say(BIZ, [
        'Greetings, you must be the chap who operates this campground.',
        'I regret to inform you that we will be repossessing this land.',
        'We intend to demolish the park and build some ~beautiful~ condominiums.',
        'Unless, of course, you come up with the funds to purchase it yourself.',
    ], { focus: [SHOT1.cam], zoom: SHOT1.zoom, keepZoom: true });
    w.camFocus = { ...SHOT1.cam };
    w.camFocusZ = 1.2;
    // he strolls back to his car; the ranger turns to us, aghast (6.5-8.6)
    void w.walkHuman(biz, { x: SHOT1.car.x - 1.0, y: SHOT1.car.y - 1.1 }, 0.55);
    if (ranger) ranger.facing = -Math.PI / 2;
    await w.wait(1.4);
    eaves.say('Oh no!!', 5.1);
    await w.wait(0.7);
    await panFocus(w, SHOT1.cam, SHOT1.panTo, 1.5);
    await w.wait(2.9);
    await hud.fadeTo(1, 1.0);
    await w.wait(0.43);

    // ---- shot 2: the notice-board clearing
    w.loadZone('home', null);
    p = w.player;
    p.setPosition(SHOT2.sas.x, SHOT2.sas.y);
    p.facing = 0;
    p.locked = true;
    hud.hideHud = true;
    w.cutsceneBubbles = true;
    r = (w.animal('raccoon') ?? w.spawnNpc({ id: 'raccoonC1', kind: 'raccoon', x: 0, y: 0 })) as Animal;
    r.setPosition(SHOT2.raccoon.x, SHOT2.raccoon.y);
    r.facing = Math.PI;
    w.camFocus = null;
    w.setZoom(w.restZoom(), true);
    w.snapCamera();
    await hud.irisTo(true, 0.01);
    hud.setBlack(0);
    const s = w.worldToScreen(p.x, p.y, 1);
    await hud.irisTo(false, 0.44, s.x, s.y);
    hud.irisOff();
    const both = [p, r];
    await w.say(RACCOON, [
        "Sasquatch, you've gotta save the park!",
        "There's a legend about a {r}treasure{/} hidden somewhere nearby.",
        'If you can find it, maybe we can buy back the park for ourselves.',
        'We used to have a map that led to the treasure, but *someone* tore it up.',
    ], { focus: both, zoom: 2, keepZoom: true, focusZ: SHOT2.focusZ });
    const duck = w.spawnNpc({ id: 'duckC1', kind: 'duck', x: SHOT2.duckIn.x, y: SHOT2.duckIn.y, facing: 40 }) as Animal;
    await w.walkAnimal(duck, SHOT2.duckSpot, 0.55);
    await w.say(DUCK, ["{s}IT'S WASN'T MY FAULT.{/}", 'I was trying to make a nest but the wind blew it all away.'], { focus: both, zoom: 2, keepZoom: true, focusZ: SHOT2.focusZ });
    await w.walkAnimal(duck, SHOT2.duckIn, 0.55);
    await w.say(RACCOON, [
        'The wind must have scattered it all over the park, so start exploring!',
        'If you can track down all nine pieces, we can do it!',
        'Good luck, Sasquatch!',
    ], { focus: both, zoom: 2, keepZoom: true, focusZ: SHOT2.focusZ });
    await w.walkAnimal(r, SHOT2.raccoonOut, 1.8);
    r.visible = false;
    await w.walkAnimal(duck, SHOT2.duckBack, 0.6);
    await w.say(DUCK, ['I found this in the bush. Is this one?'], { focus: [p, duck], zoom: 2, keepZoom: true, focusZ: SHOT2.focusZ });
    // item get: turn to the camera and hold the piece up (≈31.5-34.3)
    p.facing = -Math.PI / 2;
    await w.wait(0.6);
    const piece = holdUp(w, 'map_piece');
    w.sfx('grab');
    await w.wait(1.4);
    const pieces = (Number(G.save.flags.mapPieces) || 0) + 1;
    G.setFlag('mapPieces', pieces);
    await w.say(null, ['You got a piece of the {r}treasure map!{/}', `Only ${MAP_PIECES_TOTAL - pieces} more to go!`], {
        // same framing as the Duck's line, as plain points so nobody turns to face anybody
        focus: [{ x: p.x, y: p.y }, { x: duck.x, y: duck.y }], zoom: 2, keepZoom: true, focusZ: SHOT2.focusZ,
    });
    piece.destroy();
    G.setFlag('chapter1');
    G.persist();
    // ---- shot 3: back to play (zoom out 0.33 s); the duck wanders off
    void w.walkAnimal(duck, { x: SHOT2.duckIn.x - 4, y: SHOT2.duckIn.y - 2 }, 0.4).then(() => (duck.visible = false));
    w.camFocus = null;
    w.setZoom(w.restZoom());
    showBoard(w);
    hud.hideHud = false;
    w.cutsceneBubbles = false;
    p.locked = false;
    running = false;
    armed = false;
}

/** after Chapter 1 begins the board shows the pinned map pieces, with a "?" over it (t37.5) */
function showBoard(w: World) {
    if (w.zone.id !== 'home' || !G.flag('chapter1')) return;
    const board = w.props.find((q) => q.p.id === 'noticeBoard');
    if (board && w.textures.exists('notice_board_maps')) board.img.setTexture('notice_board_maps');
    if (!G.flag('mapBoardRead') && !w.markers.some((m) => m.id === 'noticeBoard')) w.markers.push({ id: 'noticeBoard', x: 36, y: 29.4, z: 3.0, glyph: '?' });
}

QUEST_HOOKS.push({
    onEnter(w: World) {
        if (running) return;
        // the story starts the day after you first see the Ranger Station
        if (w.zone.id === 'station' && G.save.flags.stationSeen === undefined) G.setFlag('stationSeen', G.save.day);
        const seen = G.save.flags.stationSeen;
        armed = w.zone.id === 'home' && G.flag('tutorialDone') && !G.flag('chapter1') && typeof seen === 'number' && G.save.day > seen;
        showBoard(w);
    },
    onUpdate(w: World) {
        if (!armed || running || G.frozen || w.busy) return;
        const cabin = w.buildings.find((b) => b.def.id === 'cabin');
        // the Raccoon catches him on his way out of the cabin
        const p = w.player;
        if (cabin && !w.insideBuilding(cabin.def, p.x, p.y) && p.mode !== 'lying' && !p.locked) {
            void play(w).catch((e) => {
                // never leave the game stuck in a half-played cutscene
                console.error('chapter 1 cutscene failed', e);
                running = false;
                armed = false;
                w.player.locked = false;
                w.player.ghost = false;
                w.hud.hideHud = false;
                w.cutsceneBubbles = false;
                w.camFocus = null;
                w.hud.setBlack(0);
            });
        }
    },
});
