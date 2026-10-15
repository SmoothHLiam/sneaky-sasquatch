#!/usr/bin/env node
/**
 * Close-up art for the campground / ranger-station interactables (inside-park §4.3):
 * newspaper, boombox, stove, fridge, vending machine, TV, payphone, newspaper box,
 * LOST DOG poster. Flat vector SVGs in the same style as gen-closeup-art.mjs (flat
 * shapes, no outlines, darker shading bands, rounded corners).
 *
 * Every part is authored in the 3024x1898 reference frame the stills were measured
 * on (your research/frames/inside-park/t*.jpg and "more inside park.mov"), then
 * written as its own SVG cropped to its bounding box. A layout file
 * public/assets/closeup/<closeup>.json (manifest key cu_<closeup>, in manifest.json
 * "json") gives, per part:
 *   key        texture key (manifest svgs)
 *   x, y       centre of the texture in ref px when drawn unrotated at its home spot
 *   w, h       texture size in ref px (draw at scale L.s, i.e. 1 ref px per texture px)
 *   pivot      [x,y] ref px rotation/hinge point, with origin [ox,oy] = the same
 *              point as a 0..1 texture origin -> img.setOrigin(ox,oy).setPosition(pivot)
 *   angle      initial rotation in degrees (Phaser convention, clockwise +)
 *   hit        [x0,y0,x1,y1] ref-px hit box (or {cx,cy,r})
 * plus per-closeup "order" (draw order of the default state), "slots" (text the game
 * draws itself), "states" and "notes".
 *
 * Text is converted to outlines by closeup-lib.mjs (Bree Serif from public/assets/fonts;
 * Rockwell / Avenir Next / DIN Alternate from macOS when present, Bree Serif otherwise).
 *
 * Usage: node art/tools/gen-closeup-park.mjs && node art/tools/build-manifest.mjs
 */
import { svg, json, rng, rr, poly, f, FONTS, text, fitText } from './closeup-lib.mjs';

const F = FONTS();
const REF = [3024, 1898];

// ------------------------------------------------------------------ helpers
const R = (x, y, w, h, fill, r = 0, extra = '') =>
    r ? `<path d="${rr(x, y, w, h, r)}" fill="${fill}"${extra}/>` : `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}"${extra}/>`;
const RB = ([x0, y0, x1, y1], fill, r = 0, extra = '') => R(x0, y0, x1 - x0, y1 - y0, fill, r, extra);
const E = (cx, cy, rx, ry, fill, extra = '') => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${extra}/>`;
const C = (cx, cy, r, fill, extra = '') => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}"${extra}/>`;
const P = (d, fill, extra = '') => `<path d="${d}" fill="${fill}"${extra}/>`;
const L = (x1, y1, x2, y2, stroke, w, extra = '') =>
    `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${stroke}" stroke-width="${f(w)}" stroke-linecap="round"${extra}/>`;
const T = (font, s, o, fill, extra = '') => `<path d="${text(font, s, o).d}" fill="${fill}"${extra}/>`;
const FT = (font, s, box, fill, o = {}, extra = '') => `<path d="${fitText(font, s, box, o)}" fill="${fill}"${extra}/>`;
const bold = (fill, w) => ` stroke="${fill}" stroke-width="${w}" stroke-linejoin="round"`;
const inset = ([a, b, c, d], k) => [a + k, b + k, c - k, d - k];
const capH = (font) => -text(font, 'H', { size: 1000 }).y0 / 1000;
const r2 = (v) => Math.round(v * 100) / 100;

/** smooth closed path through points (Catmull-Rom -> cubic Bezier) */
function smooth(pts, tension = 1) {
    const n = pts.length;
    let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 0; i < n; i++) {
        const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
        const c1 = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension];
        const c2 = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension];
        d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
    }
    return d + 'Z';
}

/**
 * Write a part whose body is drawn in ref-frame coordinates, cropped to bbox
 * [x0,y0,x1,y1]. extra.pivot (ref px) gets a matching texture origin.
 */
function part(name, [x0, y0, x1, y1], body, extra = {}) {
    const w = Math.round(x1 - x0), h = Math.round(y1 - y0);
    svg(name, w, h, x0 || y0 ? `<g transform="translate(${-x0} ${-y0})">${body}</g>` : body);
    const p = { key: 'cu_' + name, x: r2(x0 + w / 2), y: r2(y0 + h / 2), w, h };
    if (extra.pivot) p.origin = [+((extra.pivot[0] - x0) / w).toFixed(4), +((extra.pivot[1] - y0) / h).toFixed(4)];
    return Object.assign(p, extra);
}
/** the same texture placed again at another pivot (instances of knobs, burners ...) */
function inst(p, pivot, extra = {}) {
    const dx = pivot[0] - p.pivot[0], dy = pivot[1] - p.pivot[1];
    return { ...p, x: r2(p.x + dx), y: r2(p.y + dy), pivot, ...extra };
}
const layout = (name, obj) => json(name, { ref: REF, ...obj });

// =====================================================================================
// 1. NEWSPAPER — readable card (t0068.9). The day number is drawn by the game (slot).
// =====================================================================================
function newspaperCard() {
    const ink = '#313131', B = F.bree;
    let b = '';
    // paper stack below the card
    b += RB([420, 1690, 2567, 1741], '#717171');
    b += RB([409, 1660, 2578, 1704], '#afafaf');
    b += RB([400, 232, 2588, 1678], '#e7e7e7');
    // masthead: "DAY [n]" .... "The Newspaper" .... "1 COIN"
    const dSize = 43 / capH(B);
    const full = text(B, 'DAY 3', { x: 0, y: 414, size: dSize });
    const sx = 156 / (full.x1 - full.x0);
    const ox = 461 - full.x0 * sx;
    b += T(B, 'DAY', { x: ox, y: 414, size: dSize, sx }, ink, bold(ink, 1.5));
    const dayX = ox + text(B, 'DAY ', { size: dSize, sx }).adv;
    b += FT(F.rockwellBold, 'The Newspaper', [885, 286, 2089, 414], ink);
    b += FT(B, '1 COIN', inset([2339, 372, 2525, 414], 0.75), ink, {}, bold(ink, 1.5));
    b += RB([458, 453, 2520, 459], ink);
    // headline (Bree Serif + a stroke for the heavier weight)
    b += FT(B, 'MYSTERY BEAST SPOTTED', inset([461, 531, 2510, 664], 2.5), ink, { ls: 40 }, bold(ink, 5));
    // photo: shaggy silhouette with a "?"
    b += `<clipPath id="ph"><rect x="456" y="736" width="1037" height="778"/></clipPath>`;
    b += RB([456, 736, 1493, 1514], '#bababa');
    // low-poly shaggy hair mass: each tuft = valley -> two corners of an angled, flat-cut tip
    const r = rng(78);
    const cx = 980, cy = 1068, rx = 300, ry = 248, n = 19;
    const at = (a, k) => [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
    const hp = [];
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2 + (r() - 0.5) * 0.1, st = (Math.PI * 2) / n;
        hp.push(at(a, 0.88 + r() * 0.05), at(a + st * (0.5 + r() * 0.15), 0.99 + r() * 0.05), at(a + st * (0.8 + r() * 0.1), 0.95 + r() * 0.04));
    }
    b += `<g clip-path="url(#ph)">`;
    b += P('M778 1530 L780 1450 Q790 1370 855 1300 L1130 1300 Q1176 1370 1186 1450 L1188 1530 Z', '#464646');
    b += P(poly(hp), '#464646');
    b += `</g>`;
    b += FT(F.avenirHeavy, '?', [931, 1041, 1024, 1227], '#e7e7e7');
    b += FT(B, '"Smell was terrible" say campers.', [461, 1537, 1338, 1589], ink);
    // text columns
    for (let i = 0; i < 22; i++) b += RB([1554, 740 + i * 42.714, 2013, 746 + i * 42.714], ink);
    for (let i = 0; i < 13; i++) b += RB([2057, 740 + i * 42.714, 2516, 746 + i * 42.714], ink);
    // weather box
    b += FT(B, "TOMORROW'S", inset([2088, 1288, 2484, 1331], 1.5), ink, {}, bold(ink, 3));
    b += FT(B, 'WEATHER', inset([2144, 1355, 2430, 1397], 1.5), ink, {}, bold(ink, 3));
    b += P(rr(2057, 1424, 459, 219, 0) + rr(2063, 1430, 447, 207, 0), ink, ' fill-rule="evenodd"');
    b += C(2289, 1533, 47, ink);
    for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a);
        b += P(poly([[2289 + c * 86, 1533 + s * 86], [2289 + c * 58 - s * 13, 1533 + s * 58 + c * 13], [2289 + c * 58 + s * 13, 1533 + s * 58 - c * 13]]), ink);
    }
    const card = part('newspaper_card', [396, 228, 2592, 1745], b, { hit: [400, 232, 2588, 1678] });
    return { card, day: { x: r2(dayX), baseline: 414, capTop: 372, fontSize: r2(dSize), scaleX: r2(sx), fontFamily: 'Bree Serif', color: ink, align: 'left', sample: '3' } };
}

const news = newspaperCard();
layout('newspaper', {
    notes: 'Readable newspaper card (t0068.9). Slides up from below the frame on open (~0.3 s ease-out) and back down on close; the X button closes. ' +
        'The game draws the day number in slots.day: fontFamily/fontSize (ref px, multiply by L.s), left-aligned with its pen at x and its baseline at y=baseline (cap top at capTop); scaleX is the horizontal stretch used for "DAY".',
    parts: { card: news.card },
    order: ['card'],
    slots: { day: news.day },
});

// =====================================================================================
// 2. BOOMBOX (t0288.0 / 288.5): red body, telescopic antenna, two yellow knobs, notes
// =====================================================================================
{
    let b = '';
    b += R(972, 660, 1086, 697, '#f04557', [120, 120, 0, 0]);
    b += R(1078, 712, 46, 78, '#eaeaea', 23); // antenna stub
    b += R(972, 848, 1086, 509, '#be3b49', [130, 130, 0, 0]);
    // tuning window
    b += `<clipPath id="win"><path d="${rr(1073, 928, 407, 157, 45)}"/></clipPath>`;
    b += R(1073, 928, 407, 157, '#c7c7c7', 45);
    b += `<g clip-path="url(#win)">` + RB([1073, 1010, 1480, 1021], '#9a9a9a');
    for (let k = 0; k < 7; k++) b += RB([1121 + k * 52, 997, 1129 + k * 52, 1011], '#9a9a9a');
    b += RB([1159, 928, 1170, 1085], '#d1a307') + `</g>`;
    // speaker
    b += E(1753, 1112, 203, 183, '#7a2a31') + E(1753, 1112, 179, 159, '#952f3a');
    // knob cylinders (the rotating face+mark is a separate part)
    for (const cx of [1148, 1404]) {
        b += E(cx, 1209, 74, 66, '#f7c929') + RB([cx - 74, 1209, cx + 74, 1241], '#f7c929') + E(cx, 1241, 74, 66, '#d1a307');
    }
    const body = part('radio_body', [960, 650, 2070, 1370], b, { hit: [972, 660, 2058, 1356] });

    // knob face + indicator, drawn pointing right (+x) at angle 0; ellipse squashed like the face
    const knob = part('radio_knob', [1148 - 76, 1241 - 68, 1148 + 76, 1241 + 68],
        E(1148, 1241, 74, 66, '#d1a307') + L(1148 + 26, 1241, 1148 + 66, 1241, '#ad7c05', 17), { pivot: [1148, 1241], angle: 0 });
    const knob2 = inst(knob, [1404, 1241], { angle: 38 });
    knob.hit = { cx: 1148, cy: 1225, r: 85 };
    knob2.hit = { cx: 1404, cy: 1225, r: 85 };

    // telescopic antenna, drawn straight up from its pivot (bend above the stub)
    const px = 1101, py = 738;
    let a = '';
    const seg = (y0, y1, w, fill = '#eaeaea') => RB([px - w / 2, py - y1, px + w / 2, py - y0], fill);
    a += C(px, py, 23, '#eaeaea') + seg(0, 292, 46);
    a += seg(286, 298, 52, '#d6d6d6');
    a += seg(292, 634, 34) + seg(628, 638, 40, '#d6d6d6');
    a += seg(634, 812, 22) + R(px - 22, py - 826, 44, 16, '#eaeaea', 6);
    const antenna = part('radio_antenna', [px - 30, py - 836, px + 30, py + 30], a, { pivot: [px, py], angle: 48.7 });
    antenna.capsule = { r: 60, len: 830 }; // hit: within r of the segment from pivot, len px along the rod (up, rotated by angle)

    // music-note particles (light grey, drift up from the speaker / top and fade)
    svg('radio_note_0', 90, 130, `<g fill="#ebebeb"><ellipse cx="30" cy="104" rx="24" ry="18" transform="rotate(-22 30 104)"/><rect x="46" y="10" width="11" height="96" rx="5"/><path d="M51 10 Q84 22 82 60 Q76 36 51 34 Z"/></g>`);
    svg('radio_note_1', 130, 130, `<g fill="#ebebeb"><ellipse cx="27" cy="106" rx="22" ry="16" transform="rotate(-22 27 106)"/><ellipse cx="97" cy="94" rx="22" ry="16" transform="rotate(-22 97 94)"/><rect x="40" y="18" width="10" height="90" rx="5"/><rect x="110" y="8" width="10" height="88" rx="5"/><path d="M40 18 L120 6 L120 30 L40 42 Z"/></g>`);

    layout('radio', {
        notes: 'Red boombox (t0288.0). Drag the antenna (rotate about pivot; observed from ~0 deg = straight up to ~50 deg; the still shows 48.7) ' +
            'or a knob (rotate about its pivot); either stops the music: stop emitting notes. Notes: spawn cu_radio_note_0/1 at emitter every ~0.6 s, ' +
            'rise ~250 ref px over ~1.5 s with a small sideways sway, fade out. antenna.capsule = hit area: within r ref px of the segment that starts at the pivot and runs len px along the rod (straight up rotated by the current angle).',
        parts: { body, antenna, knobL: knob, knobR: knob2 },
        order: ['body', 'antenna', 'knobL', 'knobR'],
        particles: { notes: { keys: ['cu_radio_note_0', 'cu_radio_note_1'], emitter: [1640, 700], w: [90, 130], h: 130 } },
    });
}

// =====================================================================================
// 3. STOVE (t0476.0, 693-777 s): body, 5 knobs, 4 burners (base / flame / grate), oven door
// =====================================================================================
{
    let b = '';
    const X0 = 806, X1 = 2227;
    b += `<clipPath id="sb"><path d="${rr(X0, 234, X1 - X0, 1594, [64, 64, 0, 0])}"/></clipPath><g clip-path="url(#sb)">`;
    b += RB([X0, 234, X1, 1828], '#e7e7e7');
    b += RB([X0, 266, X1, 321], '#cdcdcd');
    b += RB([X0, 894, X1, 1056], '#cdcdcd');
    b += RB([X0, 1056, X1, 1078], '#969696');
    b += RB([X0, 1078, X1, 1696], '#cdcdcd');
    b += RB([X0, 1696, X1, 1828], '#969696');
    b += `</g>`;
    // knob back cylinders (static; the pointer is a separate rotating part)
    const knobX = [1030, 1247, 1522, 1792, 2010], KY = 985;
    for (const x of knobX) b += C(x, KY - 13, 58, '#828282') + RB([x - 58, KY - 13, x + 58, KY], '#828282') + C(x, KY, 58, '#6f6f6f');
    const body = part('stove_body', [800, 228, 2232, 1834], b, { hit: [806, 234, 2227, 1828] });

    const pointer = part('stove_knob', [1030 - 60, KY - 60, 1030 + 60, KY + 60], C(1030, KY, 58, '#6f6f6f') + R(1030 - 11, KY - 42, 22, 84, '#8a8a8a', 11), { pivot: [1030, KY], angle: 0 });
    const knobs = knobX.map((x, i) => inst(pointer, [x, KY], { hit: { cx: x, cy: KY - 6, r: 72 }, controls: ['burnerTL', 'burnerBL', 'oven', 'burnerTR', 'burnerBR'][i] }));

    // burner: base (pan + ring with inner wall), flame frames, grate (arms + cap)
    const BX = 1199, BY = 482;
    let base = '';
    base += E(BX, BY, 245, 116.5, '#6f6f6f');
    base += `<clipPath id="bi"><ellipse cx="${BX}" cy="${BY - 6}" rx="200" ry="81"/></clipPath>`;
    base += E(BX, BY - 6, 200, 81, '#5f5f5f');
    base += `<g clip-path="url(#bi)">` + E(BX, BY + 12, 200, 81, '#bfbfbf') + `</g>`;
    const bb = [BX - 250, BY - 122, BX + 250, BY + 122];
    const burnerBase = part('stove_burner', bb, base, { pivot: [BX, BY] });
    let grate = '';
    // arms: top face + darker side, rounded inner ends
    grate += R(BX - 22, BY - 92, 44, 66, '#5f5f5f', [0, 0, 18, 18]) + R(BX - 22, BY - 92, 44, 54, '#6f6f6f', [0, 0, 18, 18]);
    grate += RB([BX - 22, BY + 30, BX + 22, BY + 98], '#6f6f6f');
    for (const s of [-1, 1]) {
        const x0 = s < 0 ? BX - 202 : BX + 86, x1 = s < 0 ? BX - 86 : BX + 202;
        grate += R(x0, BY - 9, x1 - x0, 36, '#5f5f5f', s < 0 ? [0, 16, 16, 0] : [16, 0, 0, 16]);
        grate += R(x0, BY - 9, x1 - x0, 26, '#6f6f6f', s < 0 ? [0, 13, 13, 0] : [13, 0, 0, 13]);
    }
    grate += E(BX, BY + 13, 66, 36, '#8a8a8a') + E(BX, BY + 5, 66, 36, '#969696');
    const burnerGrate = part('stove_grate', bb, grate, { pivot: [BX, BY] });
    // flame ring: teal petals around the cap, squashed to the burner's perspective (ry/rx = 0.475)
    const flame = (seed, len) => {
        const r = rng(seed);
        let o = '', inner = '';
        const n = 11;
        for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2 + 0.13, L0 = 52, L1 = len * (0.9 + r() * 0.2), wv = 0.36 + r() * 0.06;
            const pt = (rad, da) => [BX + Math.cos(a + da) * rad, BY + 6 + Math.sin(a + da) * rad * 0.475];
            const [ax, ay] = pt(L0, 0), [tx, ty] = pt(L1, 0.1), [l1x, l1y] = pt((L0 + L1) * 0.55, -wv), [r1x, r1y] = pt((L0 + L1) * 0.55, wv);
            o += `M${f(ax)} ${f(ay)}Q${f(l1x)} ${f(l1y)} ${f(tx)} ${f(ty)}Q${f(r1x)} ${f(r1y)} ${f(ax)} ${f(ay)}Z`;
            const [bx2, by2] = pt(L0 + 6, 0), [t2x, t2y] = pt(L1 * 0.8, 0.08), [l2x, l2y] = pt((L0 + L1) * 0.5, -wv * 0.5), [r2x, r2y] = pt((L0 + L1) * 0.5, wv * 0.5);
            inner += `M${f(bx2)} ${f(by2)}Q${f(l2x)} ${f(l2y)} ${f(t2x)} ${f(t2y)}Q${f(r2x)} ${f(r2y)} ${f(bx2)} ${f(by2)}Z`;
        }
        return P(o, '#5cbab3') + P(inner, '#7be6da');
    };
    const flame0 = part('stove_flame_0', bb, flame(11, 158), { pivot: [BX, BY] });
    part('stove_flame_1', bb, flame(12, 148), { pivot: [BX, BY] });
    const burnerPos = { burnerTL: [1199, 482], burnerTR: [1836, 482], burnerBL: [1199, 737], burnerBR: [1836, 737] };
    const burners = {};
    for (const [k, p] of Object.entries(burnerPos)) {
        burners[k] = inst(burnerBase, p, { hit: [p[0] - 245, p[1] - 117, p[0] + 245, p[1] + 117] });
        burners[k + '_grate'] = inst(burnerGrate, p);
        burners[k + '_flame'] = inst(flame0, p, { frames: ['cu_stove_flame_0', 'cu_stove_flame_1'] });
    }

    // oven: cavity (behind), door closed, door open (foreshortened, hinged at the bottom 1696)
    let cav = '';
    cav += RB([X0, 1078, X1, 1696], '#9d9d9d') + RB([X0 + 22, 1092, X1 - 22, 1196], '#b3b3b3');
    cav += RB([X0 + 34, 1222, X1 - 34, 1248], '#e2e2e2') + RB([X0 + 34, 1248, X1 - 34, 1392], '#dcdcdc');
    for (let x = X0 + 56; x < X1 - 50; x += 44) cav += RB([x, 1248, x + 15, 1392], '#a2a2a2');
    const cavity = part('stove_oven', [X0, 1078, X1, 1696], cav);
    let door = '';
    door += RB([X0, 1078, X1, 1696], '#cdcdcd');
    door += R(958, 1116, 82, 40, '#8e8e8e', 8) + R(1995, 1116, 82, 40, '#8e8e8e', 8) + RB([958, 1128, 2077, 1144], '#8e8e8e');
    door += R(958, 1140, 1119, 47, '#6f6f6f', 22);
    door += R(946, 1224, 1142, 428, '#969696', 107);
    door += `<clipPath id="gl"><path d="${rr(974, 1252, 1086, 376, 82)}"/></clipPath>`;
    door += R(974, 1252, 1086, 376, '#d1dad7', 82);
    door += `<g clip-path="url(#gl)">`;
    for (let x = 978; x < 2060; x += 66) door += RB([x, 1252, x + 26, 1492], '#b7c0bd');
    door += RB([974, 1492, 2060, 1516], '#a6afac') + `</g>`;
    const doorClosed = part('stove_door', [X0, 1078, X1, 1696], door, { pivot: [1516.5, 1696], hit: [X0, 1080, X1, 1694] });
    let dOpen = '';
    const OT = 1388; // top of the pulled-down door
    dOpen += RB([X0, OT, X1, 1696], '#cdcdcd');
    dOpen += RB([X0, OT, X1, OT + 10], '#b8b8b8');
    dOpen += R(958, OT + 22, 1119, 20, '#6f6f6f', 10) + R(958, OT + 16, 50, 16, '#8e8e8e', 5) + R(2027, OT + 16, 50, 16, '#8e8e8e', 5);
    dOpen += R(946, OT + 66, 1142, 210, '#969696', 52) + R(974, OT + 80, 1086, 182, '#d1dad7', 40);
    dOpen += `<clipPath id="go"><path d="${rr(974, OT + 80, 1086, 182, 40)}"/></clipPath><g clip-path="url(#go)">`;
    for (let x = 978; x < 2060; x += 66) dOpen += RB([x, OT + 80, x + 26, OT + 150], '#b7c0bd', 0, ' opacity="0.6"');
    dOpen += `</g>`;
    const doorOpen = part('stove_door_open', [X0, OT, X1, 1696], dOpen, { pivot: [1516.5, 1696], hit: [X0, OT, X1, 1694] });

    // smoke wisp particle (burning food, t775): translucent wavy column
    svg('stove_smoke', 200, 520, `<path d="M96 515 C60 470 70 430 104 392 C140 352 132 312 98 278 C66 246 70 200 104 166 C134 136 128 96 100 60 C88 44 92 20 104 6 C112 26 118 44 126 60 C150 100 154 140 124 172 C96 202 94 240 122 272 C156 312 162 356 126 398 C98 432 96 468 120 515 Z" fill="#ffffff" opacity="0.55"/><path d="M104 500 C86 466 92 438 112 412 C132 384 128 352 108 326" stroke="#ffffff" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.6"/>`);

    layout('stove', {
        notes: 'White 4-burner range (t0476.0). Knobs: drag to rotate the pointer about its pivot; angle 0 = off (vertical bar), 90 = full (horizontal, t0476 knob 1), 45 = low (knob 2). ' +
            'knobs[i].controls names the burner; a burner is lit while its knob angle > ~15: show burner*_flame (alternate frames every ~0.12 s, scale 0.75..1 with the knob angle) between burner* (base) and burner*_grate. ' +
            'Oven: the door pulls down (drag down on its hit box): scaleY the closed door towards 0.5 about its bottom-centre pivot, then swap to door_open; the cavity sits behind. ' +
            'Food dropped on a lit burner burns: spawn cu_stove_smoke rising from the item (~200x520, rise 300 ref px, fade, every 0.4 s).',
        parts: { body, oven: cavity, door: doorClosed, doorOpen, ...burners, ...Object.fromEntries(knobs.map((k, i) => ['knob' + (i + 1), k])) },
        order: ['body', 'oven', 'door', 'burnerTL', 'burnerTL_grate', 'burnerTR', 'burnerTR_grate', 'burnerBL', 'burnerBL_grate', 'burnerBR', 'burnerBR_grate', 'knob1', 'knob2', 'knob3', 'knob4', 'knob5'],
        states: {
            lit: 'burner X lit: draw burnerX_flame between burnerX and burnerX_grate',
            ovenOpen: 'replace door with doorOpen (oven stays behind)',
            t0476: { knob1: { angle: 90 }, knob2: { angle: 45 }, lit: ['burnerTL', 'burnerBL'] },
        },
        particles: { smoke: { key: 'cu_stove_smoke', w: 200, h: 520 } },
    });
}

// =====================================================================================
// 4. FRIDGE (621-632 s, RV 881-893 s): body + interior, wire shelves, door closed / swung open
// =====================================================================================
{
    let b = '';
    b += RB([778, -40, 2260, 1940], '#e7e7e7');
    b += R(808, 96, 1450, 1844, '#c5c5c5', [96, 96, 0, 0]);
    b += R(856, 153, 1354, 1787, '#e7e7e7', [56, 56, 0, 0]);
    const body = part('fridge_body', [776, -40, 2262, 1940], b);

    let s = '';
    const shelves = [[513, 696], [996, 1179], [1482, 1665]];
    for (const [y0, y1] of shelves) {
        for (let x = 908; x < 2190; x += 67) s += RB([x, y0 + 20, x + 26, y1 - 26], '#999999');
        s += RB([872, y0, 2210, y0 + 22], '#6f6f6f') + RB([872, y1 - 28, 2210, y1], '#6f6f6f');
    }
    const shelvesPart = part('fridge_shelves', [866, 505, 2216, 1672], s);

    let dc = '';
    dc += R(778, 66, 1470, 1874, '#969696', [128, 128, 0, 0]);
    dc += R(778, 99, 1470, 1841, '#cdcdcd', [128, 128, 0, 0]);
    dc += R(2065, 683, 75, 60, '#999999', [37, 37, 0, 0]) + R(2065, 711, 75, 547, '#6f6f6f', [0, 0, 37, 37]);
    const doorClosed = part('fridge_door', [776, 60, 2250, 1940], dc, { pivot: [778, 1000], hit: [778, 66, 2248, 1898], handle: [2060, 680, 2145, 1262] });

    let dop = '';
    dop += P('M692 150 Q694 128 708 128 C740 128 774 420 774 720 L774 1940 L692 1940 Z', '#cdcdcd');
    dop += P('M700 128 L800 130 C838 130 872 420 872 720 L872 1940 L774 1940 L774 720 C774 420 740 128 700 128 Z', '#969696');
    dop += RB([682, 1126, 766, 1686], '#999999') + RB([682, 1126, 688, 1686], '#6f6f6f');
    const doorOpen = part('fridge_door_open', [678, 120, 880, 1940], dop, { hit: [680, 128, 874, 1898] });

    layout('fridge', {
        notes: 'White fridge (621-632 s). Closed: body + door. Drag the door (or its handle) to the left: it swings open about the hinge at x=778 ' +
            '(scaleX the closed door from 1 to ~0.07 about origin x=0, then swap to door_open which stays on the left). Items stand on the shelves: ' +
            'item bottom = shelf.itemBaseline, x within shelf.x0..x1 (items are drawn above the shelves layer). Close restores the door.',
        parts: { body, shelves: shelvesPart, door: doorClosed, doorOpen },
        order: ['body', 'shelves', 'door'],
        states: { open: ['body', 'shelves', '(items)', 'doorOpen'] },
        shelves: shelves.map(([y0, y1]) => ({ y0, y1, itemBaseline: y1 - 30, x0: 900, x1: 2190 })),
        sample: { top: ['pepper', 'orange'], bottom: ['pickles'] },
    });
}

// =====================================================================================
// 5. VENDING (t0595.0): machine front, 3 price buttons, tray cover; items are item_* sprites
// =====================================================================================
{
    let b = '';
    b += RB([672, -40, 2330, 1940], '#3971a2');
    b += R(738, -60, 1040, 1362, '#2b5470', [0, 0, 92, 92]);
    b += R(762, -40, 994, 1298, '#2a2e2f', [0, 0, 70, 70]);
    const rows = [['A', 214], ['B', 609], ['C', 1002]];
    for (const [ch, y] of rows) {
        b += RB([762, y, 1756, y + 116], '#565c5c');
        b += RB([762, y + 116, 1756, y + 147], '#414747');
        b += R(1130, y + 116, 258, 91, '#393f3f', [0, 0, 26, 26]);
        b += FT(F.bree, ch, inset([1229, y + 135, 1286, y + 190], 2), '#818181', {}, bold('#818181', 4));
    }
    // tray
    b += R(736, 1338, 1042, 326, '#294c62', 66);
    // coin panel
    b += R(1854, 1388, 394, 224, '#2b5470', 22) + R(1884, 1426, 176, 146, '#282828', 16) + R(2156, 1430, 30, 48, '#282828', 8);
    const body = part('vending_body', [670, -40, 2332, 1940], b);

    let cover = '';
    cover += R(736, 1338, 1042, 326, '#294c62', 66, ' opacity="0.62"');
    cover += R(1022, 1554, 472, 64, '#2f627d', 32) + R(1022, 1554, 472, 13, '#38768d', [6, 6, 0, 0]);
    const tray = part('vending_tray', [734, 1336, 1780, 1666], cover, { hit: [736, 1338, 1778, 1663] });

    const coinSvg = (cx, cy, r) =>
        C(cx, cy, r, '#e8b828') + C(cx, cy, r * 0.83, '#f3c93a') +
        P(`M${f(cx - r * 0.48)} ${f(cy - r * 0.17)} C${f(cx - r * 0.48)} ${f(cy - r * 0.5)} ${f(cx - r * 0.25)} ${f(cy - r * 0.52)} ${f(cx)} ${f(cy - r * 0.52)} C${f(cx + r * 0.25)} ${f(cy - r * 0.52)} ${f(cx + r * 0.48)} ${f(cy - r * 0.5)} ${f(cx + r * 0.48)} ${f(cy - r * 0.17)} C${f(cx + r * 0.48)} ${f(cy + r * 0.2)} ${f(cx + r * 0.27)} ${f(cy + r * 0.5)} ${f(cx)} ${f(cy + r * 0.52)} C${f(cx - r * 0.27)} ${f(cy + r * 0.5)} ${f(cx - r * 0.48)} ${f(cy + r * 0.2)} ${f(cx - r * 0.48)} ${f(cy - r * 0.17)} Z`, '#c8961c') +
        C(cx - r * 0.2, cy - r * 0.1, r * 0.1, '#f3c93a') + C(cx + r * 0.2, cy - r * 0.1, r * 0.1, '#f3c93a') + C(cx, cy + r * 0.22, r * 0.09, '#f3c93a');
    const button = (down) => {
        const top = down ? 18 : 43, y0 = 164 + (down ? 25 : 0);
        let o = R(1846, y0, 411, 179 - (down ? 25 : 0), '#696d6e', 12) + R(1846, y0 + top, 411, 179 - top - (down ? 25 : 0), '#4b4f50', [0, 0, 12, 12]);
        const cy = y0 + top + 136 / 2 - 8;
        o += FT(F.avenirBold, '5', [1968, cy - 32, 2012, cy + 32], '#e4b52f');
        o += coinSvg(2083, cy, 48);
        return o;
    };
    const btn = part('vending_button', [1844, 162, 2259, 345], button(false));
    part('vending_button_down', [1844, 162, 2259, 345], button(true));
    const buttons = [0, 1, 2].map((i) => ({ ...btn, y: r2(btn.y + i * 364), hit: [1846, 164 + i * 364, 2257, 343 + i * 364], row: rows[i][0], price: 5, downKey: 'cu_vending_button_down' }));

    // orange soda: same can frame as item_soda (140x220)
    svg('item_sodaOrange', 140, 220, `<rect x="20" y="20" width="100" height="190" rx="14" fill="#c56a2c"/><rect x="26" y="10" width="88" height="20" rx="8" fill="#c8c8c8"/><rect x="20" y="194" width="100" height="16" rx="8" fill="#a9b0ae"/><path d="M36 68 L104 68 L104 128 Q104 150 70 160 Q36 150 36 128 Z" fill="#9aa1a0"/><circle cx="70" cy="114" r="22" fill="#e07f22"/><path d="M68 92 Q74 80 86 82 Q80 94 70 96 Z" fill="#4f8f2a"/>`);

    const slot = (row, col, item) => {
        const y = { A: 192, B: 586, C: 951 }[row], x = col ? 1468 : 1055;
        const h = item === 'chips' ? 481 : 251;
        return { row, col, x, y, item, key: 'cu_item_' + (item === 'sodaOrange' ? 'sodaOrange' : item), h };
    };
    layout('vending', {
        notes: 'Blue vending machine (t0595.0). Each price button buys its row (A/B/C) for 5 coins: swap to downKey while held, deduct 5 (counter flashes red while counting), ' +
            'then the front item of that row falls (gravity, ~0.5 s) from its slot to tray.itemY and lands BEHIND the tray part (drawn after items) - it shows through the translucent cover; the player drags it out of tray.hit to the bag. ' +
            'Items are the shared item sprites (item_soda, item_chips, new item_sodaOrange); slot.h is the display height of the svg in ref px (keep aspect). Not enough coins: shake the button.',
        parts: { body, tray, button0: buttons[0], button1: buttons[1], button2: buttons[2] },
        order: ['body', '(slot items)', '(dropped item)', 'tray', 'button0', 'button1', 'button2'],
        slots: [slot('A', 0, 'sodaOrange'), slot('A', 1, 'sodaOrange'), slot('B', 0, 'soda'), slot('B', 1, 'soda'), slot('C', 0, 'chips'), slot('C', 1, 'chips')],
        tray: { rect: [736, 1338, 1778, 1663], itemY: 1490, dropX: [1150, 1300] },
        coinSlot: [1884, 1426, 2060, 1572],
    });
}

// =====================================================================================
// 6. TV (t0637.0, 633-646 s): CRT with V antenna, tuning dial, VOLUME / POWER, screens
// =====================================================================================
{
    const SX0 = 459, SY0 = 544, SX1 = 2089, SY1 = 1766, SW = SX1 - SX0, SH = SY1 - SY0;
    let b = '';
    b += P('M1089 94 L1950 94 L2404 272 L635 272 Z', '#3e3e3e');
    b += R(386, 272, 2266, 1600, '#714b38', [92, 92, 0, 0]);
    // wood grain
    const r = rng(21);
    for (let i = 0; i < 9; i++) {
        const w = 160 + r() * 420, x = 450 + r() * (2140 - w), y = 300 + r() * 120;
        b += R(x, y, w, 7, '#664331', 3.5);
    }
    b += R(386, 440, 2266, 1418, '#313131', [86, 86, 40, 40]);
    b += R(386, 448, 2266, 22, '#4a4a4a', [80, 80, 0, 0]);
    b += R(394, 472, 2250, 1386, '#313131', [72, 72, 40, 40]);
    b += R(SX0, SY0, SW, SH, '#2b2f2e', 30);
    // control panel
    b += R(2139, 556, 440, 1229, '#4a4a4a', 40) + R(2139, 543, 440, 1222, '#6c6c6c', 40);
    // tuning dial: back cylinder + number ring (face/ring/pointer rotate as tv_dial)
    b += C(2358, 776, 109, '#474747') + RB([2249, 776, 2467, 798], '#474747');
    b += C(2357, 625, 9, '#222222');
    for (let k = 1; k <= 9; k++) {
        const a = -Math.PI / 2 + (k / 10) * Math.PI * 2, x = 2357 + Math.cos(a) * 150, y = 798 + Math.sin(a) * 150;
        b += T(F.din, String(k), { x, y: y + 15, size: 30 / capH(F.din), anchor: 'middle' }, '#222222');
    }
    for (let i = 0; i < 16; i++) b += RB([2210, 1063 + i * 22.6, 2508, 1071 + i * 22.6], '#222222') + RB([2210, 1071 + i * 22.6, 2508, 1077 + i * 22.6], '#8e8e8e');
    for (const [x, lab] of [[2251, 'VOLUME'], [2466, 'POWER']]) {
        b += R(x - 48, 1545, 96, 82, '#474747', [48, 48, 0, 0]);
        b += T(F.din, lab, { x, y: 1712, size: 28 / capH(F.din), anchor: 'middle' }, '#222222');
    }
    // antenna base block
    b += RB([1372, 301, 1666, 423], '#3b3b3b');
    const body = part('tv_body', [380, 88, 2660, 1870], b, { hit: [386, 272, 2652, 1858] });

    const dial = part('tv_dial', [2246, 687, 2468, 909], C(2357.5, 798, 109, '#cacaca') + C(2357.5, 798, 100, '#313131') + L(2357.5 + 36, 798, 2357.5 + 104, 798, '#e8334a', 9), { pivot: [2357.5, 798], angle: -16, hit: { cx: 2357.5, cy: 790, r: 125 } });
    const knob = part('tv_knob', [2251 - 50, 1627 - 50, 2251 + 50, 1627 + 50], C(2251, 1627, 48, '#313131') + C(2251, 1627, 37, '#a9a9a9') + L(2251 + 6, 1627, 2251 + 34, 1627, '#313131', 7), { pivot: [2251, 1627] });
    const volume = { ...knob, angle: -20, hit: { cx: 2251, cy: 1610, r: 62 } };
    const power = inst(knob, [2466, 1627], { angle: -90, hit: { cx: 2466, cy: 1610, r: 62 } });

    // antenna rod, drawn straight up from its pivot
    const ant = (px, py) => {
        let a = C(px, py, 19.5, '#e9e9e9') + RB([px - 19.5, py - 300, px + 19.5, py], '#e9e9e9');
        a += RB([px - 15, py - 560, px + 15, py - 296], '#e9e9e9') + RB([px - 18, py - 306, px + 18, py - 294], '#d3d3d3');
        a += RB([px - 10.5, py - 800, px + 10.5, py - 556], '#e9e9e9') + RB([px - 13, py - 566, px + 13, py - 554], '#d3d3d3');
        a += R(px - 17, py - 816, 34, 18, '#e9e9e9', 7);
        return a;
    };
    const antL = part('tv_antenna', [1439 - 26, 363 - 826, 1439 + 26, 363 + 26], ant(1439, 363), { pivot: [1439, 363], angle: -27 });
    const antR = inst(antL, [1598, 363], { angle: 27 });
    antL.capsule = antR.capsule = { r: 60, len: 816 };

    // screens (all share the screen rect + scanlines)
    const scan = `<pattern id="sl" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="3.5" fill="#000" opacity="0.13"/></pattern>`;
    const clipS = `<clipPath id="sc"><path d="${rr(SX0, SY0, SW, SH, 30)}"/></clipPath>`;
    const sx = (u) => SX0 + u * SW, sy = (v) => SY0 + v * SH;
    const D = (x, y) => [x * 1.512, y * 1.512]; // display px of the 2000-wide stills -> ref
    const continent = (pts) => smooth(pts.map(([x, y]) => D(x, y)), 1);
    const map = [
        [[335, 540], [390, 500], [470, 490], [540, 470], [610, 470], [650, 500], [700, 482], [760, 492], [740, 540], [690, 560], [660, 600], [630, 640], [600, 690], [570, 700], [540, 670], [500, 640], [450, 620], [420, 590], [380, 580]],
        [[640, 440], [700, 428], [745, 448], [705, 478], [662, 470]],
        [[600, 705], [650, 700], [710, 730], [730, 770], [700, 830], [670, 900], [640, 960], [620, 990], [610, 940], [600, 860], [585, 780]],
        [[850, 520], [880, 490], [930, 480], [980, 470], [1000, 500], [960, 530], [940, 560], [900, 562], [870, 550]],
        [[860, 600], [920, 580], [990, 590], [1040, 630], [1070, 690], [1050, 760], [1010, 830], [980, 880], [960, 860], [940, 780], [910, 700], [870, 670], [850, 630]],
        [[1000, 470], [1080, 450], [1180, 450], [1260, 465], [1330, 500], [1350, 540], [1310, 560], [1280, 600], [1240, 640], [1200, 690], [1170, 660], [1130, 640], [1090, 610], [1050, 590], [1020, 560], [990, 530]],
        [[1150, 890], [1210, 870], [1250, 890], [1250, 940], [1200, 960], [1160, 945], [1140, 920]],
    ].map((c) => P(continent(c), '#4c86b6')).join('');
    const overlay = () => {
        let o = '';
        o += RB([1845, SY0, SX1, 620], '#a83d48') + FT(F.din, 'LIVE', [1917, 562, 2015, 600], '#efefef');
        o += RB([SX0, 1545, 915, 1690], '#a83d48') + FT(F.avenirBoldItalic, 'NEWS', [526, 1572, 836, 1653], '#efefef');
        o += RB([SX0, 1690, 1845, SY1], '#e9e9e9') + RB([1845, 1690, SX1, SY1], '#3d3d3d');
        o += FT(F.din, '04:45', [1910, 1707, 2024, 1747], '#e9e9e9');
        return o;
    };
    // scrolling ticker text (outlines, transparent) for slots.ticker
    const tickS = 36 / capH(F.din);
    const tick = text(F.din, 'Airman puzzled at unprecedented level of wire chewing in all local elevators        Local duck leader signs new treaty        ', { x: 0, y: 54, size: tickS });
    const tickW = Math.ceil(tick.adv);
    svg('tv_ticker', tickW, 76, `<path d="${tick.d}" fill="#4a4a4a"/>`);
    const screen = (name, inner, withMap = true) => part(name, [SX0, SY0, SX1, SY1], `<defs>${scan}${clipS}</defs><g clip-path="url(#sc)">${RB([SX0, SY0, SX1, SY1], "#5c9fd4")}${withMap ? map : ""}${inner}${overlay()}<rect x="${SX0}" y="${SY0}" width="${SW}" height="${SH}" fill="url(#sl)"/></g>`);
    let title = '';
    title += RB([786, 934, 1761, 1293], '#a83d48') + FT(F.avenirBoldItalic, 'NEWS', [892, 1016, 1645, 1210], '#ececec');
    title += RB([786, 1296, 1464, 1399], '#e9e9e9') + FT(F.din, 'WITH', [839, 1331, 953, 1368], '#4a4a4a') + FT(F.din, 'GUGGINS', [1001, 1318, 1300, 1376], '#4a4a4a');
    const scrNews = screen('tv_screen_news', title);
    let anchor = '';
    // newscaster: bald, side hair, grey suit, red tie; picture box with a duck at right
    // big bald head (no neck), grey side hair, dot eyes, dark suit + red tie (641-643 s)
    anchor += P('M690 1570 C700 1420 760 1335 880 1318 L1100 1318 C1220 1335 1280 1420 1290 1570 Z', '#3e4048');
    anchor += P('M928 1318 L1052 1318 L990 1420 Z', '#efefef');
    anchor += P('M974 1332 L1006 1332 L1014 1360 L1004 1500 L990 1522 L976 1500 L966 1360 Z', '#c0394a');
    anchor += E(990, 1040, 318, 272, '#dcae86');
    anchor += P('M686 940 C676 1000 680 1080 704 1130 C716 1080 724 1010 736 960 Z M1294 940 C1304 1000 1300 1080 1276 1130 C1264 1080 1256 1010 1244 960 Z', '#a39b93');
    anchor += C(862, 1150, 15, '#2e2e2e') + C(1118, 1150, 15, '#2e2e2e');
    anchor += P('M950 1222 Q990 1240 1030 1222', 'none', ' stroke="#a9775a" stroke-width="9" stroke-linecap="round"');
    anchor += R(1560, 820, 390, 330, '#e9e9e9', 12) + R(1575, 835, 360, 300, '#58a65a', 8);
    anchor += E(1755, 1050, 95, 62, '#fbfbfb') + C(1820, 960, 45, '#fbfbfb') + P('M1855 955 L1905 968 L1858 982 Z', '#f0a030') + C(1832, 950, 7, '#222');
    anchor += P('M1690 1040 Q1720 1000 1770 1030 Q1730 1060 1690 1040 Z', '#e6e6e6');
    const scrAnchor = screen("tv_screen_anchor", anchor, false);
    // static: grey grain (feTurbulence), 3 frames
    const statics = [0, 1, 2].map((i) =>
        part('tv_static_' + i, [SX0, SY0, SX1, SY1],
            `<defs>${scan}${clipS}<filter id="n" x="${SX0}" y="${SY0}" width="${SW}" height="${SH}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
            `<feTurbulence type="fractalNoise" baseFrequency="0.16 0.42" numOctaves="2" seed="${7 + i * 13}"/>` +
            `<feColorMatrix type="matrix" values="3.2 0 0 0 -1.1  3.2 0 0 0 -1.1  3.2 0 0 0 -1.1  0 0 0 0 1"/>` +
            `<feComponentTransfer><feFuncR type="linear" slope="0.62" intercept="0.19"/><feFuncG type="linear" slope="0.62" intercept="0.2"/><feFuncB type="linear" slope="0.62" intercept="0.22"/></feComponentTransfer></filter></defs>` +
            `<g clip-path="url(#sc)"><rect x="${SX0}" y="${SY0}" width="${SW}" height="${SH}" filter="url(#n)"/><rect x="${SX0}" y="${SY0}" width="${SW}" height="${SH}" fill="url(#sl)"/></g>`));

    layout('tv', {
        notes: 'CRT TV (t0637.0). Antennas: two instances of cu_tv_antenna rotating about their pivots (still: -27 / +27 deg; dragged out to about -80 / +80 at 644 s); hit = within capsule.r of the rod, capsule.len px from the pivot. ' +
            'Dial (channel, 9 stops, 36 deg apart; still angle -16) and VOLUME / POWER knobs rotate about their pivots. Dragging an antenna or the dial gives static: ' +
            'show a static frame over the channel screen (cycle tv_static_0..2 every ~70 ms) at alpha 0.5..1 depending on how far off-tune; full static while dragging (643 s). ' +
            'POWER off: hide the screen part (the body shows a dark screen). Screens: tv_screen_news (title card) and tv_screen_anchor (newscaster); both have the LIVE tag, ' +
            'bottom NEWS tab, clock and an empty ticker bar: scroll slots.ticker.key (text outlines, loops seamlessly every w px) right-to-left inside slots.ticker.rect (geometry mask), top at rect[1].',
        parts: { body, antennaL: antL, antennaR: antR, dial, volume, power, screenNews: scrNews, screenAnchor: scrAnchor, static0: statics[0], static1: statics[1], static2: statics[2] },
        order: ['body', 'antennaL', 'antennaR', 'screenNews', 'dial', 'volume', 'power'],
        states: { anchor: { screen: 'screenAnchor' }, static: { overlay: ['static0', 'static1', 'static2'] }, spread644: { antennaL: { angle: -80 }, antennaR: { angle: 80 } } },
        slots: {
            ticker: { rect: [SX0, 1690, 1845, SY1], key: 'cu_tv_ticker', w: tickW, h: 76, speed: 220 },
        },
        screen: [SX0, SY0, SX1, SY1],
    });
}

// =====================================================================================
// 7. PAYPHONE (t0431.0 / 428.6 s): body + keypad, chrome hook lever, handset, cord
// =====================================================================================
{
    let b = '';
    // cord bracket on the left of the housing
    b += R(756, 400, 117, 157, '#4e4e4e', 10) + RB([776, 540, 852, 572], '#3f3f3f');
    b += R(876, 101, 1282, 1840, '#4f4f4f', [92, 92, 0, 0]);
    b += R(880, 251, 1274, 1690, '#3f3f3f', [60, 60, 0, 0]);
    b += R(942, 320, 1153, 1548, '#868686', 46);
    // coin slot + divider
    b += R(1030, 383, 265, 161, '#3971a2', 10) + R(1190, 400, 15, 112, '#2a2a2a', 6) + R(1364, 384, 24, 160, '#3f3f3f', 6);
    // hook lever base (lever itself is a part)
    b += C(1663, 463, 97, '#777777');
    // handset cradle prongs
    for (const [x0, s] of [[999, -1], [1357, 1]]) {
        b += R(x0, 861, 63, 177, '#b5b5b5', s < 0 ? [34, 6, 6, 6] : [6, 34, 6, 6]);
        b += RB(s < 0 ? [x0 + 45, 868, x0 + 63, 1038] : [x0, 868, x0 + 18, 1038], '#9e9e9e');
    }
    // keypad
    b += R(1480, 732, 541, 945, '#777777', 40);
    b += R(1535, 779, 431, 165, '#3f3f3f', 20);
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '<'];
    const colX = [1535, 1694, 1851], rowY = [1010, 1175, 1340, 1505];
    const keyHits = {};
    keys.forEach((k, i) => {
        const x0 = colX[i % 3], y0 = rowY[Math.floor(i / 3)], x1 = x0 + 116, y1 = y0 + 141;
        b += RB([x0, y0, x1, y1], '#bdbdbd') + RB([x0, y0, x1, y0 + 27], '#e2e2e2');
        const cy = (y0 + 27 + y1) / 2 + 2;
        if (k === '*') b += FT(F.bree, '*', [x0 + 40, cy - 30, x1 - 40, cy + 6], '#656565');
        else if (k === '<') b += FT(F.bree, '<', [x0 + 42, cy - 20, x1 - 42, cy + 20], '#656565');
        else b += T(F.bree, k, { x: (x0 + x1) / 2, y: cy + 25, size: 51 / capH(F.bree), anchor: 'middle' }, '#656565');
        keyHits[k] = [x0, y0, x1, y1];
    });
    const body = part('payphone_body', [750, 96, 2164, 1940], b);

    // chrome hook lever (pivot at the knob centre; press it down to hang up / reset)
    const lever = part('payphone_lever', [1600, 400, 1940, 526],
        RB([1663, 422, 1935, 506], '#bdbdbd') + RB([1663, 422, 1935, 438], '#e2e2e2') + C(1663, 463, 57, '#bdbdbd') +
        P('M1606 463 A57 57 0 0 1 1720 463 A57 46 0 0 0 1606 463 Z', '#e2e2e2'),
        { pivot: [1663, 463], angle: 0, hit: [1600, 400, 1940, 526] });

    // handset (hangs on the cradle; drag it off)
    let h = '';
    h += C(1218, 790, 177, '#3f3f3f');
    h += P('M1004 1460 C1004 1380 1080 1424 1180 1424 C1280 1424 1360 1380 1360 1460 C1360 1600 1290 1745 1180 1745 C1070 1745 1004 1600 1004 1460 Z', '#3f3f3f');
    h += P('M1131 1746 L1215 1746 L1206 1811 L1140 1811 Z', '#346ea5');
    h += P('M1134 616 L1306 616 Q1314 616 1314 626 L1272 1748 L1094 1748 L1124 626 Q1124 616 1134 616 Z', '#4a4a4a');
    h += P('M1134 616 L1306 616 Q1314 616 1314 626 L1311 712 L1122 712 L1124 626 Q1124 616 1134 616 Z', '#545454');
    const handset = part('payphone_handset', [990, 600, 1410, 1820], h, { pivot: [1200, 1180], hit: [1000, 610, 1400, 1760], cordAttach: [1173, 1808], hookPos: [1200, 1180] });

    const cordD = 'M814 556 C820 760 860 1000 905 1240 C950 1480 1000 1700 1060 1840 C1090 1900 1150 1900 1172 1808';
    const cord = part('payphone_cord', [780, 540, 1200, 1925], `<path d="${cordD}" stroke="#a5a5a5" stroke-width="44" fill="none" stroke-linecap="round"/>`);

    layout('payphone', {
        notes: 'Payphone (t0431.0, 428-450 / 832-858 s). Flow seen: coin into the blue slot (costs 1) -> display "PICK UP" -> lift the handset off the cradle -> "PHONE" -> ' +
            'digits as typed ("555-5678"; < deletes) -> "CALLING" above the number -> dialogue. Hang up by dropping the handset back on hookPos or pressing the lever. ' +
            'The handset is draggable (grab anywhere in hit); while it is off the hook hide cu_payphone_cord and draw the cord yourself as a sagging grey #a5a5a5 44 px wide ' +
            'curve from cordAnchor to the handset cordAttach (rotate/translate that point with the handset). Keys: flash a dark overlay (rgba(0,0,0,0.18)) on the key rect for ~0.12 s. ' +
            'Lever: rotate ~ +20 deg about its pivot while pressed. Display text is drawn by the game (slots.display).',
        parts: { body, cord, handset, lever },
        order: ['body', 'cord', 'handset', 'lever'],
        coinSlot: { hit: [1030, 383, 1295, 544], coinPos: [1150, 463], coinR: 52 },
        cordAnchor: [814, 556],
        keys: keyHits,
        slots: {
            display: { rect: [1535, 779, 1966, 944], color: '#5bbff9', mainLine: { centerY: 875, capHeight: 56 }, smallLine: { centerY: 812, capHeight: 14, sample: '- - -' }, fontFamily: 'a 7-/14-segment LCD style monospace', samples: ['COIN', 'PICK UP', 'PHONE', '555-5678', 'CALLING'] },
        },
    });
}

// =====================================================================================
// 8. NEWSPAPER BOX — no close-up of the box front exists in the footage (the game cuts
//    straight to the newspaper card), so this is drawn to match the world sprite:
//    white box, dark hood, window with the paper behind it, coin slot.
// =====================================================================================
{
    const X0 = 902, X1 = 2122, WIN = [1002, 520, 2022, 1100];
    let b = '';
    b += R(X0 + 30, 1700, 70, 240, '#5a5a5a') + R(X1 - 100, 1700, 70, 240, '#5a5a5a');
    b += P(rr(X0, 330, X1 - X0, 1400, 36) + rr(WIN[0], WIN[1], WIN[2] - WIN[0], WIN[3] - WIN[1], 18), '#ececec', ' fill-rule="evenodd"');
    b += P(rr(X0, 1560, X1 - X0, 170, [0, 0, 36, 36]), '#d6d6d6');
    b += P(rr(WIN[0] - 22, WIN[1] - 22, WIN[2] - WIN[0] + 44, WIN[3] - WIN[1] + 44, 30) + rr(WIN[0], WIN[1], WIN[2] - WIN[0], WIN[3] - WIN[1], 18), '#c9c9c9', ' fill-rule="evenodd"');
    b += R(X0 - 20, 120, X1 - X0 + 40, 250, '#4a4a4a', [60, 60, 18, 18]) + RB([X0 - 20, 330, X1 + 20, 370], '#3a3a3a');
    b += FT(F.rockwellBold, 'The Newspaper', [1010, 196, 1640, 282], '#ececec');
    b += R(1730, 170, 300, 150, '#3a3a3a', 18) + R(1840, 196, 26, 98, '#151515', 10);
    b += FT(F.bree, '1 COIN', [1900, 222, 2008, 260], '#f3c93a');
    b += R(1262, 1200, 500, 70, '#8f8f8f', 35) + R(1262, 1200, 500, 26, '#a8a8a8', [13, 13, 0, 0]);
    b += R(1340, 1380, 344, 120, '#dcdcdc', 14) + R(1360, 1400, 304, 80, '#cfcfcf', 10);
    const body = part('newsbox_body', [880, 110, 2144, 1940], b, { hit: [X0, 120, X1, 1730] });
    const glass = part('newsbox_glass', WIN,
        RB(WIN, '#dfeef2', 0, ' opacity="0.18"') + P(`M${WIN[0] + 90} ${WIN[1]} L${WIN[0] + 260} ${WIN[1]} L${WIN[0] + 60} ${WIN[3]} L${WIN[0] - 110} ${WIN[3]} Z`, '#ffffff', ' opacity="0.22"') +
        P(`M${WIN[0] + 330} ${WIN[1]} L${WIN[0] + 380} ${WIN[1]} L${WIN[0] + 180} ${WIN[3]} L${WIN[0] + 130} ${WIN[3]} Z`, '#ffffff', ' opacity="0.18"'),
        { hit: WIN });
    const scale = (WIN[2] - WIN[0] - 60) / 2188;
    layout('newspaper_box', {
        notes: 'White newspaper box front (designed from the world sprite; the footage never shows its close-up: tapping the box went straight to the newspaper card). ' +
            'Draw cu_newspaper_card behind the body at paper.x/y with paper.scale (it is clipped by the window cut-out), then the glass overlay. Tapping the window, handle ' +
            'or coin slot opens the newspaper close-up (newspaper.json). Viewing was free in the footage despite "1 COIN".',
        parts: { body, glass },
        order: ['(newspaper_card at paper)', 'body', 'glass'],
        paper: { key: 'cu_newspaper_card', x: r2((WIN[0] + WIN[2]) / 2), y: r2(WIN[1] + 20 + (1517 * scale) / 2), scale: r2(scale), window: WIN },
        coinSlot: [1730, 170, 2030, 320],
        handle: [1262, 1200, 1762, 1270],
    });
}

// =====================================================================================
// 9. LOST DOG poster (824 s): white card, red title, dog photo, phone number
// =====================================================================================
{
    let b = '';
    b += RB([900, 162, 2124, 1745], '#eeeeee');
    b += FT(F.avenirHeavy, 'LOST DOG', [1029, 285, 1997, 418], '#e44747');
    b += RB([1024, 535, 2000, 1242], '#c7c7c7');
    // dog traced on a 700 px wide crop of the photo (824 s): photo px = 1.394 x crop px
    const D = (x, y) => [1024 + x * 1.394, 535 + y * 1.394];
    const sm = (pts, t = 0.6) => smooth(pts.map(([x, y]) => D(x, y)), t);
    const M = (x, y) => D(x, y).map(f).join(' ');
    const dark = '#2a2a27', white = '#e6dadb';
    b += `<clipPath id="ph"><rect x="1024" y="535" width="976" height="707"/></clipPath><g clip-path="url(#ph)">`;
    // shoulders / chest
    b += P(sm([[172, 520], [178, 440], [215, 372], [350, 360], [485, 372], [522, 440], [528, 520]], 0.5), dark);
    b += P(poly([D(226, 372), D(474, 372), D(456, 520), D(244, 520)]), '#bcb5b4');
    // head + ears
    b += P(sm([[180, 70], [178, 30], [190, 18], [205, 24], [240, 72], [285, 128], [350, 121], [415, 128], [460, 72], [500, 24], [515, 18], [524, 32], [522, 120], [516, 200], [492, 236], [488, 300], [472, 372], [446, 398], [350, 396], [254, 398], [228, 372], [212, 300], [208, 236], [186, 200], [180, 130]], 0.45), dark);
    // white blaze + muzzle
    b += P(sm([[350, 143], [382, 150], [394, 180], [386, 214], [374, 242], [392, 262], [432, 286], [446, 330], [442, 372], [425, 396], [400, 398], [350, 386], [300, 398], [275, 396], [258, 372], [254, 330], [268, 286], [308, 262], [326, 242], [314, 214], [306, 180], [318, 150]], 0.7), white);
    // eyes, nose, mouth
    b += E(...D(260, 247), 28, 32, '#0e0e0b') + E(...D(440, 247), 28, 32, '#0e0e0b');
    b += P(sm([[324, 266], [350, 262], [376, 266], [384, 282], [372, 300], [350, 310], [328, 300], [316, 282]], 0.7), '#1a1a18');
    b += P(`M${M(330, 290)} Q${M(338, 282)} ${M(345, 292)} M${M(355, 292)} Q${M(362, 282)} ${M(370, 290)}`, 'none', ' stroke="#55524f" stroke-width="5" stroke-linecap="round"');
    b += P(`M${M(350, 308)} L${M(350, 345)} M${M(296, 392)} Q${M(332, 368)} ${M(350, 345)} Q${M(368, 368)} ${M(404, 392)}`, 'none', ` stroke="${dark}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"`);
    b += `</g>`;
    b += FT(F.avenirReg, 'Call for more information.', [1030, 1348, 1992, 1404], '#303030');
    b += FT(F.avenirHeavy, '555-5678', [1025, 1466, 1999, 1615], '#303030');
    const card = part('lostdog_card', [896, 158, 2128, 1749], b, { hit: [900, 162, 2124, 1745] });
    layout('lost_dog', {
        notes: 'LOST DOG poster (820-830 s). The white card slides up from the bottom (from y+1600 to its spot, ~0.35 s ease-out) and slides back down on close. ' +
            'The number 555-5678 is the payphone quest number.',
        parts: { card },
        order: ['card'],
        phone: '555-5678',
    });
}

console.log('park close-up art written');
