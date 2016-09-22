import {Store} from "../store";
import {core} from "../core/base";

let lastReceivedObjects;
let rawDataIsLoading = false;

export function loadRawData (incremental) {
    let loadPokemon = Store.get("showPokemon");
    let loadGyms = Store.get("showGyms");
    let loadPokestops = Store.get("showPokestops");
    let loadScanned = Store.get("showScanned");
    let loadSpawnpoints = Store.get("showSpawnpoints")

    let bounds = core.map.googleMap.getBounds();
    let swPoint = bounds.getSouthWest();
    let nePoint = bounds.getNorthEast();
    let swLat = swPoint.lat();
    let swLng = swPoint.lng();
    let neLat = nePoint.lat();
    let neLng = nePoint.lng();

    let incrementalTimestamps = incremental ? lastReceivedObjects : null;

    let response = $.ajax({
        url: "raw_data",
        type: "GET",
        data: {
            "pokemon": loadPokemon,
            "pokestops": loadPokestops,
            "gyms": loadGyms,
            "scanned": loadScanned,
            "spawnpoints": loadSpawnpoints,
            "swLat": swLat,
            "swLng": swLng,
            "neLat": neLat,
            "neLng": neLng,
            "key": "dontspam",
            "lastTimestamps": incrementalTimestamps
        },
        dataType: "json",
        cache: false,
        beforeSend: function () {
            if (rawDataIsLoading) {
                return false;
            } else {
                rawDataIsLoading = true;
            }
        },
        complete: function (data) {
            if (incremental && data.responseJSON) {
                lastReceivedObjects = data.responseJSON.lastTimestamps;
            }
            rawDataIsLoading = false;
        }
    })

    return response;
}

