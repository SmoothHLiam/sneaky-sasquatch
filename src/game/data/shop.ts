/**
 * Raccoon Shop stock (wiki Raccoon_Shop + shelf prices read off tutorial t246.5).
 * Rows run from the door (south) to the back wall (north); three items per shelf.
 * Buying sets the save flag `own_<id>`; the item leaves the shelf.
 */
export interface ShopItem {
    id: string;
    name: string;
    price: number;
    /** PROP_DEFS key of the display sprite */
    prop: string;
}

export const RACCOON_SHOP: ShopItem[][] = [
    [
        { id: 'map', name: 'Map', price: 5, prop: 'shopMap' },
        { id: 'shovel', name: 'Shovel', price: 25, prop: 'shopShovel' },
        { id: 'camperDisguise', name: 'Camper Disguise', price: 150, prop: 'shopHat' },
    ],
    [
        { id: 'paddle', name: 'Paddle', price: 50, prop: 'shopPaddle' },
        { id: 'fishingRod', name: 'Fishing Rod', price: 75, prop: 'shopRod' },
        { id: 'golfClub', name: 'Golf Club', price: 100, prop: 'shopGolf' },
    ],
    [
        { id: 'flashlight', name: 'Flashlight', price: 125, prop: 'shopFlashlight' },
        { id: 'vehicleKeys', name: 'Vehicle Keys', price: 150, prop: 'shopKeys' },
        { id: 'skis', name: 'Skis', price: 250, prop: 'shopSkis' },
    ],
];
