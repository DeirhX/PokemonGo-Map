define((require) => {
    require(["async!https://maps.googleapis.com/maps/api/js?key="
    + googleApiKey + "&libraries=places,geometry"], () => {
        "use strict";
        var main = require("../legacy");
        var map = require("./map");
        map.googleMap = main.initMap();
    });
})