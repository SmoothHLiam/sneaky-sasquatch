import { TUNING } from '../config/tuning';

export type BackpackColor = 'red' | 'blue' | 'green';

export interface SaveData {
    version: 1;
    day: number;
    /** hour of day as a float, 8.0 = 8:00 AM, 25.5 = 1:30 AM next day */
    hour: number;
    coins: number;
    hunger: number;
    backpackColor: BackpackColor | null;
    /** food/items in the backpack, by item id */
    items: string[];
    flags: Record<string, boolean | number | string>;
    zone: string;
    x: number;
    y: number;
    facing: number;
    caches: string[];
    disguise: string | null;
    stats: { caught: number; eaten: number };
    /** containers already emptied today: id → day */
    looted: Record<string, number>;
    /** vehicles left somewhere other than their home spot: id → where */
    parked: Record<string, { kind: string; zone: string; x: number; y: number; h: number }>;
    /** id of the vehicle the sasquatch is sitting in (it travels with him between areas) */
    driving: string | null;
}

const KEY = (slot: number) => `sneaky-sasquatch/slot${slot}`;

export function newSave(): SaveData {
    return {
        version: 1,
        day: 0,
        hour: TUNING.time.wakeHour,
        coins: 0,
        hunger: 3,
        backpackColor: null,
        items: [],
        flags: {},
        zone: 'home',
        x: 0,
        y: 0,
        facing: -90,
        caches: [],
        disguise: null,
        stats: { caught: 0, eaten: 0 },
        looted: {},
        parked: {},
        driving: null,
    };
}

export function loadSlot(slot: number): SaveData | null {
    try {
        const raw = localStorage.getItem(KEY(slot));
        if (!raw) return null;
        const d = JSON.parse(raw) as SaveData;
        return { ...newSave(), ...d };
    } catch {
        return null;
    }
}

export function writeSlot(slot: number, data: SaveData) {
    try {
        localStorage.setItem(KEY(slot), JSON.stringify(data));
    } catch {
        /* storage unavailable: play on without saving */
    }
}

export function deleteSlot(slot: number) {
    try {
        localStorage.removeItem(KEY(slot));
    } catch {
        /* ignore */
    }
}

/** The live game state shared by all scenes. */
export const G = {
    slot: 1,
    save: newSave(),
    /** true while a dialogue/close-up/menu freezes the world */
    frozen: false,
    persist() {
        writeSlot(this.slot, this.save);
    },
    flag(name: string) {
        return !!this.save.flags[name];
    },
    setFlag(name: string, v: boolean | number | string = true) {
        this.save.flags[name] = v;
    },
};
