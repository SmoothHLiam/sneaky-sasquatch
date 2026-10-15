import { QUEST_HOOKS, World } from '../scenes/World';
import { G } from '../core/state';
import { TUNING } from '../config/tuning';
import { Vec, dist } from '../core/math';
import { SH } from '../core/proj';
import { L } from '../ui/layout';
import type { Animal } from '../entities/Animal';
import type { Human } from '../entities/Human';
import { goToBed } from './sleep';
import { itemDef } from '../data/items';

/**
 * TUTORIAL (Day 0) — reproduces videos/tutorial.mov step by step.
 * Verbatim lines and timings: your research/video-notes/tutorial-and-cutscene.md §1–§2.
 *
 * Stages (G.save.flags.tut):
 *   intro → meetRaccoon → toGate → raccoonGate → campA → eat → evening → sneak → home → bed → done
 */
type Stage = 'intro' | 'meetRaccoon' | 'toGate' | 'raccoonGate' | 'campA' | 'eat' | 'evening' | 'sneak' | 'home' | 'bed' | 'done';
const stage = (): Stage => ((G.save.flags.tut as Stage) ?? 'intro');
const setStage = (s: Stage) => {
    G.setFlag('tut', s);
    G.persist();
};

/** "evening" grade measured in the gate area: grass #45ad3a → #316729 */
// multiply grade measured from the stills: grass #44ad3a → #398732, road #ca9247 → #9b7340 (t095.5 vs t133/t185)
export const EVENING = { r: 0.8, g: 0.78, b: 0.88 };

let busy = false;
let tutRanger: Human | null = null;
let alarmSeen = false;
let hiddenFor = 0;
let resetting = false;
let shushed = false;
let bubbleTimer = 0;

const RACCOON = 'Raccoon';
const RANGER_POST = { x: 76.4, y: 26.4 };
const SNEAK_START = { x: 84.2, y: 24.6 };

function raccoon(w: World): Animal | undefined {
    return w.animal('raccoon');
}

async function run(fn: () => Promise<void>) {
    if (busy) return;
    busy = true;
    try {
        await fn();
    } finally {
        busy = false;
    }
}

/** Screen position (canvas px) of a world point — for the ghost pointer. */
function screenOf(w: World, p: Vec, z = 0.4) {
    return w.worldToScreen(p.x, p.y, z);
}

// =============================================================================
// HOME — intro, raccoon, gate
// =============================================================================
async function intro(w: World) {
    const p = w.player;
    p.locked = true;
    p.visible = false;
    G.save.hunger = 4;
    G.save.hour = 6.6;
    w.hud.setBlack(1);
    w.setZoom(TUNING.camera.zoom.tutorialIntro, true);
    // establishing shot: dark pond, pan north to the cabin while fading in (≈3.7 s, slow start)
    w.camFocus = { x: 12.5, y: 15.5 };
    w.camFocusZ = 0;
    w.snapCamera();
    void w.hud.fadeTo(0, 3.7, (k) => k * k * (3 - 2 * k) * k);
    await w.wait(0.4);
    const start = { x: 12.5, y: 15.5 }, end = { x: 14.48, y: 25.0 };
    const t0 = w.time.now;
    await w.waitUntil(() => {
        const k = Math.min(1, (w.time.now - t0) / 4200);
        const e = k * k * (3 - 2 * k);
        w.camFocus = { x: start.x + (end.x - start.x) * e, y: start.y + (end.y - start.y) * e };
        G.save.hour = 6.6 + 1.4 * k;
        return k >= 1;
    });
    // the door opens and the sasquatch steps out
    w.sfx('door');
    p.setPosition(14.48, 26.5);
    p.facing = -Math.PI / 2;
    p.visible = true;
    await w.walkPlayer({ x: 14.48, y: 24.9 }, 0.45);
    await w.wait(2.2); // wake-up stretch
    w.hud.thought.show('fork');
    w.sfx('think');
    await w.wait(2.7);
    w.camFocus = null;
    w.setZoom(w.restZoom());
    await w.wait(0.35);
    w.hud.thought.hide();
    p.locked = false;
    setStage('meetRaccoon');
    // press-and-hold demo: the ghost pointer to the right, then to the left
    await holdDemo(w, 1);
    await holdDemo(w, -1);
}

async function holdDemo(w: World, dir: 1 | -1) {
    const p = w.player;
    const x0 = p.x;
    const t0 = w.time.now;
    await w.waitUntil(() => {
        const s = screenOf(w, { x: p.x + dir * 2.1 * SH, y: p.y }, 0.6);
        w.hud.ghost.show(s.x, s.y, 'hold');
        return (dir > 0 ? p.x > x0 + 1.4 : p.x < x0 - 1.4) || w.time.now - t0 > 9000;
    });
    w.hud.ghost.hide();
    await w.wait(0.4);
}

async function meetRaccoon(w: World) {
    const r = raccoon(w)!;
    const p = w.player;
    r.marker = null;
    r.watchPlayer = true;
    p.locked = true;
    const focus = [r, p];
    await w.say(RACCOON, [
        'Hiya buddy.',
        'You look hungry, you should go to the {g}campsites{/} and grab a snack.',
        'Here, take one of these backpacks so you can carry stuff around.',
    ], {
        focus,
        keepZoom: true,
        onPage: (i) => {
            if (i === 1) {
                w.hud.hunger.value = G.save.hunger;
                w.hud.hunger.popFor(0.9);
            }
        },
    });
    G.frozen = true;
    const color = await w.hud.picker.pick();
    w.sfx('backpack');
    G.save.backpackColor = color;
    p.setPack(color);
    G.frozen = false;
    await w.say(RACCOON, ["Lookin' good!"], { focus });
    r.watchPlayer = false;
    p.locked = false;
    setStage('toGate');
    delete w.handlers['raccoon'];
    void w.walkAnimal(r, { x: 64.6, y: 26.8 }, 0.9).then(() => (r.watchPlayer = true));
}

async function gateRanger(w: World) {
    const p = w.player;
    p.locked = true;
    p.target = null;
    const ranger = w.spawnHuman('gateRanger', 'ranger', '', 86.5, 24.6, 180, 'idle');
    ranger.state = 'scripted';
    ranger.perc.idleGlyph = null;
    ranger.say('Hey!', 4.5);
    w.sfx('hey');
    await w.wait(2.3);
    await w.walkHuman(ranger, { x: p.x + 1.5, y: p.y + 0.05 }, 0.87);
    ranger.facing = Math.atan2(p.y - ranger.y, p.x - ranger.x);
    await w.say('Ranger', ["You know you're not allowed in the campground!", "You'll scare away all the campers!"], { focus: [ranger, p] });
    p.locked = false;
    void w.walkHuman(ranger, { x: 93, y: 24.6 }, 0.87).then(() => w.removeHuman('gateRanger'));
    if (stage() === 'toGate') setStage('raccoonGate');
}

async function raccoonGate(w: World) {
    const r = raccoon(w)!;
    const p = w.player;
    p.locked = true;
    p.target = null;
    r.watchPlayer = true;
    await w.say(RACCOON, ["Pfft, don't worry about that guy.", 'We just have to be ~sneaky~.'], { focus: [r, p] });
    G.setFlag('gateOpen');
    setStage('campA');
    // scripted run through the gate, the raccoon alongside (≈1.2x walk)
    r.watchPlayer = false;
    void w.walkAnimal(r, { x: 92.5, y: 23.6 }, 1.25);
    w.player.walkTo({ x: 92.5, y: 24.6 }, undefined, 1.2);
}

// =============================================================================
// CAMPSITE A — cooler, eating
// =============================================================================
async function campA(w: World) {
    const p = w.player;
    const r = w.spawnAnimal('raccoon', 'raccoon', p.x + 1.4, p.y - 0.6, 0);
    await w.wait(0.5);
    await w.walkAnimal(r, { x: 8.4, y: 26.4 }, 1.0);
    await w.walkAnimal(r, { x: 14.6, y: 22.8 }, 1.0);
    await w.walkAnimal(r, { x: 21.2, y: 26.6 }, 1.0);
    r.watchPlayer = true;
    r.say("Let's open up this food box and see what's inside", 3.6);
    const cooler = w.zone.interactables.find((i) => i.id === 'coolerA')!;
    w.handlers['coolerA'] = () => {
        delete w.handlers['coolerA'];
        w.openContainer(cooler, { tutorial: true, onDone: () => void run(() => afterCooler(w)) });
    };
}

async function afterCooler(w: World) {
    const r = raccoon(w)!;
    const p = w.player;
    p.locked = true;
    await w.say(RACCOON, [
        "That's a good snack right there, but don't eat it yet!",
        'That would be ~uncivilized~.',
        "Follow me, I'll show you the proper way to eat it.",
    ], { focus: [r, p] });
    p.locked = false;
    setStage('eat');
    r.watchPlayer = false;
    r.say('This way!', 3.5);
    await w.walkAnimal(r, { x: 26.0, y: 20.6 }, 0.9);
    await w.walkAnimal(r, { x: 28.3, y: 14.0 }, 0.9);
    r.watchPlayer = true;
    w.handlers['tableA'] = () => {
        void w.eatAtTable(() => void run(() => afterEat(w)));
    };
}

async function afterEat(w: World) {
    if (stage() !== 'eat') return;
    const r = raccoon(w)!;
    const p = w.player;
    if (w.hasFood()) return; // still has food left: keep waiting at the table
    delete w.handlers['tableA'];
    p.locked = true;
    await w.say(RACCOON, ['WOW you sure know how to eat!', "It's starting to get {r}dark{/} though, let's head back and call it a day."], {
        focus: [r, p],
    });
    p.locked = false;
    w.gradeOverride = EVENING;
    G.save.hour = 19.6;
    setStage('evening');
    r.watchPlayer = false;
    r.say('Follow me!', 3.2);
    await w.walkAnimal(r, { x: 20, y: 21.6 }, 1);
    await w.walkAnimal(r, { x: 12.4, y: 24.4 }, 1);
    await w.walkAnimal(r, { x: 3.4, y: 29.0 }, 1);
    r.watchPlayer = true;
}

// =============================================================================
// EVENING — the sleeping ranger by the gate (tip-toe lesson)
// =============================================================================
async function eveningIntro(w: World, repeat: boolean) {
    const p = w.player;
    w.gradeOverride = EVENING;
    w.snapGrade();
    // the lesson starts ~7 m east of the ranger, who dozes on the north verge ~4 m east of the gate (t133, t185, t188)
    if (!repeat) {
        p.setPosition(SNEAK_START.x, SNEAK_START.y);
        w.snapCamera();
    }
    tutRanger = w.spawnHuman('tutRanger', 'ranger', '', RANGER_POST.x, RANGER_POST.y, -90, 'sleep');
    tutRanger.noCapture = true;
    // he chases at 640 px/s vs the player's 743 (0.86x) and gives up ~9 m from his post (145.9-148.7)
    tutRanger.chaseFactor = 0.86 / TUNING.rangerDanger.chaseSpeedFactor;
    tutRanger.leash = 9;
    // once woken he stays up at his post ("Stay out!", t151) instead of going back to sleep
    tutRanger.homeBehaviour = 'idle';
    alarmSeen = false;
    shushed = false;
    hiddenFor = 0;
    const r = w.spawnAnimal('raccoon', 'raccoon', p.x - 1.3, p.y + 0.7, 180);
    p.locked = true;
    p.target = null;
    await w.wait(0.6);
    r.say('Shh, look over there', 4.0);
    await w.panCamera({ x: RANGER_POST.x, y: RANGER_POST.y - 0.6 }, 2.6);
    await w.panCamera(null, 0.5);
    await w.say(RACCOON, [
        "We'll have to sneak by so he won't hear us.",
        "You've got some gigantic {r}footsteps{/}, so you're going to have to tip toe.",
        "If he sees us we'll be in big trouble, so let's practice!",
    ], { focus: [r, p] });
    p.locked = false;
    if (!repeat) {
        await tapDemo(w, -1);
        await tapDemo(w, 1);
    }
    r.say("Let's go!", 4.4);
    setStage('sneak');
    // the raccoon tip-toes ahead and waits beyond the ranger
    void w.walkAnimal(r, { x: 80, y: 24.2 }, 0.35).then(() => w.walkAnimal(r, { x: 71.2, y: 25.3 }, 0.35));
}

async function tapDemo(w: World, dir: 1 | -1) {
    const p = w.player;
    let sneaked = 0;
    let last = p.x;
    const t0 = w.time.now;
    await w.waitUntil(() => {
        const s = { x: L.W * (dir < 0 ? 0.2 : 0.75), y: L.H * 0.53 };
        w.hud.ghost.show(s.x, s.y, 'tap');
        if (p.mode === 'sneak') sneaked += Math.abs(p.x - last);
        last = p.x;
        return sneaked > 1.4 || w.time.now - t0 > 12000;
    });
    w.hud.ghost.hide();
    await w.wait(0.3);
}

/** Detected during the sneak: the raccoon bails, then once you're hidden the lesson restarts. */
function watchSneak(w: World, dt: number) {
    const ranger = w.human('tutRanger');
    const p = w.player;
    const r = raccoon(w);
    if (!ranger || resetting) return;
    // the moment the sleeping ranger's ear pops, the raccoon hushes you (144.53)
    if (!shushed && !alarmSeen && ranger.perc.meter > 0.02) {
        shushed = true;
        r?.say('Shh, not so loud', 2.5);
    }
    if (ranger.perc.alarmed && !alarmSeen) {
        alarmSeen = true;
        r?.say("I'm outta here!", 4.5);
        if (r) void w.walkAnimal(r, { x: 40, y: 24 }, 1.3);
    }
    if (alarmSeen) {
        // after the chase: ranger is awake at his post and grumbles
        if (ranger.state === 'normal' && !ranger.sleeping && !ranger.speech && dist(ranger, p) < 4 && !ranger.perc.alarmed) ranger.say('Stay out!', 1.5);
        // the lesson restarts once you've hidden in the trees (157-160.4) or run well off
        const hidden = p.inCover || dist(ranger, p) > 22;
        hiddenFor = hidden && !ranger.seesPlayer ? hiddenFor + dt : 0;
        if (hiddenFor > 2.2) void resetSneak(w);
        return;
    }
    // success: made it past the ranger
    if (p.x < 70.5) { // through the gate
        setStage('home');
        if (r) {
            void w.walkAnimal(r, { x: 19.6, y: 23.2 }, 1).then(() => (r.watchPlayer = true));
        }
    }
}

async function resetSneak(w: World) {
    resetting = true;
    const p = w.player;
    const s = w.worldToScreen(p.x, p.y, 1);
    await w.hud.irisTo(true, 0.45, s.x, s.y);
    w.rangerDanger.end();
    w.removeHuman('tutRanger');
    w.removeAnimal('raccoon');
    p.setPosition(SNEAK_START.x, SNEAK_START.y);
    p.facing = Math.PI;
    p.stop();
    w.snapCamera();
    await w.wait(0.36);
    const s2 = w.worldToScreen(p.x, p.y, 1);
    await w.hud.irisTo(false, 0.67, s2.x, s2.y);
    resetting = false;
    setStage('evening');
    await eveningIntro(w, true);
}

async function homeTalk(w: World) {
    const r = raccoon(w)!;
    const p = w.player;
    p.locked = true;
    p.target = null;
    await w.say(RACCOON, [
        'Now get some {r}sleep{/} before you pass out!',
        "I don't want to have to carry you back to your house every night.",
        '...but I will, *for a price.*',
    ], { focus: [r, p] });
    p.locked = false;
    setStage('bed');
    r.say('Bye!', 4);
    r.watchPlayer = false;
    void w.walkAnimal(r, { x: 50, y: 26 }, 1).then(() => w.removeAnimal('raccoon'));
}

// =============================================================================
// DAY 1 — bear's favour, shop
// =============================================================================
const BEAR_MARK = '#ffd826';

function setupDay1Home(w: World) {
    const bear = w.animal('bear');
    if (bear && !G.flag('bearQuest')) {
        bear.marker = '!';
        bear.markerColor = BEAR_MARK;
    }
    if (bear) {
        w.handlers['bear'] = () =>
            void run(async () => {
                const p = w.player;
                p.locked = true;
                bear.sleeping = false;
                bear.anim = 'sit';
                bear.facing = Math.atan2(p.y - bear.y, p.x - bear.x);
                if (!G.flag('bearQuest')) {
                    await w.say('Bear', ['ZzZzZzZz', 'Can samsquanch do bear big favor?', 'Samsquanch bring leftover food from {g}campsites{/} to bear, bear will buy for good price.'], { focus: [bear, p] });
                    G.setFlag('bearQuest');
                    bear.markerColor = '#ffffff';
                } else {
                    await sellToBear(w, bear);
                }
                p.locked = false;
                bear.sleeping = true;
            });
    }
    if (!G.flag('shopVisited')) w.markers.push({ id: 'shopDoor', x: 55.5, y: 35.2, z: 3.2, glyph: '?' });
}

async function sellToBear(w: World, bear: Animal) {
    const p = w.player;
    const food = G.save.items.filter((id) => id !== 'coinBag');
    if (!food.length) {
        await w.say('Bear', ['Bear hungry. Samsquanch bring food from {g}campsites{/}.'], { focus: [bear, p] });
        return;
    }
    const total = food.reduce((a, id) => a + itemDef(id).sell, 0);
    const yes = await w.ask('Bear', `Bear buy all food for ${total} coins?`, { focus: [bear, p] });
    if (!yes) return;
    G.save.items = G.save.items.filter((id) => id === 'coinBag');
    G.save.coins += total;
    w.sfx('coins');
    await w.say('Bear', ['Yum yum. Pleasure doing business.'], { focus: [bear, p] });
}

async function shopWelcome(w: World) {
    const r = w.animal('raccoon');
    if (!r) return;
    const p = w.player;
    w.hud.coins.forceVisible = true;
    p.locked = true;
    await w.walkPlayer({ x: 8, y: 4.4 }, 1);
    r.facing = Math.atan2(p.y - r.y, p.x - r.x);
    await w.say(RACCOON, ['Hey Sasquatch! Welcome to my {g}shop{/}.', "I've found a few things around the campground that might be helpful.", 'Take a look around.'], {
        focus: [r, p],
    });
    p.locked = false;
    G.setFlag('shopVisited');
}

// =============================================================================
// hook registration
// =============================================================================
QUEST_HOOKS.push({
    onEnter(w: World) {
        busy = false;
        resetting = false;
        tutRanger = null;
        w.handlers['bed'] = () => void run(() => goToBed(w, onWake));
        const st = stage();
        const zone = w.zone.id;
        if (G.flag('tutorialDone')) {
            if (zone === 'home') setupDay1Home(w);
            if (zone === 'shop' && !G.flag('shopVisited')) void run(() => shopWelcome(w));
            return;
        }
        if (zone === 'home') {
            const r = raccoon(w);
            if (st === 'intro') void run(() => intro(w));
            else if (st === 'meetRaccoon' && r) r.marker = '?';
            else if ((st === 'toGate' || st === 'raccoonGate') && r) r.setPosition(64.6, 26.8);
            else if (st === 'evening' || st === 'sneak') void run(() => eveningIntro(w, false));
            else if (st === 'home' && r) r.setPosition(19.6, 23.2);
            else if (r && (st === 'bed' || st === 'campA' || st === 'eat')) w.removeAnimal('raccoon');
            if (st === 'meetRaccoon' || st === 'intro') {
                w.handlers['raccoon'] = () => void run(() => meetRaccoon(w));
                if (r && st === 'intro') r.marker = '?';
            }
            if (st === 'evening' || st === 'sneak' || st === 'home' || st === 'bed') w.gradeOverride = EVENING;
        }
        if (zone === 'campA') {
            if (st === 'campA') void run(() => campA(w));
            if (st === 'eat') {
                const r = w.spawnAnimal('raccoon', 'raccoon', 28.3, 14.0, 180);
                r.watchPlayer = true;
                w.handlers['tableA'] = () => void w.eatAtTable(() => void run(() => afterEat(w)));
            }
            if (st === 'evening') {
                w.gradeOverride = EVENING;
                const r = w.spawnAnimal('raccoon', 'raccoon', 3.4, 29.0, 180);
                r.watchPlayer = true;
            }
        }
    },
    onUpdate(w: World, dt: number) {
        if (G.flag('tutorialDone')) return;
        const st = stage();
        const p = w.player;
        if (w.zone.id === 'home') {
            if (st === 'toGate' && !busy && p.x > 69.6) void run(() => gateRanger(w));
            if (st === 'raccoonGate' && !busy) {
                const r = raccoon(w);
                if (p.x > 75) void run(() => gateRanger(w));
                else if (r && dist(r, p) < 2.3) void run(() => raccoonGate(w));
            }
            if (st === 'sneak') watchSneak(w, dt);
            if (st === 'home' && !busy) {
                const r = raccoon(w);
                if (r && !r.goal && dist(r, p) < 2.6) void run(() => homeTalk(w));
            }
        }
        if (w.zone.id === 'campA' && (st === 'eat' || st === 'evening')) {
            // the raccoon keeps calling while it waits
            const r = raccoon(w);
            bubbleTimer -= dt;
            if (r && !r.goal && !r.speech && bubbleTimer <= 0 && !G.frozen && !w.inCloseUp) {
                bubbleTimer = 4.2;
                r.say(st === 'eat' ? 'This way!' : 'Follow me!', 2.6);
            }
        }
    },
});

/** Called after waking up (bed). */
function onWake(w: World, firstNight: boolean) {
    if (firstNight) {
        G.setFlag('tutorialDone');
        G.setFlag('shopOpen');
        G.setFlag('raccoonInShop');
        setStage('done');
        w.hud.badge.show('Badge Earned!', 'A New Day, a New Adventure', '1');
        setupDay1Home(w);
    }
}
