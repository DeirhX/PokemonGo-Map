import {IMapElement} from "../map/map";

export interface ILocation extends IMapElement {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    size: number;
    priority: number;
    spawns: number;

    relation: number;
    online: boolean;
}
