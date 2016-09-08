import {Marker} from "../map/overlay/markers";
export enum SpawnState {
    Spawning,
    Waiting,
}

export interface ISpawn {
    id: string;
    latitude: number;
    longitude: number;
    nextSpawn: Date;
    nextDespawn: Date;
    state: SpawnState;
    prevState: SpawnState;
    marker: Marker;
    detail: ISpawnDetail;
}

export interface ISpawnChance {
    chance: number;
    pokemonId: number;
}

export interface IHourlyChance {
    hour: number;
    chances: ISpawnChance[];
}

export interface ISpawnDetail {
    spawn: ISpawn;
    rank: number;
    overall: ISpawnChance[];
    hourly: IHourlyChance[];
}

export class Spawn implements ISpawn {
    public id: string;
    public latitude: number;
    public longitude: number;
    public nextSpawn: Date;
    public nextDespawn: Date;
    public state: SpawnState;
    public prevState: SpawnState;
    public marker: Marker;
    public detail: ISpawnDetail;

    constructor(json: any) {
        this.id = json.id;
        this.latitude = json.latitude;
        this.longitude = json.longitude;
        this.nextSpawn = new Date(json.nextSpawn);
        this.nextDespawn = new Date(json.nextDespawn);

        this.update(new Date());
    }

    public isSpawning() {
        return this.state === SpawnState.Spawning;
    }

    public update(now: Date): boolean {

        if (now > this.nextDespawn) {
            this.cycleNext(now);
        }

        this.prevState = this.state;
        if (now > this.nextSpawn) {
            this.state = SpawnState.Spawning;
        } else {
            this.state = SpawnState.Waiting;
        }


        return this.prevState !== this.state;
    }

    private cycleNext(now: Date): void {
        const hourDiff = Math.floor(Math.abs(now.getTime() - this.nextDespawn.getTime()) / 36e5) + 1;
        this.nextSpawn.setHours(this.nextSpawn.getHours() + hourDiff);
        this.nextDespawn.setHours(this.nextDespawn.getHours() + hourDiff);
    }
}

export class SpawnDetail implements ISpawnDetail {
    public spawn: ISpawn;
    public rank: number;
    public overall: ISpawnChance[];
    public hourly: IHourlyChance[];

    constructor(spawn: ISpawn, json: any) {
        this.spawn = spawn;
        this.rank = json.rank;
        this.overall = json.overall;
        this.hourly = json.hourly;
        spawn.detail = this;
    }
}

export class HourlyChance implements IHourlyChance {
    public hour: number;
    public chances: ISpawnChance[];

    constructor(hourlyChance: IHourlyChance) {
        this.hour = hourlyChance.hour;
        this.chances = hourlyChance.chances.slice();
    }
}
