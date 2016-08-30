/// <reference path="../../../typings/globals/require/index.d.ts" />

let core = {
    map: null,
    google: null,
};

export default core;

export function centerMap (lat: number, lng: number, zoom?: number): void {
    const loc = new core.google.maps.LatLng(lat, lng);

    core.map.setCenter(loc);

    if (zoom) {
        core.map.setZoom(zoom);
    }
}

export function onCenterChange(centerChangedCallback: (lat: number, lng: number) => void) {
    core.google.maps.event.addListener(core.map, "idle", () => {
        centerChangedCallback(core.map.getCenter().lat(), core.map.getCenter().lng()); });
}
