/// <reference path="../../../typings/globals/require/index.d.ts" />

import {Store} from "../store";
import {google, map} from "./core";

export function createSearchMarker (lat, lng) {
  let searchMarker = new google.maps.Marker({ // need to keep reference.
    position: {lat, lng },
    map,
    animation: google.maps.Animation.DROP,
    draggable: !Store.get("lockMarker"),
    icon: null,
    optimized: false,
    zIndex: google.maps.Marker.MAX_ZINDEX + 1,
  });

  let oldLocation = null;
  google.maps.event.addListener(searchMarker, "dragstart", () => {
    oldLocation = searchMarker.getPosition();
  });

  google.maps.event.addListener(searchMarker, "dragend", () => {
    // let newLocation = searchMarker.getPosition();
  });

  return searchMarker;
}
