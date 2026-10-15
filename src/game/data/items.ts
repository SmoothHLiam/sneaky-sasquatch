/**
 * Backpack items. `food` = hunger wedges restored when eaten (wiki: most foods
 * are 1; burgers/hot meals 5; spaghetti 6). `sell` = coins from the Bear.
 * `icon` = close-up art key (public/assets/closeup/item_<icon>.svg).
 */
export interface ItemDef {
    name: string;
    icon: string;
    food: number;
    /** condiments are "eaten" for fun (ketchup squirts) but give nothing */
    condiment?: boolean;
    stinky?: boolean;
    sell: number;
    /** display size in the close-ups, ref px (width) */
    size: number;
}

export const ITEMS: Record<string, ItemDef> = {
    hotdog: { name: 'Hot Dog', icon: 'hotdog', food: 1, sell: 2, size: 250 },
    ketchup: { name: 'Ketchup', icon: 'ketchup', food: 0, condiment: true, sell: 1, size: 120 },
    pickles: { name: 'Pickles', icon: 'pickles', food: 1, sell: 2, size: 160 },
    water: { name: 'Water Bottle', icon: 'water', food: 1, sell: 1, size: 105 },
    soda: { name: 'Soda', icon: 'soda', food: 1, sell: 1, size: 120 },
    /** orange can from the ranger-station vending machine (row A) */
    sodaOrange: { name: 'Orange Soda', icon: 'sodaOrange', food: 1, sell: 1, size: 120 },
    chips: { name: 'Chips', icon: 'chips', food: 1, sell: 2, size: 170 },
    sandwich: { name: 'Sandwich', icon: 'sandwich', food: 1, sell: 3, size: 220 },
    orange: { name: 'Orange', icon: 'orange', food: 1, sell: 1, size: 130 },
    pepper: { name: 'Pepper', icon: 'pepper', food: 1, sell: 1, size: 120 },
    stinkyFood: { name: 'Stinky Food', icon: 'stinkyFood', food: 1, stinky: true, sell: 1, size: 200 },
    smores: { name: "S'mores", icon: 'smores', food: 1, sell: 3, size: 170 },
    steak: { name: 'Steak', icon: 'steak', food: 1, sell: 3, size: 210 },
    watermelon: { name: 'Watermelon', icon: 'watermelon', food: 1, sell: 2, size: 210 },
    coinBag: { name: 'Coins', icon: 'coinBag', food: 0, sell: 0, size: 170 },
    /** quest item: the Duck's red cap from the teal RV (inside-park t303) */
    duckHat: { name: 'Duck Hat', icon: 'duckHat', food: 0, sell: 0, size: 220 },
};

export const BACKPACK_CAPACITY = 75;
/** secret caches in the whole game ("Secret Cache Found! 0/40", inside-park t98) */
/** the treasure map was torn into 9 pieces (inside-park 349: Only 8 more to go!) */
export const MAP_PIECES_TOTAL = 9;
export const SECRET_CACHE_TOTAL = 40;

export const itemDef = (id: string): ItemDef => ITEMS[id] ?? { name: id, icon: 'stinkyFood', food: 1, sell: 1, size: 180 };
