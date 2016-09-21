/// <reference path="../../../../typings/globals/jquery/index.d.ts" />
/// <reference path="../../../../typings/globals/googlemaps/index.d.ts" />


import core from "../core";
import {gymTypes} from "../../data/entities";
import * as labels from "./labels";
import * as utils from "../../utils";
import {getGoogleSprite} from "../../utils";
import {Store} from "../../store";
import {sendNotification, playNotifySound, notifiedPokemon, notifiedRarity} from "../../notifications";
import LatLng = google.maps.LatLng;
import LatLngBounds = google.maps.LatLngBounds;
import * as sprites from "../../assets/sprites";
import {generateSpawnTooltip, updateSpawnTooltip, updateAllSpawnTooltips} from "../../interface/tooltip/spawntip";
import {updateAllLabelsDisappearTime} from "./labels";
import {SpawnState, ISpawn, ISpawnDetail, SpawnDetail} from "../../data/spawn";
import spawnBar from "../../interface/bar/spawnbar";
import {isTouchDevice} from "../../environment";
import {ILocation} from "../../members/location";

let infoWindowsOpen = [];
let highlightedMarker; // Global focused marker

export interface IMarker {
    isShown(): boolean;
    show();
    hide();
    delete();

    openWindow(overrideWindow?: google.maps.InfoWindow);
    closeWindow();
    toggleWindow(isOpen: boolean);
    setWindowContent(htmlContent: string);

    getBounds(): LatLngBounds;
    getPosition(): LatLng;
    setIcon(icon: string);
    setColor(color);
    setOpacity(opacity: number);

    onOpen(callback: () => void);
    onClick(callback: () => void);

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

    private listeners: google.maps.MapsEventListener[] = [];

    private marker: google.maps.Marker;
    private circle: google.maps.Circle;

    private mapObject: IMapObject;
    private infoWindow: google.maps.InfoWindow;

    private oldAnimation: google.maps.Animation;
    private persistWindow: boolean;
    private onOpenCallback: () => void;

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
    public onClick(callback: () => void) {
        this.listeners.push(this.marker.addListener("click", callback));
    }
    public onOpen(callback: () => void) {
        this.onOpenCallback = callback;
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
        this.listeners.push(this.marker.addListener("click", () => {
            if (!this.persistWindow) {
                this.openWindow();
                this.persistWindow = true;
            } else {
                this.closeWindow();
                this.persistWindow = false;
            }

            utils.clearSelection();
            if (this.onOpenCallback) {
                this.onOpenCallback();
            }
        }));

        this.listeners.push(core.google.maps.event.addListener(this.infoWindow, "closeclick", () => this.persistWindow = false));

        this.listeners.push(this.marker.addListener("mouseover", () => {
            this.openWindow();
            utils.clearSelection();
            if (this.onOpenCallback) {
                this.onOpenCallback();
            }
            highlightedMarker = this;
        }));

        this.listeners.push(this.marker.addListener("mouseout", () => {
            if (!this.persistWindow) {
                this.closeWindow();
            }
            highlightedMarker = null;
        }));
    }

    private unregisterPopupWindowListeners() {
        for (let listener of this.listeners) {
            listener.remove();
        }
    }
}

// --- Marker updators
export function updatePokestopIcon(pokestop) {
    pokestop.marker.setIcon(sprites.getPokestopIcon(pokestop));
}

export function updateSpawnIcon (spawn: ISpawn) {
    if (spawn.state === SpawnState.Spawning) {
        spawn.marker.setOpacity(1.0);
    } else {
        spawn.marker.setOpacity(0.3);
    }
}

export function updateGymMarker(item, marker) {
    marker.setIcon("static/forts/" + gymTypes[item.team_id] + ".png");
    marker.infoWindow.setContent(labels.gymLabel(gymTypes[item.team_id], item.team_id, item.gym_points, item.latitude, item.longitude));
    return marker;
}

// -- Marker creators

export function createGymMarker(item): Marker {
    let mapObject = new core.google.maps.Marker({
        position: {
            lat: item.latitude,
            lng: item.longitude,
        },
        zIndex: 5,
        map: core.map,
        icon: "static/forts/" + gymTypes[item.team_id] + ".png",
    });

    let infoWindow = new core.google.maps.InfoWindow({
        content: labels.gymLabel(gymTypes[item.team_id], item.team_id, item.gym_points, item.latitude, item.longitude),
        disableAutoPan: true,
    });
    let marker = new Marker(mapObject, infoWindow);
    marker.onOpen(updateAllLabelsDisappearTime);
    return marker;
}

export function createPokestopMarker (item): Marker {
    let mapObject = new core.google.maps.Marker({
        position: {
            lat: item.latitude,
            lng: item.longitude,
        },
        map: core.map,
        zIndex: 2,
    });
    mapObject.setIcon(sprites.getPokestopIcon(item));
    let infoWindow = new core.google.maps.InfoWindow({
        content: labels.pokestopLabel(item.lure_expiration, item.latitude, item.longitude),
        disableAutoPan: true,
    });
    let marker = new Marker(mapObject, infoWindow);
    marker.onClick(updateAllLabelsDisappearTime);
    return marker;
}

export function createSpawnMarker(item: ISpawn, pokemonSprites, skipNotification, isBounceDisabled): Marker {
    let mapObject = new core.google.maps.Marker({
        position: {
            lat: item.latitude,
            lng: item.longitude,
        },
        zIndex: 3,
        map: core.map,
        icon: {
            url: "static/images/spawn.png",
            size: new core.google.maps.Size(16, 16),
            anchor: new core.google.maps.Point(8, -8),
        },
    });

    mapObject.spawnData = item;

    let infoWindow = new core.google.maps.InfoWindow({
        content: labels.spawnLabel(item.id, item.latitude, item.longitude),
        disableAutoPan: true,
    });

    let marker = new Marker(mapObject, infoWindow);
    marker.onClick( () => {
        if (!isTouchDevice()) {
            spawnBar.open();
            spawnBar.stayOpenOnce();
        }
        if (item.detail) {
            spawnBar.displaySpawn(item.detail);
        }
    } );
    marker.onOpen( () => {
        updateAllLabelsDisappearTime();
    });

    item.marker = marker;
    updateSpawnIcon(item);

    infoWindow.addListener("domready", () => {
        $.ajax({
            url: "spawn_detail",
            type: "GET",
            data: {
                id: item.id,
            },
            dataType: "json",
            cache: false,
            complete: data => {
                if (highlightedMarker !== marker) {
                    return;
                }
                let spawnDetail = new SpawnDetail(item, data.responseJSON);

                // Initialize sidebar
                spawnBar.displaySpawn(spawnDetail);

                // Initialize tooltip
                let str = generateSpawnTooltip(spawnDetail);
                let $dom = $(str);
                let $root = $dom.find(".spawn-detail");
                $root.data("spawn", spawnDetail);
                $root.data("marker", mapObject);
                updateSpawnTooltip(spawnDetail, $root[0], true);
                let html = $dom.html();

                // Close 'loading' tooltip
                marker.closeWindow();
                let newInfoWindow = new core.google.maps.InfoWindow({
                    content: html,
                    disableAutoPan: true,
                });
                newInfoWindow.addListener("domready", element => {
                    /* var iwOuter = */
                    // Again since data items have been lost by using .html()
                    $(".gm-style-iw").find(".spawn-detail").each((index, el) => {
                        $(el).data("spawn", spawnDetail);
                        $(el).data("marker", mapObject);
                        // updateSpawnTooltip(spawnDetail, $(el), true);
                    });

                });
                marker.openWindow(newInfoWindow);
            },
        });
    });

    return marker;
}

export function createPokemonMarker(item, pokemonSprites, skipNotification, isBounceDisabled): Marker {
    // Scale icon size up with the map exponentially
    const iconSize = 2 + (core.map.getZoom() - 3) * (core.map.getZoom() - 3) * 0.2 + Store.get("iconSizeModifier");
    const pokemonIndex = item.pokemon_id - 1;
    const sprite = pokemonSprites[Store.get("pokemonIcons")] || pokemonSprites.highres;
    const icon = getGoogleSprite(pokemonIndex, sprite, iconSize);

    let mapObject = new core.google.maps.Marker({
        position: {
            lat: item.latitude,
            lng: item.longitude,
        },
        map: core.map,
        icon: icon,
        zIndex: 10,
        animationDisabled: isBounceDisabled === true,
    });

    let infoWindow = new core.google.maps.InfoWindow({
        content: labels.pokemonLabel(item.pokemon_name, item.pokemon_rarity, item.pokemon_types, item.disappear_time, item.pokemon_id, item.latitude, item.longitude, item.encounter_id),
        disableAutoPan: true,
    });

    if (notifiedPokemon.indexOf(item.pokemon_id) > -1 || notifiedRarity.indexOf(item.pokemon_rarity) > -1) {
        if (!skipNotification) {
            if (Store.get("playSound")) {
                playNotifySound();
            }
            sendNotification("A wild " + item.pokemon_name + " appeared!", "Click to load map", "static/icons/" + item.pokemon_id + ".png", item.latitude, item.longitude);
        }
        if (mapObject.animationDisabled !== true) {
            mapObject.setAnimation(core.google.maps.Animation.BOUNCE);
        }
    }

    let marker = new Marker(mapObject, infoWindow);
    marker.onOpen(updateAllLabelsDisappearTime);
    marker.onClick(() => {
        marker.stopAnimation();
    })
    return marker;
}

export function createScannedMarker (item): Marker {
    const circleCenter = new core.google.maps.LatLng(item.latitude, item.longitude);

    let marker = new core.google.maps.Circle({
        map: core.map,
        center: circleCenter,
        radius: 70, // metres
        fillColor: labels.getColorByDate(item.last_update),
        strokeWeight: 1,
        zIndex: 1,
        clickable: false,
    });

    return new Marker(marker, null);
}

export function createLocationMarker (location: ILocation): Marker {

    let mapObject = new core.google.maps.Marker({
        position: {
            lat: location.latitude,
            lng: location.longitude,
        },
        map: core.map,
        zIndex: 2,
    });
    let infoWindow = new core.google.maps.InfoWindow({
        content: labels.locationLabel(location.name, location.latitude, location.longitude),
        disableAutoPan: true,
    });
    return new Marker(mapObject, infoWindow);
}
