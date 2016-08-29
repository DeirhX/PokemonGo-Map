/// <reference path="../../../typings/globals/require/index.d.ts" />

import {map, google} from "./core";
import {Store} from "../store";

export function createSearchMarker (lat, lng) {
  let searchMarker = new google.maps.Marker({ // need to keep reference.
    position: {lat, lng },
    map: map,
    animation: google.maps.Animation.DROP,
    draggable: !Store.get('lockMarker'),
    icon: null,
    optimized: false,
    zIndex: google.maps.Marker.MAX_ZINDEX + 1
  });

  var oldLocation = null;
  google.maps.event.addListener(searchMarker, 'dragstart', function () {
    oldLocation = searchMarker.getPosition();
  });

  google.maps.event.addListener(searchMarker, 'dragend', function () {
    var newLocation = searchMarker.getPosition();
  });

  return searchMarker;
}
