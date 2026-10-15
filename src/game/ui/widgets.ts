import * as Phaser from 'phaser';
import { TUNING } from '../config/tuning';
import { L } from './layout';
import { clamp, easeOut, easeOutBack } from '../core/math';

/* ============================================================================
 * Shared colours (sampled from the reference captures)
 * ========================================================================== */
export const UI = {
    disc: 0x262626,
    discAlpha: 0.62,
    alarmDisc: 0x4a1d22,
    red: 0xf04456,
    white: 0xffffff,
    promptFill: 0xf4f4f4,
    promptRing: 0x232623,
    glyphDark: 0x2a2a2a,
    bubble: 0x1b241b,
    bubbleAlpha: 0.88,
    dialog: 0x1c1f1b,
    dialogAlpha: 0.8,
    highlightRed: '#e83044',
    highlightMint: '#51ffa1',
    hunger: [0x000000, 0xbb362d, 0xbe732f, 0xc3b731, 0xa2d532, 0x6cc63a, 0x45c433],
    hungerEmpty: 0x3f4847,
};

const textStyle = (refSize: number, color = '#ffffff', extra: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.Types.GameObjects.Text.TextStyle => ({
    fontFamily: L.font,
    fontSize: L.fs(refSize),
    color,
    ...extra,
});

/* ============================================================================
 * NPC indicator (eye / ear / ! / ?) with fill ring
 * ========================================================================== */
export interface IndicatorState {
    glyph: 'eye' | 'ear' | '!' | '?' | 'foot' | null;
    /** 0..2 */
    meter: number;
    alarmed: boolean;
    /** 0..1 memory ring while alarmed but not seeing */
    memory?: number;
    seeing?: boolean;
}

export class Indicator {
    root: Phaser.GameObjects.Container;
    private disc: Phaser.GameObjects.Arc;
    private ring: Phaser.GameObjects.Graphics;
    private glyph: Phaser.GameObjects.Image;
    private glyphKey = '';

    constructor(scene: Phaser.Scene) {
        this.disc = scene.add.circle(0, 0, 1, UI.disc, UI.discAlpha);
        this.ring = scene.add.graphics();
        this.glyph = scene.add.image(0, 0, 'ui_eye');
        this.root = scene.add.container(0, 0, [this.disc, this.ring, this.glyph]).setDepth(50);
    }

    update(x: number, y: number, s: IndicatorState) {
        const I = TUNING.ui.indicator;
        this.root.setPosition(x, y);
        const R = L.r(I.radius);
        this.disc.setRadius(R);
        this.disc.setFillStyle(s.alarmed && s.seeing !== false ? UI.alarmDisc : UI.disc, s.alarmed ? 0.78 : UI.discAlpha);
        const key = s.glyph === 'ear' ? 'ui_ear' : s.glyph === '!' ? 'ui_exclaim' : s.glyph === '?' ? 'ui_question' : s.glyph === 'foot' ? 'ui_foot' : 'ui_eye';
        if (key !== this.glyphKey) {
            this.glyph.setTexture(key);
            this.glyphKey = key;
        }
        const gsize = key === 'ui_eye' ? 168 : key === 'ui_ear' ? 128 : 120;
        this.glyph.setDisplaySize(L.r(gsize), L.r(gsize));
        const redGlyph = s.alarmed && s.seeing !== false;
        this.glyph.setTint(redGlyph ? UI.red : UI.white);

        const g = this.ring;
        g.clear();
        const rr = L.r(I.ringRadius), w = L.r(I.ringWidth);
        const start = -Math.PI / 2;
        if (s.alarmed) {
            const frac = s.seeing === false ? clamp(s.memory ?? 1, 0, 1) : 1;
            g.lineStyle(w, UI.red, 1);
            g.beginPath();
            g.arc(0, 0, rr, start, start + Math.PI * 2 * frac, false);
            g.strokePath();
            return;
        }
        const white = clamp(s.meter, 0, 1), red = clamp(s.meter - 1, 0, 1);
        if (white > 0.001) {
            g.lineStyle(w, UI.white, 1);
            g.beginPath();
            g.arc(0, 0, rr, start, start + Math.PI * 2 * white, false);
            g.strokePath();
        }
        if (red > 0.001) {
            g.lineStyle(w, UI.red, 1);
            g.beginPath();
            g.arc(0, 0, rr, start, start + Math.PI * 2 * red, false);
            g.strokePath();
        }
    }

    setVisible(v: boolean) {
        this.root.setVisible(v);
    }

    destroy() {
        this.root.destroy();
    }
}

/* ============================================================================
 * Interaction prompt (white disc + dark ring + pointer + glyph). Clickable.
 * ========================================================================== */
export class Prompt {
    root: Phaser.GameObjects.Container;
    private disc: Phaser.GameObjects.Graphics;
    private glyph: Phaser.GameObjects.Image;
    private t = 0;
    private shown = false;
    icon = '';
    onClick?: () => void;

    constructor(scene: Phaser.Scene) {
        this.disc = scene.add.graphics();
        this.glyph = scene.add.image(0, 0, 'ui_hand');
        this.root = scene.add.container(0, 0, [this.disc, this.glyph]).setDepth(60).setVisible(false);
        const hit = new Phaser.Geom.Circle(0, 0, 1);
        this.root.setInteractive(hit, Phaser.Geom.Circle.Contains);
        this.root.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
            e.stopPropagation();
            this.onClick?.();
        });
        this.redraw();
    }

    private redraw() {
        const R = L.r(112), ring = L.r(14);
        const g = this.disc;
        g.clear();
        g.fillStyle(UI.promptRing, 1);
        // pointer nub on top, pointing at the object above
        g.fillTriangle(-L.r(26), -R + L.r(4), L.r(26), -R + L.r(4), 0, -R - L.r(30));
        g.fillCircle(0, 0, R);
        g.fillStyle(UI.promptFill, 1);
        g.fillCircle(0, 0, R - ring);
        (this.root.input!.hitArea as Phaser.Geom.Circle).radius = R;
        this.glyph.setDisplaySize(L.r(150), L.r(150));
    }

    show(icon: string) {
        if (icon !== this.icon) {
            this.icon = icon;
            this.glyph.setTexture('ui_' + icon);
            // glyphs are dark silhouettes; the coin keeps its gold
            if (icon === 'coin') this.glyph.clearTint();
            else this.glyph.setTint(UI.glyphDark);
        }
        if (!this.shown) {
            this.shown = true;
            this.t = 0;
            this.redraw();
            this.root.setVisible(true);
        }
    }

    hide() {
        this.shown = false;
        this.root.setVisible(false);
    }

    get visible() {
        return this.shown;
    }

    update(dt: number, x: number, y: number) {
        if (!this.shown) return;
        this.t += dt;
        const U = TUNING.ui;
        let sc = 1;
        if (this.t < U.promptPopTime) sc = easeOutBack(this.t / U.promptPopTime, 2.2);
        else sc = 1 + Math.sin(((this.t - U.promptPopTime) / U.promptPulsePeriod) * Math.PI * 2) * U.promptPulseAmount * 0.5;
        this.root.setScale(sc);
        this.root.setPosition(x, y);
    }
}

/* ============================================================================
 * World speech bubble ("Hey!", "Follow me!", "?")
 * ========================================================================== */
export class Bubble {
    root: Phaser.GameObjects.Container;
    private bg: Phaser.GameObjects.Graphics;
    private text: Phaser.GameObjects.Text;
    /** coloured word runs of the current line ({r}red{/} / {g}mint{/} markup, as in dialogue) */
    private runs: Phaser.GameObjects.Text[] = [];
    private meas: Phaser.GameObjects.Text;
    private current = '';
    tailRight = false;
    /** marker glyph colour for "?" / "!" bubbles */
    markerColor = '#ffffff';
    private popT = 0;

    constructor(scene: Phaser.Scene) {
        this.bg = scene.add.graphics();
        this.text = scene.add.text(0, 0, '', textStyle(62)).setOrigin(0.5, 0.5);
        this.meas = scene.add.text(0, 0, '', textStyle(62)).setVisible(false);
        this.root = scene.add.container(0, 0, [this.bg, this.text]).setDepth(55).setVisible(false);
    }

    set(text: string) {
        if (text === this.current) return;
        this.current = text;
        this.popT = 0;
        for (const r of this.runs) r.destroy();
        this.runs = [];
        const g = this.bg;
        g.clear();
        g.fillStyle(UI.bubble, UI.bubbleAlpha);
        const isIcon = text === '?' || text === '!';
        if (isIcon) {
            this.text.setStyle(textStyle(92, text === '!' ? this.markerColor : '#ffffff'));
            this.text.setText(text);
            const r = L.r(80);
            g.fillCircle(0, -r, r);
            g.fillTriangle(-L.r(18), -L.r(14), L.r(18), -L.r(14), 0, L.r(18));
            this.text.setPosition(0, -r);
            return;
        }
        this.text.setText('');
        // [measured tutorial §3.4] lines wrap at ≈27 characters: "Let's open up this food box /
        // and see what's inside" (892 x 216 px), "Huh, I don't remember / trying to cook Pickles..."
        const chars: { c: string; color: string }[] = [];
        for (const r of parseRuns(text)) for (const c of r.text) chars.push({ c, color: r.color });
        const plain = chars.map((c) => c.c).join('');
        const width = (t: string) => this.meas.setText(t).width;
        const maxW = L.r(760); // "Let's open up this food box" (726) fits, "Huh, I don't remember trying" (806) breaks
        const lines: [number, number][] = [];
        for (let start = 0; start < plain.length; ) {
            let end = plain.length;
            if (width(plain.slice(start)) > maxW) {
                let cut = -1;
                for (let i = start + 1; i < plain.length; i++) if (plain[i] === ' ' && width(plain.slice(start, i)) <= maxW) cut = i;
                if (cut > start) end = cut;
            }
            lines.push([start, end]);
            start = end + (plain[end] === ' ' ? 1 : 0);
        }
        width('Ag');
        const lineH = this.meas.height;
        const pitch = L.r(72);
        const blockW = Math.max(...lines.map(([a, b]) => width(plain.slice(a, b))));
        const padX = L.r(44), padY = L.r(26);
        const w = Math.max(L.r(160), blockW + padX * 2), h = lineH + (lines.length - 1) * pitch + padY * 2;
        const tailX = this.tailRight ? w * 0.28 : -w * 0.28;
        g.fillRoundedRect(-w / 2, -h - L.r(40), w, h, Math.min(h / 2, L.r(48)));
        g.fillTriangle(tailX - L.r(30), -L.r(41), tailX + L.r(30), -L.r(41), tailX + (this.tailRight ? -L.r(4) : L.r(4)), 0);
        const top = -h - L.r(40) + padY;
        lines.forEach(([a, b], li) => {
            const lw = width(plain.slice(a, b));
            // one line is centred; wrapped lines are left-aligned, like the dialogue box
            const x0 = lines.length === 1 ? -lw / 2 : -blockW / 2;
            const y = top + lineH / 2 + li * pitch;
            for (let i = a; i < b; ) {
                let j = i;
                while (j < b && chars[j].color === chars[i].color) j++;
                const t = this.root.scene.add.text(x0 + width(plain.slice(a, i)), y, plain.slice(i, j), textStyle(62, chars[i].color)).setOrigin(0, 0.5);
                this.root.add(t);
                this.runs.push(t);
                i = j;
            }
        });
    }

    show(x: number, y: number, dt = 0.016, size = 1) {
        this.popT += dt;
        // pop-in: grows from the tail with a +10% overshoot at 0.27 s, settled by ~0.47 s
        const k = this.popT < 0.47 ? easeOutBack(Math.min(1, this.popT / 0.4), 2.2) : 1;
        this.root.setVisible(true).setPosition(x, y).setScale(k * size);
    }

    hide() {
        this.root.setVisible(false);
        this.current = '';
    }

    destroy() {
        this.root.destroy();
        this.meas.destroy();
    }
}

/* ============================================================================
 * Dialogue box (measured: your research/video-notes/tutorial-and-cutscene.md §3.3)
 *  - slides up from below (~0.4 s strong ease-out), down on close (~0.1 s)
 *  - name label straddles the top edge; single lines centred, wrapped text left-aligned
 *  - typewriter ~30-36 cps; click completes, click again advances; ▼ bobs (1.2 s)
 * Markup: {r}word{/} red keyword · {g}word{/} mint place name · ~word~ wavy ·
 *         *word* italic · {s}TEXT{/} shaky (Duck)
 * ========================================================================== */
type Fx = 'none' | 'wave' | 'shake';
interface Run { text: string; color: string; fx: Fx; italic: boolean }

function parseRuns(s: string): Run[] {
    const out: Run[] = [];
    // {c} = inline coin (a gold disc standing in for the raccoon coin glyph, inside-park §2)
    const re = /\{(r|g|s)\}(.*?)\{\/\}|~(.*?)~|\*(.*?)\*|\{c\}/g;
    let last = 0, m: RegExpExecArray | null;
    const plain = (t: string) => t && out.push({ text: t, color: '#ffffff', fx: 'none', italic: false });
    while ((m = re.exec(s))) {
        plain(s.slice(last, m.index));
        if (m[1] === 'r') out.push({ text: m[2], color: UI.highlightRed, fx: 'none', italic: false });
        else if (m[1] === 'g') out.push({ text: m[2], color: UI.highlightMint, fx: 'none', italic: false });
        else if (m[1] === 's') out.push({ text: m[2], color: '#ffffff', fx: 'shake', italic: false });
        else if (m[3] !== undefined) out.push({ text: m[3], color: '#ffffff', fx: 'wave', italic: false });
        else if (m[4] !== undefined) out.push({ text: m[4], color: '#ffffff', fx: 'none', italic: true });
        else if (m[0] === '{c}') out.push({ text: '\u25CF', color: '#eab229', fx: 'none', italic: false });
        last = m.index + m[0].length;
    }
    plain(s.slice(last));
    return out;
}

interface Glyph { obj: Phaser.GameObjects.Text; full: string; start: number; fx: Fx; baseY: number; baseX: number; i: number }

export class DialogBox {
    root: Phaser.GameObjects.Container;
    private bg: Phaser.GameObjects.Graphics;
    private name: Phaser.GameObjects.Text;
    private arrow: Phaser.GameObjects.Graphics;
    private glyphs: Glyph[] = [];
    private total = 0;
    private shownChars = 0;
    open = false;
    private resolve?: (v: boolean) => void;
    private t = 0;
    private slide = 1;          // 0 = in place, 1 = fully below the screen
    private slideTarget = 1;
    private choices: Phaser.GameObjects.Container[] = [];
    private choiceMode = false;
    /** a ✓/✗ question is waiting for an answer */
    get choosing() {
        return this.open && this.choiceMode;
    }
    private speakerShown = false;

    constructor(private scene: Phaser.Scene) {
        this.bg = scene.add.graphics();
        this.name = scene.add.text(0, 0, '', textStyle(76, '#ffffff')).setOrigin(0, 0.5);
        this.arrow = scene.add.graphics();
        this.root = scene.add.container(0, 0, [this.bg, this.arrow, this.name]).setDepth(80).setVisible(false);
    }

    private layout() {
        const bw = L.r(1576), bh = L.r(439);
        const x = L.W / 2 - bw / 2, y = L.H - L.r(146) - bh;
        return { x, y, bw, bh };
    }

    /** Show one page; resolves when the player advances. */
    say(speaker: string | null, text: string): Promise<void> {
        return this.page(speaker, text, false).then(() => undefined);
    }

    /** Show a page with ✓ / ✗ choices; resolves true for ✓. */
    ask(speaker: string | null, text: string): Promise<boolean> {
        return this.page(speaker, text, true);
    }

    private page(speaker: string | null, text: string, choice: boolean): Promise<boolean> {
        const { x, y, bw, bh } = this.layout();
        if (!this.open) this.slide = 1;
        this.open = true;
        this.slideTarget = 0;
        this.root.setVisible(true);
        this.bg.clear();
        this.bg.fillStyle(UI.dialog, UI.dialogAlpha);
        this.bg.fillRoundedRect(x, y, bw, bh, L.r(40));
        this.name.setStyle(textStyle(76, '#ffffff', { fontStyle: 'bold', shadow: { offsetX: 0, offsetY: L.r(3), color: 'rgba(0,0,0,0.6)', blur: L.r(8), fill: true } }));
        this.name.setText(speaker ?? '').setPosition(x + L.r(143), y + L.r(4)).setVisible(!!speaker);
        this.speakerShown = !!speaker;
        for (const g of this.glyphs) g.obj.destroy();
        this.glyphs = [];
        for (const c of this.choices) c.destroy();
        this.choices = [];
        this.choiceMode = choice;

        // tokenise: words for plain runs, single letters for animated runs
        const runs = parseRuns(text);
        type Tok = { text: string; color: string; fx: Fx; italic: boolean; w: number; space: boolean };
        const toks: Tok[] = [];
        const measure = this.scene.add.text(0, 0, '', textStyle(68)).setVisible(false);
        for (const r of runs) {
            for (const part of r.text.split(/(\s+)/)) {
                if (!part) continue;
                measure.setStyle(textStyle(68, '#fff', r.italic ? { fontStyle: 'italic' } : {}));
                measure.setText(part);
                toks.push({ text: part, color: r.color, fx: r.fx, italic: r.italic, w: measure.width, space: /^\s+$/.test(part) });
            }
        }
        measure.destroy();
        const maxW = L.r(1240);
        const lines: Tok[][] = [[]];
        let lw = 0;
        for (const t of toks) {
            if (t.space) {
                if (lines[lines.length - 1].length) { lines[lines.length - 1].push(t); lw += t.w; }
                continue;
            }
            if (lw + t.w > maxW && lines[lines.length - 1].length) {
                const ln = lines[lines.length - 1];
                while (ln.length && ln[ln.length - 1].space) ln.pop();
                lines.push([]);
                lw = 0;
            }
            lines[lines.length - 1].push(t);
            lw += t.w;
        }
        const lineH = L.r(96);
        const widths = lines.map((ln) => ln.reduce((a, b) => a + b.w, 0));
        const blockH = lines.length * lineH;
        let top = y + bh / 2 - blockH / 2 + (speaker ? L.r(8) : 0);
        let idx = 0;
        lines.forEach((ln, li) => {
            let cx = lines.length === 1 ? x + bw / 2 - widths[0] / 2 : x + L.r(140);
            for (const t of ln) {
                const cy = top + lineH / 2;
                if (t.fx === 'none' || t.space) {
                    const obj = this.scene.add.text(cx, cy, '', textStyle(68, t.color, t.italic ? { fontStyle: 'italic' } : {})).setOrigin(0, 0.5);
                    this.root.add(obj);
                    this.glyphs.push({ obj, full: t.text, start: idx, fx: 'none', baseX: cx, baseY: cy, i: 0 });
                    idx += t.text.length;
                    cx += t.w;
                } else {
                    // per-letter objects for animated text
                    const m2 = this.scene.add.text(0, 0, '', textStyle(68)).setVisible(false);
                    let k = 0;
                    for (const ch of t.text) {
                        const obj = this.scene.add.text(cx, cy, '', textStyle(68, t.color)).setOrigin(0, 0.5);
                        this.root.add(obj);
                        this.glyphs.push({ obj, full: ch, start: idx, fx: t.fx, baseX: cx, baseY: cy, i: k++ });
                        m2.setText(ch);
                        cx += m2.width;
                        idx += 1;
                    }
                    m2.destroy();
                }
            }
            top += lineH;
            void li;
        });
        this.total = idx;
        this.shownChars = 0;
        this.t = 0;
        this.arrow.clear();
        if (choice) this.buildChoices(y + bh);
        return new Promise((res) => (this.resolve = res));
    }

    private buildChoices(edgeY: number) {
        const mk = (cx: number, icon: string, val: boolean) => {
            const g = this.scene.add.graphics();
            const R = L.r(120);
            g.fillStyle(UI.promptRing, 1).fillCircle(0, 0, R);
            g.fillStyle(0xebebeb, 1).fillCircle(0, 0, R - L.r(14));
            const gl = this.scene.add.graphics();
            gl.lineStyle(L.r(26), UI.glyphDark, 1);
            if (icon === 'yes') {
                gl.beginPath(); gl.moveTo(-L.r(50), 0); gl.lineTo(-L.r(12), L.r(40)); gl.lineTo(L.r(56), -L.r(44)); gl.strokePath();
            } else {
                gl.lineBetween(-L.r(42), -L.r(42), L.r(42), L.r(42));
                gl.lineBetween(L.r(42), -L.r(42), -L.r(42), L.r(42));
            }
            const c = this.scene.add.container(cx, edgeY, [g, gl]).setVisible(false);
            c.setInteractive(new Phaser.Geom.Circle(0, 0, R), Phaser.Geom.Circle.Contains);
            c.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
                e.stopPropagation();
                if (this.shownChars < this.total) return;
                const r = this.resolve;
                this.resolve = undefined;
                r?.(val);
            });
            this.root.add(c);
            this.choices.push(c);
        };
        mk(L.W * 0.387, 'yes', true);
        mk(L.W * 0.612, 'no', false);
    }

    /** Advance: completes the typewriter, or closes the page. Returns true if handled. */
    advance(): boolean {
        if (!this.open || this.slide > 0.6) return false;
        if (this.shownChars < this.total) {
            this.shownChars = this.total;
            this.reveal();
            return true;
        }
        if (this.choiceMode) return true; // must click a choice
        const r = this.resolve;
        this.resolve = undefined;
        r?.(true);
        return true;
    }

    /** keyboard shortcut for choices */
    choose(v: boolean) {
        if (!this.choiceMode || this.shownChars < this.total) return;
        const r = this.resolve;
        this.resolve = undefined;
        r?.(v);
    }

    close() {
        this.slideTarget = 1;
        this.open = false;
        for (const c of this.choices) c.destroy();
        this.choices = [];
    }

    private reveal() {
        for (const g of this.glyphs) {
            const n = clamp(Math.floor(this.shownChars) - g.start, 0, g.full.length);
            g.obj.setText(g.full.slice(0, n));
        }
    }

    update(dt: number) {
        // slide animation (open: strong ease-out ~0.4 s; close: ~0.1 s)
        const rate = this.slideTarget < this.slide ? 7 : 14;
        this.slide += (this.slideTarget - this.slide) * Math.min(1, dt * rate);
        if (Math.abs(this.slide - this.slideTarget) < 0.002) this.slide = this.slideTarget;
        const off = this.slide * L.r(600);
        this.root.setY(off);
        if (!this.open && this.slide >= 0.999) {
            this.root.setVisible(false);
            for (const g of this.glyphs) g.obj.destroy();
            this.glyphs = [];
            return;
        }
        if (!this.open) return;
        this.t += dt;
        this.name.setVisible(this.speakerShown && this.slide < 0.25);
        if (this.slide < 0.5 && this.shownChars < this.total) {
            this.shownChars = Math.min(this.total, this.shownChars + dt * TUNING.ui.typewriterCps);
            this.reveal();
        }
        for (const g of this.glyphs) {
            if (g.fx === 'wave') g.obj.setY(g.baseY + Math.sin(this.t * 7 + g.i * 0.8) * L.r(8));
            else if (g.fx === 'shake' && Math.random() < 0.3) {
                g.obj.setPosition(g.baseX + (Math.random() - 0.5) * L.r(6), g.baseY + (Math.random() - 0.5) * L.r(8));
                g.obj.setRotation((Math.random() - 0.5) * 0.16);
            }
        }
        this.arrow.clear();
        const done = this.shownChars >= this.total;
        for (const c of this.choices) c.setVisible(done);
        if (done && !this.choiceMode) {
            const { y, bh } = this.layout();
            const bob = Math.sin((this.t / 1.2) * Math.PI * 2) * L.r(12.5);
            const cx = L.W / 2, cy = y + bh + bob;
            const aw = L.r(42), ah = L.r(36);
            this.arrow.fillStyle(0x1d1d1d, 1);
            this.arrow.fillTriangle(cx - aw - L.r(7), cy - ah / 2 - L.r(6), cx + aw + L.r(7), cy - ah / 2 - L.r(6), cx, cy + ah / 2 + L.r(9));
            this.arrow.fillStyle(0xffffff, 1);
            this.arrow.fillTriangle(cx - aw, cy - ah / 2, cx + aw, cy - ah / 2, cx, cy + ah / 2);
        }
    }
}

/* ============================================================================
 * "RANGER DANGER!" style banner
 * ========================================================================== */
export class Banner {
    private text: Phaser.GameObjects.Text;
    private t = -1;
    constructor(scene: Phaser.Scene) {
        this.text = scene.add
            .text(0, 0, '', textStyle(145, '#ffffff', { shadow: { offsetX: 0, offsetY: 6, color: '#000000', blur: 18, fill: true } }))
            .setOrigin(0.5)
            .setDepth(70)
            .setVisible(false);
    }
    show(msg: string) {
        this.text.setStyle(textStyle(145, '#ffffff', { shadow: { offsetX: 0, offsetY: L.r(6), color: 'rgba(0,0,0,0.55)', blur: L.r(18), fill: true } }));
        this.text.setText(msg).setVisible(true);
        this.t = 0;
    }
    update(dt: number) {
        if (this.t < 0) return;
        const B = TUNING.rangerDanger.banner;
        this.t += dt;
        this.text.setPosition(L.W * 0.499, L.H * 0.807);
        let sc = 1, a = 1;
        if (this.t < B.popIn) sc = easeOutBack(this.t / B.popIn, 3.0);
        else if (this.t > B.popIn + B.hold) a = 1 - (this.t - B.popIn - B.hold) / B.fade;
        if (a <= 0) {
            this.t = -1;
            this.text.setVisible(false);
            return;
        }
        this.text.setScale(sc).setAlpha(a);
    }
}

/* ============================================================================
 * Hunger pie (6 segments) with fork & knife tab
 * ========================================================================== */
export class HungerMeter {
    root: Phaser.GameObjects.Container;
    private g: Phaser.GameObjects.Graphics;
    private tabIcon: Phaser.GameObjects.Image;
    value = 6;
    /** fractional fill animation (for eating) */
    shown = 6;
    private popT = 0;
    private blinkT = 0;
    forceVisible = false;

    constructor(scene: Phaser.Scene) {
        this.g = scene.add.graphics();
        this.tabIcon = scene.add.image(0, 0, 'ui_forktab');
        this.root = scene.add.container(0, 0, [this.g, this.tabIcon]).setDepth(65).setVisible(false);
    }

    /** Called when hunger changes: pop the meter up for a few seconds. */
    pop() {
        this.popT = TUNING.hunger.popupTime;
    }

    popFor(sec: number) {
        this.popT = sec;
    }

    update(dt: number, hidden: boolean) {
        const H = TUNING.hunger;
        this.popT = Math.max(0, this.popT - dt);
        this.shown += (this.value - this.shown) * Math.min(1, dt * 6);
        const visible = !hidden && (this.forceVisible || this.popT > 0 || this.value <= H.alwaysShowAtOrBelow);
        this.root.setVisible(visible);
        if (!visible) return;
        const cx = L.right(250), cy = L.r(268), R = L.r(222) - L.r(11);
        this.root.setPosition(cx, cy);
        const g = this.g;
        g.clear();
        // tab
        g.fillStyle(0x222222, 1);
        g.fillRoundedRect(-L.r(425), -L.r(116), L.r(260), L.r(234), L.r(36));
        this.tabIcon.setPosition(-L.r(320), 0).setDisplaySize(L.r(150), L.r(150));
        // pie
        g.fillStyle(0x222222, 1);
        g.fillCircle(0, 0, R + L.r(22));
        const n = Math.round(this.value);
        this.blinkT += dt;
        const blinkOff = n === 1 && (this.blinkT % (H.blinkOn + H.blinkOff)) > H.blinkOn;
        const col = UI.hunger[clamp(n, 0, 6)];
        const seg = (Math.PI * 2) / H.max;
        for (let i = 0; i < H.max; i++) {
            const a0 = -Math.PI / 2 + i * seg, a1 = a0 + seg;
            const filled = i < Math.round(this.shown) && !(blinkOff && i === 0);
            g.fillStyle(filled ? col : UI.hungerEmpty, filled ? 1 : 0.85);
            g.beginPath();
            g.moveTo(0, 0);
            g.arc(0, 0, R, a0, a1, false);
            g.closePath();
            g.fillPath();
        }
        g.lineStyle(L.r(10), 0x222222, 1);
        for (let i = 0; i < H.max; i++) {
            const a = -Math.PI / 2 + i * seg;
            g.lineBetween(0, 0, Math.cos(a) * R, Math.sin(a) * R);
        }
    }
}

/* ============================================================================
 * Backpack HUD button (bottom-left)
 * ========================================================================== */
export class BackpackButton {
    img: Phaser.GameObjects.Image;
    constructor(scene: Phaser.Scene, onClick: () => void) {
        this.img = scene.add.image(0, 0, 'ui_backpack_red').setDepth(60).setVisible(false).setInteractive({ useHandCursor: false });
        this.img.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
            e.stopPropagation();
            onClick();
        });
    }
    setColor(c: string) {
        this.img.setTexture('ui_backpack_' + c);
    }
    update(visible: boolean) {
        this.img.setVisible(visible);
        this.img.setPosition(L.r(145), L.bottom(1898 - 1712)).setDisplaySize(L.r(210), L.r(295));
    }
}

/* ============================================================================
 * Iris wipe: black everywhere except a circle around a point.
 * ========================================================================== */
export class Iris {
    private g: Phaser.GameObjects.Graphics;
    radius = -1;      // <0 = off
    cx = 0;
    cy = 0;
    constructor(scene: Phaser.Scene) {
        this.g = scene.add.graphics().setDepth(100);
    }
    get maxRadius() {
        return Math.hypot(L.W, L.H) * 0.62;
    }
    draw() {
        const g = this.g;
        g.clear();
        if (this.radius < 0) return;
        const r = Math.max(0, this.radius);
        const thick = Math.hypot(L.W, L.H) * 2.2;
        g.lineStyle(thick, 0x000000, 1);
        g.strokeCircle(this.cx, this.cy, r + thick / 2);
        if (r <= 0.5) {
            g.fillStyle(0x000000, 1);
            g.fillRect(0, 0, L.W, L.H);
        }
    }
}

/* ============================================================================
 * Toast ("Secret Cache Found! 1/40")
 * ========================================================================== */
export class Toast {
    root: Phaser.GameObjects.Container;
    private bg: Phaser.GameObjects.Graphics;
    private line1: Phaser.GameObjects.Text;
    private line2: Phaser.GameObjects.Text;
    private t = -1;
    constructor(scene: Phaser.Scene) {
        this.bg = scene.add.graphics();
        this.line1 = scene.add.text(0, 0, '', textStyle(62)).setOrigin(0.5);
        this.line2 = scene.add.text(0, 0, '', textStyle(62, UI.highlightRed)).setOrigin(0.5);
        this.root = scene.add.container(0, 0, [this.bg, this.line1, this.line2]).setDepth(75).setVisible(false);
    }
    show(a: string, b = '') {
        this.line1.setStyle(textStyle(62)).setText(a);
        this.line2.setStyle(textStyle(62, UI.highlightRed)).setText(b);
        const w = Math.max(this.line1.width, this.line2.width) + L.r(90);
        const h = L.r(b ? 190 : 120);
        this.bg.clear().fillStyle(UI.dialog, 0.85).fillRoundedRect(-w / 2, -h / 2, w, h, L.r(24));
        this.line1.setPosition(0, b ? -L.r(36) : 0);
        this.line2.setPosition(0, L.r(40));
        this.root.setVisible(true);
        this.t = 0;
    }
    /** change the counter line mid-toast (the cache count ticks up ~1.75 s in) */
    setLine2(b: string) {
        this.line2.setText(b);
        this.root.setScale(1.06);
        this.root.scene.tweens.add({ targets: this.root, scale: 1, duration: 160 });
    }
    update(dt: number, x: number, y: number) {
        if (this.t < 0) return;
        this.t += dt;
        this.root.setPosition(x, y);
        // pop in, hold, ≈3.8 s total (inside-park t98.3-102.1)
        if (this.t < 0.2) this.root.setScale(0.6 + 0.4 * (this.t / 0.2));
        if (this.t > 3.8) {
            this.t = -1;
            this.root.setVisible(false);
        }
    }
}

/* ============================================================================
 * Tutorial ghost pointer: big white arrow; "hold" shows a steady press ring,
 * "tap" flashes the ring every 0.5 s for ~0.13 s (tutorial §3.13).
 * ========================================================================== */
export class GhostPointer {
    root: Phaser.GameObjects.Container;
    private arrow: Phaser.GameObjects.Graphics;
    private ring: Phaser.GameObjects.Graphics;
    mode: 'hold' | 'tap' | 'click' = 'hold';
    private t = 0;
    private shown = false;
    constructor(scene: Phaser.Scene) {
        this.arrow = scene.add.graphics();
        this.ring = scene.add.graphics();
        this.root = scene.add.container(0, 0, [this.ring, this.arrow]).setDepth(90).setVisible(false);
    }
    show(x: number, y: number, mode: 'hold' | 'tap' | 'click') {
        this.mode = mode;
        this.root.setPosition(x, y).setVisible(true);
        if (!this.shown) {
            this.t = 0;
            this.shown = true;
        }
        const a = this.arrow;
        a.clear();
        const s = L.r(1);
        // classic arrow cursor, tip at (0,0): 224x308 ref px
        const pts = [[0, 0], [0, 230], [62, 178], [104, 270], [146, 252], [104, 162], [182, 162]].map(([px, py]) => new Phaser.Math.Vector2(px * s * 0.8, py * s * 0.8));
        a.fillStyle(0x222222, 1);
        a.fillPoints(pts.map((p) => new Phaser.Math.Vector2(p.x - 7 * s, p.y - 9 * s)), true);
        a.lineStyle(L.r(12), 0x222222, 1);
        a.strokePoints(pts, true, true);
        a.fillStyle(0xffffff, 1);
        a.fillPoints(pts, true);
    }
    moveTo(x: number, y: number) {
        this.root.setPosition(x, y);
    }
    hide() {
        this.shown = false;
        this.root.setVisible(false);
    }
    update(dt: number) {
        if (!this.shown) return;
        this.t += dt;
        const sc = this.t < 0.15 ? easeOutBack(this.t / 0.15, 2) : 1;
        this.root.setScale(sc);
        let on = true;
        if (this.mode === 'tap') on = this.t % 0.5 < 0.13;
        if (this.mode === 'click') on = this.t % 1.2 < 0.3;
        this.ring.clear();
        if (on) {
            this.ring.lineStyle(L.r(14), 0xffffff, 1);
            this.ring.beginPath();
            this.ring.arc(L.r(4), -L.r(8), L.r(62), Math.PI * 1.05, Math.PI * 1.95, false);
            this.ring.strokePath();
            this.ring.lineStyle(L.r(22), 0x222222, 0.35);
        }
    }
}

/* ============================================================================
 * Backpack colour picker (tutorial §3.15): dims the scene, three white discs.
 * ========================================================================== */
export class BackpackPicker {
    root: Phaser.GameObjects.Container;
    private dim: Phaser.GameObjects.Rectangle;
    private resolve?: (c: 'blue' | 'red' | 'green') => void;
    private dimT = 0;
    open = false;
    constructor(private scene: Phaser.Scene) {
        this.dim = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0).setOrigin(0).setDepth(84);
        this.root = scene.add.container(0, 0).setDepth(85).setVisible(false);
    }
    pick(): Promise<'blue' | 'red' | 'green'> {
        this.root.removeAll(true);
        this.open = true;
        this.dimT = 0;
        const panel = this.scene.add.graphics();
        const px = L.W * 0.214, py = L.H * 0.34, pw = L.W * 0.572, ph = L.H * 0.319;
        panel.fillStyle(UI.dialog, 0.85).fillRoundedRect(px, py, pw, ph, L.r(24));
        this.root.add(panel);
        (['blue', 'red', 'green'] as const).forEach((c, i) => {
            const cx = L.W * (0.32 + 0.18 * i), cy = L.H * 0.5;
            const g = this.scene.add.graphics();
            const R = L.r(200);
            g.fillStyle(UI.promptRing, 1).fillCircle(0, 0, R);
            g.fillStyle(0xe8e8e8, 1).fillCircle(0, 0, R - L.r(14));
            const img = this.scene.add.image(0, 0, 'ui_backpack_' + c).setDisplaySize(L.r(190), L.r(267));
            const btn = this.scene.add.container(cx, cy, [g, img]);
            btn.setInteractive(new Phaser.Geom.Circle(0, 0, R), Phaser.Geom.Circle.Contains);
            btn.on('pointerover', () => this.scene.tweens.add({ targets: btn, scale: 1.08, duration: 120 }));
            btn.on('pointerout', () => this.scene.tweens.add({ targets: btn, scale: 1, duration: 120 }));
            btn.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
                e.stopPropagation();
                this.close();
                this.resolve?.(c);
            });
            this.root.add(btn);
        });
        this.root.setVisible(true);
        return new Promise((res) => (this.resolve = res));
    }
    close() {
        this.open = false;
        this.root.setVisible(false);
    }
    update(dt: number) {
        this.dim.setSize(L.W, L.H);
        this.dimT = this.open ? Math.min(1, this.dimT + dt / 0.5) : Math.max(0, this.dimT - dt / 0.1);
        this.dim.setFillStyle(0x000000, 0.38 * this.dimT);
    }
}

/* ============================================================================
 * Thought bubble (white cloud with a dark pictogram + 2 trailing circles)
 * ========================================================================== */
export class ThoughtBubble {
    root: Phaser.GameObjects.Container;
    private g: Phaser.GameObjects.Graphics;
    private icon: Phaser.GameObjects.Image;
    private t = -1;
    constructor(scene: Phaser.Scene) {
        this.g = scene.add.graphics();
        this.icon = scene.add.image(0, 0, 'ui_fork');
        this.root = scene.add.container(0, 0, [this.g, this.icon]).setDepth(56).setVisible(false);
    }
    show(icon = 'fork') {
        this.icon.setTexture('ui_' + icon).setTint(UI.glyphDark);
        this.t = 0;
        this.root.setVisible(true);
    }
    hide() {
        this.t = -1;
        this.root.setVisible(false);
    }
    update(dt: number, x: number, y: number) {
        if (this.t < 0) return;
        this.t += dt;
        this.root.setPosition(x, y);
        const g = this.g;
        g.clear();
        const grow = clamp(this.t / 1.0, 0, 1);
        g.fillStyle(0xf6f3ee, 0.95);
        g.fillCircle(-L.r(30), L.r(70), L.r(16) * clamp(this.t / 0.3, 0, 1));
        g.fillCircle(L.r(10), L.r(26), L.r(26) * clamp((this.t - 0.2) / 0.3, 0, 1));
        const R = L.r(120) * easeOutBack(grow, 1.4);
        for (const [dx, dy, rr] of [[-0.55, 0.1, 0.62], [0.55, 0.1, 0.62], [0, -0.38, 0.7], [-0.25, 0.32, 0.6], [0.3, 0.32, 0.6], [0, 0, 0.8]]) {
            g.fillCircle(L.r(90) + dx * R, -L.r(110) + dy * R, rr * R);
        }
        this.icon.setPosition(L.r(90), -L.r(110)).setDisplaySize(R * 1.05, R * 1.05).setAlpha(grow);
    }
}

/* ============================================================================
 * "Badge Earned!" toast — slides down from the top (0.47 s), holds 6.5 s.
 * ========================================================================== */
export class BadgeToast {
    root: Phaser.GameObjects.Container;
    private t = -1;
    constructor(private scene: Phaser.Scene) {
        this.root = scene.add.container(0, 0).setDepth(76).setVisible(false);
    }
    /** `icon`: a texture key drawn in the green disc instead of the tear-off calendar */
    show(title: string, subtitle: string, badgeText = '1', icon?: string) {
        this.root.removeAll(true);
        const x0 = L.W * 0.35, x1 = L.W * 0.67, h = L.r(226);
        const g = this.scene.add.graphics();
        g.fillStyle(UI.dialog, UI.dialogAlpha).fillRoundedRect(x0, L.r(72), x1 - x0, h, L.r(40));
        g.fillStyle(UI.promptRing, 1).fillCircle(x0 + L.r(20), L.r(72) + h / 2, L.r(135));
        g.fillStyle(0x399132, 1).fillCircle(x0 + L.r(20), L.r(72) + h / 2, L.r(120));
        const cx = x0 + L.r(20), cy = L.r(72) + h / 2;
        const t1 = this.scene.add.text(x0 + L.r(190), L.r(72) + h * 0.36, title, textStyle(66)).setOrigin(0, 0.5);
        const t2 = this.scene.add.text(x0 + L.r(190), L.r(72) + h * 0.7, subtitle, textStyle(52, '#8b8b8b')).setOrigin(0, 0.5);
        this.root.add([g, t1, t2]);
        if (icon && this.scene.textures.exists(icon)) {
            const img = this.scene.add.image(cx, cy, icon);
            img.setScale(Math.min(L.r(170) / img.width, L.r(150) / img.height));
            this.root.add(img);
        } else {
            // tear-off calendar
            g.fillStyle(0xfe4343, 1).fillRoundedRect(cx - L.r(60), cy - L.r(60), L.r(120), L.r(120), L.r(14));
            g.fillStyle(0xececd1, 1).fillRoundedRect(cx - L.r(50), cy - L.r(34), L.r(100), L.r(84), L.r(8));
            this.root.add(this.scene.add.text(cx, cy + L.r(8), badgeText, textStyle(70, '#1c1c19')).setOrigin(0.5));
        }
        this.root.setVisible(true);
        this.t = 0;
    }
    update(dt: number) {
        if (this.t < 0) return;
        this.t += dt;
        const inT = 0.47, hold = 6.5, outT = 0.07;
        let y = 0;
        if (this.t < inT) y = -L.r(400) * (1 - easeOut(this.t / inT));
        else if (this.t > inT + hold) y = -L.r(400) * clamp((this.t - inT - hold) / outT, 0, 1);
        this.root.setY(y);
        if (this.t > inT + hold + outT) {
            this.t = -1;
            this.root.setVisible(false);
        }
    }
}

/* ============================================================================
 * Coin counter (top-left): pops in when coins change, counts up ~6/s,
 * red while decreasing (inside-park §4.5).
 * ========================================================================== */
export class CoinCounter {
    root: Phaser.GameObjects.Container;
    private coin: Phaser.GameObjects.Image;
    private text: Phaser.GameObjects.Text;
    shown = 0;
    target = 0;
    private visT = 0;
    forceVisible = false;
    constructor(scene: Phaser.Scene) {
        this.coin = scene.add.image(0, 0, 'ui_coin');
        this.text = scene.add.text(0, 0, '0', textStyle(150, '#eab229', { stroke: '#7a5a10', strokeThickness: 0 })).setOrigin(0, 0.5);
        this.root = scene.add.container(0, 0, [this.coin, this.text]).setDepth(66).setVisible(false);
    }
    set(v: number, instant = false) {
        if (v !== this.target) this.visT = 4;
        this.target = v;
        if (instant) this.shown = v;
    }
    update(dt: number, hidden: boolean) {
        this.visT = Math.max(0, this.visT - dt);
        if (this.shown !== this.target) {
            const step = Math.max(1, Math.abs(this.target - this.shown) * dt * 2.5);
            this.shown = this.shown < this.target ? Math.min(this.target, this.shown + step) : Math.max(this.target, this.shown - step);
            this.visT = Math.max(this.visT, 1.5);
        }
        const vis = !hidden && (this.forceVisible || this.visT > 0);
        this.root.setVisible(vis);
        if (!vis) return;
        this.coin.setPosition(L.r(183), L.r(177)).setDisplaySize(L.r(260), L.r(260));
        const dec = this.shown > this.target;
        this.text.setStyle(textStyle(150, dec ? '#e83044' : '#eab229')).setText(String(Math.round(this.shown))).setPosition(L.r(340), L.r(182));
    }
}

/* ============================================================================
 * Objective banner (Fox mischief): persistent top-centre box, x 1049-1974 /
 * y 99-299 on the 3024x1898 reference, two centred white lines, the quest
 * giver's head above it (inside-park t0470). Stays up until the mission ends.
 * ========================================================================== */
export class ObjectiveBanner {
    root: Phaser.GameObjects.Container;
    private shown = false;
    private t = 0;
    constructor(private scene: Phaser.Scene) {
        this.root = scene.add.container(0, 0).setDepth(74).setVisible(false);
    }
    show(text: string, icon = 'ui_fox') {
        this.root.removeAll(true);
        const x0 = L.r(1049), x1 = L.r(1974), y0 = L.r(99), y1 = L.r(299);
        const cx = L.W / 2;
        const g = this.scene.add.graphics();
        g.fillStyle(UI.dialog, UI.dialogAlpha).fillRoundedRect(cx - (x1 - x0) / 2, y0, x1 - x0, y1 - y0, L.r(34));
        const t = this.scene.add.text(cx, (y0 + y1) / 2, text, textStyle(66, '#ffffff', { align: 'center', lineSpacing: L.r(8) })).setOrigin(0.5);
        this.root.add([g, t]);
        if (this.scene.textures.exists(icon)) {
            const img = this.scene.add.image(cx, y0 - L.r(6), icon).setDisplaySize(L.r(150), L.r(118));
            this.root.add(img);
        }
        this.root.setVisible(true);
        this.shown = true;
        this.t = 0;
    }
    hide() {
        this.shown = false;
        this.root.setVisible(false);
    }
    update(dt: number, hidden: boolean) {
        if (!this.shown) return;
        this.t += dt;
        this.root.setVisible(!hidden);
        this.root.setAlpha(Math.min(1, this.t / 0.25));
    }
}

/* ============================================================================
 * "Mischief Complete!" toast: bottom-centre box 32-68 %W, 57-76 %H with the fox
 * head over its top edge and the coin reward in gold (inside-park t0816).
 * ========================================================================== */
export class RewardToast {
    root: Phaser.GameObjects.Container;
    private t = -1;
    constructor(private scene: Phaser.Scene) {
        this.root = scene.add.container(0, 0).setDepth(77).setVisible(false);
    }
    show(title: string, coins: number, icon = 'ui_fox') {
        this.root.removeAll(true);
        const w = L.W * 0.355, top = L.H * 0.565, h = L.H * 0.192;
        const g = this.scene.add.graphics();
        g.fillStyle(UI.dialog, 0.92).fillRoundedRect(-w / 2, top, w, h, L.r(30));
        const t1 = this.scene.add.text(0, top + h * 0.36, title, textStyle(96)).setOrigin(0.5);
        const num = this.scene.add.text(-L.r(18), top + h * 0.72, String(coins), textStyle(92, '#eab229')).setOrigin(1, 0.5);
        const coin = this.scene.add.image(L.r(48), top + h * 0.72, 'ui_coin').setDisplaySize(L.r(112), L.r(112));
        this.root.add([g, t1, num, coin]);
        if (this.scene.textures.exists(icon)) this.root.add(this.scene.add.image(0, top - L.r(20), icon).setDisplaySize(L.r(220), L.r(172)));
        this.root.setPosition(L.W / 2, 0).setVisible(true);
        this.t = 0;
    }
    update(dt: number) {
        if (this.t < 0) return;
        this.t += dt;
        // pop in ≈0.2 s, hold, gone after ≈3.5 s (t815-817 + fade)
        this.root.setScale(this.t < 0.2 ? 0.7 + 0.3 * (this.t / 0.2) : 1);
        this.root.setAlpha(this.t > 3.2 ? Math.max(0, 1 - (this.t - 3.2) / 0.3) : 1);
        if (this.t > 3.5) {
            this.t = -1;
            this.root.setVisible(false);
        }
    }
}

/* ============================================================================
 * Kart fuel gauge: on getting in, a ring gauge slides in diagonally from the
 * top-right corner, sits ≈0.15-0.3 s and slides back out. Dark disc, white gas
 * pump, yellow-green sector filling anticlockwise from 12 (outside-park §4.1).
 * ========================================================================== */
export class FuelGauge {
    root: Phaser.GameObjects.Container;
    private g: Phaser.GameObjects.Graphics;
    private t = -1;
    private level = 0.4;
    private hold = 0.3;
    constructor(scene: Phaser.Scene) {
        this.g = scene.add.graphics();
        const pump = scene.add.image(0, 0, 'ui_fuel');
        this.root = scene.add.container(0, 0, [this.g, pump]).setDepth(72).setVisible(false);
    }
    flash(level: number, hold: number) {
        this.level = level;
        this.hold = hold;
        this.t = 0;
        this.root.setVisible(true);
    }
    update(dt: number) {
        if (this.t < 0) return;
        this.t += dt;
        const R = L.r(150), inT = 0.15, outT = 0.15;
        const k = this.t < inT ? this.t / inT : this.t < inT + this.hold ? 1 : 1 - (this.t - inT - this.hold) / outT;
        if (k <= 0 && this.t > inT) {
            this.t = -1;
            this.root.setVisible(false);
            return;
        }
        const e = easeOut(clamp(k, 0, 1));
        const hx = L.W - L.r(200), hy = L.r(200);
        this.root.setPosition(hx + (1 - e) * L.r(420), hy - (1 - e) * L.r(420));
        const g = this.g;
        g.clear();
        g.fillStyle(UI.dialog, 0.9).fillCircle(0, 0, R);
        g.fillStyle(0xc8c86e, 1);
        g.slice(0, 0, R - L.r(16), -Math.PI / 2, -Math.PI / 2 - this.level * Math.PI * 2, true).fillPath();
        g.lineStyle(L.r(16), 0x222222, 1).strokeCircle(0, 0, R - L.r(8));
        (this.root.list[1] as Phaser.GameObjects.Image).setDisplaySize(R * 0.95, R * 0.95);
    }
}

/* ============================================================================
 * Vehicle exit button: bottom-right white disc (centre 93.8 %/90.2 %, ≈264 px,
 * 14 px dark ring, door-with-arrow glyph). Slides in from the corner over
 * 0.17 s while the vehicle is stopped; gone within 0.07 s once it moves.
 * ========================================================================== */
export class ExitButton {
    root: Phaser.GameObjects.Container;
    private k = 0;
    shown = false;
    constructor(scene: Phaser.Scene, onClick: () => void) {
        const g = scene.add.graphics();
        const icon = scene.add.image(0, 0, 'ui_door').setTint(0x2d2f2e);
        this.root = scene.add.container(0, 0, [g, icon]).setDepth(70).setVisible(false);
        this.root.setSize(10, 10);
        this.root.setInteractive(new Phaser.Geom.Circle(0, 0, 1), Phaser.Geom.Circle.Contains);
        this.root.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
            ev.stopPropagation();
            if (this.k > 0.6) onClick();
        });
    }
    update(dt: number, show: boolean) {
        this.shown = show;
        this.k = clamp(this.k + (show ? dt / 0.17 : -dt / 0.07), 0, 1);
        this.root.setVisible(this.k > 0);
        if (this.k <= 0) return;
        const R = L.r(132), e = easeOut(this.k);
        const cx = L.W * 0.938, cy = L.H * 0.902;
        this.root.setPosition(cx + (1 - e) * L.r(260), cy + (1 - e) * L.r(260)).setScale(0.6 + 0.4 * e);
        const g = this.root.list[0] as Phaser.GameObjects.Graphics;
        g.clear();
        g.fillStyle(0x2d2f2e, 1).fillCircle(0, 0, R);
        g.fillStyle(0xffffff, 1).fillCircle(0, 0, R - L.r(14));
        (this.root.list[1] as Phaser.GameObjects.Image).setDisplaySize(R * 1.05, R * 1.05);
        (this.root.input!.hitArea as Phaser.Geom.Circle).radius = R;
    }
}
