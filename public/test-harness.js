// Dev-only test helpers for driving the game from the browser console while the
// pane is hidden (rAF paused). Load with: await import('/test-harness.js')
// __adv(sec)        step the game loop manually at 60 fps
// __ready(zone)     wait until World has loaded the given zone
// __click(x, y)     mouse click at CSS px on the canvas
// __drag(x0,y0,x1,y1) mouse drag in CSS px
window.__adv = async (sec) => {
    const L = window.__game.loop;
    let t = L.__t || performance.now();
    const n = Math.round(sec * 60);
    for (let i = 0; i < n; i++) {
        t += 1000 / 60;
        L.step(t);
        await null;
        await null;
    }
    L.__t = t;
};
window.__ready = async (zone) => {
    for (let k = 0; k < 40; k++) {
        await new Promise((r) => setTimeout(r, 250));
        await window.__adv(0.5);
        const w = window.__game.scene.getScene('World');
        if (w && w.player && w.zone && w.zone.id === zone) return true;
    }
    return false;
};
const mev = (type, x, y) => {
    const cv = window.__game.canvas;
    const r = cv.getBoundingClientRect();
    const ev = new MouseEvent(type, { clientX: r.left + x, clientY: r.top + y, bubbles: true, button: 0, buttons: type === 'mouseup' ? 0 : 1 });
    cv.dispatchEvent(ev);
};
window.__mev = mev;
window.__click = async (x, y) => {
    mev('mousemove', x, y);
    await window.__adv(0.05);
    mev('mousedown', x, y);
    await window.__adv(0.08);
    mev('mouseup', x, y);
    await window.__adv(0.1);
};
window.__drag = async (x0, y0, x1, y1) => {
    mev('mousemove', x0, y0);
    await window.__adv(0.1);
    mev('mousedown', x0, y0);
    await window.__adv(0.15);
    for (let i = 1; i <= 8; i++) {
        mev('mousemove', x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * i) / 8);
        await window.__adv(0.05);
    }
    await window.__adv(0.2);
    mev('mouseup', x1, y1);
    await window.__adv(0.4);
};
window.__W = () => window.__game.scene.getScene('World');
/** step until cond() is truthy (or timeout seconds of game time) */
window.__until = async (cond, timeout = 10) => {
    for (let t = 0; t < timeout; t += 0.1) {
        if (cond()) return true;
        await window.__adv(0.1);
        await new Promise((r) => setTimeout(r, 5));
    }
    return !!cond();
};
/** advance any open dialogue page by page; returns pages advanced */
window.__talk = async (max = 12) => {
    const d = window.__W().hud.dialog;
    let n = 0;
    for (let i = 0; i < max; i++) {
        if (!d.open) {
            await window.__adv(0.4);
            if (!d.open) break;
        }
        d.advance();
        await window.__adv(0.15);
        d.advance();
        n++;
        await window.__adv(0.5);
    }
    return n;
};
/** rapid taps (tiptoe) at CSS px for secs; returns the player modes seen */
window.__taps = async (x, y, secs) => {
    const modes = new Set();
    for (let t = 0; t < secs; t += 0.25) {
        mev('mousemove', x, y);
        mev('mousedown', x, y);
        await window.__adv(0.06);
        mev('mouseup', x, y);
        await window.__adv(0.19);
        modes.add(window.__W().player.mode);
    }
    return [...modes];
};
/** wait for the World scene to have a zone and player loaded */
window.__boot = async () => {
    for (let k = 0; k < 40; k++) {
        await new Promise((r) => setTimeout(r, 250));
        await window.__adv(0.5);
        const w = window.__W();
        if (w && w.zone && w.player) return w.zone.id;
    }
    return null;
};
/** skip the title: start save slot n and wait for its zone */
window.__start = async (slot = 3) => {
    await window.__boot();
    window.__game.scene.stop('Title');
    window.__W().scene.restart({ slot });
    await window.__adv(1);
    await new Promise((r) => setTimeout(r, 1500));
    await window.__adv(1);
    return window.__W().zone.id;
};
/** jump to a zone entry (optionally to x,y), dropping any cutscene camera focus */
window.__goto = async (zone, entry, x, y) => {
    window.__W().loadZone(zone, entry);
    await window.__adv(0.5);
    const V = window.__W();
    V.camFocus = null;
    V.player.locked = false;
    V.player.stop();
    if (x !== undefined) { V.player.x = x; V.player.y = y; }
    V.setZoom(V.restZoom(), true);
    V.snapCamera();
    await window.__adv(0.3);
    V.snapCamera();
    await window.__adv(0.05);
    return V.zone.id;
};
