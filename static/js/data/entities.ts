/// <reference path="../../../typings/globals/jquery/index.d.ts" />

export const gymTypes = ["Uncontested", "Mystic", "Valor", "Instinct"];

export interface IMapData {
    pokemons: any;
    gyms: any;
    pokestops: any;
    lurePokemons: any;
    scanned: any;
    spawnpoints: any;
}

export class MapData implements IMapData {
    public pokemons = {};
    public gyms =  {};
    public pokestops = {};
    public lurePokemons = {};
    public scanned = {};
    public spawnpoints = {};
}

export var mapData = new MapData();

export function clearAllMapData() {
    mapData = new MapData();
}
