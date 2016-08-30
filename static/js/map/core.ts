/// <reference path="../../../typings/globals/require/index.d.ts" />

let map;
let google;
export { map, google };

export function centerMap (lat, lng, zoom) {
    const loc = new google.maps.LatLng(lat, lng)

    map.setCenter(loc)

    if (zoom) {
        map.setZoom(zoom);
    }
}
