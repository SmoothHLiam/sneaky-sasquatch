# Static environment props (Blender → sprites)

Rendered with `lib_toon` (orthographic, pitch 52°, 200 px/m, house toon material) into
`public/assets/sprites/props/<key>.png` + `<key>.json`, then `node art/tools/build-manifest.mjs`.

Re-run a script (all groups, or just some):

```
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/blender/props_tutorial.py -- [cabin bed stove shop_tree wood_sign wood_sign_campsites gate]
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/blender/props_campsite.py -- [camp_sign firepit bbq_grill firewood cooler picnic_table tents foodbox pad trash_can blanket umbrella camp_chair]
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/blender/props_nature.py -- [rocks rock_big stump log]
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/blender/props_campground.py -- [notice_board outhouse cache_chest signpost warning_sign fence]
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/blender/props_extra.py -- [bridge rvs shop_shelf shop_floor rug lantern]
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/blender/props_station.py -- [station atm vending newspaper fridge stove counter tv moose smoke table chair bed cabinet rugs]
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/blender/props_park.py -- [payphone power_pole poster hydrant car boombox sign_exit cliff cave rv_interior duck_hat]
node art/tools/build-manifest.mjs
```

Shared helpers live in `props_lib.py` (colour compensation so a face renders exactly the sampled
reference colour, per-normal painting, prisms/lofts/roots/text meshes, `run()` driver).

## Conventions

* **Anchor = footprint centre on the ground** for every key (x = east, y = north, front faces −y).
  Footprints below are collision boxes `w × d` (metres) **centred on the anchor** — no offset.
  (props.ts has been updated to centred anchors.)
* **Scale:** the 3024-px stills are ~1:1 with these sprites (the sasquatch renders 316 px tall at
  200 ppm and measures ~317 px in t030/t050). All sizes were measured that way, so several are
  smaller than the first guesses (cabin 3.3 m wide, not 6.2; tent 2.0 m; picnic table 1.75 m).
* Each json also carries `footprint`, `blocksSight` and, where useful, extra layout data
  (`board` text frame for `wood_sign`, `plaque` for `camp_sign`, `sortY` for cabin layers).
* Flat graphics (letters, icons, sign text) are stretched ×1/cos52 vertically so they read
  undistorted on screen, matching the original.

## Keys

| key | size W×D×H (m) | footprint w×d | blocks sight | script / group | notes |
|---|---|---|---|---|---|
| `cabin` | 3.9×3.3×5.1 (walls 3.27×2.8, roof incl. overhang) | 3.27×2.8 | yes | tutorial / cabin | mossy roof, boarded window, orange door (t030) |
| `cabin_roof` | 3.9×3.3 roof only | – | – | tutorial / cabin | same anchor as `cabin`; fade/cut layer |
| `cabin_interior` | 3.27×2.8, back wall 3 m | – | – | tutorial / cabin | floor, back wall + picture, back posts, side walls cut to 0.32 m (t208) |
| `cabin_interior_front` | 3.27×0.25×0.32 | – | – | tutorial / cabin | low cut front wall with door gap; draw in front of actors (json `sortY` = −1.4) |
| `cabin_door_open` | 0.9 door, swung 20° in | – | – | tutorial / cabin | same anchor as cabin; sort at y ≈ −0.9 |
| `bed` | 0.85×1.5×0.8 | 0.85×1.5 | no | tutorial / bed | long axis N-S, headboard north (t208) |
| `wood_stove` | 0.62×0.62×3.35 (pipe) | 0.6×0.6 | no | tutorial / stove | cabin stove + pipe to the ceiling |
| `shop_tree` | trunk Ø≈2.2 (roots spread ≈4.5×4.5), 12 m tall | 2.2×2.2 | yes | tutorial / shop_tree | door, round window, stovepipe, hanging raccoon/SHOP sign (t050.5) |
| `wood_sign` | 3.2 board × 1.1, posts 2.9 | 2.2×0.3 | no | tutorial / wood_sign | blank; json `board` = text frame (centre, size, roll −6.3°) |
| `wood_sign_campsites` | same | 2.2×0.3 | no | tutorial / wood_sign_campsites | "Campsites →" baked in Bree Serif |
| `gate` | post Ø0.3×1.86 on 0.43 slab, arm 3.6 m along +x (open) | 0.45×0.45 (post) | no | tutorial / gate | origin = north post base; arm swung open along the road (t056) |
| `gate_closed` | arm 3.6 m along −y | 0.45×0.45 | no | tutorial / gate | arm swung across the road onto `gate_post` |
| `gate_post` | Ø0.3×1.86 + slab | 0.45×0.45 | no | tutorial / gate | south receiving post |
| `camp_sign` / `_a` `_b` `_c` `_d` | post 0.17×2.36, plaque 0.68 wide | 0.3×0.3 | no | campsite / camp_sign | `camp_sign` = blank plaque |
| `firepit` | Ø1.15, 0.37 tall | 1.15×1.1 (or r 0.55) | no | campsite / firepit | 13 rocks, ash bed, 2 logs |
| `firepit_lit` | same + flames | 1.15×1.1 | no | campsite / firepit | |
| `bbq_grill` | Ø1.15, grate 0.86×0.5×0.62 | 1.15×1.1 | no | campsite / bbq_grill | fire ring + flames under a black grate (campsite D) |
| `firewood` | 1.45×0.7×1.2 | 1.45×0.7 | no | campsite / firewood | 6/5/4/3 stacked logs, spiral ring ends |
| `cooler` | 0.8×0.5×0.6 | 0.8×0.5 | no | campsite / cooler | teal body, white lid, bail handle (the tutorial "food box") |
| `cooler_open` | 0.8×0.5×1.1 (lid up) | 0.8×0.5 | no | campsite / cooler | lid open, water + ice |
| `picnic_table` | 1.75×1.31×0.78 | 1.75×1.35 | no | campsite / picnic_table | long axis N-S, benches E/W, as in every still |
| `picnic_table_ew` | 1.31×1.75×0.78 | 1.35×1.75 | no | campsite / picnic_table | rotated 90° |
| `tent_green` / `tent_orange` / `tent_blue` | 2.0×1.28×1.9 | 2.0×1.3 | yes | campsite / tents | ridge N-S, door faces −y, corner pegs |
| `foodbox` | 1.36×0.76×1.02 | 1.36×0.76 | no | campsite / foodbox | grey steel bear locker — no reference found (see below) |
| `parking_pad` | 2.45×1.61, slab raised 0.22 | 2.45×1.61 (decal) | no | campsite / pad | tan dirt border + concrete slab (trash-can pad, t0025) |
| `trash_can` | 0.66×0.45×1.3 | 0.66×0.45 (r 0.33) | no | campsite / trash_can | ribbed grey can, lid + handle; sits on `parking_pad` |
| `blanket` | 1.42×2.1 flat | decal | no | campsite / blanket | 6×7 red/white checks |
| `umbrella` | canopy Ø2.0, 3.7 tall | pole r 0.1 | no | campsite / umbrella | teal/white 8 panels |
| `camp_chair` (+`_e` `_w` `_n`) | 0.5×0.46×0.92 | 0.5×0.5 | no | campsite / camp_chair | teal chair facing south / east / west / north (i_0413) |
| `rock_a` | 1.05×0.8×0.7 | 1.0×0.75 (r 0.45) | no | nature / rocks | rounded rock + top lump (t030) |
| `rock_b` | 1.2×0.65×0.3 | 1.2×0.65 | no | nature / rocks | flat slab + small companion (t056) |
| `rock_big_a` | 2.2×1.3×3.3 | 2.2×1.3 | yes | nature / rock_big | cluster of grey rock columns (i_0091) |
| `stump` | Ø0.5×0.5 | 0.5×0.5 (r 0.25) | no | nature / stump | tan top #b07e39 + spiral rings, bark #75582e (t0250) |
| `log` | 2.1×0.44×0.6 | 2.0×0.5 | no | nature / log | fallen log along x, ring ends, branch stub |
| `notice_board` | 2.2 roof × 3.5 tall, posts at x=±0.79 | 2.0×0.4 | no | campground / notice_board | red mossy gable roof, cork board, posts on concrete blocks (cut037.5) |
| `notice_board_maps` | same | 2.0×0.4 | no | campground / notice_board | + 4 yellow map pieces pinned on |
| `outhouse` | 1.38×1.35 walls, 1.84×1.6 roof, 3.3 tall | 1.4×1.4 | yes | campground / outhouse | red roof, plank walls, crescent-moon door (t0078) |
| `outhouse_door_open` | same | 1.4×1.4 | yes | campground / outhouse | door swung 120° outward on the right hinge, dark interior |
| `cache_chest` | 1.07×0.55×0.78 | 1.1×0.6 | no | campground / cache_chest | red chest, white ring + pine logo on the lid (i_0091 / t0093.3) |
| `signpost_rv_lake` | 3.2 boards × 2, posts 3.8 | 2.7×0.3 | no | campground / signpost | "RV Park ↑ / Lake ↓" baked (t0250) |
| `signpost_blank` | same | 2.7×0.3 | no | campground / signpost | blank boards; json `boards` = text frames |
| `warning_sign` | post 0.18×3.2, plate 0.65 | 0.25×0.25 | no | campground / warning_sign | yellow triangle with "!" hung off a grey post (i_0409) |
| `fence` | one 2.13 m bay along x, 1.42 tall | 2.13×0.2 | no | campground / fence | post at x=−1.065 + 3 rails; tile bays every 2.13 m, cap the run with `fence_post` (o01) |
| `fence_post` | Ø0.26×1.42 | 0.26×0.26 | no | campground / fence | end post |
| `bridge_wood` | 3.7 (x) × 2.9 (y), deck arch +0.85 m | 3.7×2.9 (walkable deck; railings block ±y edges) | no | extra / bridge | **deck runs along x** — in t0129.6 the bridge crosses a N–S river east–west |
| `bridge_wood_ns` | 2.9 (x) × 3.7 (y) | 2.9×3.7 (railings block ±x edges) | no | extra / bridge | same bridge rotated 90° so the deck runs along y (railings seen edge-on) |
| `rv_teal` | 8.3×1.72×3.16 | 8.3×1.72 | yes | extra / rvs | motorhome, windshield/cab at +x, door on −y (i_0293 / i_0300 — measured 8.3 m, not 6) |
| `rv_white` | 3.36×1.57×3.19 (+0.4 hitch at −x) | 3.36×1.57 | yes | extra / rvs | camper trailer (i_0264) |
| `rv_yellow` | 3.36×1.57×3.19 (+0.4 hitch) | 3.36×1.57 | yes | extra / rvs | same trailer, yellow with white stripe (i_0267) |
| `shop_shelf` | 4.17×0.69×0.85 | 4.2×0.7 | no | extra / shop_shelf | pale counter on 3 log stumps, dark blank price plaques (json `plaques`) (t246.5) |
| `shop_interior_floor` | Ø10.6, wall 2.5 tall | decal (wall ring r 4.9–5.3 from −28° to 208°) | no | extra / shop_floor | sandy floor #b98a4c + curved wall ring open to the south |
| `rug_red` | 3.8×1.85 flat | decal | no | extra / rug | ranger-station rug, darker border (i_0493) |
| `lantern` | Ø0.3×0.65 | 0.3×0.3 | no | extra / lantern | dark frame, glowing yellow glass (t246.5) |

### Ranger station (`props_station.py`)

Measured in "more inside park.mov": exterior f_454 / f_658 (zoom 1.0), interior f_650 / f_655 / t0470 / t0495.
**The camera zooms ~1.56× inside the station** (sasquatch 491 px, door leaf 257 px vs 163 px outside), so every
interior size was divided by 1.56 — the notes' "10 × 6 SH" was screen-measured; the real room is 7.6 × 7.4 m inside.

All `station*` layers share **one anchor = centre of the 8.01 × 7.91 m wall bounding box**. Building plan (metres,
relative to that anchor; x east, y north): L-shape = gabled main block x −4.0…1.24 (front wall y −3.955, door
x −0.99…−0.16, window left of it) + east wing x 1.24…4.0 whose front wall is set back to y −1.755 (window, no door).
A low partition (y 0.565…0.825, door x 2.10…2.93) splits the south room (L-shaped: ATM, vending machine, newspaper
stand, long table, rug) from the north room (bed, wardrobe, moose head, table + 2 chairs, TV, fridge, counter, stove,
smoke detector). `station_interior.json` carries `walls` (collision rects), `rooms`, `doors` and `furniture`
(footprint-centre positions for every furniture key, `key#n` = another copy).

| key | size W×D×H (m) | footprint w×d | blocks sight | script / group | notes |
|---|---|---|---|---|---|
| `station` | 8.2 (logs) × 7.9, ridge 5.49, wing eave 2.9 | 8.01×7.91 (json `colliders`: main 4.74×7.91 + wing) | yes | station / station | log walls, rounded log tips, spiral log-end stacks, brown roof (not green-grey: every still shows #885932 / #a36b39), "RANGER STATION" board, lantern, door + window; east wing set back 2.2 m |
| `station_roof` | roofs only | – | – | station / station | fade/cut layer, same anchor |
| `station_interior` | floor + 2.71 m back wall + 0.32 m cut side walls | – | – | station / station | draw behind everything inside; json walls/rooms/doors/furniture |
| `station_interior_mid` | partition, cut 0.32 | – | – | station / station | own sort layer, `sortY` 0.565 (partition south face) |
| `station_interior_front` | main front wall, cut 0.32, door gap | – | – | station / station | `sortY` −3.955 |
| `station_interior_front_wing` | wing front wall, cut 0.32 | – | – | station / station | `sortY` −1.755 |
| `station_door` | 0.83×1.97 leaf, closed | – | – | station / station | the cut-away view draws the closed door full height in the cut wall (f_655) |
| `station_door_open` | leaf swung 80° outward on the west jamb (t0660.3) | – | – | station / station | `sortY` −4.405 |
| `station_door_inner` / `_inner_open` | partition door closed / swung 95° into the north room (f_654) | – | – | station / station | `sortY` 0.565 / 1.225 |
| `atm` | 0.82×0.32×2.28 | 0.82×0.4 | no | station / atm | blue "ATM" sign, screen + side keys, keypad with red/yellow/green keys |
| `vending_machine` | 1.16×0.73×2.32 | 1.16×0.73 | yes | station / vending | blue, stocked window (orange + red cans, chip bags), 3 buttons, coin slot, tray |
| `newspaper_box` | 0.67×0.46×1.23 | 0.67×0.46 | no | station / newspaper | brown frame on dark legs, two stacks, front page on top, coin box (the notes' "white box" is the paper) |
| `fridge` / `fridge_open` | 0.82×0.50×1.78 | 0.82×0.5 | no | station / fridge | closed (t0470) / door open west with wire shelves (f_650) |
| `stove_range` | 0.77×0.565×0.86 (+0.09 splash) | 0.77×0.565 | no | station / stove | 4 burners (json `burners_m`), 5 knobs, oven window grille |
| `kitchen_counter` | 1.25×0.56×0.80 | 1.25×0.56 | no | station / counter | 2 doors + plain panel, white sink on top (between fridge and stove) |
| `tv_crt` | stand 1.0×0.56×0.49, TV 0.9 wide, antenna to 1.94 | 1.0×0.56 | no | station / tv | news anchor on the screen (json `screen` frame for a game-side picture) |
| `moose_head` | plaque 0.61 wide, z 0.90–1.99, antlers to 2.45 | 0.62×0.2 | no | station / moose | **wall-mounted**: origin = floor point at the wall face; json `mountZ`, `plaqueTopZ`, `height` |
| `smoke_detector` | Ø0.24 puck, centre z 2.05 | 0.24×0.07 | no | station / smoke | wall-mounted on the back wall (axis −y), red LED; json `mountZ` |
| `table_yellow` | 0.93×0.71×0.76 | 0.93×0.71 | no | station / table | north room, chairs E/W |
| `table_yellow_long` | 0.78×1.34×0.74 | 0.78×1.34 | no | station / table | south room, long axis N-S |
| `chair_cyan` (+`_e` `_w` `_n`) | seat 0.50×0.42 at 0.45 | 0.5×0.45 | no | station / chair | faces S / E / W / N; E/W versions have the 0.55 m back seen in the stills, S/N a 0.30 m back |
| `bed_teal` | 0.83×1.37, headboard 0.80 | 0.83×1.37 | no | station / bed | head north, teal blanket + darker fold, wooden head/foot boards (ranger sleeps here) |
| `cabinet_wood` | 0.82×0.48×1.88 | 0.82×0.48 | no | station / cabinet | pale wardrobe, two doors |
| `rug_red_station` | 3.37×1.27 flat | decal | no | station / rugs | north-room rug (f_650). The older `rug_red` (3.8×1.85) was measured without the inside zoom |
| `rug_red_station_b` | 2.69×2.51 flat | decal | no | station / rugs | entrance rug in front of the door (f_655) |

### Park / station yard / RV park (`props_park.py`)

| key | size W×D×H (m) | footprint w×d | blocks sight | script / group | notes |
|---|---|---|---|---|---|
| `payphone` | slab 2.05×1.18×0.12 (+0.18 tan border), booth 0.74×0.34, top 2.55 | 0.8×0.4 (booth) | no | park / payphone | blue hood, "Phone" header, grey phone, black handset; json `slab`, `use_spot_m` (f_450.5, t0431) |
| `power_pole` | Ø0.46×8.41, cross-arm 2.08 m N-S on the west side at 7.9–8.26 | 0.5×0.5 | no | park / power_pole | 2 white insulators; json `wires_m` = insulator tops [x,y,z] from the anchor (f_827) |
| `power_pole_poster` | same + LOST DOG poster z 0.85–1.88 | 0.5×0.5 | no | park / power_pole | poster wrapped on the pole front |
| `lost_dog_poster` | 0.41 wrapped, z 0.85–1.88 | decal | no | park / poster | origin = pole axis on the ground, `sortY` −0.25 (draw just after the pole) |
| `fire_hydrant` | 0.51 (nozzles)×0.4×1.09 | 0.4×0.4 | no | park / hydrant | red, base flange, side nozzles, dome cap (f_450.5) |
| `car_white` | 3.1×1.1×1.64 | 3.1×1.15 | yes | park / car | sedan facing east (front +x), station parking lot (f_658) |
| `boombox` | 0.41×0.14×0.34 (+antenna) | 0.41×0.14 | no | park / boombox | red radio (t0288); sits on the stand at restZ 0.77 |
| `boombox_post` | 0.67×0.66×0.77 | 0.67×0.66 | no | park / boombox | small wooden stand it sits on at RV site D (f_293.5); json `topZ` |
| `boombox_on_post` | stand + radio | 0.67×0.66 | no | park / boombox | combined |
| `sign_exit` | board 3.18×1.03 level at z 1.97–3.0, posts ±1.245, 3.31 tall | 2.7×0.3 | no | park / sign_exit | "Exit →" baked (f_827); json `board` |
| `cliff_rocks_a` / `_b` | 6.0 wide chunk, ~7.2 tall | 6.0×1.4 | yes | park / cliff | stacked angular blocks with light chamfer facets + plateau behind + foot boulders; tile every 6 m along x (`tile_x`) |
| `cave_mouth` | 6.0 chunk with a 2.3 m × ~3.5 m opening | 6.0×1.4 | yes | park / cave | dark recess with a brown floor fading in; json `entrance` x −1.15…1.15 (f_370, t0380) |
| `rv_teal_interior` | 8.3×1.72 | – | – | park / rv_interior | **same anchor as `rv_teal`**: roof off over the living area, back wall with 2 curtained windows, double bed, table, counter + sink, fridge; cab kept; floor at z 0.80; json `walk`, `furniture`, `hat_spot_m`, `door` |
| `rv_teal_front` | cut south wall + wheels + step | – | – | park / rv_interior | wall cut at 1.30 m along the bed, at floor level east of the door (as in f_299.5); `sortY` −0.86 |
| `rv_teal_door_open` | door leaf swung ~137° out on the doorway's west edge (x −0.30) | – | – | park / rv_interior | `sortY` −1.31 |
| `duck_hat_item` | red cap ~0.6×0.55 | 0.6×0.55 | no | park / duck_hat | rendered resting on the RV table (restZ 1.85); place at rv_teal anchor + `rvOffset_m` [−1.25, 0.50] and remove on pickup |

## Comparison sheets

Overlays (reference | render | 50 % blend, aligned on the ground anchor) are in the session
scratchpad `props_work/`: `ov_cabin.png`, `ov_cabin_int.png`, `ov_bed.png`, `ov_stove.png`,
`ov_shop.png`, `ov_sign.png`, `ov_gate.png`, `ov_tent_green.png`, `ov_campsign.png`, `ov_notice.png`,
`ov_outhouse.png`, `ov_cache.png`, `ov_signpost.png`, `ov_warn.png`, `ov_fence.png`, `ov_bridge.png`,
`ov_rvteal.png`, `ov_rvwhite.png`, plus `sheet_campsite1/2.png`, `cmp_nature.png`, `cmp_rocks.png`,
`cmp_shopfloor.png`, `cmp_shopbits.png`, `sheet_new_props.png`.

Station / park batch: scratchpad `props_m2/` — exterior `ov_station454.png`, `ov_station658b.png`; interior with
every furniture key placed from the json (`ov_furn650.png` north room, `ov_furn655.png` south room, close-ups
`ov_furnN.png`, `ov_furnNE.png`, `ov_moose.png`); `ov_phone.png` (payphone + hydrant), `ov_pole.png` (pole, poster,
Exit sign), `ov_car.png`, `ov_boom.png`, `ov_cave.png` (cliff chunks + cave), `ov_rvint.png`, `ov_rvdoor.png`, and
contact sheets `sheet_station.png`, `sheet_furn.png`, `sheet_park.png`. Helpers: `props_m2/tools/ov.py` (overlay at a
given zoom/anchor), `grid.py`, `prof.py` (colour-run profiles used for the measurements), `sheet.py`; reference
frames pulled from the video in `props_m2/ff/`.

## Known gaps / not matched exactly

* Cabin moss edge is smoother than the original's lumpy outline; no darker ground patch under the roof.
* Shop tree roots are simpler half-tubes than the original's flowing shapes; trunk top (never on screen) is a flat cap.
* `foodbox`: the tutorial's "food box" is actually the cooler; no grey bear locker appears in the stills, so this one is invented in the same style.
* `wood_stove` is mostly hidden in the reference, so its body is a best guess.
* `rock_big_a` is a stylised column cluster; the original has 2–3 large faceted columns with flatter faces.
* `notice_board` moss is smoother than the original's lumpy hanging moss.
* `rv_white` / `rv_yellow`: the trailers' door is drawn closed (the reference shows it open); no interior (`rv_teal` has one now).
* `shop_interior_floor` uses #b98a4c (as requested); the still reads darker (#8f6e3b–#9d793f) because of the
  shop's radial dim lighting — apply that as a game-side overlay.
* `bridge_wood_ns` is an extrapolation (no still shows a N–S bridge).
* `station`: the roof's back half and the wing roof are never on screen — the wing has an E-W ridge (slope 0.6)
  as a guess. Interior walls are ~0.25 m outside the exterior side-wall faces (the original's interior is drawn
  slightly bigger than its exterior); the json `walls` follow the interior. Sign text is a little bolder/narrower-
  spaced than the original's slab serif.
* `moose_head`: head/antlers simplified (antlers are straight tubes); plaque bottom is rounder than the original.
* `chair_cyan`: the stills show a 0.55 m back on E/W chairs but only ~0.3 m on the S-facing ones, so the S/N
  variants use the short back.
* `tv_crt` screen shows a stylised news anchor; the original swaps in static after the antenna mini-game.
* `car_white` is boxier than the original's rounded body; windshield/rear-window slopes read heavier.
* `cliff_rocks_*`: the original's facets are bigger and more contrasted; chunks tile but the plateau top is a
  flat grey band (never visible in the stills).
* `rv_teal_interior` follows the existing `rv_teal` model (8.3 × 1.72, roof 3.16) so the layers swap cleanly,
  but in f_299.5 / f_310 the real RV is ~9 % taller (roof ≈3.4 m) and its cab side window larger — both
  inherited from `rv_teal`. Re-render `rv_teal` taller if that matters, then nudge the interior heights.
* `duck_hat_item` is a simple crown + visor; the original's cap is more stretched.
* `payphone` handset hangs straight; the tan surround is baked in like `parking_pad`.

## Still missing / not built

Everything requested so far is built. Seen in the stills but not modelled: picnic-site radio on the blanket (the
`radio_small` svg covers it), the potted plants inside the station, the bicycle leaning on the teal RV, interiors
of the white / yellow trailers, power-line wires (draw them game-side between `wires_m` points).

---

## Outside-park / race-track lot (props_lot.py, props_racetrack.py, props_roads.py)

```
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/blender/props_lot.py -- [roof_bits dealer_furniture dealership garage_furniture garage customs_furniture customs licensing]
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/blender/props_racetrack.py -- [gantry start_lights bleachers podium monument tiki tyres guard_rail cone hedge]
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P art/blender/props_roads.py -- [stop_sign sign_highway wood_signs signpost bus_stop map_kiosk]
node art/tools/build-manifest.mjs
```

Refs: `your research/frames/outside-park` + `videos/outside park 1.mov` (frames pulled with ffmpeg). Walking frames are
1:1 with the sprites (hydrant 106 px wide = the `fire_hydrant` sprite); circuit frames are driving frames zoomed out
~0.67–0.80 (calibrated on the start gantry, which is the same 9.06 m structure as the ENTRANCE gantry); interiors are
zoomed ~1.55×. Sizes are screen-true (a vertical face of height h covers h·0.616·200 px).

### Buildings (cut-away like the cabin / station)

All layers of one building share **one anchor = centre of the outer wall bounding box** (json `footprint`); json
positions are metres relative to it (x east, y north). Layers: `<b>` exterior (walls + roof, `blocksSight`,
`colliders`, `door`, `roofProps`), `<b>_roof` (fade/cut layer), `<b>_interior` (floor + full-height back wall +
side walls cut to 0.32 m + baked low furniture; json `walls`, `rooms`, `doors`, `furniture`), `<b>_interior_front`
(front wall cut 0.32 m, `sortY` = front face), optional `_interior_mid`, and door layers. Rooftop AC units / vents
are baked into the roofs; their positions are in `roofProps` (z = roof deck) in case the game needs to hang a "?" on
them (the licensing AC gets one at t243–253).

| key | size W×D×H (m) | footprint | blocks sight | layers / sort | json extras |
|---|---|---|---|---|---|
| `dealership` (+`_roof`, `_interior`, `_interior_mid`, `_interior_front`, `_door`, `_door_open`, `_office_door`, `_office_door_open`) | 22.71×9.01×7.08, red portal protrudes 0.23 m | 22.71×9.01 | yes | interior_mid sortY = office glass wall (y −0.905); front sortY −4.505; door_open sortY −5.1 | `door` (glass door x 3.455..4.405 on the front, hinge W, opens out), `displays` (5 plinths: rect/centre/h/price/vehicle), `plates` (price_plate_* positions), `furniture` (desk, 3 palms, brochure stand, computer desk, red bench), `rooms` (showroom, office), `walls` |
| `garage` (+`_roof`, `_interior`, `_interior_front`, `_interior_front_annex`, `_door`, `_door_open`) | 12.55×6.05; main block 10×6.05×4.43, banner to 5.75; annex 2.55 wide set back 1.84 m, 3.3→4.37 shed roof | 12.55×6.05 | yes | two front layers: main sortY −3.025, annex sortY −1.185 | `bays` (west closed roll-up, east open = entrance), `door` (annex side door), `lifts` (2 × car_lift with post rects), `furniture` (car_lift ×2, existing `atm`, `vending_machine`) |
| `customs` (+`_roof`, `_interior`, `_interior_front`, `_door`, `_door_open`) | 13.06×6.2; work-bay wing 5.59 wide ×5.44, showroom 7.47 wide ×6.41 | 13.06×6.2 | yes | front sortY −3.1 | `door` (glass door in the window), `bay` (open), `furniture` (customs_desk, 2 armchairs, car_lift in the wing), `display` (black sports car spot, faces south) |
| `licensing` (+`_roof`) | 7.65×7.0×4.26 | 7.65×7.0 | yes | exterior only | `door` (decorative), `roofProps` (the "?" AC) |

### Interior furniture / small props

| key | size (m) | footprint | blocks sight | notes |
|---|---|---|---|---|
| `dealer_desk` | 2.08×0.95×1.0 | 2.1×1.0 | no | white U counter, red front + chevron; clerk stands inside the U (north) |
| `potted_palm` | Ø0.6×1.35 | 0.6×0.6 | no | terracotta pot |
| `brochure_stand` | 0.7×0.42×1.32 | 0.7×0.42 | no | wooden newspaper rack |
| `computer_desk` | 0.8×3.65×1.3 | 0.8×3.65 | no | long axis N-S, 2 PCs |
| `bench_red` | 0.55×2.0×0.88 | 0.55×2.0 | no | sofa facing west |
| `price_plate_250` / `_350` / `_500` / `_2500` / `_50000` | 1.30 (1.75)×0.05×0.72 | w×0.1 | no | dark plate #161616, gold #b79431 digits + coin; 500 is inferred from "5.." / "..00" |
| `car_lift` | 3.35×0.8×4.75 | 3.35×0.5 | no | posts at x ±1.455 (0.44×0.47) — collide with posts only (`posts`); arms + pads on the floor |
| `jerry_can` | 0.34×0.24×0.78 | 0.35×0.25 | no | red can (also baked in garage / customs) |
| `customs_desk` | 2.4×0.74×1.4 | 2.4×0.74 | no | grey desk with PC + paper |
| `armchair_orange` | 0.62×0.75×0.95 | 0.62×0.75 | no | faces east |
| `ac_unit` | 1.4×0.66×1.18 | 1.4×0.66 | no | sage rooftop condenser |
| `roof_vent` | Ø0.95×1.04 | 0.66×0.44 | no | mushroom vent |

### Race track + road furniture

| key | size W×D×H (m) | footprint | blocks sight | notes / json |
|---|---|---|---|---|
| `entrance_gantry` | 9.06×0.5×5.68 | 9.06×0.5 | no | red "ENTRANCE" banner (4.32–5.62 m) + dark top beam on two open black lattice towers; `towers` [[−3.875,0],[3.875,0]], `tower_size` [0.67,0.24], `clear_span` 7.08 |
| `start_gantry` | same | same | no | no text, two crossed-flag pairs; chequered line = ground decal |
| `start_lights` | 1.46×0.25×4.22 | 0.3×0.3 | no | pole + housing (3.04–4.22), top row dark red (off), bottom row green (on); `lamps` z |
| `bleachers_long` / `bleachers_short` | 14.0 / 7.0 ×1.62×2.3 | L×1.62 | no | plank deck at 2.3 m (`deck_z`) on an X-braced steel truss; spectators stand on it |
| `podium_123` | 4.87×1.46×1.38 | 4.87×1.46 | no | blocks 2/1/3, `steps` (x, top_z) |
| `race_track_sign` | 4.25×0.3×4.16 | 4.25×0.3 | no | red monument, arch + crossed flags; `posts` ±2.0 |
| `sign_campground_green` | same | same | no | green twin with tent icon (built in props_racetrack / monument) |
| `tiki_torch` | 0.5×0.4×1.95 | 0.5×0.4 | no | pole, yellow flame ribbon, rock pile |
| `tyre_stack_red` / `tyre_stack_white` | Ø0.69×1.03 | 0.7×0.7 | no | 6 tyres; barrier lines alternate colours every 1.4 m |
| `guard_rail` | 1.91 bay ×0.25×1.45 | 1.91×0.25 | no | post at x = −L/2 in front of the rail (`tile_x` 1.91); cap runs with `guard_rail_post` |
| `traffic_cone` | 0.48×0.48×0.67 | 0.48×0.48 | no | |
| `hedge` | 2.0×0.75×1.5 | 2.0×0.75 | **yes** | box hedge segment, `tile_x` 2.0 |
| `stop_sign` | 1.0×0.12×3.47 | 0.25×0.25 | no | blank red octagon (no STOP text, as in o03) |
| `sign_highway` | 2.68×0.2×3.85 | 2.7×0.2 | no | "Race Track ↑ / Ski Resort → / Farm Valley →", posts ±0.79 |
| `sign_campground_left` / `sign_racetrack_up` | 3.18×0.3×3.31 | 2.7×0.3 | no | level wooden board (centre 2.36 m) on posts ±1.245 — taller than `wood_sign` |
| `sign_racetrack_podium` | 3.18×0.3×3.79 | 2.7×0.3 | no | same build as `signpost_rv_lake`: "Race Track ↑ / Podium ←" |
| `bus_stop` | 0.7×0.14×3.46 | 0.3×0.3 | no | blue plate + white bus pictogram; no bench/shelter in the stills |
| `map_kiosk` | 2.22×0.8×3.38 | 2.0×0.45 | no | red gable roof, log posts ±0.79 on concrete feet, printed trail map |

Not rebuilt (already match): `fence` (o01 rail fence was its reference), `fire_hydrant`, `power_pole`, `gate` (the
yellow swing barrier by the bleacher road looks like it), `atm`, `vending_machine`.

### Comparison sheets (session scratchpad `props_m3/`)

`ov_dealer_o05.png`, `ov_dealer_t70.png`, `ov_dealer_t74.png` (facade / east end / roof), `ov_dealer_int576.png`
(interior at 1.55×), `ov_garage438.png`, `ov_garage_int440.png`, `ov_customs446.png`, `ov_customs_int448.png`,
`ov_lic223.png`, `sheet_rt1.png`–`sheet_rt3.png` (gantries, bleachers, guard rail, podium, monument signs, start
lights, tyres, cone, hedge, tiki), `sheet_roads.png` / `sheet_roads2.png`, `sheet_lot_bldgs.png`,
`sheet_new_props_m3.png` (all new small props). Each overlay = reference | render on reference | 50 % blend.

### Known gaps

* **Texture size:** `dealership`, `_roof`, `_interior`, `_interior_front` are 4552 px wide (the building really is
  22.7 m). Fine on desktop WebGL (max texture ≥ 8192) but over 4096 — split on load if a target GPU needs it.
* Dealership: the original glass shows the cars for sale through the windows; ours shows the floor/plinths/plates/
  furniture baked behind see-through glass but no vehicles (the vehicles are separate sprites). The interior back
  wall's red chevron panel sits over the 2500 plinth (x −3.1..2.5), not under the facade portal — as in t578/t580.
  Interiors are rendered with exterior lighting; the original darkens them ~0.78× with a blue tint (game-side).
  Office partition is a thin N-S wall in the mid layer (sortY at its south end) — actors hugging it may overlap.
* Garage: annex depth/roof is inferred (front measured 3.3 m tall; the roof edge lines up with the main block's
  north edge, so it is modelled as a shed roof rising to 4.37 m). Lift posts are 4.75 m in the interior sprite but
  baked 3.8 m in the exterior so they stay under the roof.
* Customs: depth 6.2 m is a compromise (roof read 6.0, interior read ~6.5); roof AC/vent positions are guesses.
  No door between the bay wing and the showroom was seen (partition is a cut wall). The chain-link alley fence
  between Customs and the Garage is not modelled.
* Licensing: only the 7.65 m west unit; depth 7 m guessed (north edge never on screen); the east neighbour with the
  red "RACE…" sign is not modelled. Window chairs are simple boxes behind tinted glass.
* Bleacher lengths (7 / 14 m) are guesses — their east ends are never on screen.
* Fonts: GARAGE = Arial Bold Italic, CUSTOMS = Arial Black, "Automotive" = Brush Script, LICENSING / highway sign =
  Arial Rounded Bold (macOS system fonts, baked into the PNGs); everything else Bree Serif.
