import { QUEST_HOOKS, World } from '../scenes/World';
import { G } from '../core/state';
import { itemDef } from '../data/items';

/**
 * FOX MISCHIEF: "Set off the smoke alarm in the ranger station"
 * (inside-park 451-466 s offer, 466-815 s solution; lines verbatim, notes §2).
 *   - The Fox in the station parking lot (yellow "!") offers a job: two ✓/✗ asks.
 *   - Objective banner (fox head) stays up until it's done.
 *   - Inside, food left on a lit stove burner smokes; ~15 s later the smoke
 *     detector goes off, the sleeping ranger wakes up and wonders aloud
 *     "Huh, I don't remember trying to cook <food>..." → "Mischief Complete!"
 *     +57 coins, then the "Heh Heh" badge.
 */
const FOX = 'Fox';
const REWARD = 57;
const YELLOW = '#ffd826';
/** [measured] pickles went on at 775 s, alarm by 815 s with a 25 s recording gap → ≈15 s of smoke */
const SMOKE_TO_ALARM = 15;

let busy = false;
let burning: { item: string; t: number } | null = null;
let alarmT = -1;
let smokeT = 0;

async function run(fn: () => Promise<void>) {
    if (busy) return;
    busy = true;
    try {
        await fn();
    } finally {
        busy = false;
    }
}

function refreshFox(w: World) {
    const fox = w.animal('fox');
    if (!fox) return;
    fox.marker = G.flag('foxAccepted') || G.flag('foxDone') ? null : '!';
    fox.markerColor = YELLOW;
}

function showObjective(w: World) {
    if (G.flag('foxAccepted') && !G.flag('foxDone')) w.hud.objective.show('Set off the smoke alarm\nin the ranger station');
    else w.hud.objective.hide();
}

async function talkToFox(w: World) {
    const fox = w.animal('fox')!;
    const p = w.player;
    p.locked = true;
    p.stop();
    const focus = { focus: [fox, p] };
    if (G.flag('foxDone')) {
        await w.say(FOX, ['*Heh heh*'], focus);
    } else if (G.flag('foxAccepted')) {
        await w.say(FOX, ['You\'ll have to sneak in there and set off the smoke detector somehow.'], focus);
    } else if (await w.ask(FOX, "Hey Sasquatch, wanna earn some coins? I've got a job for ya *heh heh*", focus)) {
        await w.say(FOX, [
            "That ranger's *constant snoring* is keeping me up at night.",
            "I want you to go in there and wake him up, but he's a real heavy sleeper.",
            "You'll have to sneak in there and set off the smoke detector somehow.",
            `If you can get him to stop sleeping I'll give you ${REWARD} {c}.`,
        ], focus);
        if (await w.ask(FOX, 'Do we have a deal?', focus)) {
            await w.say(FOX, ['*Heh heh*'], focus);
            G.setFlag('foxAccepted');
        } else {
            await w.say(FOX, ['Suit yourself *heh heh*'], focus); // [guess] the ✗ branch wasn't recorded
        }
    } else {
        await w.say(FOX, ['Suit yourself *heh heh*'], focus); // [guess]
    }
    refreshFox(w);
    showObjective(w);
    p.locked = false;
}

/** Called by the stove close-up when food lands on a lit burner. */
export function burnFood(itemId: string) {
    if (!burning) burning = { item: itemId, t: 0 };
}

/** Called by the stove close-up when the burner under the food is turned off / food taken back. */
export function stopBurning() {
    burning = null;
}

export function isBurning() {
    return !!burning;
}

async function alarmGoesOff(w: World) {
    const ranger = w.human('stationRanger');
    const food = itemDef(burning?.item ?? 'pickles').name;
    burning = null;
    // the detector shrieks, the ranger is up and goes to see what's burning
    w.sfx('alarm');
    await w.wait(0.8);
    w.sfx('alarm');
    if (ranger) {
        ranger.sleeping = false;
        ranger.behaviour = 'idle';
        ranger.homeBehaviour = 'idle';
        ranger.anim = 'idle';
        const stove = w.zone.interactables.find((i) => i.id === 'stove');
        if (stove) await Promise.race([w.walkHuman(ranger, stove, 1), w.wait(7)]);
        ranger.goal = null;
        ranger.state = 'normal';
        ranger.home = { x: ranger.x, y: ranger.y };
        ranger.homeFacing = ranger.facing = Math.PI / 2;
    }
    const done = G.flag('foxAccepted') && !G.flag('foxDone');
    if (done) {
        G.setFlag('foxDone');
        G.save.coins += REWARD;
        w.hud.objective.hide();
        w.hud.reward.show('Mischief Complete!', REWARD);
        w.sfx('coins');
        await w.wait(1.0);
    }
    // [verbatim 816-822; the food's name is red] the bubble sits over the kitchen
    ranger?.say(`Huh, I don't remember trying to cook {r}${food}{/}...`, 5);
    if (done) {
        await w.wait(1.0);
        w.hud.badge.show('Badge Earned!', 'Heh Heh', '', 'ui_fox');
        G.persist();
    }
    refreshFox(w);
}

QUEST_HOOKS.push({
    onEnter(w: World) {
        busy = false;
        alarmT = -1;
        showObjective(w);
        if (w.zone.id !== 'station') {
            burning = null;
            return;
        }
        refreshFox(w);
        if (w.animal('fox')) w.handlers['fox'] = () => void run(() => talkToFox(w));
        // food left on a lit burner smokes until the detector goes off
        w.handlers['stove'] = () => w.openMinigame('stove', { onBurn: (id) => burnFood(id), onUnburn: () => stopBurning() });
        // he sleeps until something wakes him; after the mischief he's up for the day
        const ranger = w.human('stationRanger');
        if (ranger && G.save.flags.rangerWoke === G.save.day) {
            ranger.sleeping = false;
            ranger.behaviour = 'idle';
        }
    },
    onUpdate(w: World, dt: number) {
        if (!burning) return;
        burning.t += dt;
        // smoke curls off the pan; only seen from inside (the roof hides it, t800-t812)
        smokeT -= dt;
        const stove = w.zone.id === 'station' && w.buildings.some((b) => b.inside) ? w.zone.interactables.find((i) => i.id === 'stove') : null;
        if (stove && smokeT <= 0) {
            smokeT = 0.3;
            w.emitSmoke(stove.x, stove.y + 0.62, 1.0);
        }
        if (burning.t >= SMOKE_TO_ALARM && alarmT < 0) {
            alarmT = 0;
            G.setFlag('rangerWoke', G.save.day);
            void alarmGoesOff(w);
        }
    },
});
