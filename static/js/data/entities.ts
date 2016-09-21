/// <reference path="../../../typings/globals/jquery/index.d.ts" />

import {IMarker} from "../map/overlay/markers";
import {IMember} from "../members/members";
export const gymTypes = ["Uncontested", "Mystic", "Valor", "Instinct"];

export interface IMapData {
    pokemons: { [id: string]: IMapElement } ;
    gyms: { [id: string]: IMapElement } ;
    pokestops: { [id: string]: IMapElement } ;
    lurePokemons: { [id: string]: IMapElement } ;
    scanned: { [id: string]: IMapElement } ;
    spawnpoints: { [id: string]: IMapElement } ;
    locations: { [id: string]: IMapElement } ;
}

export interface IMapElement {
    marker: IMarker;
}

export interface IPokemon {

}

export class MapData implements IMapData {
    public pokemons: { [id: string]: IMapElement } = {};
    public gyms: { [id: string]: IMapElement } = {};
    public pokestops: { [id: string]: IMapElement } = {};
    public lurePokemons: { [id: string]: IMapElement } = {};
    public scanned: { [id: string]: IMapElement } = {};
    public spawnpoints: { [id: string]: IMapElement } = {};
    public locations: { [id: string]: IMapElement } = {};
}

export class CoreSingleton {
    public member: IMember;
    public mapData = new MapData();
}
export var Core = new CoreSingleton();
export default Core;

export function clearMemberMapData() {
    clearMarkersIn(Core.mapData.scanned);
    Core.mapData.scanned = {};
    clearMarkersIn(Core.mapData.pokemons);
    Core.mapData.pokemons = {};
    clearMarkersIn(Core.mapData.locations);
    Core.mapData.locations = {};
}

export function clearAllMapData() {
    for (let type in Core.mapData) {
        clearMarkersIn(Core.mapData[type]);
        Core.mapData[type] = {};
    }
}

function clearMarkersIn(items: { [id: string]: IMapElement } ) {
    for (let key in items) {
        if (items[key].marker) {
            items[key].marker.delete();
        }
    }
}

