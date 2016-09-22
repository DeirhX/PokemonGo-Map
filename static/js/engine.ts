import {clearMemberMapData, Core} from "./data/entities";
import {members} from "./members/members";
import * as server from "./data/server";
import {map} from "./map/map";
import * as markers from "map/overlay/markers";
import {Store} from "./store";
import {pokemonSprites} from "./assets/sprites";
import {getColorByDate} from "./map/overlay/labels";
import {Spawn} from "./data/spawn";
import {createSpawnMarker} from "./map/overlay/markers";
import {countMarkers} from "./stats";
import {createPokemonMarker} from "./map/overlay/markers";

export var excludedPokemon = []

export function initialize() {
    members.MemberChanged.on((memberChange) => {
        "use strict";
        console.log("Member changed.");
        if (memberChange.previous && map.googleMap.getBounds()) {
            // Is already loaded with content?
            clearMemberMapData();
            updateMap(false);
        }
        function addLocationMarkers() {
            if (memberChange.current.locations) {
                for (let location of memberChange.current.locations) {
                    location.marker = markers.createLocationMarker(location);
                    Core.mapData.locations[location.id] = location;
                }
            }
        }

        if (map.googleMap.getBounds()) {
            addLocationMarkers();
        } else {
            map.onLoad(() => addLocationMarkers());
        }
    });
}

let updateQueue = [];
export function updateMap (incremental: boolean) {
    if (!incremental) {
        incremental = false;
    }
    function doRequest (doIncremental: boolean) {
        server.loadRawData(doIncremental)
            .done(result => {
                $.each(result.pokemons, processPokemons)
                $.each(result.pokestops, processPokestops)
                $.each(result.gyms, processGyms)
                $.each(result.scanned, processScanned)
                $.each(result.spawns, processSpawns)
                showInBoundsMarkers(Core.mapData.pokemons)
                showInBoundsMarkers(Core.mapData.lurePokemons)
                showInBoundsMarkers(Core.mapData.gyms)
                showInBoundsMarkers(Core.mapData.pokestops)
                showInBoundsMarkers(Core.mapData.scanned)
                showInBoundsMarkers(Core.mapData.spawnpoints)
                clearStaleMarkers()
                if ($("#stats").hasClass("visible")) {
                    countMarkers(Core.mapData);
                }
            })
            .then(() => {
                updateQueue.shift(); // Remove this from queue
                if (updateQueue.length > 0) { // Fire again if queued
                    doRequest(updateQueue[0]);
                }
            });
    }
    if (updateQueue.length > 15) {
        console.log(`Update queue too large! ${updateQueue.length} entries present.`);
        return; // Throw it away, queue too long
    }
    updateQueue.push(incremental);
    if (updateQueue.length === 1) { // Fire request only if the queue was empty
        doRequest(updateQueue[0]);
    }
}

export function clearStaleMarkers () {
    $.each(Core.mapData.pokemons, function (key, value) {
        if (Core.mapData.pokemons[key]['disappear_time'] < new Date().getTime() ||
            excludedPokemon.indexOf(Core.mapData.pokemons[key]['pokemon_id']) >= 0) {
            Core.mapData.pokemons[key].marker.delete()
            delete Core.mapData.pokemons[key];
        }
    })

    $.each(Core.mapData.lurePokemons, function (key, value) {
        if (Core.mapData.lurePokemons[key]['lure_expiration'] < new Date().getTime() ||
            excludedPokemon.indexOf(Core.mapData.lurePokemons[key]['pokemon_id']) >= 0) {
            Core.mapData.lurePokemons[key].marker.delete()
            delete Core.mapData.lurePokemons[key];
        }
    })

    $.each(Core.mapData.scanned, function (key, value) {
        // If older than 15mins remove
        if (Core.mapData.scanned[key]['last_update'] < (new Date().getTime() - 15 * 60 * 1000)) {
            Core.mapData.scanned[key].marker.delete()
            delete Core.mapData.scanned[key]
        } else {
            // Update color
            Core.mapData.scanned[key].marker.setColor(getColorByDate(Core.mapData.scanned[key]['last_update']));
        }
    });
}

export function showInBoundsMarkers (markers) {
    $.each(markers, function (key, value) {
        var marker = markers[key].marker
        var show = false
        if (!markers[key].hidden) {
            var bounds = marker.getBounds();
            if (bounds) {
                if (map.getBounds().intersects(marker.getBounds())) {
                    show = true
                }
            } else {
                var position = marker.getPosition();
                if (position) {
                    if (map.getBounds().contains(marker.getPosition())) {
                        show = true
                    }
                }
            }
        }

        if (show && !marker.isShown()) {
            marker.show()
            // Not all markers can be animated (ex: scan locations)
            if (marker.canAnimate()) {
                marker.resumeAnimation();
            }
        } else if (!show && marker.isShown()) {
            // Not all markers can be animated (ex: scan locations)
            if (marker.canAnimate()) {
                marker.pauseAnimation();
            }
            marker.hide();
        }
    })
}


export function processPokemons (i, item) {
    if (!Store.get('showPokemon')) {
        return false // in case the checkbox was unchecked in the meantime.
    }

    if (!(item['encounter_id'] in Core.mapData.pokemons) &&
        excludedPokemon.indexOf(item['pokemon_id']) < 0) {
        // add marker to map and item to dict
        if (item.marker) {
            item.marker.hide()
        }
        if (!item.hidden) {
            item.marker = createPokemonMarker(item, pokemonSprites)
            Core.mapData.pokemons[item['encounter_id']] = item
        }
    }
}

export function processSpawns (i, rawItem) {
    if (!Store.get('showSpawnpoints')) {
        return false; // in case the checkbox was unchecked in the meantime.
    }
    let spawn = new Spawn(rawItem);

    if (!(spawn.id in Core.mapData.spawnpoints)) {
        // add marker to map and item to dict
        if (!rawItem.hidden) {
            createSpawnMarker(spawn, pokemonSprites);
            Core.mapData.spawnpoints[rawItem.id] = spawn;
        }
    }
}


export function processPokestops (i, item) {
    if (!Store.get('showPokestops')) {
        return false;
    }

    if (Store.get('showLuredPokestopsOnly') && !item['lure_expiration']) {
        if (Core.mapData.pokestops[item['pokestop_id']] && Core.mapData.pokestops[item['pokestop_id']].marker) {
            Core.mapData.pokestops[item['pokestop_id']].marker.hide()
            delete Core.mapData.pokestops[item['pokestop_id']]
        }
        return true;
    }

    if (!Core.mapData.pokestops[item['pokestop_id']]) { // add marker to map and item to dict
        // add marker to map and item to dict
        if (item.marker) {
            item.marker.hide();
        }
        item.marker = markers.createPokestopMarker(item)
        Core.mapData.pokestops[item['pokestop_id']] = item
    } else {
        var item2 = Core.mapData.pokestops[item['pokestop_id']]
        if (!!item['lure_expiration'] !== !!item2['lure_expiration']) {
            item2.marker.hide()
            item.marker = markers.createPokestopMarker(item)
            Core.mapData.pokestops[item['pokestop_id']] = item;
        }
    }
}

export function removePokemonMarker (encounterId) { // eslint-disable-line no-unused-vars
    Core.mapData.pokemons[encounterId].marker.hide()
    Core.mapData.pokemons[encounterId].hidden = true;
}

export function processGyms (i, item) {
    if (!Store.get('showGyms')) {
        return false; // in case the checkbox was unchecked in the meantime.
    }

    if (item['gym_id'] in Core.mapData.gyms) {
        item.marker = markers.updateGymMarker(item, Core.mapData.gyms[item['gym_id']].marker)
    } else { // add marker to map and item to dict
        item.marker = markers.createGymMarker(item);
    }
    Core.mapData.gyms[item['gym_id']] = item;
}

export function processScanned (i, item) {
    if (!Store.get('showScanned')) {
        return false
    }

    var scanId = item['latitude'] + '|' + item['longitude']

    if (scanId in Core.mapData.scanned) {
        Core.mapData.scanned[scanId].last_update = item['last_update']
        Core.mapData.scanned[scanId].marker.setColor(getColorByDate(item['last_update']));
    } else { // add marker to map and item to dict
        if (item.marker) {
            item.marker.hide()
        }
        item.marker = markers.createScannedMarker(item)
        Core.mapData.scanned[scanId] = item
    }
}


export function redrawPokemon (pokemonList) {
    var skipNotification = true
    $.each(pokemonList, function (key, value) {
        var item = pokemonList[key]
        if (!item.hidden) {
            var newMarker = markers.createPokemonMarker(item, pokemonSprites, skipNotification, this.marker.isAnimated())
            item.marker.hide()
            pokemonList[key].marker = newMarker;
        }
    });
}

export function updateAllSpawns() {
    var now = new Date();
    for (var spawnId in Core.mapData.spawnpoints) {
        var spawn = Core.mapData.spawnpoints[spawnId]
        spawn.update(now);
        markers.updateSpawnIcon(spawn);
    }
}

export function updateAllPokestopIcons() {
    for (var pokestopId in Core.mapData.pokestops) {
        markers.updatePokestopIcon(Core.mapData.pokestops[pokestopId]);
    }
}

