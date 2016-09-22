/// <reference path="../../../typings/globals/require/index.d.ts" />
/// <reference path="../../../typings/globals/googlemaps/index.d.ts" />
define(["require", "exports", "../core/base"], function (require, exports, base_1) {
    "use strict";
    var Map = (function () {
        function Map(googleMap) {
            var _this = this;
            this.googleMap = googleMap;
            this.onLoad(function () { return _this.isLoaded = true; });
        }
        Map.prototype.getBounds = function () {
            return this.googleMap.getBounds();
        };
        Map.prototype.centerMap = function (lat, lng, zoom) {
            var loc = new google.maps.LatLng(lat, lng);
            this.googleMap.setCenter(loc);
            if (zoom) {
                this.googleMap.setZoom(zoom);
            }
        };
        Map.prototype.onCenterChange = function (centerChangedCallback) {
            var _this = this;
            google.maps.event.addListener(this.googleMap, "idle", function () {
                centerChangedCallback(_this.googleMap.getCenter().lat(), base_1.core.map.googleMap.getCenter().lng());
            });
        };
        Map.prototype.onZoomChange = function (zoomChangedCallback) {
            var _this = this;
            google.maps.event.addListener(this.googleMap, "zoom_changed", function () {
                zoomChangedCallback(_this.googleMap.getZoom());
            });
        };
        Map.prototype.onFinishedMove = function (finishedMoveCallback) {
            google.maps.event.addListener(this.googleMap, 'idle', function () {
                finishedMoveCallback();
            });
        };
        Map.prototype.onLoad = function (loadCallback) {
            google.maps.event.addListenerOnce(this.googleMap, 'projection_changed', loadCallback);
        };
        return Map;
    }());
    exports.Map = Map;
});
