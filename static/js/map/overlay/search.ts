/// <reference path="../../../../typings/globals/require/index.d.ts" />
/// <reference path="../../../../typings/globals/jquery/index.d.ts" />

import {Store} from "../../store";
import core from "../core";

export let searchMarker;
let searchMarkerStyles;

export function createSearchMarker(lat, lng) {
    searchMarker = new core.google.maps.Marker({ // need to keep reference.
        position: {lat, lng},
        map: core.map,
        animation: core.google.maps.Animation.DROP,
        draggable: !Store.get("lockMarker"),
        icon: null,
        optimized: false,
        zIndex: core.google.maps.Marker.MAX_ZINDEX + 1,
    });
    return searchMarker;
}

function updateSearchMarker(style) {
    if (style in searchMarkerStyles) {
        searchMarker.setIcon(searchMarkerStyles[style].icon);
        Store.set("searchMarkerStyle", style);
    }
    return searchMarker;
}

export function loadSearchMarkerStyles($selectSearchIconMarker) {
    $.getJSON("static/dist/data/searchmarkerstyle.min.json").done(data => {
        searchMarkerStyles = data;
        let searchMarkerStyleList = [];

        $.each(data, (key, value) => searchMarkerStyleList.push({
            id: key,
            text: value.name,
        }));

        $selectSearchIconMarker.select2({
            placeholder: "Select Icon Marker",
            data: searchMarkerStyleList,
            minimumResultsForSearch: Infinity,
        });

        $selectSearchIconMarker.on("change", e => {
            let selectSearchIconMarker = $selectSearchIconMarker.val();
            Store.set("searchMarkerStyle", selectSearchIconMarker);
            updateSearchMarker(selectSearchIconMarker);
        });

        $selectSearchIconMarker.val(Store.get("searchMarkerStyle")).trigger("change");

        updateSearchMarker(Store.get("lockMarker"));
    });
}
