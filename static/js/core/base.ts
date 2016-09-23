import {Map} from "map/map";
import {Membership} from "../members/members";

export class Core {
    public get map(): Map { return this._map; }
    public set map(value: Map) { this._map = value; }
    public get members(): Membership { return this._membership; }

    private _map: Map;
    private _membership = new Membership();
}

export const core = new Core();
export default core;
