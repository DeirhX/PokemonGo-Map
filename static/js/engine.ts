import {clearMemberMapData, Core, IPokemon, IPokestop, IScannedCell, IGym} from "./data/entities";
import * as server from "./data/server";
import * as markers from "map/overlay/markers";
import {Store} from "./store";
import {pokemonSprites} from "./assets/sprites";
import {getColorByDate} from "./map/overlay/labels";
import {Spawn} from "./data/spawn";
import {createSpawnMarker} from "./map/overlay/markers";
import {countMarkers} from "./stats";
import {createPokemonMarker} from "./map/overlay/markers";
import {core} from "./core/base";
import {ILocation} from "./members/location";
import {IMemberChanged} from "./members/members";

export var excludedPokemon = []

export function initialize() {

    // React to member change
    core.members.MemberChanged.on((memberChange) => {
        onMemberChanged(memberChange);
    });
    if (core.members.current) {
        onMemberChanged({ previous: null, current: core.members.current });
    }
}

function onMemberChanged(memberChange: IMemberChanged) {
    console.log("Member changed.");
    if (memberChange.previous && core.map.googleMap.getBounds()) {
        // Is already loaded with content?
        clearMemberMapData();
        updateMap(false);
    }

    if (core.map.isLoaded && memberChange.current && memberChange.current.locations) {
        addLocationMarkers(memberChange.current.locations);
    } else {
        core.map.onLoad(() => addLocationMarkers(memberChange.current.locations));
    }
}

let updateQueue = [];
export function updateMap (incremental: boolean) {
    if (!incremental) {
        incremental = false;
    }
    function doRequest (doIncremental: boolean) {
        server.loadRawData(doIncremental)
            .done(result => {
                $.each(result.pokemons, processPokemon)
                $.each(result.pokestops, processPokestop)
                $.each(result.gyms, processGym)
                $.each(result.scanned, processScannedCell)
                $.each(result.spawns, processSpawn)
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
    if (updateQueue.length > 10) {
        console.log(`Update queue too large! ${updateQueue.length} entries present. Clearing...`);
        updateQueue = [];
    }
    updateQueue.push(incremental);
    if (updateQueue.length === 1) { // Fire request only if the queue was empty
        doRequest(updateQueue[0]);
    }
}

export function clearStaleMarkers () {
    $.each(Core.mapData.pokemons, function (key, value) {
        if (Core.mapData.pokemons[key]['disappear_time'] < new Date().getTime()) {
            Core.mapData.pokemons[key].marker.destroy()
            delete Core.mapData.pokemons[key];
        }
    })

    $.each(Core.mapData.lurePokemons, function (key, value) {
        if (Core.mapData.lurePokemons[key]['lure_expiration'] < new Date().getTime() ||
            excludedPokemon.indexOf(Core.mapData.lurePokemons[key]['pokemon_id']) >= 0) {
            Core.mapData.lurePokemons[key].marker.destroy()
            delete Core.mapData.lurePokemons[key];
        }
    })

    $.each(Core.mapData.scanned, function (key, value) {
        // If older than 15mins remove
        if (Core.mapData.scanned[key].last_update < (new Date().getTime() - 15 * 60 * 1000)) {
            Core.mapData.scanned[key].marker.destroy()
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
                if (core.map.getBounds().intersects(marker.getBounds())) {
                    show = true;
                }
            } else {
                var position = marker.getPosition();
                if (position) {
                    if (core.map.getBounds().contains(marker.getPosition())) {
                        show = true;
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


export function processPokemon (i, item: IPokemon) {
    if (!Store.get('showPokemon')) {
        return false; // in case the checkbox was unchecked in the meantime.
    }

    if (!(item.encounter_id in Core.mapData.pokemons)) {
        // add marker to map and item to dict
        var isHidden = (excludedPokemon.indexOf(item.pokemon_id) !== -1);
        item.marker = createPokemonMarker(item, pokemonSprites, isHidden);
        Core.mapData.pokemons[item.encounter_id] = item;
        if (isHidden) {
            item.hidden = true;
            item.marker.hide();
        }
    }
}

export function processSpawn (i, rawItem) {
    if (!Store.get('showSpawnpoints')) {
        return false; // in case the checkbox was unchecked in the meantime.
    }
    let spawn = new Spawn(rawItem);

    if (!(spawn.id in Core.mapData.spawnpoints)) {
        // add marker to map and item to dict
        if (!rawItem.hidden) {
            createSpawnMarker(spawn);
            Core.mapData.spawnpoints[rawItem.id] = spawn;
        }
    }
}


export function processPokestop (i, item: IPokestop) {
    if (!Store.get('showPokestops')) {
        return false;
    }

    if (Store.get('showLuredPokestopsOnly') && !item.lure_expiration) {
        if (Core.mapData.pokestops[item.pokestop_id] && Core.mapData.pokestops[item.pokestop_id].marker) {
            Core.mapData.pokestops[item.pokestop_id].marker.hide()
            delete Core.mapData.pokestops[item.pokestop_id]
        }
        return true;
    }

    if (!Core.mapData.pokestops[item.pokestop_id]) { // add marker to map and item to dict
        // add marker to map and item to dict
        if (item.marker) {
            item.marker.hide();
        }
        item.marker = markers.createPokestopMarker(item)
        Core.mapData.pokestops[item.pokestop_id] = item
    } else {
        var item2 = Core.mapData.pokestops[item.pokestop_id]
        if (!!item.lure_expiration !== !!item2.lure_expiration) {
            item2.marker.hide()
            item.marker = markers.createPokestopMarker(item)
            Core.mapData.pokestops[item.pokestop_id] = item;
        }
    }
}

export function removePokemonMarker (encounterId: string) { // eslint-disable-line no-unused-vars
    Core.mapData.pokemons[encounterId].marker.hide();
    Core.mapData.pokemons[encounterId].hidden = true;
}

export function processGym (i, item: IGym) {
    if (!Store.get('showGyms')) {
        return false; // in case the checkbox was unchecked in the meantime.
    }

    if (item.gym_id in Core.mapData.gyms) {
        item.marker = markers.updateGymMarker(item, Core.mapData.gyms[item.gym_id].marker)
    } else { // add marker to map and item to dict
        item.marker = markers.createGymMarker(item);
    }
    Core.mapData.gyms[item.gym_id] = item;
}

export function processScannedCell (i, item: IScannedCell) {
    if (!Store.get('showScanned')) {
        return false;
    }

    var scanId = item.latitude + '|' + item.longitude;

    if (scanId in Core.mapData.scanned) {
        Core.mapData.scanned[scanId].last_update = item.last_update;
        Core.mapData.scanned[scanId].marker.setColor(getColorByDate(item.last_update));
    } else { // add marker to map and item to dict
        if (item.marker) {
            item.marker.hide();
        }
        item.marker = markers.createScannedMarker(item);
        Core.mapData.scanned[scanId] = item;
    }
}

function addLocationMarkers(locations: ILocation[]) {
    for (let location of locations) {
        location.marker = markers.createLocationMarker(location);
        Core.mapData.locations[location.id] = location;
    }
}

export function updatePokemonHiddenStatus() {
    $.each(Core.mapData.pokemons, (key, item) => {
        let excluded = excludedPokemon.indexOf(item.pokemon_id) !== -1;
        if (excluded && !item.hidden) {
            item.hidden = true;
            if (item.marker) {
                item.marker.hide();
            }
        } else if (!excluded && item.hidden) {
            item.hidden = false;
            if (item.marker) {
                item.marker.show();
            }
        }
    });
}

export function redrawPokemonMarkers(pokemonList: IPokemon[]) {
    var skipNotification = true
    $.each(pokemonList, function (key, value) {
        var item = pokemonList[key]
        var newMarker = markers.createPokemonMarker(item, pokemonSprites, skipNotification)
        if (item.hidden) {
            newMarker.hide();
        }
        item.marker.hide(); // Remove previous
        item.marker = newMarker; // Reinstate new
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

