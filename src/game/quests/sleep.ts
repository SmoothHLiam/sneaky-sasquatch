import type { World } from '../scenes/World';
import { G } from '../core/state';
import { TUNING } from '../config/tuning';

/**
 * Going to bed (tutorial §1.1 t209-t220): "Go to bed?" ✓/✗ → lie down, Z's rise →
 * slow iris (1.27 s, ⅓ normal speed) → black 0.3 s → morning → iris opens (0.43 s).
 * Hunger: −2 overnight (−1 if only 1 left) [wiki], meter shown dropping on wake.
 */
export async function goToBed(w: World, onWake?: (w: World, firstNight: boolean) => void) {
    // at 0 hunger he can't sleep [wiki Hunger]
    if (G.save.hunger <= 0 && G.flag('hungerEnabled')) {
        await w.say(null, ["You're too hungry to sleep!"], { zoom: 1 }); // [guess] wording
        return;
    }
    // the camera closes in on the bed for the question (t210.6: ≈2.2x the outdoor zoom)
    const yes = await w.ask(null, 'Go to bed?', { zoom: TUNING.camera.zoom.dialogue });
    if (!yes) return;
    await sleep(w, onWake);
}

export async function sleep(w: World, onWake?: (w: World, firstNight: boolean) => void) {
    const p = w.player;
    p.locked = true;
    p.target = null;
    const bed = w.zone.entries.bed ?? { x: p.x, y: p.y };
    p.setPosition(bed.x, bed.y);
    p.facing = 0;
    p.mode = 'lying';
    p.anim = 'lying';
    p.sleepingZ = true;
    w.sfx('bed');
    await w.wait(2.2);
    const s = w.worldToScreen(p.x, p.y, 0.5);
    await w.hud.irisTo(true, 1.27, s.x, s.y);
    await w.wait(0.3);

    const firstNight = !G.flag('tutorialDone');
    const before = G.save.hunger;
    G.save.day += 1;
    G.save.hour = TUNING.time.wakeHour;
    w.gradeOverride = null;
    w.snapGrade();
    p.mode = 'idle';
    p.anim = 'idle';
    p.sleepingZ = false;
    p.setPosition(bed.x + 0.2, bed.y - 1.0);
    p.facing = -Math.PI / 2;
    w.snapCamera();
    onWake?.(w, firstNight);
    const s2 = w.worldToScreen(p.x, p.y, 1);
    await w.hud.irisTo(false, 0.43, s2.x, s2.y);
    // the meter pops up full, then drops by the night's cost
    w.hud.hunger.value = before;
    w.hud.hunger.popFor(3.9);
    await w.wait(0.95);
    const loss = before <= 1 ? Math.min(1, before) : TUNING.hunger.overnightLoss;
    for (let i = 0; i < loss; i++) {
        G.save.hunger = Math.max(0, G.save.hunger - 1);
        w.sfx('tick');
        await w.wait(0.2);
    }
    p.locked = false;
    G.save.x = p.x;
    G.save.y = p.y;
    G.persist();
}

const RACCOON = 'Raccoon';

/**
 * Passing out: still up at 3:10 AM, or 4 in-game hours at 0 hunger [wiki Time, Hunger].
 * He keels over, the screen irises shut, and he wakes in the cabin next morning with
 * the Raccoon (inside-park t0-8.3, lines verbatim) — minus a fee [wiki: "a bunch of
 * your coins"; 20 for the cookies when it was hunger].
 */
export async function passOut(w: World, reason: 'late' | 'hungry') {
    if (w.busy) return;
    w.busy = true;
    const p = w.player;
    p.locked = true;
    p.stop();
    p.mode = 'lying';
    p.anim = 'lying';
    w.sfx('bed');
    await w.wait(1.6);
    const s = w.worldToScreen(p.x, p.y, 0.5);
    await w.hud.irisTo(true, 1.27, s.x, s.y);
    await w.wait(0.4);

    const before = G.save.hunger;
    G.save.day += 1;
    G.save.hour = TUNING.time.wakeHour;
    const fee = Math.min(TUNING.hunger.passOutFee, G.save.coins);
    G.save.coins -= fee;
    if (reason === 'hungry') G.save.hunger = 2;
    else G.save.hunger = before <= 1 ? Math.max(0, before - 1) : Math.max(0, before - TUNING.hunger.overnightLoss);
    w.gradeOverride = null;
    w.loadZone('home', 'bed');
    w.snapGrade();
    const q = w.player;
    q.locked = true;
    q.mode = 'idle';
    q.anim = 'idle';
    q.setPosition(13.3, 27.1);
    q.facing = -Math.PI / 2;
    const r = w.spawnAnimal('raccoonHome', 'raccoon', 14.6, 26.8, 180);
    w.snapCamera();
    const s2 = w.worldToScreen(q.x, q.y, 1);
    await w.hud.irisTo(false, 0.43, s2.x, s2.y);
    if (reason === 'late') {
        await w.say(RACCOON, [
            '~Sasquatch!~ You can\'t just fall asleep anywhere you like!',
            'The ranger brought you back, he was steaming mad.',
            'I had to pay him off so he wouldn\'t kick us out of the park.',
            'Sleep in your bed tonight, ~Sasquatch!~',
        ], { focus: [r, q] });
    } else {
        // [guess] the hunger version isn't in the footage; the wiki only says he pays "for the cookies"
        await w.say(RACCOON, ['~Sasquatch!~ You fainted from hunger!', `I had to feed you cookies to get you back on your feet. That's ${fee} {c}, *for the cookies.*`], { focus: [r, q] });
    }
    await w.walkAnimal(r, { x: 14.48, y: 24.6 }, 1);
    w.removeAnimal('raccoonHome');
    q.locked = false;
    w.busy = false;
    G.persist();
}
