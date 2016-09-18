/// <reference path="../../../../typings/globals/require/index.d.ts" />
/// <reference path="../../../../typings/globals/jquery/index.d.ts" />
define(["require", "exports", "../../store", "../core"], function (require, exports, store_1, core_1) {
    "use strict";
    var searchMarkerStyles;
    function createSearchMarker(lat, lng) {
        exports.searchMarker = new core_1["default"].google.maps.Marker({
            position: { lat: lat, lng: lng },
            map: core_1["default"].map,
            animation: core_1["default"].google.maps.Animation.DROP,
            draggable: !store_1.Store.get("lockMarker"),
            icon: null,
            optimized: false,
            zIndex: core_1["default"].google.maps.Marker.MAX_ZINDEX + 1
        });
        return exports.searchMarker;
    }
    exports.createSearchMarker = createSearchMarker;
    function updateSearchMarker(style) {
        if (style in searchMarkerStyles) {
            exports.searchMarker.setIcon(searchMarkerStyles[style].icon);
            store_1.Store.set("searchMarkerStyle", style);
        }
        return exports.searchMarker;
    }
    function loadSearchMarkerStyles($selectSearchIconMarker) {
        $.getJSON("static/dist/data/searchmarkerstyle.min.json").done(function (data) {
            searchMarkerStyles = data;
            var searchMarkerStyleList = [];
            $.each(data, function (key, value) { return searchMarkerStyleList.push({
                id: key,
                text: value.name
            }); });
            $selectSearchIconMarker.select2({
                placeholder: "Select Icon Marker",
                data: searchMarkerStyleList,
                minimumResultsForSearch: Infinity
            });
            $selectSearchIconMarker.on("change", function (e) {
                var selectSearchIconMarker = $selectSearchIconMarker.val();
                store_1.Store.set("searchMarkerStyle", selectSearchIconMarker);
                updateSearchMarker(selectSearchIconMarker);
            });
            $selectSearchIconMarker.val(store_1.Store.get("searchMarkerStyle")).trigger("change");
            updateSearchMarker(store_1.Store.get("lockMarker"));
        });
    }
    exports.loadSearchMarkerStyles = loadSearchMarkerStyles;
});
//# sourceMappingURL=search.js.map