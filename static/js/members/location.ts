export interface ILocation {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    size: number;
    priority: number;

    relation: number;
    online: boolean;
}
