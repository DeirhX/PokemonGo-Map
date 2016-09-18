/// <reference path="../../../typings/globals/require/index.d.ts" />
define(["require", "exports"], function (require, exports) {
    "use strict";
    var core = {
        map: null,
        google: null
    };
    exports.__esModule = true;
    exports["default"] = core;
    function centerMap(lat, lng, zoom) {
        var loc = new core.google.maps.LatLng(lat, lng);
        core.map.setCenter(loc);
        if (zoom) {
            core.map.setZoom(zoom);
        }
    }
    exports.centerMap = centerMap;
    function onCenterChange(centerChangedCallback) {
        core.google.maps.event.addListener(core.map, "idle", function () {
            centerChangedCallback(core.map.getCenter().lat(), core.map.getCenter().lng());
        });
    }
    exports.onCenterChange = onCenterChange;
    function onZoomChange(zoomChangedCallback) {
        core.google.maps.event.addListener(core.map, "zoom_changed", function () {
            zoomChangedCallback(core.map.getZoom());
        });
    }
    exports.onZoomChange = onZoomChange;
    function onFinishedMove(finishedMoveCallback) {
        core.google.maps.event.addListener(core.map, 'idle', function () {
            finishedMoveCallback();
        });
    }
    exports.onFinishedMove = onFinishedMove;
});
//# sourceMappingURL=core.js.map