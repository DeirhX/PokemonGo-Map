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
import * as sprites from "../../assets/sprites";

let infoWindowsOpen = [];
let highlightedMarker; // Global focused marker

export interface IMarker {
    delete();
    openWindow(overrideWindow?: google.maps.InfoWindow);
    closeWindow();
    toggleWindow(isOpen: boolean);
    setWindowContent(htmlContent: string);
    isShown(): boolean;
    show();
    hide();
    setIcon(icon: string);
    setColor(color);
    setOpacity(opacity: number);
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
    setMap(map: google.maps.Map|google.maps.StreetViewPanorama);
    getMap(): google.maps.Map|google.maps.StreetViewPanorama;
    // setOpacity(opacity: number);
    addListener(name: string, callback);
}

export class Marker implements IMarker {

    private static Listeners = class {
        public click: google.maps.MapsEventListener;
        public closeClick: google.maps.MapsEventListener;
        public mouseOver: google.maps.MapsEventListener;
        public mouseOut: google.maps.MapsEventListener;
    };
    private listeners = new Marker.Listeners();

    private marker: google.maps.Marker;
    private circle: google.maps.Circle;

    private mapObject: IMapObject;
    private infoWindow: google.maps.InfoWindow;

    private oldAnimation: google.maps.Animation;

    private persistWindow: boolean;

    constructor(marker: google.maps.Marker, infoWindow: google.maps.InfoWindow);
    constructor(circle: google.maps.Circle, infoWindow: google.maps.InfoWindow);
    constructor(mapObject: IMapObject, infoWindow: google.maps.InfoWindow) {
        if (mapObject instanceof google.maps.Marker) {
            this.marker = <google.maps.Marker> mapObject;
        } else if (mapObject instanceof google.maps.Circle) {
            this.circle = <google.maps.Circle> mapObject;
        } else {
            throw "Not supported";
        }
        this.mapObject = mapObject;
        this.infoWindow = infoWindow;
        this.registerPopupWindowListeners();
    }

    public openWindow(overrideWindow?: google.maps.InfoWindow) {
        if (overrideWindow) {
            this.infoWindow = overrideWindow;
        }
        this.toggleWindow(true);
    }
    public closeWindow() { this.toggleWindow(false); };
    public toggleWindow(isOpen: boolean) {
        if (!this.infoWindow) { return; }

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
    public setWindowContent(htmlContent: string) {
        this.infoWindow.setContent(htmlContent);
    }
    public show() {
        this.mapObject.setMap(core.map);
    }
    public hide() {
        this.mapObject.setMap(null);
    }
    public delete() {
        this.unregisterPopupWindowListeners();
        this.hide();
    }
    public isShown(): boolean {
        return this.mapObject.getMap() != null;
    }
    public setIcon(icon: string) {
        if (!this.marker) {
            throw "Not implemented";
        }
        this.marker.setIcon(icon);
    }
    public setColor(color) {
        if (!this.circle) {
            throw "Can change color only of polygons";
        }
        this.circle.setOptions({
            fillColor: color,
        });
    }
    public setOpacity(opacity: number) {
        if (!this.marker) {
            throw "Not implemented";
        }
        this.marker.setOpacity(opacity);
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
    public startAnimation(animation: google.maps.Animation) {
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

    private registerPopupWindowListeners() {
        if (!this.infoWindow) {
            return;
        }
        this.listeners.click = this.marker.addListener("click", () => {
            if (!this.persistWindow) {
                this.openWindow();
                this.persistWindow = true;
            } else {
                this.closeWindow();
                this.persistWindow = false;
            }

            utils.clearSelection();
            updateAllLabelsDiffTime();
        });

        this.listeners.closeClick = core.google.maps.event.addListener(this.infoWindow, "closeclick", () => this.persistWindow = false)

        this.listeners.mouseOver = this.marker.addListener("mouseover", () => {
            this.openWindow();
            utils.clearSelection();
            updateAllLabelsDiffTime();
            highlightedMarker = this;
        });

        this.listeners.mouseOut = this.marker.addListener("mouseout", () => {
            if (!this.persistWindow) {
                this.closeWindow();
            }
            highlightedMarker = null;
        });
    }

    private unregisterPopupWindowListeners() {
        if (!this.infoWindow) {
            return;
        }
        this.listeners.click.remove();
        this.listeners.closeClick.remove();
        this.listeners.mouseOver.remove();
        this.listeners.mouseOut.remove();
    }
}
// -- UTILS
export function updateAllLabelsDiffTime() {
    $(".label-countdown").each((index, element) => {
        if (!$(element).hasClass("disabled")) {
            updateDisappearTime(element);
        }
    });
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

// --- Marker updators

export function updatePokestopIcon(pokestop) {
    pokestop.marker.setIcon(sprites.getPokestopIcon(pokestop));
}

export function updateSpawnIcon (spawn) {
    fastForwardSpawnTimes(spawn);
    if (new Date() >= spawn.appearsAt && new Date() <= spawn.disappearsAt) {
        spawn.marker.setOpacity(1.0);
    } else {
        spawn.marker.setOpacity(0.3);
    }
}

export function updateGymMarker(item, marker) {
    marker.setIcon("static/forts/" + gymTypes[item["team_id"]] + ".png")
    marker.infoWindow.setContent(labels.gymLabel(gymTypes[item["team_id"]], item["team_id"], item["gym_points"], item["latitude"], item["longitude"]))
    return marker;
}

// -- Marker creators

export function createGymMarker(item): Marker {
    let mapObject = new core.google.maps.Marker({
        position: {
            lat: item["latitude"],
            lng: item["longitude"],
        },
        zIndex: 5,
        map: core.map,
        icon: "static/forts/" + gymTypes[item["team_id"]] + ".png"
    })

    let infoWindow = new core.google.maps.InfoWindow({
        content: labels.gymLabel(gymTypes[item["team_id"]], item["team_id"], item["gym_points"], item["latitude"], item["longitude"]),
        disableAutoPan: true,
    })
    let marker = new Marker(mapObject, infoWindow);
    return marker;
}

export function createPokestopMarker (item): Marker {
    var mapObject = new core.google.maps.Marker({
        position: {
            lat: item["latitude"],
            lng: item["longitude"]
        },
        map: core.map,
        zIndex: 2,
    })
    mapObject.setIcon(sprites.getPokestopIcon(item))
    let infoWindow = new core.google.maps.InfoWindow({
        content: labels.pokestopLabel(item["lure_expiration"], item["latitude"], item["longitude"]),
        disableAutoPan: true,
    })
    let marker = new Marker(mapObject, infoWindow);
    return marker;
}

export function createSpawnMarker(item, pokemonSprites, skipNotification, isBounceDisabled): Marker {
    let mapObject = new core.google.maps.Marker({
        position: {
            lat: item.latitude,
            lng: item.longitude,
        },
        zIndex: 3,
        map: core.map,
        icon: 'static/images/spawn-tall.png'
    });

    mapObject.spawnData = item;

    let infoWindow = new core.google.maps.InfoWindow({
        content: labels.spawnLabel(item.id, item.latitude, item.longitude),
        disableAutoPan: true,
    });

    let marker = new Marker(mapObject, infoWindow);
    item.marker = marker;
    item.appearsAt = new Date(item.last_appear);
    item.disappearsAt = new Date(item.last_disappear);
    updateSpawnIcon(item);

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
                    return;
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
                $dom.data('marker', mapObject);
                updateSpawnCycle($dom, true);
                var html = $dom.html();

                marker.closeWindow();
                let newInfoWindow = new core.google.maps.InfoWindow({
                    content: html,
                    disableAutoPan: true,
                });
                newInfoWindow.addListener('domready', function (element) {
                    /* var iwOuter = */
                    $('.gm-style-iw').find('.spawn-timing').each(function (index, element) {
                        $(element).data('spawn', item);
                        $(element).data('marker', mapObject);
                        updateSpawnCycle(element);
                    });
                });
                marker.openWindow(newInfoWindow);
            }
        });
    });

    return marker;
}

export function createPokemonMarker(item, pokemonSprites, skipNotification, isBounceDisabled): Marker {
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

    let infoWindow = new core.google.maps.InfoWindow({
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

    return new Marker(marker, infoWindow);
}

export function createScannedMarker (item): Marker {
    const circleCenter = new core.google.maps.LatLng(item['latitude'], item['longitude'])

    let marker = new core.google.maps.Circle({
        map: core.map,
        center: circleCenter,
        radius: 60, // metres
        fillColor: getColorByDate(item['last_update']),
        strokeWeight: 1,
        zIndex: 1,
        clickable: false,
    })

    return new Marker(marker, null);
}