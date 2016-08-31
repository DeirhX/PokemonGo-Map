/// <reference path="../../../typings/globals/jquery/index.d.ts" />
/// <reference path="../../../typings/globals/select2/index.d.ts" />


import {Store} from "../store";
import core from "../map/core";
import {pokemonSprites} from "../assets/sprites";
import {centerMap} from "../map/core";
import * as mapStyles from "../map/styles";
import {i8ln} from "../assets/strings";

export function initSidebar() {
    $("#gyms-switch").prop("checked", Store.get("showGyms"));
    $("#pokemon-switch").prop("checked", Store.get("showPokemon"));
    $("#pokestops-switch").prop("checked", Store.get("showPokestops"));
    $("#lured-pokestops-only-switch").val(Store.get("showLuredPokestopsOnly"));
    $("#lured-pokestops-only-wrapper").toggle(Store.get("showPokestops"));
    $("#geoloc-switch").prop("checked", Store.get("geoLocate"));
    $("#lock-marker-switch").prop("checked", Store.get("lockMarker"));
    $("#start-at-user-location-switch").prop("checked", Store.get("startAtUserLocation"));
    $("#scanned-switch").prop("checked", Store.get("showScanned"));
    $("#spawnpoint-switch").prop("checked", Store.get("showSpawnpoints"));
    $("#sound-switch").prop("checked", Store.get("playSound"));
    $("#next-location").css("background-color", $("#geoloc-switch").prop("checked") ? "#e0e0e0" : "#ffffff");

    const searchBox = new core.google.maps.places.SearchBox(document.getElementById("next-location"));
    searchBox.addListener("places_changed", () => {
        const places = searchBox.getPlaces();

        if (places.length === 0) {
            return;
        }

        const loc = places[0].geometry.location;
        centerMap(loc.lat(), loc.lng());
    });

    const icons = $("#pokemon-icons");
    $.each(pokemonSprites, (key, value) =>
        icons.append($("<option></option>").attr("value", key).text(value.name)));
    icons.val((pokemonSprites[Store.get("pokemonIcons")]) ? Store.get("pokemonIcons") : "highres");
    $("#pokemon-icon-size").val(Store.get("iconSizeModifier"));

    setupStylePicker();
};

function setupStylePicker () {
    // populate Navbar Style menu
    let $selectStyle = $("#map-style")
    let selectedStyle = "light"

    // Load Stylenames, translate entries, and populate lists
    $.getJSON("static/dist/data/mapstyle.min.json").done((data) => {
        let styleList = []

        $.each(data, (key, value) => {
            styleList.push({
                id: key,
                text: i8ln(value),
            });
        })

        // setup the stylelist
        $selectStyle.select2({
            placeholder: "Select Style",
            data: styleList,
            minimumResultsForSearch: Infinity,
        });

        // setup the list change behavior
        $selectStyle.on("change", (e) => {
            selectedStyle = $selectStyle.val();
            mapStyles.setStyle(selectedStyle);
            Store.set("map_style", selectedStyle);
        });

        // recall saved mapstyle
        $selectStyle.val(Store.get("map_style")).trigger("change");
    });
}


