import {IMapElement} from "../data/entities";

export interface ILocation extends IMapElement {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    size: number;
    priority: number;

    relation: number;
    online: boolean;
}
