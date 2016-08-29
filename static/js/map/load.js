define((require) => {
    require(["async!https://maps.googleapis.com/maps/api/js?key="
    + googleApiKey + "&callback=initMap&libraries=places,geometry"], () => {
        "use strict";
        var main = require("../map");
        var core = require("./core");
        core.map = main.initMap();
        var omg = 3;
    });
})

