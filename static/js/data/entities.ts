/// <reference path="../../../typings/globals/jquery/index.d.ts" />

import {IMarker} from "../map/overlay/markers";
import {IMember} from "../members/members";
import {IMapElement} from "../map/map";
import {ISpawn} from "./spawn";
export const gymTypes = ["Uncontested", "Mystic", "Valor", "Instinct"];

export interface IMapData {
    pokemons: { [id: string]: IPokemon } ;
    gyms: { [id: string]: IGym } ;
    pokestops: { [id: string]: IPokestop } ;
    lurePokemons: { [id: string]: ILuredPokemon } ;
    scanned: { [id: string]: IScannedCell } ;
    spawnpoints: { [id: string]: ISpawn } ;
    locations: { [id: string]: ILocation } ;
}

export interface IGym extends IMapElement {

}

export interface IPokemon extends IMapElement {

}

export interface ILuredPokemon extends IPokemon {

}

export interface IPokestop extends IMapElement {
    pokestop_id: string;
    lure_expiration: Date;
}

export interface IScannedCell extends IMapElement {
    last_update: number;
}

export interface ILocation extends IMapElement {

}

export class MapData implements IMapData {
    public pokemons: { [id: string]: IPokemon } = {};
    public gyms: { [id: string]: IGym } = {};
    public pokestops: { [id: string]: IPokestop } = {};
    public lurePokemons: { [id: string]: ILuredPokemon } = {};
    public scanned: { [id: string]: IScannedCell } = {};
    public spawnpoints: { [id: string]: ISpawn } = {};
    public locations: { [id: string]: ILocation } = {};
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

