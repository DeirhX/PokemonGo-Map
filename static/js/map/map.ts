/// <reference path="../../../typings/globals/require/index.d.ts" />

let googleMaps = require(["async!https://maps.googleapis.com/maps/api/js?key="
    + googleApiKey + "&callback=initMap&libraries=places,geometry"]);
let map = require("../map");
map.initMap();
export { map };

