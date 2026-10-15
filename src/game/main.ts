import { AUTO, Game, Scale, Types } from 'phaser';
import { Boot } from './scenes/Boot';
import { Title } from './scenes/Title';
import { SlotSelect } from './scenes/SlotSelect';
import { World } from './scenes/World';
import { Hud } from './scenes/Hud';
import { CloseUp } from './scenes/CloseUp';
import { Minigame } from './scenes/Minigame';
import { Pause } from './scenes/Pause';
import './quests';
import { G } from './core/state';

/**
 * The canvas is rendered at full device resolution (CSS size x devicePixelRatio)
 * and shown at CSS size, so sprites stay crisp on retina screens. All UI is laid
 * out from the canvas size (see ui/layout.ts), so any window shape works.
 */
const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: Math.round(window.innerWidth * dpr()),
    height: Math.round(window.innerHeight * dpr()),
    parent: 'game-container',
    backgroundColor: '#000000',
    scale: {
        mode: Scale.NONE,
        zoom: 1 / dpr(),
    },
    render: {
        antialias: true,
        roundPixels: false,
    },
    input: {
        mouse: { preventDefaultWheel: true },
    },
    disableContextMenu: true,
    // request every asset at once (the loader otherwise waits for frames between batches)
    loader: { maxParallelDownloads: 256 },
    scene: [Boot, Title, SlotSelect, World, Hud, CloseUp, Minigame, Pause],
};

const StartGame = (parent: string) => {
    const game = new Game({ ...config, parent });
    const onResize = () => {
        const r = dpr();
        game.scale.setZoom(1 / r);
        game.scale.resize(Math.round(window.innerWidth * r), Math.round(window.innerHeight * r));
    };
    window.addEventListener('resize', onResize);
    // handy for debugging in the console (and public/test-harness.js)
    Object.assign(window, { __game: game, __G: G });
    return game;
};

export default StartGame;
