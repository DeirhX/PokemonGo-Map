/// <reference path="../../../../typings/globals/jquery/index.d.ts" />
/// <reference path="../../../../typings/globals/googlemaps/index.d.ts" />


import core from "../core";
import {gymTypes, updateSpawnCycle, fastForwardSpawnTimes} from "../../data/entities";
import * as labels from "./labels";
import * as utils from "../../utils";
import {getGoogleSprite} from "../../utils";
import {Store} from "../../store";
import {pad} from "../../utils";
import {sendNotification, playNotifySound, notifiedPokemon, notifiedRarity} from "../../notifications";
import {updateDisappearTime} from "./labels";
import LatLng = google.maps.LatLng;
import LatLngBounds = google.maps.LatLngBounds;

let infoWindowsOpen = [];
let highlightedMarker;

interface IMarker {
    openWindow();
    closeWindow();
    toggleWindow(isOpen: boolean);
    isShown(): boolean;
    show();
    hide();
    setColor(color);
    getBounds(): LatLngBounds;
    getPosition(): LatLng;

    canAnimate(): boolean;
    isAnimated(): boolean;
    setAnimation(animation: google.maps.Animation);
    startAnimation(animation: google.maps.Animation);
    pauseAnimation();
    stopAnimation();
    resumeAnimation();
}

interface IMapObject {
    setMap(map: google.maps.Map);
}

class Marker implements IMarker {

    private marker: google.maps.Marker;
    private circle: google.maps.Circle;

    private mapObject: IMapObject;
    private infoWindow: google.maps.InfoWindow;

    private oldAnimation: googlem.maps.Animation;

    constructor(marker: google.maps.Marker, infoWindow: google.maps.InfoWindow) {
        this.marker = marker;
        this.mapObject = marker;
        this.infoWindow = infoWindow;
    }
    constructor(circle: google.maps.Circle, infoWindow: google.maps.InfoWindow) {
        this.circle = circle;
        this.mapObject = circle;
        this.infoWindow = infoWindow;
    }
    public openWindow() { this.toggleWindow(true); }
    public closeWindow() { this.toggleWindow(false); };
    public toggleWindow(isOpen: boolean) {
        for (let i = 0; i < infoWindowsOpen.length; ++i) {
            infoWindowsOpen[i].close();
            if (infoWindowsOpen[i] === this.infoWindow) {
                // wasOpen = true;
            }
        }

        infoWindowsOpen = [];
        if (isOpen) {
            this.infoWindow.open(core.map, this.marker);
            infoWindowsOpen.push(this.infoWindow);
        } else if (this.infoWindow) {
            this.infoWindow.close();
        }
    }
    public show() {
        this.marker.setMap(core.map);
    }
    public hide() {
        this.marker.setMap(null);
    }
    public isShown(): boolean {
        return !!this.marker.getMap();
    }
    public setColor(color) {
        if (!this.circle) {
            throw "Can chance color only of polygons";
        }
        this.circle.setOptions({
            fillColor: color,
        });
    }
    public getPosition(): LatLng {
        if (this.marker) {
            return this.marker.getPosition();
        }
        return null;
    }
    public getBounds(): LatLngBounds {
        if (this.circle) {
            return this.circle.getBounds();
        }
        return null;
    }
    public canAnimate(): boolean {
        return !!this.marker;
    }
    public isAnimated(): boolean {
        if (!this.marker) {
            throw "Cannot animate this";
        }
        return !!this.marker.getAnimation();
    }
    public setAnimation(animation: google.maps.Animation) {
        if (!this.marker) {
            throw "Cannot animate this";
        }
        this.oldAnimation = animation;
    }
    public startAnimation(animation: google.maps.Animation)
    {
        if (!this.marker) {
            throw "Cannot animate this";
        }
        this.marker.setAnimation(animation);
    }
    public stopAnimation() {
        if (!this.marker) {
            throw "Cannot animate this";
        }
        this.oldAnimation = null;
        this.marker.setAnimation(null);
    }
    public pauseAnimation() {
        if (!this.marker) {
            throw "Cannot animate this";
        }
        this.oldAnimation = this.marker.getAnimation();
        this.marker.setAnimation(null);
    }
    public resumeAnimation() {
        if (!this.marker) {
            throw "Cannot animate this";
        }
        this.marker.setAnimation(this.oldAnimation);
    }
}

export function updateAllLabelsDiffTime() {
    $(".label-countdown").each((index, element) => {
        if (!$(element).hasClass("disabled")) {
            updateDisappearTime(element);
        }
    });
};

function addMarkerListeners(marker) {
    marker.addListener("click", () => {
        if (!marker.persist) {
            openMarkerWindow(marker);
            marker.persist = true;
        } else {
            closeMarkerWindow(marker);
            marker.persist = false;
        }

        utils.clearSelection();
        updateAllLabelsDiffTime();
    });

    core.google.maps.event.addListener(marker.infoWindow, "closeclick", () => marker.persist = null)

    marker.addListener("mouseover", () => {
        openMarkerWindow(marker);
        utils.clearSelection()
        updateAllLabelsDiffTime();
        highlightedMarker = marker;
    })

    marker.addListener("mouseout", function () {
        if (!marker.persist) {
            closeMarkerWindow(marker.infoWindow);
        }
        highlightedMarker = null
    })

    return marker
}

export function setupGymMarker(item) {
    let marker = new core.google.maps.Marker({
        position: {
            lat: item["latitude"],
            lng: item["longitude"],
        },
        zIndex: 5,
        map: core.map,
        icon: "static/forts/" + gymTypes[item["team_id"]] + ".png"
    })

    marker.infoWindow = new core.google.maps.InfoWindow({
        content: labels.gymLabel(gymTypes[item["team_id"]], item["team_id"], item["gym_points"], item["latitude"], item["longitude"]),
        disableAutoPan: true,
    })

    addMarkerListeners(marker)
    return marker;
}

function getPokestopIcon(item) {
    var isLured = item["lure_expiration"] && item["lure_expiration"] > new Date().getTime()
    var imagename = isLured ? "PstopLured" : "Pstop"
    return "static/forts/" + imagename + ".png"
}

export function setupPokestopMarker (item) {
    var marker = new core.google.maps.Marker({
        position: {
            lat: item["latitude"],
            lng: item["longitude"]
        },
        map: core.map,
        zIndex: 2,
    })
    marker.setIcon(getPokestopIcon(item))
    marker.infoWindow = new core.google.maps.InfoWindow({
        content: labels.pokestopLabel(item["lure_expiration"], item["latitude"], item["longitude"]),
        disableAutoPan: true
    })

    addMarkerListeners(marker)
    return marker;
}

export var updatePokestopIcon = function (pokestop) {
    var currentIcon = pokestop.marker.getIcon()
    var newIcon = getPokestopIcon(pokestop)
    if (newIcon !== currentIcon) {
        pokestop.marker.setIcon(newIcon);
    }
};

export function updateSpawnIcon (spawn) {
    fastForwardSpawnTimes(spawn);
    if (new Date() >= spawn.appearsAt && new Date() <= spawn.disappearsAt) {
        spawn.marker.setOpacity(1.0);
    } else {
        spawn.marker.setOpacity(0.3);
    }
};

export function updateGymMarker(item, marker) {
    marker.setIcon("static/forts/" + gymTypes[item["team_id"]] + ".png")
    marker.infoWindow.setContent(labels.gymLabel(gymTypes[item["team_id"]], item["team_id"], item["gym_points"], item["latitude"], item["longitude"]))
    return marker;
}


export function setupSpawnMarker(item, pokemonSprites, skipNotification, isBounceDisabled) {
    let marker = new core.google.maps.Marker({
        position: {
            lat: item.latitude,
            lng: item.longitude,
        },
        zIndex: 3,
        map: core.map,
        icon: 'static/images/spawn-tall.png'
    });

    marker.spawnData = item;
    item.marker = marker;
    item.appearsAt = new Date(item.last_appear);
    item.disappearsAt = new Date(item.last_disappear);
    updateSpawnIcon(item);

    let infoWindow = new core.google.maps.InfoWindow({
        content: labels.spawnLabel(item.id, item.latitude, item.longitude),
        disableAutoPan: true,
    });
    infoWindow.addListener('domready', function () {
        $.ajax({
            url: "spawn_detail",
            type: 'GET',
            data: {
                'id': item.id
            },
            dataType: "json",
            cache: false,
            complete: function (data) {
                if (highlightedMarker !== marker) {
                    return
                }
                if (data && data.responseJSON && data.responseJSON['rank'] && data.responseJSON['chances']) {
                    item.rank = data.responseJSON['rank'];
                    var rankChanceMod = 1 - (0.75 / item.rank);
                    // var percentHtml = "";
                    // var iconHtml = "";
                    var table = "";
                    data.responseJSON['chances'].sort(function (a, b) {
                        return ((a.chance < b.chance) ? +1 : ((a.chance > b.chance) ? -1 : 0));
                    });
                    var maxEntries = 5
                    for (var i = 0; i < Math.min(data.responseJSON['chances'].length, maxEntries); ++i) {
                        var entry = data.responseJSON['chances'][i];
                        var pokemonIndex = entry.pokemon_id - 1;
                        var sprite = pokemonSprites[Store.get('pokemonIcons')] || pokemonSprites['highres']
                        var iconSize = 32;
                        var icon = getGoogleSprite(pokemonIndex, sprite, iconSize);
                        table += `
          <span class="spawn-entry"><div><a href='http://www.pokemon.com/us/pokedex/${entry.pokemon_id}' target='_blank' title='View in Pokedex'>
              <icon style='width: ${icon.size.width}px; height: ${icon.size.height}px; background-image: url("${icon.url}"); 
              background-size: ${icon.scaledSize.width}px ${icon.scaledSize.height}px; background-position: -${icon.origin.x}px -${icon.origin.y}px; background-repeat: no-repeat;'></icon></a>
          </div><div class="chance">${Math.round(entry.chance * rankChanceMod)}%</div></span>`;
                        // <span>${entry.chance}%</span>
                    }
                    var despawnTime = new Date(data.responseJSON['despawn']);
                    var spawnTime = new Date(data.responseJSON['spawn']);
                    var str = `
           <div>
             <div class="spawn-window">
              <div>
                <div class="header">Most likely to appear:</div>
                <div class="spawn-table">
                  ${table}
                </div>
              </div>
              
              <div class="spawn-timing">
                  <div class="spawn-inactive" spawns-at='${spawnTime.getTime()}'>
                      Next spawn at: 
                      <span class='label-nextspawn'>${pad(spawnTime.getHours(), 2)}:${pad(spawnTime.getMinutes(), 2)}:${pad(spawnTime.getSeconds(), 2)}</span> 
                      <span class='label-countdown appear-countdown' disappears-at='${spawnTime.getTime()}'>(00m00s)</span>
                  </div>
                  <div class="spawn-active" despawns-at='${despawnTime.getTime()}'>
                      Disappears in: 
                      <span class='label-countdown disappear-countdown' disappears-at='${despawnTime.getTime()}'>(00m00s)</span>
                  </div>
              </div>
              <div>
                <a href='https://www.google.com/maps/dir/Current+Location/${item.latitude},${item.longitude}' target='_blank' title='View in Maps'>Get directions</a>
              </div>
             </div>
            </div>`;
                } else {
                    str = "Error retrieving data";
                }

                var $dom = $(str);
                $dom.data('spawn', item);
                $dom.data('marker', marker);
                updateSpawnCycle($dom, true);
                var html = $dom.html();

                closeMarkerWindow(marker.infoWindow);
                infoWindow = new core.google.maps.InfoWindow({
                    content: html,
                    disableAutoPan: true
                });
                infoWindow.addListener('domready', function (element) {
                    /* var iwOuter = */
                    $('.gm-style-iw').find('.spawn-timing').each(function (index, element) {
                        $(element).data('spawn', item);
                        $(element).data('marker', marker);
                        updateSpawnCycle(element);
                    });
                });
                openMarkerWindow(marker);
            }
        });
    });

    addMarkerListeners(marker);
    return marker;
}

export function setupPokemonMarker(item, pokemonSprites, skipNotification, isBounceDisabled) {
    // Scale icon size up with the map exponentially
    var iconSize = 2 + (core.map.getZoom() - 3) * (core.map.getZoom() - 3) * 0.2 + Store.get('iconSizeModifier')
    var pokemonIndex = item['pokemon_id'] - 1
    var sprite = pokemonSprites[Store.get('pokemonIcons')] || pokemonSprites['highres']
    var icon = getGoogleSprite(pokemonIndex, sprite, iconSize)

    var marker = new core.google.maps.Marker({
        position: {
            lat: item['latitude'],
            lng: item['longitude']
        },
        map: core.map,
        icon: icon,
        zIndex: 10,
        animationDisabled: isBounceDisabled === true,
    })

    marker.addListener('click', function () {
        this.setAnimation(null)
        this.animationDisabled = true
    })

    marker.infoWindow = new core.google.maps.InfoWindow({
        content: labels.pokemonLabel(item['pokemon_name'], item['pokemon_rarity'], item['pokemon_types'], item['disappear_time'], item['pokemon_id'], item['latitude'], item['longitude'], item['encounter_id']),
        disableAutoPan: true
    })

    if (notifiedPokemon.indexOf(item['pokemon_id']) > -1 || notifiedRarity.indexOf(item['pokemon_rarity']) > -1) {
        if (!skipNotification) {
            if (Store.get('playSound')) {
                playNotifySound();
            }
            sendNotification('A wild ' + item['pokemon_name'] + ' appeared!', 'Click to load map', 'static/icons/' + item['pokemon_id'] + '.png', item['latitude'], item['longitude'])
        }
        if (marker.animationDisabled !== true) {
            marker.setAnimation(core.google.maps.Animation.BOUNCE)
        }
    }

    addMarkerListeners(marker)
    return marker
}



export function getColorByDate (value) {
    // Changes the color from red to green over 15 mins
    var diff = (Date.now() - value) / 1000 / 60 / 15

    if (diff > 1) {
        diff = 1
    }

    // value from 0 to 1 - Green to Red
    var hue = ((1 - diff) * 120).toString(10)
    return ['hsl(', hue, ',100%,50%)'].join('')
}

export function setupScannedMarker (item) {
    var circleCenter = new core.google.maps.LatLng(item['latitude'], item['longitude'])

    var marker = new core.google.maps.Circle({
        map: core.map,
        center: circleCenter,
        radius: 60, // metres
        fillColor: getColorByDate(item['last_update']),
        strokeWeight: 1,
        zIndex: 1,
        clickable: false,
    })

    return marker;
}