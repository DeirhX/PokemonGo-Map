/// <reference path="../../../typings/globals/require/index.d.ts" />
/// <reference path="../../../typings/globals/googlemaps/index.d.ts" />

import {IMarker} from "./overlay/markers";
import {ILocation} from "../data/location";
import {core} from "../core/base";


export interface IMapElement extends ILocation {
    marker: IMarker;
    hidden: boolean;
}

export class Map {
    public googleMap: google.maps.Map;
    public isLoaded: boolean;

    constructor(googleMap: google.maps.Map) {
        this.googleMap = googleMap;
        this.onLoad(() => this.isLoaded = true);
    }

    public getBounds() {
        return this.googleMap.getBounds();
    }

    public centerMap (lat: number, lng: number, zoom?: number): void {
        const loc = new google.maps.LatLng(lat, lng);

        this.googleMap.setCenter(loc);

        if (zoom) {
            this.googleMap.setZoom(zoom);
        }
    }

    public onCenterChange(centerChangedCallback: (lat: number, lng: number) => void) {
        google.maps.event.addListener(this.googleMap, "idle", () => {
            centerChangedCallback(this.googleMap.getCenter().lat(), core.map.googleMap.getCenter().lng()); });
    }

    public onZoomChange(zoomChangedCallback: (zoomLevel: number) => void) {
        google.maps.event.addListener(this.googleMap, "zoom_changed", () => {
            zoomChangedCallback(this.googleMap.getZoom()); });
    }

    public onFinishedMove( finishedMoveCallback: () => void ) {
        google.maps.event.addListener(this.googleMap, 'idle', () => {
            finishedMoveCallback(); }) ;
    }

    public onLoad( loadCallback: () => void ) {
        google.maps.event.addListenerOnce(this.googleMap, 'projection_changed', loadCallback);
    }
}
