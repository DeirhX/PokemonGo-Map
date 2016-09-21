/// <reference path="../../../typings/globals/jquery/index.d.ts" />

import {IMarker} from "../map/overlay/markers";
import {IMember, Member} from "../members/server";
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

export class Core {
    public member: IMember = new Member();
}
export var core = new Core();
export var mapData = new MapData();

export function clearMemberMapData() {
    clearMarkersIn(mapData.scanned);
    mapData.scanned = {};
    clearMarkersIn(mapData.pokemons);
    mapData.pokemons = {};
    clearMarkersIn(mapData.locations);
    mapData.locations = {};
}

export function clearAllMapData() {
    for (let type in mapData) {
        clearMarkersIn(mapData[type]);
        mapData[type] = {};
    }
}

function clearMarkersIn(items: { [id: string]: IMapElement } ) {
    for (let key in items) {
        if (items[key].marker) {
            items[key].marker.delete();
        }
    }
}
