/// <reference path="../../../typings/globals/jquery/index.d.ts" />

import {IMarker} from "../map/overlay/markers";
import {IMember} from "../members/members";
import {IMapElement} from "../map/map";
import {ISpawn} from "./spawn";

export const gymTypes = ["Uncontested", "Mystic", "Valor", "Instinct"];
export const gymPrestige = [2000, 4000, 8000, 12000, 16000, 20000, 30000, 40000, 50000];

export interface IMapData {
    pokemons: { [id: string]: IPokemon } ;
    gyms: { [id: string]: IGym } ;
    pokestops: { [id: string]: IPokestop } ;
    lurePokemons: { [id: string]: ILuredPokemon } ;
    scanned: { [id: string]: IScannedCell } ;
    spawnpoints: { [id: string]: ISpawn } ;
    locations: { [id: string]: ILocation } ;
}

export interface IStaticData {
    attacks: { [id: string]: IPokemonAttack } ;
}


export interface IGym extends IMapElement {
    gym_id: string;
    team_id: number;
    enabled: boolean;
    guard_pokemon_id: number;
    gym_points: number;
    name: string;
    pokemon: { [id: string]: IGymPokemon };
}

// TODO: Make class member once we have more?
export function getGymLevel(gym: IGym): number {
    let gymLevel = 1;
    while (gym.gym_points >= gymPrestige[gymLevel - 1]) {
        gymLevel++;
    }
    return gymLevel;
}

export interface IPokemon extends IMapElement {
    encounter_id: string;
    pokemon_id: number;
    disappear_time: number;
    pokemon_rarity: string;
    pokemon_name: string;
    pokemon_types: string;

    individual_attack: number;
    individual_defense: number;
    individual_stamina: number;
    attack_1: number;
    attack_2: number;
}

export interface IGymPokemon extends  IPokemon {
    gym_id: string;
    pokemon_cp: number;
    trainer_level: number;
    trainer_name: string;
}

export interface IPokemonAttack {
    // id: number;
    name: string;
    type: string;
    damage: number;
    duration: number;
    energy: number;
    dps: number;
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

export class StaticData implements IStaticData {
    public attacks: { [id: string]: IPokemonAttack } =  {};
}

export class CoreSingleton {
    public member: IMember;
    public mapData = new MapData();
    public staticData = new StaticData();
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
            items[key].marker.destroy();
        }
    }
}

