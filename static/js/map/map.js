/// <reference path="../../../typings/globals/require/index.d.ts" />
define(["require", "exports"], function (require, exports) {
    "use strict";
    exports.Google = null;
    exports.map = new Map();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = exports.map;
    var Map = (function () {
        function Map() {
            this.googleMap = null;
        }
        Map.prototype.centerMap = function (lat, lng, zoom) {
            var loc = new exports.Google.maps.LatLng(lat, lng);
            this.googleMap.setCenter(loc);
            if (zoom) {
                this.googleMap.setZoom(zoom);
            }
        };
        Map.prototype.onCenterChange = function (centerChangedCallback) {
            google.maps.event.addListener(this.googleMap, "idle", function () {
                centerChangedCallback(exports.map.googleMap.getCenter().lat(), exports.map.googleMap.getCenter().lng());
            });
        };
        Map.prototype.onZoomChange = function (zoomChangedCallback) {
            google.maps.event.addListener(exports.map.googleMap, "zoom_changed", function () {
                zoomChangedCallback(exports.map.googleMap.getZoom());
            });
        };
        Map.prototype.onFinishedMove = function (finishedMoveCallback) {
            google.maps.event.addListener(exports.map.googleMap, 'idle', function () {
                finishedMoveCallback();
            });
        };
        Map.prototype.onLoad = function (loadCallback) {
            // throw "not implemented yet";
        };
        return Map;
    }());
    exports.Map = Map;
});
