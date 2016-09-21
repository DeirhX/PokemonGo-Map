
import {Store} from "../store";
import {map, Google} from "./map";

export const mapStyles = {
    noLabelsStyle: [{
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{
            visibility: 'off'
        }]
    }, {
        'featureType': 'all',
        'elementType': 'labels.text.stroke',
        'stylers': [{
            'visibility': 'off'
        }]
    }, {
        'featureType': 'all',
        'elementType': 'labels.text.fill',
        'stylers': [{
            'visibility': 'off'
        }]
    }, {
        'featureType': 'all',
        'elementType': 'labels.icon',
        'stylers': [{
            'visibility': 'off'
        }]
    }],
    light2Style: [{
        'elementType': 'geometry',
        'stylers': [{
            'hue': '#ff4400'
        }, {
            'saturation': -68
        }, {
            'lightness': -4
        }, {
            'gamma': 0.72
        }]
    }, {
        'featureType': 'road',
        'elementType': 'labels.icon'
    }, {
        'featureType': 'landscape.man_made',
        'elementType': 'geometry',
        'stylers': [{
            'hue': '#0077ff'
        }, {
            'gamma': 3.1
        }]
    }, {
        'featureType': 'water',
        'stylers': [{
            'hue': '#00ccff'
        }, {
            'gamma': 0.44
        }, {
            'saturation': -33
        }]
    }, {
        'featureType': 'poi.park',
        'stylers': [{
            'hue': '#44ff00'
        }, {
            'saturation': -23
        }]
    }, {
        'featureType': 'water',
        'elementType': 'labels.text.fill',
        'stylers': [{
            'hue': '#007fff'
        }, {
            'gamma': 0.77
        }, {
            'saturation': 65
        }, {
            'lightness': 99
        }]
    }, {
        'featureType': 'water',
        'elementType': 'labels.text.stroke',
        'stylers': [{
            'gamma': 0.11
        }, {
            'weight': 5.6
        }, {
            'saturation': 99
        }, {
            'hue': '#0091ff'
        }, {
            'lightness': -86
        }]
    }, {
        'featureType': 'transit.line',
        'elementType': 'geometry',
        'stylers': [{
            'lightness': -48
        }, {
            'hue': '#ff5e00'
        }, {
            'gamma': 1.2
        }, {
            'saturation': -23
        }]
    }, {
        'featureType': 'transit',
        'elementType': 'labels.text.stroke',
        'stylers': [{
            'saturation': -64
        }, {
            'hue': '#ff9100'
        }, {
            'lightness': 16
        }, {
            'gamma': 0.47
        }, {
            'weight': 2.7
        }]
    }],
    darkStyle: [{
        'featureType': 'all',
        'elementType': 'labels.text.fill',
        'stylers': [{
            'saturation': 36
        }, {
            'color': '#b39964'
        }, {
            'lightness': 40
        }]
    }, {
        'featureType': 'all',
        'elementType': 'labels.text.stroke',
        'stylers': [{
            'visibility': 'on'
        }, {
            'color': '#000000'
        }, {
            'lightness': 16
        }]
    }, {
        'featureType': 'all',
        'elementType': 'labels.icon',
        'stylers': [{
            'visibility': 'off'
        }]
    }, {
        'featureType': 'administrative',
        'elementType': 'geometry.fill',
        'stylers': [{
            'color': '#000000'
        }, {
            'lightness': 20
        }]
    }, {
        'featureType': 'administrative',
        'elementType': 'geometry.stroke',
        'stylers': [{
            'color': '#000000'
        }, {
            'lightness': 17
        }, {
            'weight': 1.2
        }]
    }, {
        'featureType': 'landscape',
        'elementType': 'geometry',
        'stylers': [{
            'color': '#000000'
        }, {
            'lightness': 20
        }]
    }, {
        'featureType': 'poi',
        'elementType': 'geometry',
        'stylers': [{
            'color': '#000000'
        }, {
            'lightness': 21
        }]
    }, {
        'featureType': 'road.highway',
        'elementType': 'geometry.fill',
        'stylers': [{
            'color': '#000000'
        }, {
            'lightness': 17
        }]
    }, {
        'featureType': 'road.highway',
        'elementType': 'geometry.stroke',
        'stylers': [{
            'color': '#000000'
        }, {
            'lightness': 29
        }, {
            'weight': 0.2
        }]
    }, {
        'featureType': 'road.arterial',
        'elementType': 'geometry',
        'stylers': [{
            'color': '#000000'
        }, {
            'lightness': 18
        }]
    }, {
        'featureType': 'road.local',
        'elementType': 'geometry',
        'stylers': [{
            'color': '#181818'
        }, {
            'lightness': 16
        }]
    }, {
        'featureType': 'transit',
        'elementType': 'geometry',
        'stylers': [{
            'color': '#000000'
        }, {
            'lightness': 19
        }]
    }, {
        'featureType': 'water',
        'elementType': 'geometry',
        'stylers': [{
            'lightness': 17
        }, {
            'color': '#525252'
        }]
    }],
    pGoStyle: [{
        'featureType': 'landscape.man_made',
        'elementType': 'geometry.fill',
        'stylers': [{
            'color': '#a1f199'
        }]
    }, {
        'featureType': 'landscape.natural.landcover',
        'elementType': 'geometry.fill',
        'stylers': [{
            'color': '#37bda2'
        }]
    }, {
        'featureType': 'landscape.natural.terrain',
        'elementType': 'geometry.fill',
        'stylers': [{
            'color': '#37bda2'
        }]
    }, {
        'featureType': 'poi.attraction',
        'elementType': 'geometry.fill',
        'stylers': [{
            'visibility': 'on'
        }]
    }, {
        'featureType': 'poi.business',
        'elementType': 'geometry.fill',
        'stylers': [{
            'color': '#e4dfd9'
        }]
    }, {
        'featureType': 'poi.business',
        'elementType': 'labels.icon',
        'stylers': [{
            'visibility': 'off'
        }]
    }, {
        'featureType': 'poi.park',
        'elementType': 'geometry.fill',
        'stylers': [{
            'color': '#37bda2'
        }]
    }, {
        'featureType': 'road',
        'elementType': 'geometry.fill',
        'stylers': [{
            'color': '#84b09e'
        }]
    }, {
        'featureType': 'road',
        'elementType': 'geometry.stroke',
        'stylers': [{
            'color': '#fafeb8'
        }, {
            'weight': '1.25'
        }]
    }, {
        'featureType': 'road.highway',
        'elementType': 'labels.icon',
        'stylers': [{
            'visibility': 'off'
        }]
    }, {
        'featureType': 'water',
        'elementType': 'geometry.fill',
        'stylers': [{
            'color': '#5ddad6'
        }]
    }],
    light2StyleNoLabels: [{
        'elementType': 'geometry',
        'stylers': [{
            'hue': '#ff4400'
        }, {
            'saturation': -68
        }, {
            'lightness': -4
        }, {
            'gamma': 0.72
        }]
    }, {
        'featureType': 'road',
        'elementType': 'labels.icon'
    }, {
        'featureType': 'landscape.man_made',
        'elementType': 'geometry',
        'stylers': [{
            'hue': '#0077ff'
        }, {
            'gamma': 3.1
        }]
    }, {
        'featureType': 'water',
        'stylers': [{
            'hue': '#00ccff'
        }, {
            'gamma': 0.44
        }, {
            'saturation': -33
        }]
    }, {
        'featureType': 'poi.park',
        'stylers': [{
            'hue': '#44ff00'
        }, {
            'saturation': -23
        }]
    }, {
        'featureType': 'water',
        'elementType': 'labels.text.fill',
        'stylers': [{
            'hue': '#007fff'
        }, {
            'gamma': 0.77
        }, {
            'saturation': 65
        }, {
            'lightness': 99
        }]
    }, {
        'featureType': 'water',
        'elementType': 'labels.text.stroke',
        'stylers': [{
            'gamma': 0.11
        }, {
            'weight': 5.6
        }, {
            'saturation': 99
        }, {
            'hue': '#0091ff'
        }, {
            'lightness': -86
        }]
    }, {
        'featureType': 'transit.line',
        'elementType': 'geometry',
        'stylers': [{
            'lightness': -48
        }, {
            'hue': '#ff5e00'
        }, {
            'gamma': 1.2
        }, {
            'saturation': -23
        }]
    }, {
        'featureType': 'transit',
        'elementType': 'labels.text.stroke',
        'stylers': [{
            'saturation': -64
        }, {
            'hue': '#ff9100'
        }, {
            'lightness': 16
        }, {
            'gamma': 0.47
        }, {
            'weight': 2.7
        }]
    }, {
        'featureType': 'all',
        'elementType': 'labels.text.stroke',
        'stylers': [{
            'visibility': 'off'
        }]
    }, {
        'featureType': 'all',
        'elementType': 'labels.text.fill',
        'stylers': [{
            'visibility': 'off'
        }]
    }, {
        'featureType': 'all',
        'elementType': 'labels.icon',
        'stylers': [{
            'visibility': 'off'
        }]
    }],
    darkStyleNoLabels: [{
        'featureType': 'all',
        'elementType': 'labels.text.fill',
        'stylers': [{
            'visibility': 'off'
        }]
    }, {
        'featureType': 'all',
        'elementType': 'labels.text.stroke',
        'stylers': [{
            'visibility': 'off'
        }]
    }, {
        'featureType': 'all',
        'elementType': 'labels.icon',
        'stylers': [{
            'visibility': 'off'
        }]
    }, {
        'featureType': 'administrative',
        'elementType': 'geometry.fill',
        'stylers': [{
            'color': '#000000'
        }, {
            'lightness': 20
        }]
    }, {
        'featureType': 'administrative',
        'elementType': 'geometry.stroke',
        'stylers': [{
            'color': '#000000'
        }, {
            'lightness': 17
        }, {
            'weight': 1.2
        }]
    }, {
        'featureType': 'landscape',
        'elementType': 'geometry',
        'stylers': [{
            'color': '#000000'
        }, {
            'lightness': 20
        }]
    }, {
        'featureType': 'poi',
        'elementType': 'geometry',
        'stylers': [{
            'color': '#000000'
        }, {
            'lightness': 21
        }]
    }, {
        'featureType': 'road.highway',
        'elementType': 'geometry.fill',
        'stylers': [{
            'color': '#000000'
        }, {
            'lightness': 17
        }]
    }, {
        'featureType': 'road.highway',
        'elementType': 'geometry.stroke',
        'stylers': [{
            'color': '#000000'
        }, {
            'lightness': 29
        }, {
            'weight': 0.2
        }]
    }, {
        'featureType': 'road.arterial',
        'elementType': 'geometry',
        'stylers': [{
            'color': '#000000'
        }, {
            'lightness': 18
        }]
    }, {
        'featureType': 'road.local',
        'elementType': 'geometry',
        'stylers': [{
            'color': '#181818'
        }, {
            'lightness': 16
        }]
    }, {
        'featureType': 'transit',
        'elementType': 'geometry',
        'stylers': [{
            'color': '#000000'
        }, {
            'lightness': 19
        }]
    }, {
        'featureType': 'water',
        'elementType': 'geometry',
        'stylers': [{
            'lightness': 17
        }, {
            'color': '#525252'
        }]
    }],
    pGoStyleNoLabels: [{
        'featureType': 'landscape.man_made',
        'elementType': 'geometry.fill',
        'stylers': [{
            'color': '#a1f199'
        }]
    }, {
        'featureType': 'landscape.natural.landcover',
        'elementType': 'geometry.fill',
        'stylers': [{
            'color': '#37bda2'
        }]
    }, {
        'featureType': 'landscape.natural.terrain',
        'elementType': 'geometry.fill',
        'stylers': [{
            'color': '#37bda2'
        }]
    }, {
        'featureType': 'poi.attraction',
        'elementType': 'geometry.fill',
        'stylers': [{
            'visibility': 'on'
        }]
    }, {
        'featureType': 'poi.business',
        'elementType': 'geometry.fill',
        'stylers': [{
            'color': '#e4dfd9'
        }]
    }, {
        'featureType': 'poi.business',
        'elementType': 'labels.icon',
        'stylers': [{
            'visibility': 'off'
        }]
    }, {
        'featureType': 'poi.park',
        'elementType': 'geometry.fill',
        'stylers': [{
            'color': '#37bda2'
        }]
    }, {
        'featureType': 'road',
        'elementType': 'geometry.fill',
        'stylers': [{
            'color': '#84b09e'
        }]
    }, {
        'featureType': 'road',
        'elementType': 'geometry.stroke',
        'stylers': [{
            'color': '#fafeb8'
        }, {
            'weight': '1.25'
        }]
    }, {
        'featureType': 'road.highway',
        'elementType': 'labels.icon',
        'stylers': [{
            'visibility': 'off'
        }]
    }, {
        'featureType': 'water',
        'elementType': 'geometry.fill',
        'stylers': [{
            'color': '#5ddad6'
        }]
    }, {
        'featureType': 'all',
        'elementType': 'labels.text.stroke',
        'stylers': [{
            'visibility': 'off'
        }]
    }, {
        'featureType': 'all',
        'elementType': 'labels.text.fill',
        'stylers': [{
            'visibility': 'off'
        }]
    }, {
        'featureType': 'all',
        'elementType': 'labels.icon',
        'stylers': [{
            'visibility': 'off'
        }]
    }]
};

export function initStyles () {

    var styleNoLabels = new Google.maps.StyledMapType(mapStyles.noLabelsStyle, {
        name: 'No Labels'
    })
    map.googleMap.mapTypes.set('nolabels_style', styleNoLabels)

    var styleDark = new Google.maps.StyledMapType(mapStyles.darkStyle, {
        name: 'Dark'
    })
    map.googleMap.mapTypes.set('dark_style', styleDark)

    var styleLight2 = new Google.maps.StyledMapType(mapStyles.light2Style, {
        name: 'Light2'
    })
    map.googleMap.mapTypes.set('style_light2', styleLight2)

    var stylePgo = new Google.maps.StyledMapType(mapStyles.pGoStyle, {
        name: 'PokemonGo'
    })
    map.googleMap.mapTypes.set('style_pgo', stylePgo)

    var styleDarkNl = new Google.maps.StyledMapType(mapStyles.darkStyleNoLabels, {
        name: 'Dark (No Labels)'
    })
    map.googleMap.mapTypes.set('dark_style_nl', styleDarkNl)

    var styleLight2Nl = new Google.maps.StyledMapType(mapStyles.light2StyleNoLabels, {
        name: 'Light2 (No Labels)'
    })
    map.googleMap.mapTypes.set('style_light2_nl', styleLight2Nl)

    var stylePgoNl = new Google.maps.StyledMapType(mapStyles.pGoStyleNoLabels, {
        name: 'PokemonGo (No Labels)'
    })
    map.googleMap.mapTypes.set('style_pgo_nl', stylePgoNl)

    map.googleMap.setMapTypeId(Store.get('map_style'))
}

export function watchStyleChange() {

    map.googleMap.addListener('maptypeid_changed', function (s) {
        Store.set('map_style', this.mapTypeId)
    })
}

export function setStyle(mapStyle) {
    map.googleMap.setMapTypeId(mapStyle);
}