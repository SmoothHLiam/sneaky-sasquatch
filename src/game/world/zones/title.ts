import type { ZoneDef } from '../types';
import { DECAL_MIX, rect, scatter } from './helpers';

/**
 * Title-screen backdrop: the forest clearing behind the logo
 * (your research/frames/tutorial/t000.5_title_screen.jpg). The camera is static;
 * the sasquatch and a ranger wander through it (attract loop, scenes/Title.ts).
 */
const W = 26, H = 21;

export const titleZone: ZoneDef = {
    id: 'title',
    name: 'Title',
    w: W,
    h: H,
    groundColor: 0x3f9c37,
    ground: [],
    // positions mapped from screen fractions of t000.5 (16:10 view spans x 4.7–21.3, ground y 3.3–16.5)
    props: [
        ...scatter(rect(4, 3, 18, 14), DECAL_MIX, 70, 61, { minGap: 0.6 }),
        // berry-bush thicket top-left
        { type: 'berryBush', x: 5.2, y: 15.6, v: 0 }, { type: 'berryBush', x: 7.6, y: 16.2, v: 1 }, { type: 'berryBush', x: 10.2, y: 15.8, v: 0 },
        { type: 'berryBush', x: 6.0, y: 13.6, v: 1 }, { type: 'berryBush', x: 8.4, y: 14.2, v: 0 }, { type: 'berryBush', x: 10.4, y: 13.2, v: 1 },
        { type: 'berryBush', x: 7.2, y: 12.2, v: 0 }, { type: 'berryBush', x: 12.6, y: 16.4, v: 1 }, { type: 'berryBush', x: 14.6, y: 16.8, v: 0 },
        // big round tree top-right, pines down both edges, one in the foreground
        { type: 'roundTree', x: 18.7, y: 12.3, v: 0 }, { type: 'pine', x: 20.4, y: 16.4, v: 1 },
        { type: 'pine', x: 4.6, y: 11.0, v: 1 }, { type: 'pine', x: 4.2, y: 6.0, v: 0 }, { type: 'pineDark', x: 4.9, y: 3.0, v: 1 },
        { type: 'pine', x: 21.4, y: 11.2, v: 2 }, { type: 'pine', x: 21.2, y: 5.2, v: 0 }, { type: 'pine', x: 8.6, y: 2.9, v: 2 },
        { type: 'berryBush', x: 17.6, y: 3.6, v: 1 }, { type: 'berryBush', x: 20.2, y: 3.4, v: 0 },
        { type: 'rock', x: 16.0, y: 12.5, v: 0 }, { type: 'rock', x: 9.8, y: 6.4, v: 1 }, { type: 'rock', x: 18.3, y: 6.6, v: 1 },
        { type: 'pebble', x: 6.0, y: 3.8 }, { type: 'pebble', x: 15.3, y: 4.1 },
        { type: 'fern', x: 16.3, y: 6.0, v: 0 }, { type: 'fern', x: 17.4, y: 11.0, v: 1 }, { type: 'flowersYellow', x: 20.3, y: 8.2 },
    ],
    walls: [],
    exits: [],
    entries: { default: { x: 20, y: 3.6, facing: 180 } },
    npcs: [],
    interactables: [],
    camBounds: { x: 0, y: 0, w: W, h: H },
    rangersRespond: false,
    scatter: { seed: 60 },
};
