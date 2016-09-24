/// <reference path="../../../../typings/globals/jquery/index.d.ts" />
/// <reference path="../../../../typings/globals/googlemaps/index.d.ts" />


import {gymTypes, IPokestop, IGym, IPokemon, IScannedCell} from "../../data/entities";
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
import {core} from "../../core/base";
import {ILiteEvent, LiteEvent} from "../../core/events";

let infoWindowsOpen = [];
let highlightedMarker; // Global focused marker

export interface IMarker {
    onOpen: ILiteEvent<void>;
    onClick: ILiteEvent<void>;

    isShown(): boolean;
    show();
    hide();
    destroy();

    openWindow(overrideWindow?: google.maps.InfoWindow);
    closeWindow();
    toggleWindow(isOpen: boolean);
    setWindowContent(htmlContent: string);

    getBounds(): LatLngBounds;
    getPosition(): LatLng;
    setIcon(icon: string);
    setColor(color);
    setOpacity(opacity: number);

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

/*
export class MarkerInfoWindow {
    public get onOpen(): ILiteEvent<void> { return this.onOpenEvent; }

    private nativeObject: google.maps.InfoWindow;
    private onOpenEvent: LiteEvent<void>;

    public setHtmlContent(htmlContent: string) {
        this.nativeObject.setContent(htmlContent);
    }
}*/

export abstract class MapMarker {
    public hidden: boolean;
    public get onOpen(): ILiteEvent<void> { return this.eventOnOpen; }
    public get onClick(): ILiteEvent<void> { return this.eventOnClick; }

    protected infoWindow: google.maps.InfoWindow;
    protected nativeObject: google.maps.MVCObject;

    private listeners: google.maps.MapsEventListener[] = [];
    private persistWindow: boolean;
    private eventOnOpen = new LiteEvent<void>();
    private eventOnClick = new LiteEvent<void>();

    constructor(nativeObj: google.maps.MVCObject, infoWindow: google.maps.InfoWindow) {
        this.nativeObject = nativeObj;
        this.infoWindow = infoWindow;
        this.registerPopupWindowListeners();
        this.listeners.push(this.nativeObject.addListener("click", () => this.eventOnClick.fire()));
    }

    public show(): void {
        this.hidden = false;
    }
    public hide(): void {
        this.hidden = true;
    }
    public destroy(): void {
        this.hide();
        this.unregisterPopupWindowListeners();
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
            this.infoWindow.open(core.map.googleMap, this.nativeObject);
            infoWindowsOpen.push(this.infoWindow);
        } else if (this.infoWindow) {
            this.infoWindow.close();
        }
    }

    public setWindowContent(htmlContent: string) {
        this.infoWindow.setContent(htmlContent);
    }

    private registerPopupWindowListeners() {
        if (!this.infoWindow) {
            return;
        }
        this.listeners.push(this.nativeObject.addListener("click", () => {
            if (!this.persistWindow) {
                this.openWindow();
                this.persistWindow = true;
            } else {
                this.closeWindow();
                this.persistWindow = false;
            }

            utils.clearSelection();
            this.eventOnOpen.fire();
        }));

        this.listeners.push(google.maps.event.addListener(this.infoWindow, "closeclick", () => this.persistWindow = false));

        this.listeners.push(this.nativeObject.addListener("mouseover", () => {
            this.openWindow();
            utils.clearSelection();
            this.eventOnOpen.fire();
            highlightedMarker = this;
        }));

        this.listeners.push(this.nativeObject.addListener("mouseout", () => {
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

export class Marker extends MapMarker implements IMarker {

    private marker: google.maps.Marker;
    private circle: google.maps.Circle;

    private mapObject: IMapObject;

    private oldAnimation: google.maps.Animation;

    constructor(marker: google.maps.Marker, infoWindow: google.maps.InfoWindow);
    constructor(circle: google.maps.Circle, infoWindow: google.maps.InfoWindow);
    constructor(mapObject: IMapObject, infoWindow: google.maps.InfoWindow) {
        let marker: google.maps.Marker;
        let circle: google.maps.Circle;
        let nativeObject: google.maps.MVCObject;
        if (mapObject instanceof google.maps.Marker) {
            marker = <google.maps.Marker> mapObject;
            nativeObject = marker;
        } else if (mapObject instanceof google.maps.Circle) {
            circle = <google.maps.Circle> mapObject;
            nativeObject = circle;
        } else {
            throw "Not supported";
        }
        super(nativeObject, infoWindow);
        this.marker = marker;
        this.circle = circle;
        this.mapObject = mapObject;
        this.infoWindow = infoWindow;
    }


    public show() {
        super.show();
        this.mapObject.setMap(core.map.googleMap);
    }
    public hide() {
        super.hide();
        this.mapObject.setMap(null);
    }
    public destroy() {
        super.destroy();
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
}

class Circle {

}

class LocationMarker extends Marker {
    private range;

    constructor(marker: google.maps.Marker, infoWindow: google.maps.InfoWindow) {
        super(marker, infoWindow);
    }
}

// --- Marker updators
export function updatePokestopIcon(pokestop: IPokestop) {
    pokestop.marker.setIcon(sprites.getPokestopIcon(pokestop));
}

export function updateSpawnIcon (spawn: ISpawn) {
    if (spawn.state === SpawnState.Spawning) {
        spawn.marker.setOpacity(1.0);
    } else {
        spawn.marker.setOpacity(0.3);
    }
}

export function updateGymMarker(item: IGym, marker) {
    marker.setIcon("static/forts/" + gymTypes[item.team_id] + ".png");
    marker.infoWindow.setContent(labels.gymLabel(gymTypes[item.team_id], item.team_id, item.gym_points, item.latitude, item.longitude));
    return marker;
}

// -- Marker creators

export function createGymMarker(item: IGym): Marker {
    let mapObject = new google.maps.Marker({
        position: {
            lat: item.latitude,
            lng: item.longitude,
        },
        zIndex: 5,
        map: core.map.googleMap,
        icon: "static/forts/" + gymTypes[item.team_id] + ".png",
    });

    let infoWindow = new google.maps.InfoWindow({
        content: labels.gymLabel(gymTypes[item.team_id], item.team_id, item.gym_points, item.latitude, item.longitude),
        disableAutoPan: true,
    });
    let marker = new Marker(mapObject, infoWindow);
    marker.onOpen.on(updateAllLabelsDisappearTime);
    return marker;
}

export function createPokestopMarker (item: IPokestop): Marker {
    let mapObject = new google.maps.Marker({
        position: {
            lat: item.latitude,
            lng: item.longitude,
        },
        map: core.map.googleMap,
        zIndex: 2,
    });
    mapObject.setIcon(sprites.getPokestopIcon(item));
    let infoWindow = new google.maps.InfoWindow({
        content: labels.pokestopLabel(item.lure_expiration, item.latitude, item.longitude),
        disableAutoPan: true,
    });
    let marker = new Marker(mapObject, infoWindow);
    marker.onClick.on(updateAllLabelsDisappearTime);
    return marker;
}

export function createSpawnMarker(item: ISpawn): Marker {
    let mapObject = new google.maps.Marker({
        position: {
            lat: item.latitude,
            lng: item.longitude,
        },
        zIndex: 3,
        map: core.map.googleMap,
        icon: {
            url: "static/images/spawn.png",
            size: new google.maps.Size(16, 16),
            anchor: new google.maps.Point(8, -8),
        },
    });

    // mapObject.spawnData = item;

    let infoWindow = new google.maps.InfoWindow({
        content: labels.spawnLabel(item.id, item.latitude, item.longitude),
        disableAutoPan: true,
    });

    let marker = new Marker(mapObject, infoWindow);
    marker.onClick.on( () => {
        if (!isTouchDevice()) {
            spawnBar.open();
            spawnBar.stayOpenOnce();
        }
        if (item.detail) {
            spawnBar.displaySpawn(item.detail);
        }
    } );
    marker.onOpen.on( () => {
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
                let newInfoWindow = new google.maps.InfoWindow({
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

export function createPokemonMarker(item: IPokemon, pokemonSprites: any, skipNotification?: boolean, isBounceDisabled?: boolean): Marker {
    // Scale icon size up with the map exponentially
    const iconSize = 2 + (core.map.googleMap.getZoom() - 3) * (core.map.googleMap.getZoom() - 3) * 0.2 + Store.get("iconSizeModifier");
    const pokemonIndex = item.pokemon_id - 1;
    const sprite = pokemonSprites[Store.get("pokemonIcons")] || pokemonSprites.highres;
    const icon = getGoogleSprite(pokemonIndex, sprite, iconSize);

    let mapObject = new google.maps.Marker({
        position: {
            lat: item.latitude,
            lng: item.longitude,
        },
        map: core.map.googleMap,
        icon: icon,
        zIndex: 10,
    });

    let infoWindow = new google.maps.InfoWindow({
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
        if (isBounceDisabled === true) {
            mapObject.setAnimation(google.maps.Animation.BOUNCE);
        }
    }

    let marker = new Marker(mapObject, infoWindow);
    marker.onOpen.on(updateAllLabelsDisappearTime);
    marker.onClick.on(() => {
        marker.stopAnimation();
    })
    return marker;
}

export function createScannedMarker (item: IScannedCell): Marker {
    const circleCenter = new google.maps.LatLng(item.latitude, item.longitude);

    let marker = new google.maps.Circle({
        map: core.map.googleMap,
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

    let mapObject = new google.maps.Marker({
        position: {
            lat: location.latitude,
            lng: location.longitude,
        },
        map: core.map.googleMap,
        zIndex: 2,
    });
    let infoWindow = new google.maps.InfoWindow({
        content: labels.locationLabel(location),
        disableAutoPan: true,
    });
    let marker = new Marker(mapObject, infoWindow);
    let rangeMarker = createLocationRangeMarker(location);
    rangeMarker.hide();
    marker.onClick.on(() => {
            if (rangeMarker.hidden) {
                rangeMarker.show();
            } else {
                rangeMarker.hide();
            }
        });
    return marker;
}

export function createLocationRangeMarker (location: ILocation): Marker {
    const circleCenter = new google.maps.LatLng(location.latitude, location.longitude);

    let marker = new google.maps.Circle({
        map: core.map.googleMap,
        center: circleCenter,
        radius: 70 * ((location.size * 2) - 1) * 0.7, // metres
        fillColor: 'hsl(50,100%,50%)',
        strokeWeight: 1,
        zIndex: 1,
        clickable: false,
    });

    return new Marker(marker, null);
}
