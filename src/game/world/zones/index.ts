import type { ZoneDef } from '../types';
import type { World } from '../../scenes/World';
import { testZone } from './test';
import { homeZone } from './home';
import { campAZone } from './campA';
import { shopScript, shopZone } from './shop';
import { campBScript, campBZone } from './campB';
import { campCDScript, campCDZone } from './campCD';
import { junctionZone } from './junction';
import { rvParkSZone } from './rvParkS';
import { rvParkNZone } from './rvParkN';
import { caveZone, cliffZone } from './cliff';
import { lakeZone } from './lake';
import { campEdgeZone } from './campEdge';
import { highwayZone } from './highway';
import { titleZone } from './title';
import { stationScript, stationZone } from './station';
import { raceLotZone } from './raceLot';
import { circuitZone } from './circuit';

export interface ZoneScript {
    onEnter?(w: World): void;
    onUpdate?(w: World, dt: number): void;
}

export const ZONES: Record<string, ZoneDef> = {
    test: testZone,
    home: homeZone,
    campA: campAZone,
    shop: shopZone,
    campB: campBZone,
    campCD: campCDZone,
    junction: junctionZone,
    rvParkS: rvParkSZone,
    rvParkN: rvParkNZone,
    cliff: cliffZone,
    cave: caveZone,
    lake: lakeZone,
    campEdge: campEdgeZone,
    highway: highwayZone,
    station: stationZone,
    raceLot: raceLotZone,
    circuit: circuitZone,
    title: titleZone,
};

export const ZONE_SCRIPTS: Record<string, ZoneScript> = {
    shop: shopScript,
    campB: campBScript,
    campCD: campCDScript,
    station: stationScript,
};
