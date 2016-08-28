define(function (require) {
    require(["async!https://maps.googleapis.com/maps/api/js?key=" + googleApiKey + "&callback=initMap&libraries=places,geometry"], function () {
        map = require("./map");
        map.initMap();
    });
});
//# sourceMappingURL=main.js.map