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
}

export interface ISpawnChance {
    chance: number;
    pokemonId: number;
}

export interface ISpawnDetail extends ISpawn {
    rank: number;
    chances: ISpawnChance[];
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

export class SpawnDetail extends Spawn implements ISpawnDetail {
    public rank: number;
    public chances: ISpawnChance[];

    constructor(json: any) {
        super(json);
        this.rank = json.rank;
        this.chances = json.chances;
    }
}
