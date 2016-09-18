/// <reference path="../../../../typings/globals/jquery/index.d.ts" />
define(["require", "exports", "../../utils", "../../assets/sprites", "../../store", "../../data/spawn", "../../map/overlay/labels"], function (require, exports, utils_1, sprites_1, store_1, spawn_1, labels_1) {
    "use strict";
    function generateSpawnTooltip(spawnDetail) {
        var table = overallProbabilityTable(spawnDetail, 5);
        var spawn = spawnDetail.spawn;
        return "\n           <div>\n             <div class=\"spawn-detail\">\n              <div>\n                <div class=\"header\">Most likely to appear:</div>\n                <div class=\"overall spawn-table\">\n                  " + table + "\n                </div>\n              </div>\n              \n              <div class=\"spawn-timing\">\n                  <div class=\"spawn-inactive\" spawns-at='" + spawn.nextSpawn.getTime() + "'>\n                      Next spawn at: \n                      <span class='label-nextspawn'>" + utils_1.pad(spawn.nextSpawn.getHours(), 2) + ":" + utils_1.pad(spawn.nextSpawn.getMinutes(), 2) + ":" + utils_1.pad(spawn.nextSpawn.getSeconds(), 2) + "</span> \n                      <span class='label-countdown appear-countdown' disappears-at='" + spawn.nextSpawn.getTime() + "'>(00m00s)</span>\n                  </div>\n                  <div class=\"spawn-active\" despawns-at='" + spawn.nextDespawn.getTime() + "'>\n                      Disappears in: \n                      <span class='label-countdown disappear-countdown' disappears-at='" + spawn.nextDespawn.getTime() + "'>(00m00s)</span>\n                  </div>\n              </div>\n              <div>\n                <a href='https://www.google.com/maps/dir/Current+Location/" + spawn.latitude + "," + spawn.longitude + "' target='_blank' title='View in Maps'>Get directions</a>\n              </div>\n             </div>\n            </div>";
    }
    exports.generateSpawnTooltip = generateSpawnTooltip;
    function overallProbabilityTable(spawnDetail, maxEntries) {
        if (maxEntries === void 0) { maxEntries = 100; }
        var table = "";
        var chances = spawnDetail.overall.slice();
        chances.sort(function (a, b) { return ((a.chance < b.chance) ? +1 : ((a.chance > b.chance) ? -1 : 0)); });
        for (var i = 0; i < Math.min(chances.length, maxEntries); ++i) {
            var entry = chances[i];
            var pokemonIndex = entry.pokemonId - 1;
            var sprite = sprites_1.pokemonSprites[store_1.Store.get("pokemonIcons")] || sprites_1.pokemonSprites.highres;
            var iconSize = 32;
            var icon = utils_1.getGoogleSprite(pokemonIndex, sprite, iconSize);
            table += "\n          <span class=\"spawn-entry\"><div><a href='http://www.pokemon.com/us/pokedex/" + entry.pokemonId + "' target='_blank' title='View in Pokedex'>\n              <icon style='width: " + icon.size.width + "px; height: " + icon.size.height + "px; background-image: url(\"" + icon.url + "\"); \n              background-size: " + icon.scaledSize.width + "px " + icon.scaledSize.height + "px; background-position: -" + icon.origin.x + "px -" + icon.origin.y + "px; background-repeat: no-repeat;'></icon></a>\n          </div><div class=\"chance\">" + Math.round(100 * entry.chance) + "%</div></span>";
        }
        return table;
    }
    exports.overallProbabilityTable = overallProbabilityTable;
    function hourlyProbabilityTable(spawnDetail, maxEntries) {
        if (maxEntries === void 0) { maxEntries = 100; }
        var table = "";
        var now = new Date();
        var hourOffset = Math.round(now.getTimezoneOffset() / 60);
        var hourlySpawns = [];
        for (var _i = 0, _a = spawnDetail.hourly; _i < _a.length; _i++) {
            var hourlySpawn = _a[_i];
            var hourlyCopy = new spawn_1.HourlyChance(hourlySpawn);
            hourlyCopy.hour = (hourlyCopy.hour - hourOffset) % 24; // Convert to local time
            hourlySpawns.push(hourlyCopy);
        }
        var thisHour = new Date().getHours();
        var spawnMinute = spawnDetail.spawn.nextSpawn.getMinutes();
        hourlySpawns.sort(function (a, b) {
            if (a.hour > b.hour) {
                return (a.hour >= thisHour && b.hour < thisHour) ? -1 : +1;
            }
            else if (a.hour < b.hour) {
                return (a.hour < thisHour && b.hour >= thisHour) ? +1 : -1;
            }
            return 0;
        });
        for (var _b = 0, hourlySpawns_1 = hourlySpawns; _b < hourlySpawns_1.length; _b++) {
            var hourly = hourlySpawns_1[_b];
            var row = "";
            var chances = hourly.chances.slice();
            chances.sort(function (a, b) { return ((a.chance < b.chance) ? +1 : ((a.chance > b.chance) ? -1 : 0)); });
            for (var i = 0; i < Math.min(chances.length, maxEntries); ++i) {
                var entry = chances[i];
                var pokemonIndex = entry.pokemonId - 1;
                var sprite = sprites_1.pokemonSprites[store_1.Store.get("pokemonIcons")] || sprites_1.pokemonSprites.highres;
                var iconSize = 32;
                var icon = utils_1.getGoogleSprite(pokemonIndex, sprite, iconSize);
                row += "\n          <span class=\"spawn-entry\"><div><a href='http://www.pokemon.com/us/pokedex/" + entry.pokemonId + "' target='_blank' title='View in Pokedex'>\n              <icon style='width: " + icon.size.width + "px; height: " + icon.size.height + "px; background-image: url(\"" + icon.url + "\"); \n              background-size: " + icon.scaledSize.width + "px " + icon.scaledSize.height + "px; background-position: -" + icon.origin.x + "px -" + icon.origin.y + "px; background-repeat: no-repeat;'></icon></a>\n          </div><div class=\"chance\">" + Math.round(100 * entry.chance) + "%</div></span>";
            }
            table += "<tr><td><span>" + hourly.hour + "</span><span>:" + utils_1.pad(spawnMinute, 2) + "</span></td><td>" + row + "</td></tr>";
        }
        return "<table>" + table + "</table>";
    }
    exports.hourlyProbabilityTable = hourlyProbabilityTable;
    function updateSpawnTooltip(detail, element, forceUpdate) {
        if (forceUpdate === void 0) { forceUpdate = false; }
        var justAppeared = detail.spawn.state === spawn_1.SpawnState.Spawning && (detail.spawn.state !== detail.spawn.prevState || forceUpdate);
        var justDisappeared = detail.spawn.state === spawn_1.SpawnState.Waiting && (detail.spawn.state !== detail.spawn.prevState || forceUpdate);
        var inactiveContent = $(element).find(".spawn-inactive");
        var activeContent = $(element).find(".spawn-active");
        if (justAppeared || justDisappeared) {
            activeContent.attr("despawns-at", detail.spawn.nextDespawn.getTime());
            inactiveContent.attr("spawns-at", detail.spawn.nextSpawn.getTime());
        }
        if (justAppeared) {
            inactiveContent.hide();
            activeContent.show();
            activeContent.find(".disappear-countdown").removeClass("disabled");
            inactiveContent.find(".appear-countdown").addClass("disabled");
        }
        else if (justDisappeared) {
            activeContent.hide();
            inactiveContent.show();
            inactiveContent.find(".appear-countdown").removeClass("disabled");
            activeContent.find(".disappear-countdown").addClass("disabled");
            inactiveContent.find(".label-nextspawn")[0].innerHTML = utils_1.pad(detail.spawn.nextSpawn.getHours(), 2) +
                ":" + utils_1.pad(detail.spawn.nextSpawn.getMinutes(), 2) + ":" + utils_1.pad(detail.spawn.nextSpawn.getSeconds(), 2);
        }
        if (justAppeared || justDisappeared) {
            activeContent.find(".disappear-countdown").attr("disappears-at", detail.spawn.nextDespawn.getTime());
            inactiveContent.find(".appear-countdown").attr("disappears-at", detail.spawn.nextSpawn.getTime());
            labels_1.updateDisappearTime(activeContent.find(".disappear-countdown")[0]);
            labels_1.updateDisappearTime(inactiveContent.find(".appear-countdown")[0]);
        }
    }
    exports.updateSpawnTooltip = updateSpawnTooltip;
    exports.updateAllSpawnTooltips = function () { return $(".spawn-detail").each(function (index, element) {
        var spawn = $(element).data("spawn");
        if (spawn) {
            updateSpawnTooltip(spawn, element);
        }
    }); };
});
//# sourceMappingURL=spawntip.js.map