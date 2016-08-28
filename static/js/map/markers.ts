import {map} from "map";

function createSearchMarker (lat, lng) {
  let searchMarker = new google.maps.Marker({ // need to keep reference.
  position: {
    lat: lat,
    lng: lng
  },
  map: map,
  animation: google.maps.Animation.DROP,
  draggable: !store.Store.get('lockMarker'),
  icon: null,
  optimized: false,
  zIndex: google.maps.Marker.MAX_ZINDEX + 1
});

var oldLocation = null;
google.maps.event.addListener(searchMarker, 'dragstart', function () {
  oldLocation = searchMarker.getPosition()
});

google.maps.event.addListener(searchMarker, 'dragend', function () {
  var newLocation = searchMarker.getPosition();
  changeSearchLocation(newLocation.lat(), newLocation.lng())
    .done(function () {
      oldLocation = null
    })
    .fail(function () {
      if (oldLocation) {
        searchMarker.setPosition(oldLocation)
      }
    })
});

return searchMarker
}
