import { QUEST_HOOKS, World } from '../scenes/World';
import { G } from '../core/state';
import { MAP_PIECES_TOTAL } from '../data/items';

/**
 * THE DUCK'S HAT (inside-park 271-352 s, lines verbatim from the notes §2):
 *   1. The Duck by the RV-park pond (yellow "!") asks for its hat back — no ✓/✗.
 *      Its marker turns white and a white "!" appears over the teal RV.
 *   2. Messing with the boombox at site D kills the music; the RV camper comes out
 *      ("HEY!"), walks over and fixes it — which leaves his RV unwatched.
 *   3. Inside the RV (cut-away) the hat is on the table: "You found the Duck Hat!"
 *   4. Leaving, the camper grumbles "Darn kids, fartin' around with my radio."
 *   5. Back at the pond the Duck takes the hat (wears it, stretched), gives a
 *      treasure-map piece (9 in all) and the "Solve the Duck's Hat Problem" badge.
 */
const DUCK = 'Duck';
const YELLOW = '#ffd826';
const BOOMBOX = { x: 24.6, y: 34.3 };
const RV = { x: 29.5, y: 38.2 };
const GUY_HOME = { x: 27.8, y: 36.6 };

let radioOn = true;
let noteT = 0;
let busy = false;
let grumbled = false;
let wasInRv = false;

async function run(fn: () => Promise<void>) {
    if (busy) return;
    busy = true;
    try {
        await fn();
    } finally {
        busy = false;
    }
}

function updateMarkers(w: World) {
    const duck = w.animal('duck');
    w.markers = w.markers.filter((m) => m.id !== 'rvHat');
    if (G.flag('duckDone')) {
        if (duck) duck.marker = null;
        return;
    }
    if (duck) {
        duck.marker = '!';
        duck.markerColor = G.flag('duckQuest') ? '#ffffff' : YELLOW;
    }
    if (G.flag('duckQuest') && !G.flag('duckHatTaken')) w.markers.push({ id: 'rvHat', x: RV.x - 1.4, y: RV.y, z: 2.7, glyph: '!' });
}

async function talkToDuck(w: World) {
    const duck = w.animal('duck')!;
    const p = w.player;
    p.locked = true;
    p.stop();
    if (!G.flag('duckQuest')) {
        await w.say(DUCK, [
            'Hey you look like a sneaky fella, maybe you can help me?',
            'A camper in the {r}RV{/} up there took my {r}hat{/} and I really want it back!',
            "I'll make it worth your while if you can get it back for me.",
        ], { focus: [duck, p] });
        G.setFlag('duckQuest');
    } else if (G.flag('duckHatTaken') && !G.flag('duckDone')) {
        await w.say(DUCK, ["Oh, OH, OOOOH that's my {r}HAT{/} you've got!", 'Aw jeez, that guy totally stretched it out.', 'Here, you can have this cool piece of paper I found.'], { focus: [duck, p] });
        duck.setAtlas('duck_hat');
        G.save.items = G.save.items.filter((i) => i !== 'duckHat');
        const pieces = (Number(G.save.flags.mapPieces) || 0) + 1;
        G.setFlag('mapPieces', pieces);
        await w.say(null, ['You got a piece of the {r}treasure map!{/}', `Only ${MAP_PIECES_TOTAL - pieces} more to go!`], { focus: [duck, p] });
        await w.say(DUCK, ['Catch you later skater.'], { focus: [duck, p] });
        G.setFlag('duckDone');
        w.hud.badge.show('Badge Earned!', "Solve the Duck's Hat Problem", '', 'shop_hat');
        G.persist();
    } else {
        await w.say(DUCK, ['A camper in the {r}RV{/} up there took my {r}hat{/} and I really want it back!'], { focus: [duck, p] });
    }
    updateMarkers(w);
    p.locked = false;
}

/** the music stops; the camper comes out, fixes it, goes back to his door (E6, t285-299) */
async function radioFiddled(w: World) {
    if (!radioOn) return;
    radioOn = false;
    w.sfx('click');
    const guy = w.human('rvGuy');
    if (!guy) return;
    await w.wait(1.2);
    // out of his RV door
    guy.setPosition(GUY_HOME.x, GUY_HOME.y);
    guy.ghost = false;
    guy.say('HEY!', 2.5);
    await w.walkHuman(guy, { x: BOOMBOX.x + 0.4, y: BOOMBOX.y - 1.1 }, 0.5);
    guy.facing = Math.PI / 2;
    await w.wait(5.5);
    radioOn = true;
    // he stays by the radio, nodding along, until he catches you coming out of his RV (t299-314)
    guy.behaviour = 'idle';
}

async function takeHat(w: World) {
    const p = w.player;
    p.locked = true;
    p.stop();
    G.setFlag('duckHatTaken');
    if (!G.save.items.includes('duckHat')) G.save.items.push('duckHat');
    w.removeProp('duckHatProp');
    w.sfx('grab');
    await w.say(null, ['You found the {r}Duck Hat{/}!', "This hat doesn't really look like it belongs to a duck."], { zoom: 1 });
    updateMarkers(w);
    p.locked = false;
}

QUEST_HOOKS.push({
    onEnter(w: World) {
        busy = false;
        if (w.zone.id !== 'rvParkN') return;
        radioOn = true;
        noteT = 0;
        grumbled = false;
        wasInRv = false;
        const duck = w.animal('duck');
        if (duck && G.flag('duckDone')) duck.setAtlas('duck_hat');
        if (G.flag('duckHatTaken')) w.removeProp('duckHatProp');
        // the RV-D camper is inside his motorhome until the music stops
        const guy = w.human('rvGuy');
        if (guy) {
            guy.ghost = true;
            guy.state = 'scripted';
            guy.setPosition(RV.x + 2.2, RV.y);
        }
        updateMarkers(w);
        w.handlers['duck'] = () => void run(() => talkToDuck(w));
        // the radio close-up: fiddling with the antenna or a knob cuts the music (t287-291)
        w.handlers['boombox'] = () => w.openMinigame('radio', { onRadioOff: () => void radioFiddled(w) });
        w.handlers['duckHat'] = () => void run(() => takeHat(w));
    },
    onUpdate(w: World, dt: number) {
        if (w.zone.id !== 'rvParkN') return;
        // the boombox plays while it's on
        noteT -= dt;
        if (radioOn && noteT <= 0) {
            noteT = 0.8;
            w.emitNote(BOOMBOX.x, BOOMBOX.y, 1.25);
        }
        // coming out of the RV with the hat, in front of its owner (t309.5)
        const p = w.player;
        const inRv = Math.abs(p.x - RV.x) < 4.15 && Math.abs(p.y - RV.y) < 0.86;
        const guy = w.human('rvGuy');
        if (wasInRv && !inRv && G.flag('duckHatTaken') && !grumbled && guy && !guy.ghost && Math.hypot(guy.x - p.x, guy.y - p.y) < 10) {
            grumbled = true;
            guy.facing = Math.atan2(p.y - guy.y, p.x - guy.x);
            guy.say("Darn kids, fartin' around with my radio.", 5);
            // blames the kids and goes back inside his RV
            void w.wait(1.5).then(() => w.walkHuman(guy, GUY_HOME, 0.45)).then(() => (guy.ghost = true));
        }
        wasInRv = inRv;
    },
});
