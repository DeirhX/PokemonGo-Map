import map from "map/map";

export function addMyLocationButton(lat: number, lng: number): void {

    let locationMarker = createMyLocationMarker(map.googleMap, lat, lng);
    let locationButton = createMyLocationButton(map.googleMap);

    locationMarker.setMap(map.googleMap);
    map.googleMap.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(locationButton);
    beginUpdateLocationOnPress(locationButton, locationMarker);
}

export function beginUpdateLocationOnPress(locationButton: any, locationMarker: any): void {

    locationButton.addEventListener('click', function () {
        centerMapMyOnLocation(locationMarker);
    });

    // Fade out my location if map is panned
    google.maps.event.addListener(map.googleMap, 'dragend', function () {
        let currentLocation = document.getElementById('current-location');
        currentLocation.style.backgroundPosition = '0px 0px';
        locationMarker.setOptions({
            'opacity': 0.5,
        });
    });
}

function createMyLocationMarker(map: any, lat: number, lng: number): any {
    let locationMarker = new google.maps.Marker({
        animation: google.maps.Animation.DROP,
        position: {
            lat,
            lng,
        },
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillOpacity: 1,
            fillColor: '#1c8af6',
            scale: 6,
            strokeColor: '#1c8af6',
            strokeWeight: 8,
            strokeOpacity: 0.3
        },
    })
    locationMarker.setVisible(false);
    return locationMarker;
}

function createMyLocationButton(map): any {
    let locationContainer = document.createElement('div');

    let locationButton = document.createElement('button')
    locationButton.style.backgroundColor = '#fff'
    locationButton.style.border = 'none'
    locationButton.style.outline = 'none'
    locationButton.style.width = '28px'
    locationButton.style.height = '28px'
    locationButton.style.borderRadius = '2px'
    locationButton.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)'
    locationButton.style.cursor = 'pointer'
    locationButton.style.marginRight = '10px'
    locationButton.style.padding = '0px'
    locationButton.title = 'Your Location'
    locationContainer.appendChild(locationButton)

    let locationIcon = document.createElement('div')
    locationIcon.style.margin = '5px'
    locationIcon.style.width = '18px'
    locationIcon.style.height = '18px'
    locationIcon.style.backgroundImage = 'url(static/mylocation-sprite-1x.png)'
    locationIcon.style.backgroundSize = '180px 18px'
    locationIcon.style.backgroundPosition = '0px 0px'
    locationIcon.style.backgroundRepeat = 'no-repeat'
    locationIcon.id = 'current-location'
    locationButton.appendChild(locationIcon)

    // locationContainer.index = 1;
    return locationContainer;
}

function centerMapMyOnLocation(locationMarker) {
    var currentLocation = document.getElementById('current-location');
    var imgX = '0';
    var animationInterval = setInterval(function () {
        if (imgX === '-18') {
            imgX = '0'
        } else {
            imgX = '-18'
        }
        currentLocation.style.backgroundPosition = imgX + 'px 0';
    }, 500)
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (position) {
            var latlng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude)
            locationMarker.setVisible(true);
            locationMarker.setOptions({
                'opacity': 1,
            })
            locationMarker.setPosition(latlng);
            map.googleMap.setCenter(latlng);
            clearInterval(animationInterval);
            currentLocation.style.backgroundPosition = '-144px 0px';
        });
    } else {
        clearInterval(animationInterval);
        currentLocation.style.backgroundPosition = '0px 0px';
    }
}
