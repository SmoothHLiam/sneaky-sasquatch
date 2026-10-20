import * as Phaser from 'phaser';
import { TUNING } from '../config/tuning';
import { G, loadSlot, newSave } from '../core/state';
import { Controls } from '../core/input';
import { atlasMeta, spriteMeta } from '../core/assets';
import { DEG, Vec, clamp, dist, pointInPoly, rng } from '../core/math';
import { PPM, SH, SIN_P, depthFor, groundFromWorldPx, spriteScale, wx, wy } from '../core/proj';
import { L } from '../ui/layout';
import { CollisionWorld } from '../world/collision';
import { NavGrid } from '../world/nav';
import { buildGround } from '../world/ground';
import { PROP_DEFS, propSpriteKey } from '../world/props';
import type { BuildingDef, Interactable, NpcSpawn, PropPlacement, ZoneDef, ZoneExit } from '../world/types';
import { ZONES, ZONE_SCRIPTS } from '../world/zones';
import { Player } from '../entities/Player';
import { Human } from '../entities/Human';
import { Animal } from '../entities/Animal';
import { Actor } from '../entities/Actor';
import { sense, stepPerception } from '../systems/perception';
import { RangerDanger } from '../systems/rangerDanger';
import { VehicleSystem } from '../systems/vehicles';
import { TrafficSystem } from '../systems/traffic';
import { playSfx } from '../core/audio';
import { Settings } from '../core/settings';
import { SECRET_CACHE_TOTAL, itemDef } from '../data/items';
import { passOut } from '../quests/sleep';
import type { Hud } from './Hud';
import type { MiniKind, MiniOpts } from './Minigame';

export interface PromptTarget {
    id: string;
    x: number;
    y: number;
    icon: string;
    action: () => void;
}

interface PropInstance {
    p: PropPlacement;
    img: Phaser.GameObjects.Image;
    baseScale: number;
}

/** The playable world: one zone at a time. */
export class World extends Phaser.Scene {
    zone!: ZoneDef;
    collision!: CollisionWorld;
    nav!: NavGrid;
    groundLayer!: Phaser.GameObjects.Layer;
    objLayer!: Phaser.GameObjects.Layer;
    player!: Player;
    humans: Human[] = [];
    animals: Animal[] = [];
    props: PropInstance[] = [];
    controls!: Controls;
    vehicles!: VehicleSystem;
    traffic!: TrafficSystem;
    hud!: Hud;
    rangerDanger!: RangerDanger;

    /** camera */
    baseZoom = 1;
    zoomMult = 1;
    zoomGoal = 1;
    private hungryHours = 0;
    private lightMask: Phaser.GameObjects.Image | null = null;
    camFocus: Vec | null = null;
    camFocusZ = 1;
    camLerp = 1;

    promptTarget: PromptTarget | null = null;
    playerSpeech: { text: string; t: number } | null = null;
    cutsceneBubbles = false;
    /** floating "?"/"!" markers on objects (shop door, notice board...) */
    markers: { id: string; x: number; y: number; z: number; glyph: string; color?: string }[] = [];
    inCloseUp = false;
    darkness = 0;
    /** a transition/capture/script holds the world */
    busy = false;
    /** handlers for interactables/animals by id (zone scripts and quests register these) */
    handlers: Record<string, () => void> = {};
    private waiters: { test: () => boolean; res: () => void }[] = [];
    private hungerClock = 0;
    private transitioning = false;
    private rustle = 0;
    /** water polygons of the current zone (metres) */
    water: Vec[][] = [];
    /** the full-area grass-blade overlay (hidden in optimization mode: it fills the whole screen) */
    private grassTile: Phaser.GameObjects.TileSprite | null = null;
    private prints: { img: Phaser.GameObjects.Image; t: number; x: number; y: number; stamp: number }[] = [];
    private zTimer = 0;
    private anyOccluded = false;
    /** enterable buildings in this zone */
    buildings: {
        def: BuildingDef;
        ext: Phaser.GameObjects.Image | null;
        int: Phaser.GameObjects.Image | null;
        front: Phaser.GameObjects.Image | null;
        door: Phaser.GameObjects.Image | null;
        /** extra cut-away layers (partition walls...) shown while inside */
        extra: Phaser.GameObjects.Image[];
        inner: { closed: Phaser.GameObjects.Image | null; open: Phaser.GameObjects.Image | null; x0: number; x1: number; y: number }[];
        /** furniture placed with `in: id` */
        furniture: Phaser.GameObjects.Image[];
        inside: boolean;
    }[] = [];
    /** colour-grade overlay (time of day), multiply-blended over the world */
    private grade!: Phaser.GameObjects.Rectangle;
    /** current colour grade multiplier (r,g,b 0..1) */
    gradeColor = { r: 1, g: 1, b: 1 };
    /** zone/script override for the grade (e.g. tutorial "evening") */
    gradeOverride: { r: number; g: number; b: number } | null = null;

    constructor() {
        super('World');
    }

    // =====================================================================
    // lifecycle
    // =====================================================================
    /** title-screen backdrop mode: no control, no HUD, nothing saved */
    attract = false;

    /** coming from the slot picker: start black and iris in on the player */
    private irisIn = false;

    create(data: { slot?: number; debugZone?: string; fresh?: boolean; stage?: string; attract?: boolean; irisIn?: boolean }) {
        this.resetRunState();
        this.irisIn = !!data?.irisIn;
        L.update(this.scale.width, this.scale.height);
        this.attract = !!data?.attract;
        if (this.attract) {
            G.save = newSave();
            G.save.zone = 'title';
        }
        if (data?.slot) {
            G.slot = data.slot;
            G.save = (!data.fresh && loadSlot(data.slot)) || newSave();
        }
        if (data?.stage) applyDebugStage(data.stage);
        if (data?.debugZone) {
            // a throwaway game in the test slot, so it never saves over slots 1-3
            G.slot = 9;
            G.save = newSave();
            G.save.zone = data.debugZone;
            G.save.backpackColor = 'red';
            G.save.flags.tutorialDone = true;
            G.save.flags.tut = 'done';
        }
        this.controls = new Controls(this);
        this.rangerDanger = new RangerDanger(this);
        this.vehicles = new VehicleSystem(this);
        this.traffic = new TrafficSystem(this);
        this.scene.launch('Hud', { world: this, black: this.irisIn });
        this.hud = this.scene.get('Hud') as Hud;
        this.cameras.main.setBackgroundColor('#41a036');
        this.scale.on('resize', () => this.refreshZoom());
        this.updateBaseZoom();
        // Esc opens the pause menu (scenes/Pause.ts). A window listener, because the paused
        // World's own keyboard stops listening
        const onKey = (e: KeyboardEvent) => {
            if (e.code === 'Escape' && !e.repeat) this.openPause();
        };
        window.addEventListener('keydown', onKey);
        this.events.once('shutdown', () => window.removeEventListener('keydown', onKey));
        // wait one tick so the HUD scene is created before scripts use it
        this.time.delayedCall(0, () => this.loadZone(G.save.zone, null));
    }

    /**
     * scene.restart() reuses this object, so field initialisers don't run again: clear anything a
     * previous run (the title backdrop, a cutscene) left behind. The title's fixed camera focus
     * used to leak into a loaded save and park the camera on the clearing for good.
     */
    private resetRunState() {
        this.zone = undefined as unknown as ZoneDef;
        this.zoomMult = 1;
        this.zoomGoal = 1;
        this.camFocus = null;
        this.camFocusZ = 1;
        this.camLerp = 1;
        this.hungryHours = 0;
        this.hungerClock = 0;
        this.lightMask = null;
        this.promptTarget = null;
        this.playerSpeech = null;
        this.cutsceneBubbles = false;
        this.markers = [];
        this.inCloseUp = false;
        this.darkness = 0;
        this.busy = false;
        this.handlers = {};
        this.waiters = [];
        this.transitioning = false;
        this.rustle = 0;
        this.water = [];
        this.prints = [];
        this.zTimer = 0;
        this.anyOccluded = false;
        this.buildings = [];
        this.gradeColor = { r: 1, g: 1, b: 1 };
        this.gradeOverride = null;
    }

    updateBaseZoom() {
        L.update(this.scale.width, this.scale.height);
        this.cameras.main.setSize(this.scale.width, this.scale.height);
        // the player's Field of view setting scales every zoom (dialogue, interiors, driving...)
        this.baseZoom = ((TUNING.camera.sasquatchScreenHeightRef * L.s) / (SH * PPM)) * (this.attract ? 1 : Settings.fovZoom());
    }

    /** apply a new Field of view at once (the pause menu previews it while the World is paused) */
    refreshZoom() {
        this.updateBaseZoom();
        if (this.zone) this.snapCamera();
    }

    // ---- pause menu ---------------------------------------------------------
    /** Esc: freeze the game under the pause menu — not over a close-up or a ✓/✗ question (Esc answers those) */
    openPause() {
        if (this.attract || !this.zone || this.transitioning || this.inCloseUp) return;
        if (this.scene.isActive('Pause') || !this.scene.isActive()) return;
        if (this.hud?.dialog.choosing) return;
        this.scene.pause();
        this.scene.pause('Hud');
        this.scene.launch('Pause', { world: this });
        this.scene.bringToTop('Pause');
    }

    /** back from the pause menu: drop any input that piled up while frozen */
    resumeFromPause() {
        this.controls.endFrame();
        this.controls.pointerDown = false;
        this.controls.clickTarget = null;
        this.scene.resume('Hud');
        this.scene.resume();
    }

    // =====================================================================
    // zones
    // =====================================================================
    loadZone(id: string, entryId: string | null) {
        const def = ZONES[id];
        if (!def) throw new Error('Unknown zone ' + id);
        this.unloadZone();
        this.zone = def;
        G.save.zone = id;
        this.collision = new CollisionWorld(def.w, def.h);
        this.groundLayer = this.add.layer().setDepth(-1e7);
        this.objLayer = this.add.layer().setDepth(0);
        ({ water: this.water, grass: this.grassTile } = buildGround(this, this.groundLayer, def));
        this.spawnFish();
        this.prints = [];

        for (const w of def.walls) this.collision.addPoly(w, { sight: true });
        const r = rng(def.scatter?.seed ?? 99);
        for (const p of def.props) this.placeProp(p, r);
        this.buildBuildings(def);
        this.buildWires(def);

        this.nav = new NavGrid(this.collision, 0.3);

        // player
        const entry = entryId ? def.entries[entryId] : null;
        this.player = new Player(this, this.objLayer);
        this.player.onStep = (x, y, left, f) => this.addFootprint(x, y, left, f);
        this.player.setPack(G.save.backpackColor);
        if (entry) {
            this.player.setPosition(entry.x, entry.y);
            this.player.facing = (entry.facing ?? -90) * DEG;
        } else {
            this.player.setPosition(G.save.x || def.entries.default?.x || def.w / 2, G.save.y || def.entries.default?.y || def.h / 2);
            this.player.facing = G.save.facing * DEG;
        }

        this.rangerDanger.clearJeeps();
        this.vehicles.spawn(def);
        this.traffic.spawn(def);

        // npcs
        for (const n of def.npcs) {
            if (n.ifFlag && !G.flag(n.ifFlag)) continue;
            if (n.ifNotFlag && G.flag(n.ifNotFlag)) continue;
            this.spawnNpc(n);
        }

        this.lightMask = def.dark ? this.makeLightMask() : null;
        this.grade = this.add.rectangle(0, 0, 10, 10, 0xffffff, 1).setOrigin(0.5).setScrollFactor(0).setDepth(1e8);
        this.grade.setBlendMode(Phaser.BlendModes.MULTIPLY);
        const cam = this.cameras.main;
        const top = wy(def.h) - 900, bottom = wy(0);
        const cb = def.camBounds;
        if (cb) cam.setBounds(wx(cb.x), wy(cb.y + cb.h) - 900, wx(cb.w), wy(cb.y) - wy(cb.y + cb.h) + 900);
        else cam.setBounds(0, top, wx(def.w), bottom - top);
        this.snapCamera();

        if (this.attract) {
            // static camera framing the clearing
            this.player.locked = true;
            this.hud.hideHud = true;
            this.camFocus = { x: def.w / 2, y: def.h / 2 - 0.6 };
            this.camFocusZ = 0;
            this.setZoom(1, true);
            this.snapCamera();
            return;
        }
        this.hud.hideHud = false;
        this.hud.coins.forceVisible = !!def.showCoins;
        ZONE_SCRIPTS[id]?.onEnter?.(this);
        for (const q of QUEST_HOOKS) q.onEnter?.(this);
        if (this.irisIn) {
            this.irisIn = false;
            if (G.save.flags.tut === undefined) {
                // brand new game: the tutorial intro has already gone black and started its own
                // 3.7 s fade-in (quest hooks run first) — only drop the iris; re-blacking here would
                // cancel that fade and leave the screen black for good
                this.hud.irisOff();
            } else {
                this.player.locked = true;
                void this.wait(0.6).then(async () => {
                    const s = this.worldToScreen(this.player.x, this.player.y, 1);
                    await this.hud.irisTo(false, 0.47, s.x, s.y);
                    this.player.locked = false;
                });
            }
        }
        G.save.x = this.player.x;
        G.save.y = this.player.y;
        G.persist();
    }

    unloadZone() {
        for (const h of this.humans) h.destroy();
        for (const a of this.animals) a.destroy();
        this.player?.destroy();
        this.groundLayer?.destroy();
        this.objLayer?.destroy();
        this.grade?.destroy();
        this.lightMask?.destroy();
        this.lightMask = null;
        this.humans = [];
        this.animals = [];
        this.props = [];
        this.buildings = [];
        this.handlers = {};
        this.markers = [];
        this.promptTarget = null;
        this.rangerDanger?.end();
        this.hud?.clearWorldWidgets?.();
    }

    placeProp(p: PropPlacement, r: ReturnType<typeof rng>) {
        const def = PROP_DEFS[p.type];
        if (!def) return;
        const v = p.v ?? Math.floor(Math.abs(Math.sin(p.x * 12.9898 + p.y * 78.233)) * 1000);
        const key = propSpriteKey(def, v);
        const meta = spriteMeta(this, key, def.ph);
        const jit = def.jitter?.scale ? 1 + (r.next() * 2 - 1) * def.jitter.scale : 1;
        const sc = spriteScale(meta.ppm) * jit;
        const img = this.add.image(wx(p.x), wy(p.y, p.z ?? 0), key).setOrigin(meta.anchorX / meta.w, meta.anchorY / meta.h).setScale(sc);
        if (p.flip) img.setFlipX(true);
        if (def.decal) {
            // decals sit above the ground fills (depth 0) but stay y-sorted among themselves
            this.groundLayer.add(img);
            img.setDepth(1e6 + depthFor(p.y));
        } else {
            this.objLayer.add(img);
            img.setDepth(depthFor(p.y + (p.sort ?? def.sortOffset ?? 0)));
        }
        this.props.push({ p, img, baseScale: sc });
        const c = { x: p.x, y: p.y };
        if ((p.z ?? 0) > 0.3) return; // resting on something that already collides
        if (p.type === 'hideBush') {
            /* movable bush: no collider, it's picked up */
        } else if (def.hide) this.collision.addHideSpot(c, (def.r ?? 0.8) * jit);
        else if (def.r) this.collision.addCircle(c, def.r * jit, { sight: !!def.blocksSight, tag: def.veg ? 'veg' : undefined });
        if (def.box) this.collision.addBox(p.x + (def.box.ox ?? 0), p.y + (def.box.oy ?? 0), def.box.w, def.box.d, { sight: !!def.blocksSight });
    }

    /** add a person or animal to the current zone (zone NPC lists, cutscenes) */
    spawnNpc(n: NpcSpawn): Human | Animal {
        if (n.kind === 'camper' || n.kind === 'ranger') {
            const atlas = n.kind === 'ranger' ? n.look ?? 'ranger' : n.look && atlasMeta(n.look) ? n.look : 'camper_' + (n.look ?? 'a');
            const h = new Human(this, this.objLayer, n.id, n.kind, atlas, n.x, n.y, n.facing ?? -90, n.behaviour ?? 'idle');
            if (n.route) h.route = n.route;
            if (n.marker) h.marker = n.marker;
            if (n.sleepAnim) {
                h.sleepAnim = n.sleepAnim;
                if (h.sleeping) h.anim = n.sleepAnim;
            }
            this.humans.push(h);
            return h;
        }
        const look = n.look && atlasMeta(n.look) ? n.look : undefined;
        const a = new Animal(this, this.objLayer, n.id, n.kind, n.x, n.y, n.facing ?? -90, look);
        if (n.behaviour === 'sit') a.idleAnim = 'sit';
        if (n.behaviour === 'sleep') a.sleeping = true;
        this.animals.push(a);
        return a;
    }

    /** take a placed prop out of the world (picked-up items) */
    removeProp(id: string) {
        const i = this.props.findIndex((q) => q.p.id === id);
        if (i < 0) return;
        const img = this.props[i].img;
        for (const b of this.buildings) b.furniture = b.furniture.filter((f) => f !== img);
        img.destroy();
        this.props.splice(i, 1);
    }

    /** ranger arrival points: zone-defined or the zone's entry points */
    rangerSpawnPoints(): Vec[] {
        const z = this.zone as ZoneDef & { rangerSpawns?: Vec[] };
        if (z.rangerSpawns?.length) return z.rangerSpawns.map((p) => ({ ...p }));
        return Object.values(z.entries).map((e) => ({ x: e.x, y: e.y }));
    }

    spawnRanger(x: number, y: number, dispatched = false): Human {
        const h = new Human(this, this.objLayer, (dispatched ? 'disp_' : 'ranger_') + Math.random().toString(36).slice(2, 7), 'ranger', 'ranger', x, y, 90, 'idle');
        (h as Human & { dispatched?: boolean }).dispatched = dispatched;
        this.humans.push(h);
        return h;
    }

    // =====================================================================
    // coordinate helpers
    // =====================================================================
    worldToScreen(x: number, y: number, z = 0) {
        const cam = this.cameras.main;
        return {
            x: (wx(x) - cam.midPoint.x) * cam.zoom + cam.width / 2,
            y: (wy(y, z) - cam.midPoint.y) * cam.zoom + cam.height / 2,
        };
    }

    pointerGround(): Vec | null {
        const cam = this.cameras.main;
        const p = cam.getWorldPoint(this.controls.pointerX, this.controls.pointerY);
        // aim at the sasquatch's feet, not his head: the cursor is compared on the ground plane
        return groundFromWorldPx(p.x, p.y);
    }

    snapCamera() {
        const cam = this.cameras.main;
        cam.setZoom(this.baseZoom * this.zoomMult * (this.zone?.zoom ?? 1));
        const f = this.camFocus ?? this.player;
        cam.centerOn(wx(f.x), wy(f.y, this.camFocus ? this.camFocusZ : 1.0));
        this.cull();
    }

    /**
     * Phaser draws every object in a layer each frame, on screen or not, and an area holds 300-1900
     * of them: skip the ones well outside the view (render time 6.2 → 1.4 ms in the circuit).
     * Uses cameraFilter, so game code's own setVisible() is untouched.
     */
    private cull() {
        const cam = this.cameras.main;
        // half the view plus a 50 % margin, so nothing pops in at the edges before the next pass
        const hw = (cam.width / cam.zoom) * 0.75, hh = (cam.height / cam.zoom) * 0.75;
        const x0 = cam.midPoint.x - hw, x1 = cam.midPoint.x + hw, y0 = cam.midPoint.y - hh, y1 = cam.midPoint.y + hh;
        for (const layer of [this.groundLayer, this.objLayer]) {
            for (const o of layer.list as unknown as { x: number; y: number; displayWidth?: number; displayHeight?: number; scrollFactorX: number; cameraFilter: number }[]) {
                const w = o.displayWidth ?? 0, h = o.displayHeight ?? 0;
                // sizeless objects (containers) and screen-fixed ones always draw; the box is
                // doubled around x/y so any origin or flip stays inside it
                const out = w > 0 && o.scrollFactorX === 1 && (o.x - w > x1 || o.x + w < x0 || o.y - h > y1 || o.y + h < y0);
                o.cameraFilter = out ? cam.id : 0;
            }
        }
    }

    setZoom(mult: number, instant = false) {
        this.zoomGoal = mult;
        if (instant) this.zoomMult = mult;
    }

    /** zoom to settle at when no dialogue/script overrides it (building interiors sit closer) */
    restZoom(): number {
        // driving: 0.91 stopped → 0.66 flat out, eased with speed (outside-park §4.2)
        if (this.vehicles?.driving) {
            const Z = TUNING.camera.zoom;
            return (Z.vehicleStopped + (Z.vehicleTopSpeed - Z.vehicleStopped) * this.vehicles.speedFrac) / (this.zone?.zoom ?? 1);
        }
        const inside = this.buildings.some((b) => b.inside);
        return inside ? TUNING.camera.zoom.interior / (this.zone?.zoom ?? 1) : 1;
    }

    // =====================================================================
    // main loop
    // =====================================================================
    update(_t: number, deltaMs: number) {
        if (!this.player || !this.zone) return;
        const dt = Math.min(0.05, deltaMs / 1000);
        // dialogue freezes the world [measured: outside-park rule 11]; close-ups don't —
        // NPCs keep going and the sasquatch simply stands still [inside-park rule 11]
        const frozen = G.frozen;
        const uiBusy = frozen || this.inCloseUp;

        // ---- input-level actions -----------------------------------------
        if (this.hud.dialog.open) {
            if (this.controls.justPressed('KeyY')) this.hud.dialog.choose(true);
            if (this.controls.justPressed('KeyN', 'Escape')) this.hud.dialog.choose(false);
        }
        if (this.controls.interact) {
            if (this.hud.dialog.open) this.hud.dialog.advance();
            else if (!uiBusy && this.promptTarget && !this.busy) this.interact();
        }
        if (this.controls.backpack && !uiBusy && !this.busy) this.openBackpack();

        // ---- simulation ---------------------------------------------------
        if (!frozen) {
            this.controls.captureUI(this.hud.dialog.open);
            if (!this.vehicles.driving) {
                const wasLocked = this.player.locked;
                if (this.inCloseUp) this.player.locked = true;
                this.player.update(dt, this.controls, this.collision, () => this.pointerGround(), (q) => this.inWater(q));
                this.player.locked = wasLocked;
            } else if (!this.hud.dialog.open) {
                this.zoomGoal = this.restZoom();
            }
            this.updateFootprints(dt);
            this.updateSleepers(dt);
            this.updateFish(dt);
            for (const a of this.animals) a.update(dt, this.nav, this.collision, this.player);
            this.player.applianceNoise = Math.max(0, this.player.applianceNoise - dt);
            this.updateHumans(dt);
            this.vehicles.update(dt, false);
            this.traffic.update(dt, false);
            this.rangerDanger.update(dt);
            this.updateClock(dt);
            this.checkExits();
            if (this.playerSpeech) {
                this.playerSpeech.t -= dt;
                if (this.playerSpeech.t <= 0) this.playerSpeech = null;
            }
        } else {
            this.player.render();
            for (const a of this.animals) a.render();
            for (const h of this.humans) h.render();
        }
        this.updatePrompt();
        this.updateBushes(dt);
        this.updateDarkness();
        this.updateBuildings();
        this.player.inCover = !!this.zone.cover?.some((c) => pointInPoly(this.player, c));

        // ---- camera -------------------------------------------------------
        const z = TUNING.camera.zoomEase;
        this.zoomMult += (this.zoomGoal - this.zoomMult) * Math.min(1, dt / Math.max(0.01, z * 0.35));
        const cam = this.cameras.main;
        cam.setZoom(this.baseZoom * this.zoomMult * (this.zone.zoom ?? 1));
        const f = this.camFocus ?? this.player;
        const tx = wx(f.x), ty = wy(f.y, this.camFocus ? this.camFocusZ : 1.0);
        const k = this.camFocus ? Math.min(1, dt * 6) : 1 - Math.exp(-dt / TUNING.camera.followTau);
        cam.centerOn(cam.midPoint.x + (tx - cam.midPoint.x) * k, cam.midPoint.y + (ty - cam.midPoint.y) * k);
        this.cull();
        this.grassTile?.setVisible(!Settings.optimize);

        if (!this.attract) {
            ZONE_SCRIPTS[this.zone.id]?.onUpdate?.(this, dt);
            for (const q of QUEST_HOOKS) q.onUpdate?.(this, dt);
        }
        for (const w of this.waiters.slice()) {
            if (w.test()) {
                this.waiters.splice(this.waiters.indexOf(w), 1);
                w.res();
            }
        }
        this.updateGrade();
        this.updateLightMask();
        this.controls.endFrame();
    }

    /** Multiply-blend colour grade for time of day (and scripted moods like the tutorial evening). */
    /** world-space darkness with a soft hole; 20x the outer radius so it always covers the view */
    private makeLightMask() {
        const key = 'light_mask';
        if (!this.textures.exists(key)) {
            const S = 1024, c = this.textures.createCanvas(key, S, S)!;
            const ctx = c.getContext();
            const L0 = TUNING.lighting;
            const rOut = S / 20, rIn = rOut * (L0.caveInnerH / L0.caveOuterH);
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, S, S);
            ctx.globalCompositeOperation = 'destination-out';
            const g = ctx.createRadialGradient(S / 2, S / 2, rIn, S / 2, S / 2, rOut);
            g.addColorStop(0, 'rgba(0,0,0,1)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(S / 2, S / 2, rOut, 0, Math.PI * 2);
            ctx.fill();
            c.refresh();
        }
        return this.add.image(0, 0, key).setDepth(9e7);
    }

    private updateLightMask() {
        if (!this.lightMask) return;
        const cam = this.cameras.main;
        const p = this.player;
        // outer radius = caveOuterH of the screen height, in world px at the current zoom
        const rOut = (TUNING.lighting.caveOuterH * cam.height) / cam.zoom;
        this.lightMask.setPosition(wx(p.x), wy(p.y, 0.9)).setDisplaySize(rOut * 20, rOut * 20);
    }

    private updateGrade() {
        const cam = this.cameras.main;
        const z = cam.zoom;
        this.grade.setPosition(cam.width / 2, cam.height / 2).setSize(cam.width / z + 4, cam.height / z + 4);
        const tgt = this.gradeOverride ?? gradeForHour(G.save.hour);
        const g = this.gradeColor;
        const k = 0.03;
        g.r += (tgt.r - g.r) * k; g.g += (tgt.g - g.g) * k; g.b += (tgt.b - g.b) * k;
        const c = Phaser.Display.Color.GetColor(Math.round(g.r * 255), Math.round(g.g * 255), Math.round(g.b * 255));
        this.grade.setFillStyle(c, 1);
        this.grade.setVisible(g.r < 0.995 || g.g < 0.995 || g.b < 0.995);
    }

    snapGrade() {
        const tgt = this.gradeOverride ?? gradeForHour(G.save.hour);
        this.gradeColor = { ...tgt };
    }

    // ---- buildings ---------------------------------------------------------
    /** power poles along each chain plus the wires sagging between their insulators, drawn over everything */
    private buildWires(def: ZoneDef) {
        if (!def.wires?.length) return;
        const meta = this.cache.json.get('power_pole') as { wires_m?: number[][] } | undefined;
        const tops = meta?.wires_m ?? [[-0.345, 0.48, 8.57], [-0.345, -0.99, 8.57]];
        // faint shadows of the wires on the ground, nearly straight below them (inside-park t825)
        const sh = this.add.graphics();
        this.groundLayer.add(sh);
        sh.setDepth(1e6 + 9e5);
        sh.lineStyle(2.5, 0x000000, 0.1);
        for (const chain of def.wires) {
            for (let i = 0; i + 1 < chain.length; i++) {
                const a = chain[i], b = chain[i + 1];
                for (const t of tops) {
                    sh.beginPath();
                    sh.moveTo(wx(a.x + t[0] - 0.25), wy(a.y + t[1] + 0.7));
                    sh.lineTo(wx(b.x + t[0] - 0.25), wy(b.y + t[1] + 0.7));
                    sh.strokePath();
                }
            }
        }
        const g = this.add.graphics();
        this.objLayer.add(g);
        g.setDepth(9e6);
        g.lineStyle(3, 0x2a2a2a, 0.9);
        for (const chain of def.wires) {
            for (let i = 0; i + 1 < chain.length; i++) {
                const a = chain[i], b = chain[i + 1];
                for (const t of tops) {
                    const x0 = wx(a.x + t[0]), y0 = wy(a.y + t[1], t[2]);
                    const x1 = wx(b.x + t[0]), y1 = wy(b.y + t[1], t[2]);
                    // sag ≈0.8 m at mid-span
                    const curve = new Phaser.Curves.QuadraticBezier(
                        new Phaser.Math.Vector2(x0, y0),
                        new Phaser.Math.Vector2((x0 + x1) / 2, (y0 + y1) / 2 + 160 * 0.616),
                        new Phaser.Math.Vector2(x1, y1),
                    );
                    curve.draw(g, 20);
                }
            }
        }
    }

    private buildBuildings(def: ZoneDef) {
        // optional layers are skipped when their sprite hasn't been rendered; the interior falls back to a placeholder
        const layer = (key: string | undefined, sortY: number, placeholder = false) =>
            key && (placeholder || this.textures.exists(key)) ? { key, sortY } : null;
        for (const b of def.buildings ?? []) {
            const ext = this.props.find((p) => p.p.id === b.id)?.img ?? null;
            const mk = (spec: { key: string; sortY: number } | null) => {
                if (!spec) return null;
                const meta = spriteMeta(this, spec.key, { w: b.w, h: 2.5, color: 0x6a4a2a, shape: 'box' });
                const img = this.add.image(wx(b.x), wy(b.y), spec.key).setOrigin(meta.anchorX / meta.w, meta.anchorY / meta.h).setScale(spriteScale(meta.ppm));
                this.objLayer.add(img);
                img.setDepth(depthFor(b.y + spec.sortY)).setVisible(false);
                return img;
            };
            const int = mk(layer(b.interior, b.d / 2, true));
            const front = mk(layer(b.interiorFront, b.frontSortY ?? -b.d / 2));
            const door = mk(layer(b.doorOpen, b.doorSortY ?? -b.d / 2 + 0.5));
            const extra = (b.layers ?? []).map((l) => mk(layer(l.key, l.sortY))).filter((x): x is Phaser.GameObjects.Image => !!x);
            const inner = (b.innerDoors ?? []).map((d) => ({
                closed: mk(layer(d.closed, d.sortY)), open: mk(layer(d.open, d.openSortY)), x0: d.x0, x1: d.x1, y: d.y,
            }));
            const furniture = this.props.filter((p) => p.p.in === b.id).map((p) => p.img.setVisible(false));
            const opts = { sight: true };
            if (b.walls) {
                for (const r of b.walls) this.collision.addBox(b.x + (r.x0 + r.x1) / 2, b.y + (r.y0 + r.y1) / 2, r.x1 - r.x0, r.y1 - r.y0, opts);
            } else {
                const t = b.wall ?? 0.2;
                const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, y0 = b.y - b.d / 2, y1 = b.y + b.d / 2;
                this.collision.addBox(b.x, y1 - t / 2, b.w, t, opts);                 // back wall
                this.collision.addBox(x0 + t / 2, b.y, t, b.d, opts);                 // left wall
                this.collision.addBox(x1 - t / 2, b.y, t, b.d, opts);                 // right wall
                const dl = b.x + b.doorX - b.doorW / 2, dr = b.x + b.doorX + b.doorW / 2;
                this.collision.addBox((x0 + dl) / 2, y0 + t / 2, dl - x0, t, opts);    // front wall, left of door
                this.collision.addBox((dr + x1) / 2, y0 + t / 2, x1 - dr, t, opts);    // front wall, right of door
            }
            this.buildings.push({ def: b, ext, int, front, door, extra, inner, furniture, inside: false });
        }
    }

    /** is (x, y) on the floor of building b */
    insideBuilding(d: BuildingDef, x: number, y: number) {
        const lx = x - d.x, ly = y - d.y;
        if (d.rooms) return d.rooms.some((r) => lx > r.x0 && lx < r.x1 && ly > r.y0 && ly < r.y1);
        return Math.abs(lx) < d.w / 2 && Math.abs(ly) < d.d / 2;
    }

    private updateBuildings() {
        const p = this.player;
        for (const b of this.buildings) {
            const d = b.def;
            const inside = this.insideBuilding(d, p.x, p.y);
            // the door swings open while the sasquatch passes through it
            const atDoor = Math.abs(p.x - (d.x + d.doorX)) < d.doorW * 0.8 && Math.abs(p.y - (d.y - d.d / 2)) < 0.9;
            if (inside !== b.inside) {
                const rest = this.restZoom();
                b.inside = inside;
                if (Math.abs(this.zoomGoal - rest) < 1e-6) this.setZoom(this.restZoom());
                // the original swaps instantly (1 frame): roof + front wall removed, interior shown
                b.ext?.setVisible(!inside);
                b.int?.setVisible(inside);
                b.front?.setVisible(inside);
                for (const img of b.extra) img.setVisible(inside);
                for (const img of b.furniture) img.setVisible(inside);
                if (inside) this.sfx('door');
            }
            b.door?.setVisible(inside || (atDoor && !b.ext?.visible));
            // inner doors open for anyone walking through them
            for (const door of b.inner) {
                const near = (a: { x: number; y: number }) =>
                    a.x > d.x + door.x0 - 0.15 && a.x < d.x + door.x1 + 0.15 && Math.abs(a.y - (d.y + door.y)) < 0.75;
                const open = near(p) || this.humans.some((h) => !h.ghost && near(h));
                door.open?.setVisible(inside && open);
                door.closed?.setVisible(inside && !open);
            }
        }
        // people (and showroom cars) inside a building you're not in are hidden behind its roof
        const roofed = this.buildings.filter((b) => b.def.rooms && !b.inside);
        if (!roofed.length && !this.anyOccluded) return;
        this.anyOccluded = false;
        for (const a of [...this.humans, ...this.animals, ...this.vehicles.list.filter((v) => v !== this.vehicles.driving)]) {
            const occ = roofed.some((b) => this.insideBuilding(b.def, a.x, a.y));
            this.anyOccluded ||= occ;
            if (occ !== a.occluded) {
                a.occluded = occ;
                a.render();
            }
        }
    }

    private updateHumans(dt: number) {
        const p = this.player;
        const danger = this.rangerDanger.active;
        for (const h of this.humans) {
            h.updateSpeech(dt);
            if (h.state === 'scripted' || h.state === 'capturing') {
                if (h.goal) h.updateNormal(dt, this.nav, this.collision);
                h.tickAnim(dt);
                h.render();
                continue;
            }
            // ---- perception
            const info = { x: h.x, y: h.y, facing: h.facing, sleeping: h.sleeping, authority: h.authority };
            const s = sense(info, p, this.collision, G.save.disguise, danger);
            // a leashed guard who gave up ignores you until he is back at his post
            if (h.state === 'return' && h.leash > 0) s.see = s.hear = false;
            // nose in a newspaper: oblivious even at 0.7 SH [inside-park rule 9]
            if (h.behaviour === 'read' && h.state === 'normal') s.see = s.hear = false;
            h.seesPlayer = s.see;
            if (s.see) h.perc.lastSeen = { x: p.x, y: p.y };
            const res = stepPerception(h.perc, s, info, dt, (b) => h.turnTo(b, dt), () => h.wake());
            if (res === 'alarm') {
                this.sfx('alarm');
                // spotted mid close-up: drop whatever you were rummaging in
                if (this.inCloseUp) this.closeCloseUps();
                if (h.kind === 'ranger') h.state = 'chase';
                else h.state = 'watch';
                this.rangerDanger.trigger(h);
            }

            // woken by noise and nobody in sight: pick up the footprints (inside-park E11)
            if (h.wokeT > 0) {
                h.wokeT -= dt;
                if (h.wokeT <= 0 && h.kind === 'ranger' && h.state === 'normal' && !h.seesPlayer && !h.perc.alarmed && this.nextPrint(h, 0)) {
                    h.state = 'track';
                    h.trackStamp = 0;
                }
            }

            // ---- behaviour
            switch (h.state) {
                case 'track': {
                    if (h.seesPlayer || h.perc.alarmed) {
                        h.state = 'normal';
                        break;
                    }
                    const next = this.nextPrint(h, h.trackStamp);
                    if (!next) {
                        // trail's gone cold: look around, then go home
                        h.state = 'search';
                        h.searchTimer = TUNING.rangerDanger.searchTime;
                        h.perc.searching = true;
                        h.perc.glyph = '?';
                        h.perc.hold = TUNING.detection.searchHoldTime;
                        break;
                    }
                    if (h.perc.meter > 0) h.perc.glyph = 'foot';
                    if (h.moveToward(next, h.walkSpeed * TUNING.npc.trackSpeedFactor, dt, this.nav, this.collision, 0.35)) h.trackStamp = next.stamp;
                    break;
                }
                case 'watch':
                    h.anim = 'idle';
                    if (h.seesPlayer || h.perc.alarmed) h.turnTo(Math.atan2(p.y - h.y, p.x - h.x), dt);
                    if (!h.perc.alarmed) h.state = 'return';
                    break;
                case 'chase': {
                    const target = h.seesPlayer ? p : h.perc.lastSeen;
                    if (!target) { h.state = 'search'; h.searchTimer = TUNING.rangerDanger.searchTime; break; }
                    if (h.leash > 0 && dist(h, h.home) > h.leash) {
                        // leashed guards stop at the edge of their post: red eye → red ear, then gone
                        h.state = 'return';
                        h.perc.glyph = 'ear';
                        h.perc.memory = Math.min(h.perc.memory, 1.0);
                        break;
                    }
                    const speed = h.walkSpeed * TUNING.rangerDanger.chaseSpeedFactor * h.chaseFactor;
                    const arrived = h.moveToward(target, speed, dt, this.nav, this.collision, 0.2);
                    if (!h.noCapture && h.seesPlayer && dist(h, p) < this.rangerDanger.captureDistance && !this.busy && p.mode !== 'lying') {
                        this.capture(h);
                    } else if (arrived && !h.seesPlayer) {
                        h.state = 'search';
                        h.searchTimer = TUNING.rangerDanger.searchTime;
                        h.perc.lastSeen = null;
                    }
                    break;
                }
                case 'search':
                    h.anim = 'idle';
                    h.lookAround(dt, 120);
                    if (h.seesPlayer) { h.state = 'chase'; break; }
                    h.searchTimer -= dt;
                    if (h.searchTimer <= 0) h.state = 'return';
                    break;
                case 'return': {
                    const disp = (h as Human & { dispatched?: boolean }).dispatched;
                    const home = disp ? this.nearestExitPoint(h) : h.home;
                    // a bed is solid: someone going back to bed only has to reach its edge, then climbs in
                    const inBed = h.homeBehaviour === 'sleep' && h.sleepAnim === 'sleepBed';
                    if (h.moveToward(home, h.walkSpeed * 0.5, dt, this.nav, this.collision, inBed ? 0.95 : 0.3)) {
                        if (disp) h.visible = false;
                        h.state = 'normal';
                        h.facing = h.homeFacing;
                        // a woken sleeper goes back to bed
                        if (h.homeBehaviour === 'sleep') {
                            h.behaviour = 'sleep';
                            h.sleeping = true;
                            h.anim = h.sleepAnim;
                            if (inBed) {
                                h.x = home.x;
                                h.y = home.y;
                            }
                        }
                    }
                    break;
                }
                default:
                    if (h.perc.alarmed) {
                        h.state = h.kind === 'ranger' ? 'chase' : 'watch';
                    } else if (h.perc.meter >= 1 && h.perc.glyph === 'ear') {
                        h.anim = 'idle'; // turned toward the sound, waiting to see
                    } else if (h.perc.meter > 0.05 && h.perc.glyph === 'eye') {
                        h.anim = 'idle';
                        h.turnTo(Math.atan2(p.y - h.y, p.x - h.x), dt, 120);
                    } else {
                        h.updateNormal(dt, this.nav, this.collision);
                    }
            }
            h.tickAnim(dt);
            h.render();
        }
        // dispatched rangers who went home disappear
        this.humans = this.humans.filter((h) => {
            if (!h.visible) { h.destroy(); return false; }
            return true;
        });
    }

    private nearestExitPoint(from: Vec): Vec {
        let best: Vec = { x: from.x, y: from.y }, bd = Infinity;
        for (const s of this.rangerSpawnPoints()) {
            const d = dist(s, from);
            if (d < bd) { bd = d; best = s; }
        }
        return best;
    }

    private updateClock(dt: number) {
        // the clock pauses in conversations and interactive screens [wiki Time]
        if (G.flag('clockStopped') || this.inCloseUp) return;
        const T = TUNING.time;
        G.save.hour += dt / T.secondsPerHour;
        // sleepy "Zzz" from 12:50 AM; passes out at 3:10 AM [wiki Time]
        this.player.sleepyZ = G.save.hour >= T.zzzHour && G.flag('tutorialDone');
        if (G.save.hour >= T.passOutHour && G.flag('tutorialDone') && !this.busy) void passOut(this, 'late');
        // four in-game hours at 0 hunger and he faints [wiki Hunger]
        if (G.flag('hungerEnabled') && G.save.hunger <= 0) {
            this.hungryHours += dt / T.secondsPerHour;
            if (this.hungryHours >= TUNING.hunger.passOutAfterHoursAtZero && !this.busy) {
                this.hungryHours = 0;
                void passOut(this, 'hungry');
            }
        } else this.hungryHours = 0;
        if (G.flag('hungerEnabled')) {
            this.hungerClock += dt;
            if (this.hungerClock >= TUNING.hunger.secondsPerPoint) {
                this.hungerClock = 0;
                if (G.save.hunger > 0) {
                    G.save.hunger -= 1;
                    this.hud.hunger.pop();
                }
            }
        }
    }

    private updateDarkness() {
        const T = TUNING.time;
        let h = G.save.hour % 24;
        let d = 0;
        if (h >= T.dusk.start && h < T.dusk.end) d = (h - T.dusk.start) / (T.dusk.end - T.dusk.start);
        else if (h >= T.dusk.end || h < T.dawn.start) d = 1;
        else if (h >= T.dawn.start && h < T.dawn.end) d = 1 - (h - T.dawn.start) / (T.dawn.end - T.dawn.start);
        if (G.flag('forceDay')) d = 0;
        this.darkness = d * T.dusk.maxDarkness;
        h = 0;
    }

    private updateBushes(dt: number) {
        this.rustle += dt;
        void dt;
    }

    inWater(p: Vec) {
        for (const w of this.water) if (pointInPoly(p, w)) return true;
        return false;
    }

    // ---- footprints ----------------------------------------------------------
    private addFootprint(x: number, y: number, left: boolean, facing: number) {
        if (!this.textures.exists('ui_foot')) return;
        const side = left ? 1 : -1;
        const ox = Math.cos(facing + Math.PI / 2) * 0.11 * side, oy = Math.sin(facing + Math.PI / 2) * 0.11 * side;
        const img = this.add.image(wx(x + ox), wy(y + oy), 'ui_foot').setTint(0x000000).setAlpha(0.16);
        const size = 0.3 * PPM / 256;
        // orient the print along the walking direction as seen through the tilted camera
        img.setScale(size * (left ? -1 : 1), size * (0.75 + 0.25 * SIN_P));
        img.setRotation(Math.atan2(Math.cos(facing), Math.sin(facing) * SIN_P));
        this.groundLayer.add(img);
        img.setDepth(2e6);
        this.prints.push({ img, t: TUNING.player.footprintLife, x, y, stamp: this.time.now });
        playSfx(this, 'step', { volume: this.player.mode === 'sneak' ? 0.35 : 1, rate: 0.9 + Math.random() * 0.2, minGap: 0.1 });
        if (this.prints.length > 60) this.prints.shift()!.img.destroy();
    }

    /** footprint tracking: first the nearest fresh print, then the next one along the trail */
    private nextPrint(from: Vec, after: number) {
        const N = TUNING.npc;
        let best: { x: number; y: number; stamp: number } | null = null;
        for (const p of this.prints) {
            if (p.stamp <= after || p.t <= 0) continue;
            const d = dist(p, from);
            if (after === 0) {
                if (d < N.trackPickupM && (!best || d < dist(best, from))) best = p;
            } else if (d < N.trackStepM && (!best || p.stamp < best.stamp)) best = p;
        }
        return best;
    }

    private updateFootprints(dt: number) {
        for (const p of this.prints) {
            p.t -= dt;
            p.img.setAlpha(0.16 * clamp(p.t / 1.5, 0, 1));
        }
        while (this.prints.length && this.prints[0].t <= 0) this.prints.shift()!.img.destroy();
    }

    // ---- sleeping "Z z" particles ------------------------------------------------
    // ---- fish: dark silhouettes drifting in rivers and ponds (inside-park c221, n281) ----
    private fish: { img: Phaser.GameObjects.Image; poly: Vec[]; x: number; y: number; a: number; v: number; t: number }[] = [];

    private spawnFish() {
        this.fish = [];
        if (!this.textures.exists('fish_shadow')) {
            const g = this.make.graphics({}, false);
            g.fillStyle(0xffffff, 1);
            g.fillEllipse(30, 10, 44, 14);
            g.fillTriangle(6, 10, 0, 2, 0, 18);
            g.generateTexture('fish_shadow', 54, 20);
            g.destroy();
        }
        const r = rng((this.zone.scatter?.seed ?? 1) * 31 + 7);
        for (const poly of this.water) {
            let area = 0;
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                area += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
                minX = Math.min(minX, poly[i].x); maxX = Math.max(maxX, poly[i].x);
                minY = Math.min(minY, poly[i].y); maxY = Math.max(maxY, poly[i].y);
            }
            const n = clamp(Math.round(Math.abs(area / 2) / 22), 1, 10);
            for (let k = 0, tries = 0; k < n && tries < 200; tries++) {
                const x = minX + r.next() * (maxX - minX), y = minY + r.next() * (maxY - minY);
                if (!pointInPoly({ x, y }, poly)) continue;
                const img = this.add.image(wx(x), wy(y), 'fish_shadow').setTint(0x1d6b80).setAlpha(0.55).setScale(0.9 + r.next() * 0.4);
                this.groundLayer.add(img);
                img.setDepth(5e5);
                this.fish.push({ img, poly, x, y, a: r.next() * Math.PI * 2, v: 0.4, t: r.next() * 2 });
                k++;
            }
        }
    }

    private updateFish(dt: number) {
        for (const f of this.fish) {
            f.img.setVisible(!Settings.optimize);
            f.t -= dt;
            if (f.t <= 0) {
                f.t = 1 + Math.random() * 2.5;
                f.a += (Math.random() - 0.5) * 1.6;
                f.v = Math.random() < 0.15 ? 1.6 : 0.15 + Math.random() * 0.5;
            }
            // shy: dart away from the sasquatch
            const pd = Math.hypot(f.x - this.player.x, f.y - this.player.y);
            if (pd < 1.6) {
                f.a = Math.atan2(f.y - this.player.y, f.x - this.player.x);
                f.v = 2.2;
            }
            const nx = f.x + Math.cos(f.a) * f.v * dt, ny = f.y + Math.sin(f.a) * f.v * dt;
            if (pointInPoly({ x: nx, y: ny }, f.poly)) {
                f.x = nx;
                f.y = ny;
            } else {
                f.a += Math.PI * (0.6 + Math.random() * 0.8);
            }
            f.img.setPosition(wx(f.x), wy(f.y)).setRotation(Math.atan2(-Math.sin(f.a) * SIN_P, Math.cos(f.a)));
        }
    }

    private updateSleepers(dt: number) {
        this.zTimer -= dt;
        if (this.zTimer > 0 || !this.textures.exists('ui_zzz')) return;
        this.zTimer = 1.1;
        const sleepers: { x: number; y: number; h: number }[] = [];
        for (const h of this.humans) if (h.sleeping) sleepers.push({ x: h.x, y: h.y, h: h.headHeight + 0.1 });
        for (const a of this.animals) if (a.sleeping) sleepers.push({ x: a.x, y: a.y, h: a.headHeight });
        if (this.player.sleepingZ) sleepers.push({ x: this.player.x, y: this.player.y, h: 0.9 });
        else if (this.player.sleepyZ && this.player.mode !== 'lying') sleepers.push({ x: this.player.x, y: this.player.y, h: 2.0 });
        for (const z of sleepers) {
            const img = this.add.image(wx(z.x) + 20, wy(z.y, z.h), 'ui_zzz').setTint(0xe8e8f0).setScale(0.12).setAlpha(0);
            this.objLayer.add(img);
            img.setDepth(depthFor(z.y) + 50);
            this.tweens.add({ targets: img, y: img.y - 90, x: img.x + 25, alpha: { from: 0.95, to: 0 }, scale: { from: 0.1, to: 0.2 }, duration: 2200, ease: 'Sine.Out', onComplete: () => img.destroy() });
        }
    }

    // =====================================================================
    // interaction
    // =====================================================================
    private static ICONS: Record<string, string> = {
        cooler: 'hand', foodbox: 'hand', basket: 'hand', trash: 'hand', cache: 'hand', table: 'fork', bed: 'bed', hide: 'hide', door: 'door', talk: 'talk', sign: 'eye', shop: 'door',
    };

    private activeInteractables(): Interactable[] {
        return this.zone.interactables.filter(
            (i) => (!i.ifFlag || G.flag(i.ifFlag)) && (!i.ifNotFlag || !G.flag(i.ifNotFlag)) && (this.handlers[i.id] || this.defaultAction(i)),
        );
    }

    /** Built-in behaviour for common interactables (zone scripts can override by id). */
    defaultAction(it: Interactable): (() => void) | null {
        switch (it.kind) {
            case 'cooler':
            case 'foodbox':
            case 'basket':
            case 'trash':
            case 'cache':
                return () => this.openContainer(it);
            case 'table':
                return () => this.eatAtTable();
            case 'hide':
                return () => this.enterHidingSpot(it.id, it);
            default:
                return null;
        }
    }

    /** Contents left in a container today (restocks daily). */
    containerLoot(it: Interactable): string[] {
        // secret caches are one-off finds; everything else restocks daily
        if (it.kind === 'cache' && G.save.caches.includes(it.id)) return [];
        if (G.save.looted[it.id] === G.save.day) return [];
        const saved = G.save.flags['cont_' + it.id];
        if (typeof saved === 'string') {
            const [day, list] = saved.split(':');
            if (+day === G.save.day) return list ? list.split(',') : [];
        }
        return (it.loot ?? []).slice();
    }

    openContainer(it: Interactable, opts: { tutorial?: boolean; onDone?: () => void } = {}) {
        const onDone = it.kind === 'cache' ? () => { this.cacheFound(it); opts.onDone?.(); } : opts.onDone;
        this.scene.launch('CloseUp', { world: this, kind: it.kind, id: it.id, loot: this.containerLoot(it), ...opts, onDone });
    }

    /** a readable close-up card (newspaper, posters) */
    openCard(name: string, onDone?: () => void) {
        if (this.cache.json.exists('cu_' + name)) return this.openMinigame(name as MiniKind, { onDone });
        this.scene.launch('CloseUp', { world: this, kind: 'card', card: name, onDone });
    }

    /** force-close whichever close-up is open (CloseUp or Minigame) */
    closeCloseUps() {
        for (const key of ['CloseUp', 'Minigame']) {
            if (this.scene.isActive(key)) (this.scene.get(key) as Phaser.Scene & { close(force?: boolean): void }).close(true);
        }
    }

    /** layout-driven close-ups from inside the park (scenes/Minigame.ts) */
    openMinigame(kind: MiniKind, opts: MiniOpts = {}) {
        this.scene.launch('Minigame', { world: this, kind, opts });
    }

    /** a grey puff curling up off burning food and fading (fox mischief, inside-park 775-815) */
    emitSmoke(x: number, y: number, z: number) {
        const c = this.add.circle(wx(x) + (Math.random() - 0.5) * 18, wy(y, z), 9 + Math.random() * 5, 0x8c8c8c, 0.8);
        this.objLayer.add(c);
        c.setDepth(depthFor(y - 0.05));
        this.tweens.add({
            targets: c, y: c.y - 120, x: c.x + (Math.random() - 0.5) * 40, scale: { from: 0.7, to: 2.2 }, alpha: { from: 0.8, to: 0 },
            duration: 1700, ease: 'Sine.Out', onComplete: () => c.destroy(),
        });
    }

    /** a music note that drifts up from a radio and fades (inside-park t66.5) */
    emitNote(x: number, y: number, z: number) {
        const glyph = Math.random() < 0.5 ? '♪' : '♫';
        const t = this.add.text(wx(x) + (Math.random() - 0.5) * 24, wy(y, z), glyph, { fontFamily: 'Arial', fontSize: '120px', color: '#ffffff' }).setOrigin(0.5).setScale(0.32);
        this.objLayer.add(t);
        t.setDepth(1e7);
        this.tweens.add({ targets: t, y: t.y - 70, x: t.x + (Math.random() - 0.5) * 30, alpha: { from: 1, to: 0 }, duration: 1600, ease: 'Sine.Out', onComplete: () => t.destroy() });
    }

    /** first time a secret cache is emptied: count it and show the toast, counter ticking up mid-way */
    private cacheFound(it: Interactable) {
        if (G.save.caches.includes(it.id) || this.containerLoot(it).length) return;
        G.save.caches.push(it.id);
        const n = G.save.caches.length;
        this.hud.toast.show('Secret Cache Found!', `${n - 1}/${SECRET_CACHE_TOTAL}`);
        this.time.delayedCall(1750, () => this.hud.toast.setLine2(`${n}/${SECRET_CACHE_TOTAL}`));
        G.persist();
    }

    hasFood() {
        return G.save.items.some((id) => itemDef(id).food > 0 || itemDef(id).condiment);
    }

    async eatAtTable(onDone?: () => void) {
        if (!this.hasFood()) {
            await this.say(null, ["You don't have any food!"], { zoom: 1 });
            onDone?.();
            return;
        }
        this.scene.launch('CloseUp', { world: this, kind: 'eat', onDone });
    }

    private enterHidingSpot(id: string, it: Interactable) {
        this.player.hidingIn = id;
        this.player.target = null;
        this.player.setPosition(it.x, it.y);
        this.sfx('door');
    }

    private leaveHidingSpot() {
        const it = this.zone.interactables.find((i) => i.id === this.player.hidingIn);
        this.player.hidingIn = null;
        if (it) this.player.setPosition(it.x, it.y - 0.6);
        this.sfx('door');
    }

    private enterBush(pi: PropInstance) {
        this.player.bush = { img: pi.img, baseScale: pi.baseScale };
        this.player.setPosition(pi.p.x, pi.p.y);
        this.player.stillTime = 1;
        this.player.target = null;
        this.sfx('bush');
    }

    private leaveBush() {
        const b = this.player.bush!;
        const pi = this.props.find((q) => q.img === b.img);
        if (pi) {
            pi.p.x = this.player.x;
            pi.p.y = this.player.y;
            pi.img.setPosition(wx(pi.p.x), wy(pi.p.y)).setScale(pi.baseScale).setDepth(depthFor(pi.p.y));
        }
        this.player.bush = null;
        this.player.sprite.setVisible(true);
        // step out in front of the bush
        this.player.setPosition(this.player.x, this.player.y - 0.7);
        this.sfx('bush');
    }

    private updatePrompt() {
        this.promptTarget = null;
        if (this.busy || G.frozen || this.inCloseUp || this.player.mode === 'lying') return;
        const p = this.player;
        // inside a hiding spot / bush: only the exit prompt (shown while still)
        if (p.hidingIn) {
            const it = this.zone.interactables.find((i) => i.id === p.hidingIn);
            this.promptTarget = { id: 'exit', x: it?.x ?? p.x, y: it?.y ?? p.y, icon: 'door', action: () => this.leaveHidingSpot() };
            return;
        }
        if (p.bush) {
            if (p.stillTime > 0.25) this.promptTarget = { id: 'exitBush', x: p.x, y: p.y, icon: 'door', action: () => this.leaveBush() };
            return;
        }
        if (this.rangerDanger.active) return;
        const R = TUNING.ui.interactRadiusSH * SH;
        let best: PromptTarget | null = null, bd = Infinity;
        for (const it of this.activeInteractables()) {
            const d = dist(it, p);
            if (d < (it.radius ?? R) && d < bd) {
                bd = d;
                const action = this.handlers[it.id] ?? this.defaultAction(it)!;
                best = { id: it.id, x: it.x, y: it.y, icon: it.icon ?? World.ICONS[it.kind] ?? 'hand', action };
            }
        }
        const veh = this.vehicles.candidate(p);
        if (veh && veh.d < bd) {
            bd = veh.d;
            const v = veh.v;
            best = { id: 'vehicle_' + v.id, x: v.x, y: v.y, icon: v.locked ? 'lock' : 'wheel', action: () => this.vehicles.enter(v) };
        }
        for (const a of this.animals) {
            const h = this.handlers[a.id];
            if (!h) continue;
            // measured from the body's edge: the bear (r 0.7 m) is talked to from ~1.1 m (t228.6)
            const d = dist(a, p) - a.radius;
            if (d < R * 1.3 && d < bd) {
                bd = d;
                best = { id: a.id, x: a.x, y: a.y, icon: 'talk', action: h };
            }
        }
        for (const pi of this.props) {
            if (pi.p.type !== 'hideBush') continue;
            const d = dist(pi.p, p);
            if (d < R * 1.1 && d < bd) {
                bd = d;
                best = { id: 'bush', x: pi.p.x, y: pi.p.y, icon: 'hide', action: () => this.enterBush(pi) };
            }
        }
        this.promptTarget = best;
    }

    interact() {
        const t = this.promptTarget;
        if (!t || this.busy) return;
        this.sfx('click');
        t.action();
    }

    openBackpack() {
        if (!G.save.backpackColor || this.busy) return;
        this.sfx('backpack');
        this.scene.launch('CloseUp', { world: this, kind: 'backpack' });
    }

    // =====================================================================
    // exits / transitions
    // =====================================================================
    private checkExits() {
        if (this.busy || this.transitioning) return;
        const p = this.player;
        for (const e of this.zone.exits) {
            const r = e.rect;
            if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
                if (e.requiresFlag && !G.flag(e.requiresFlag)) continue;
                // blocked on foot (e.g. the highway: "...without a car!")
                if (e.blockedLine && !this.vehicles.driving) {
                    this.bounceBack(e);
                    return;
                }
                if (!ZONES[e.to]) continue; // area not built yet
                this.transition(e.to, e.entry);
                return;
            }
        }
    }

    private bounceBack(e: ZoneExit) {
        const r = e.rect;
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        const dx = this.player.x - cx, dy = this.player.y - cy;
        const l = Math.hypot(dx, dy) || 1;
        this.player.target = null;
        this.player.x += (dx / l) * 0.6;
        this.player.y += (dy / l) * 0.6;
        const lines = e.blockedLine!;
        void this.selfTalk(Array.isArray(lines) ? lines : [lines]);
    }

    async transition(to: string, entry: string) {
        if (this.transitioning) return;
        this.transitioning = true;
        this.busy = true;
        const tr = TUNING.transitions;
        const s = this.worldToScreen(this.player.x, this.player.y, 1);
        this.player.locked = true;
        await this.hud.irisTo(true, tr.irisClose, s.x, s.y);
        this.loadZone(to, entry);
        await this.wait(tr.irisBlack);
        const s2 = this.worldToScreen(this.player.x, this.player.y, 1);
        await this.hud.irisTo(false, tr.irisOpen, s2.x, s2.y);
        this.player.locked = false;
        this.busy = false;
        this.transitioning = false;
    }

    // =====================================================================
    // capture
    // =====================================================================
    async capture(ranger: Human) {
        if (this.busy) return;
        this.busy = true;
        const C = TUNING.capture;
        // caught in a kart: he's hauled out of it (it stays parked where it is)
        if (this.vehicles.driving) this.vehicles.exit();
        const p = this.player;
        ranger.state = 'capturing';
        ranger.say('Gotcha!', C.gotchaBeforeIris + 1);
        this.sfx('tackle');
        // fling the sasquatch away from the ranger and lie him down
        const a = Math.atan2(p.y - ranger.y, p.x - ranger.x);
        const fling = C.tackleFlingSH * SH;
        p.locked = true;
        p.target = null;
        p.mode = 'lying';
        p.anim = 'lying';
        const from = { x: p.x, y: p.y };
        const to = this.collision.resolve({ x: p.x + Math.cos(a) * fling, y: p.y + Math.sin(a) * fling }, p.radius);
        const t0 = this.time.now;
        await this.waitUntil(() => {
            const k = clamp((this.time.now - t0) / 300, 0, 1);
            p.x = from.x + (to.x - from.x) * k;
            p.y = from.y + (to.y - from.y) * k;
            p.z = Math.sin(k * Math.PI) * 0.6;
            if (!p.has('lying')) p.tilt = (k * Math.PI) / 2;
            return k >= 1;
        });
        p.z = 0;
        await this.wait(C.gotchaBeforeIris);
        const s = this.worldToScreen(p.x, p.y, 0.5);
        await this.hud.irisTo(true, TUNING.transitions.irisClose, s.x, s.y);
        G.save.stats.caught++;
        G.save.coins = Math.max(0, G.save.coins - C.coinPenalty);
        // respawn at the area's safe spot next to a ranger — for the campground that's
        // outside the yellow gate (inside-park t138.6-149)
        const rs = this.zone.respawn ?? { x: this.zone.w / 2, y: this.zone.h / 2 };
        this.loadZone(rs.zone ?? this.zone.id, null);
        this.player.setPosition(rs.x, rs.y);
        this.player.tilt = 0;
        const rp = rs.rangerAt ?? { x: rs.x - 3 * SH * 0.6, y: rs.y };
        const rr = this.spawnRanger(rp.x, rp.y, false);
        rr.facing = Math.atan2(rs.y - rp.y, rs.x - rp.x);
        rr.homeFacing = rr.facing;
        rr.state = 'scripted';
        this.snapCamera();
        await this.wait(TUNING.transitions.irisBlack);
        const s2 = this.worldToScreen(this.player.x, this.player.y, 1);
        await this.hud.irisTo(false, TUNING.transitions.irisOpen, s2.x, s2.y);
        rr.say(C.respawnLine, C.respawnLineTime);
        this.busy = false;
        this.player.locked = false;
        await this.wait(C.respawnLineTime);
        rr.state = 'return';
        (rr as Human & { dispatched?: boolean }).dispatched = true;
    }

    // =====================================================================
    // script helpers (used by quests / zone scripts)
    // =====================================================================
    wait(sec: number): Promise<void> {
        return new Promise((res) => this.time.delayedCall(sec * 1000, () => res()));
    }

    waitUntil(test: () => boolean): Promise<void> {
        return new Promise((res) => this.waiters.push({ test, res }));
    }

    /**
     * Modal dialogue. Freezes the world, zooms the camera onto `focus`
     * (defaults to the player), shows each page in turn.
     */
    async say(speaker: string | null, pages: string[], opts: { focus?: Vec[]; zoom?: number; onPage?: (i: number) => void; keepZoom?: boolean; focusZ?: number } = {}) {
        const wasFrozen = G.frozen;
        G.frozen = true;
        this.player.target = null;
        const pts = opts.focus ?? [this.player];
        const fx = pts.reduce((a, b) => a + b.x, 0) / pts.length;
        const fy = pts.reduce((a, b) => a + b.y, 0) / pts.length;
        this.camFocus = { x: fx, y: fy };
        this.camFocusZ = opts.focusZ ?? 1.2;
        const prevZoom = this.zoomGoal;
        this.setZoom(opts.zoom ?? TUNING.camera.zoom.dialogue);
        // speakers turn toward each other; world bubbles give way to the dialogue box
        const actors = pts.filter((q): q is Actor => q instanceof Actor && !(q as Actor & { sleeping?: boolean }).sleeping);
        if (actors.length >= 2) {
            for (const a of actors) {
                const o = actors.find((q) => q !== a)!;
                a.facing = Math.atan2(o.y - a.y, o.x - a.x);
            }
        }
        for (const a of [...this.animals, ...this.humans]) a.speech = null;
        for (let i = 0; i < pages.length; i++) {
            this.sfx('talk');
            opts.onPage?.(i);
            await this.hud.dialog.say(speaker, pages[i]);
        }
        this.hud.dialog.close();
        if (!opts.keepZoom) {
            this.camFocus = null;
            this.setZoom(prevZoom);
        }
        G.frozen = wasFrozen;
    }

    /** Sasquatch self-talk (no speaker name). */
    selfTalk(pages: string[]) {
        return this.say(null, pages);
    }

    /** Yes/no question in the dialogue box (✓ / ✗). */
    async ask(speaker: string | null, text: string, opts: { focus?: Vec[]; zoom?: number } = {}): Promise<boolean> {
        const wasFrozen = G.frozen;
        G.frozen = true;
        this.player.target = null;
        if (opts.focus || opts.zoom) {
            const pts = opts.focus ?? [this.player];
            this.camFocus = { x: pts.reduce((a, b) => a + b.x, 0) / pts.length, y: pts.reduce((a, b) => a + b.y, 0) / pts.length };
            this.camFocusZ = 1.2;
            this.setZoom(opts.zoom ?? TUNING.camera.zoom.dialogue);
        }
        const v = await this.hud.dialog.ask(speaker, text);
        this.hud.dialog.close();
        if (opts.focus || opts.zoom) {
            this.camFocus = null;
            this.setZoom(this.restZoom());
        }
        G.frozen = wasFrozen;
        return v;
    }

    /** Walk the player somewhere (cutscenes). */
    walkPlayer(to: Vec, speed = 1): Promise<void> {
        return new Promise((res) => this.player.walkTo(to, res, speed));
    }

    sfx(name: string) {
        playSfx(this, name);
    }

    // ---- actor helpers for scripts ------------------------------------------
    animal(id: string) {
        return this.animals.find((a) => a.id === id);
    }

    human(id: string) {
        return this.humans.find((h) => h.id === id);
    }

    spawnAnimal(id: string, kind: Animal['kind'], x: number, y: number, facingDeg = -90): Animal {
        this.animal(id)?.destroy();
        this.animals = this.animals.filter((a) => a.id !== id);
        const a = new Animal(this, this.objLayer, id, kind, x, y, facingDeg);
        this.animals.push(a);
        return a;
    }

    spawnHuman(id: string, kind: 'camper' | 'ranger', look: string, x: number, y: number, facingDeg = -90, behaviour: Human['behaviour'] = 'idle'): Human {
        this.removeHuman(id);
        const h = new Human(this, this.objLayer, id, kind, kind === 'ranger' ? 'ranger' : 'camper_' + look, x, y, facingDeg, behaviour);
        this.humans.push(h);
        return h;
    }

    removeHuman(id: string) {
        const h = this.human(id);
        if (h) h.destroy();
        this.humans = this.humans.filter((q) => q.id !== id);
    }

    removeAnimal(id: string) {
        const a = this.animal(id);
        if (a) a.destroy();
        this.animals = this.animals.filter((q) => q.id !== id);
    }

    /** Walk an animal somewhere; resolves on arrival. */
    walkAnimal(a: Animal, to: Vec, speed = 1): Promise<void> {
        return new Promise((res) => a.walkTo(to, speed, res));
    }

    /** Walk a human somewhere (scripted); resolves on arrival. */
    walkHuman(h: Human, to: Vec, speed = 1): Promise<void> {
        h.state = 'scripted';
        return new Promise((res) => {
            h.goal = { ...to };
            h.goalSpeed = speed;
            h.onGoal = res;
        });
    }

    /** Ease the camera to look at a point (null = back to the player). */
    async panCamera(to: Vec | null, wait = 0.8) {
        this.camFocus = to ? { ...to } : null;
        this.camFocusZ = 1;
        await this.wait(wait);
    }
}

/** Debug: jump into a tutorial stage (?tutorial&stage=toGate). */
function applyDebugStage(st: string) {
    if (st === 'day1') {
        // morning after the tutorial: bear's favour + shop greeting
        for (const f of ['gateOpen', 'tutorialDone', 'shopOpen', 'raccoonInShop']) G.setFlag(f);
        G.setFlag('tut', 'done');
        Object.assign(G.save, { day: 1, hour: TUNING.time.wakeHour, hunger: 4, backpackColor: 'red', zone: 'home', x: 14.48, y: 25.2 });
        return;
    }
    const after = ['meetRaccoon', 'toGate', 'raccoonGate', 'campA', 'eat', 'evening', 'sneak', 'home', 'bed'];
    const i = after.indexOf(st);
    if (i < 0) return;
    G.setFlag('tut', st);
    G.save.hunger = 4;
    if (i >= 1) G.save.backpackColor = 'red';
    if (i >= 3) G.setFlag('gateOpen');
    const pos: Record<string, [string, number, number]> = {
        meetRaccoon: ['home', 48, 26], toGate: ['home', 64, 25.4], raccoonGate: ['home', 70, 24.8], campA: ['campA', 2.6, 29.2],
        eat: ['campA', 22, 22], evening: ['home', 89.6, 24.6], sneak: ['home', 82, 24.6], home: ['home', 30, 23.6], bed: ['home', 15.3, 24.4],
    };
    const [z, x, y] = pos[st];
    G.save.zone = z; G.save.x = x; G.save.y = y;
    if (st === 'eat') G.save.items = ['hotdog', 'hotdog', 'ketchup'];
    if (i >= 5) G.save.hunger = 6;
}

/** Time-of-day colour grade (multiply). Measured dusk: R x0.82, G x0.77, B x0.86 (inside-park t945). */
export function gradeForHour(hour: number): { r: number; g: number; b: number } {
    const h = ((hour % 24) + 24) % 24;
    const keys: [number, number, number, number][] = [
        // hour, r, g, b
        [0, 0.38, 0.4, 0.62],
        [5, 0.4, 0.42, 0.64],
        [7, 1, 1, 1],
        [18, 1, 1, 1],
        [20.5, 0.82, 0.77, 0.86],
        [22, 0.55, 0.55, 0.75],
        [24, 0.38, 0.4, 0.62],
    ];
    for (let i = 0; i < keys.length - 1; i++) {
        const a = keys[i], b = keys[i + 1];
        if (h >= a[0] && h <= b[0]) {
            const t = (h - a[0]) / (b[0] - a[0]);
            return { r: a[1] + (b[1] - a[1]) * t, g: a[2] + (b[2] - a[2]) * t, b: a[3] + (b[3] - a[3]) * t };
        }
    }
    return { r: 1, g: 1, b: 1 };
}

/** Global quest hooks (tutorial etc.) — registered by quests/index.ts */
export interface QuestHook {
    onEnter?(w: World): void;
    onUpdate?(w: World, dt: number): void;
}
export const QUEST_HOOKS: QuestHook[] = [];
