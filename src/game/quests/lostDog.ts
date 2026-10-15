import { QUEST_HOOKS, type World } from '../scenes/World';
import { G } from '../core/state';

/**
 * LOST DOG (inside-park 821-858 s): "LOST DOG" posters on the power poles by the
 * Ranger Station give 555-5678; ringing it from the payphone starts the quest with
 * the owner's 7 lines (verbatim, unnamed box). The dog itself is in the RV Park and
 * the owner waits at the Pet Shop in the Strip Mall (outside the park, later milestone).
 */
export const LOST_DOG_NUMBER = '555-5678';

export async function phoneCall(w: World, number: string) {
    if (number !== LOST_DOG_NUMBER) {
        // [guess] nobody picks up at other numbers
        await w.say(null, ['*Ring... ring...*', 'Nobody answers.'], { zoom: 1 });
        return;
    }
    await w.say(null, [
        'Hello! You must be calling about those lost dog posters I put up!',
        'I just don\'t know *where* my dog could have run off to. I could really use your help!',
        'I heard my dog was spotted somewhere near the {g}RV Park{/} today, but I couldn\'t find anything!',
        'Maybe you\'ll have better luck?',
        'My dog can be a bit cautious, so you\'ll have to earn its trust to get it to follow you.',
        'Try petting it, and feeding it {r}Dog Treats{/}. Dogs LOVE those!',
        'If you need me, I\'ll be outside the {g}Pet Shop{/} at the {g}Strip mall{/}. Good luck!',
    ], { zoom: 1 });
    G.setFlag('lostDogCalled');
}

QUEST_HOOKS.push({
    onEnter(w: World) {
        // the payphone by the Ranger Station (1 coin a call, inside-park 428-450, 832-858)
        if (w.zone.interactables.some((i) => i.id === 'payphone')) {
            w.handlers['payphone'] = () => w.openMinigame('payphone', { onDial: (n) => phoneCall(w, n) });
        }
    },
});
