import StartGame from './game/main';

document.addEventListener('DOMContentLoaded', async () => {
    // Make sure the UI font is ready before Phaser rasterises any text.
    try {
        await Promise.all([document.fonts.load('64px "Bree Serif"'), document.fonts.load('bold 64px "Bree Serif"'), document.fonts.load('italic 900 64px "Montserrat"')]);
    } catch {
        /* fall back to the default serif */
    }
    StartGame('game-container');
});
