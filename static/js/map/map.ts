/// <reference path="../../../typings/globals/require/index.d.ts" />

export let Google = null;
export let map = new Map();
export default map;

export class Map {
    public googleMap = null;

    public centerMap (lat: number, lng: number, zoom?: number): void {
        const loc = new Google.maps.LatLng(lat, lng);

        this.googleMap.setCenter(loc);

        if (zoom) {
            this.googleMap.setZoom(zoom);
        }
    }

    public onCenterChange(centerChangedCallback: (lat: number, lng: number) => void) {
        google.maps.event.addListener(this.googleMap, "idle", () => {
            centerChangedCallback(map.googleMap.getCenter().lat(), map.googleMap.getCenter().lng()); });
    }

    public onZoomChange(zoomChangedCallback: (zoomLevel: number) => void) {
        google.maps.event.addListener(map.googleMap, "zoom_changed", () => {
            zoomChangedCallback(map.googleMap.getZoom()); });
    }

    public onFinishedMove( finishedMoveCallback: () => void ) {
        google.maps.event.addListener(map.googleMap, 'idle', () => {
            finishedMoveCallback(); }) ;
    }

    public onLoad( loadCallback: () => void ) {
        // throw "not implemented yet";
    }
}

