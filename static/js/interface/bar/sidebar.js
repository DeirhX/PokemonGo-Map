/// <reference path="../../../../typings/globals/jquery/index.d.ts" />
/// <reference path="../../../../typings/globals/select2/index.d.ts" />
define(["require", "exports", "../../store", "../../map/core", "../../assets/sprites", "../../map/core", "../../map/styles", "../../assets/strings", "../bar"], function (require, exports, store_1, core_1, sprites_1, core_2, mapStyles, strings_1, bar_1) {
    "use strict";
    var sideBar = new bar_1.Bar("nav");
    exports.__esModule = true;
    exports["default"] = sideBar;
    function initSidebar() {
        $("#gyms-switch").prop("checked", store_1.Store.get("showGyms"));
        $("#pokemon-switch").prop("checked", store_1.Store.get("showPokemon"));
        $("#pokestops-switch").prop("checked", store_1.Store.get("showPokestops"));
        $("#lured-pokestops-only-switch").val(store_1.Store.get("showLuredPokestopsOnly"));
        $("#lured-pokestops-only-wrapper").toggle(store_1.Store.get("showPokestops"));
        $("#geoloc-switch").prop("checked", store_1.Store.get("geoLocate"));
        $("#lock-marker-switch").prop("checked", store_1.Store.get("lockMarker"));
        $("#start-at-user-location-switch").prop("checked", store_1.Store.get("startAtUserLocation"));
        $("#scanned-switch").prop("checked", store_1.Store.get("showScanned"));
        $("#spawnpoint-switch").prop("checked", store_1.Store.get("showSpawnpoints"));
        $("#sound-switch").prop("checked", store_1.Store.get("playSound"));
        $("#next-location").css("background-color", $("#geoloc-switch").prop("checked") ? "#e0e0e0" : "#ffffff");
        var searchBox = new core_1["default"].google.maps.places.SearchBox(document.getElementById("next-location"));
        searchBox.addListener("places_changed", function () {
            var places = searchBox.getPlaces();
            if (places.length === 0) {
                return;
            }
            var loc = places[0].geometry.location;
            core_2.centerMap(loc.lat(), loc.lng());
        });
        var icons = $("#pokemon-icons");
        $.each(sprites_1.pokemonSprites, function (key, value) {
            return icons.append($("<option></option>").attr("value", key).text(value.name));
        });
        icons.val((sprites_1.pokemonSprites[store_1.Store.get("pokemonIcons")]) ? store_1.Store.get("pokemonIcons") : "highres");
        $("#pokemon-icon-size").val(store_1.Store.get("iconSizeModifier"));
        setupStylePicker();
    }
    exports.initSidebar = initSidebar;
    function setupStylePicker() {
        // populate Navbar Style menu
        var $selectStyle = $("#map-style");
        var selectedStyle = "light";
        // Load Stylenames, translate entries, and populate lists
        $.getJSON("static/dist/data/mapstyle.min.json").done(function (data) {
            var styleList = [];
            $.each(data, function (key, value) {
                styleList.push({
                    id: key,
                    text: strings_1.i8ln(value)
                });
            });
            // setup the stylelist
            $selectStyle.select2({
                placeholder: "Select Style",
                data: styleList,
                minimumResultsForSearch: Infinity
            });
            // setup the list change behavior
            $selectStyle.on("change", function (e) {
                selectedStyle = $selectStyle.val();
                mapStyles.setStyle(selectedStyle);
                store_1.Store.set("map_style", selectedStyle);
            });
            // recall saved mapstyle
            $selectStyle.val(store_1.Store.get("map_style")).trigger("change");
        });
    }
});
//# sourceMappingURL=sidebar.js.map