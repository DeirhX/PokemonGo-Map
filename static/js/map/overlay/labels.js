/// <reference path="../../../../typings/globals/jquery/index.d.ts" />
define(["require", "exports", "../../utils"], function (require, exports, utils_1) {
    "use strict";
    function getTypeSpan(type) {
        return "<span style='padding: 2px 5px; text-transform: uppercase; color: white; margin-right: 2px; border-radius: 4px; font-size: 0.8em; vertical-align: text-bottom; background-color: " + type['color'] + "'>" + type['type'] + "</span>";
    }
    function getColorByDate(value) {
        // Changes the color from red to green over 15 mins
        var diff = (Date.now() - value) / 1000 / 60 / 15;
        if (diff > 1) {
            diff = 1;
        }
        // value from 0 to 1 - Green to Red
        var hue = ((1 - diff) * 120).toString(10);
        return ['hsl(', hue, ',100%,50%)'].join('');
    }
    exports.getColorByDate = getColorByDate;
    function updateDisappearTime(element) {
        var disappearsAt = new Date(parseInt(element.getAttribute("disappears-at"), 10));
        var now = new Date();
        var difference = Math.abs(disappearsAt.getTime() - now.getTime());
        var hours = Math.floor(difference / 36e5);
        var minutes = Math.floor((difference - (hours * 36e5)) / 6e4);
        var seconds = Math.floor((difference - (hours * 36e5) - (minutes * 6e4)) / 1e3);
        var timestring = "";
        if (disappearsAt < now) {
            timestring = "(expired)";
        }
        else {
            timestring = "(";
            if (hours > 0) {
                timestring = hours + "h";
            }
            timestring += ("0" + minutes).slice(-2) + "m";
            timestring += ("0" + seconds).slice(-2) + "s";
            timestring += ")";
        }
        $(element).text(timestring);
    }
    exports.updateDisappearTime = updateDisappearTime;
    ;
    function updateAllLabelsDisappearTime() {
        $(".label-countdown").each(function (index, element) {
            if (!$(element).hasClass("disabled")) {
                updateDisappearTime(element);
            }
        });
    }
    exports.updateAllLabelsDisappearTime = updateAllLabelsDisappearTime;
    function pokemonLabel(name, rarity, types, disappearTime, id, latitude, longitude, encounterId) {
        var disappearDate = new Date(disappearTime);
        var rarityDisplay = rarity ? "(" + rarity + ")" : "";
        var typesDisplay = "";
        for (var _i = 0, types_1 = types; _i < types_1.length; _i++) {
            var type = types_1[_i];
            typesDisplay += getTypeSpan(type);
        }
        return "\n      <div>\n        <b>" + name + "</b>\n        <span> - </span>\n        <small>\n          <a href='http://www.pokemon.com/us/pokedex/" + id + "' target='_blank' title='View in Pokedex'>#" + id + "</a>\n        </small>\n        <span> " + rarityDisplay + "</span>\n        <span> - </span>\n        <small>" + typesDisplay + "</small>\n      </div>\n      <div>\n        Disappears at " + utils_1.pad(disappearDate.getHours(), 2) + ":" + utils_1.pad(disappearDate.getMinutes(), 2) + ":" + utils_1.pad(disappearDate.getSeconds(), 2) + "\n        <span class='label-countdown' disappears-at='" + disappearTime + "'>(00m00s)</span>\n      </div>\n      <div>\n        Location: " + latitude.toFixed(6) + ", " + longitude.toFixed(7) + "\n      </div>\n      <div>\n        <a href='javascript:excludePokemon(" + id + ")'>Exclude</a>&nbsp;&nbsp\n        <a href='javascript:notifyAboutPokemon(" + id + ")'>Notify</a>&nbsp;&nbsp\n        <a href='javascript:removePokemonMarker(\"" + encounterId + "\")'>Remove</a>&nbsp;&nbsp\n        <a href='https://www.google.com/maps/dir/Current+Location/" + latitude + "," + longitude + "?hl=en' target='_blank' title='View in Maps'>Get directions</a>\n      </div>";
    }
    exports.pokemonLabel = pokemonLabel;
    function spawnLabel(id, latitude, longitude, spawnTime) {
        return "\n        <div id=\"spawn-content\">\n          <b>Loading...</b>\n        </div>";
    }
    exports.spawnLabel = spawnLabel;
    function gymLabel(teamName, teamId, gymPoints, latitude, longitude) {
        var gymColor = ["0, 0, 0, .4", "74, 138, 202, .6", "240, 68, 58, .6", "254, 217, 40, .6"];
        if (teamId === 0) {
            return "\n        <div>\n          <center>\n            <div>\n              <b style='color:rgba(" + gymColor[teamId] + ")'>" + teamName + "</b><br>\n              <img height='70px' style='padding: 5px;' src='static/forts/" + teamName + "_large.png'>\n            </div>\n            <div>\n              Location: " + latitude.toFixed(6) + ", " + longitude.toFixed(7) + "\n            </div>\n            <div>\n              <a href='https://www.google.com/maps/dir/Current+Location/" + latitude + "," + longitude + "?hl=en' target='_blank' title='View in Maps'>Get directions</a>\n            </div>\n          </center>\n        </div>";
        }
        else {
            var gymPrestige = [2000, 4000, 8000, 12000, 16000, 20000, 30000, 40000, 50000];
            var gymLevel = 1;
            while (gymPoints >= gymPrestige[gymLevel - 1]) {
                gymLevel++;
            }
            return "\n        <div>\n          <center>\n            <div style='padding-bottom: 2px'>\n              Gym owned by:\n            </div>\n            <div>\n              <b style='color:rgba(" + gymColor[teamId] + ")'>Team " + teamName + "</b><br>\n              <img height='70px' style='padding: 5px;' src='static/forts/" + teamName + "_large.png'>\n            </div>\n            <div>\n              Level: " + gymLevel + " | Prestige: " + gymPoints + "\n            </div>\n            <div>\n              Location: " + latitude.toFixed(6) + ", " + longitude.toFixed(7) + "\n            </div>\n            <div>\n              <a href='https://www.google.com/maps/dir/Current+Location/" + latitude + "," + longitude + "?hl=en' target='_blank' title='View in Maps'>Get directions</a>\n            </div>\n          </center>\n        </div>";
        }
    }
    exports.gymLabel = gymLabel;
    function pokestopLabel(expireTime, latitude, longitude) {
        if (expireTime && new Date(expireTime) > new Date()) {
            var expireDate = new Date(expireTime);
            return "\n        <div>\n          <b>Lured Pok\u00E9stop</b>\n        </div>\n        <div>\n          Lure expires at " + utils_1.pad(expireDate.getHours(), 2) + ":" + utils_1.pad(expireDate.getMinutes(), 2) + ":" + utils_1.pad(expireDate.getSeconds(), 2) + "\n          <span class='label-countdown' disappears-at='" + expireTime + "'>(00m00s)</span>\n        </div>\n        <div>\n          Location: " + latitude.toFixed(6) + ", " + longitude.toFixed(7) + "\n        </div>\n        <div>\n          <a href='https://www.google.com/maps/dir/Current+Location/" + latitude + "," + longitude + "?hl=en' target='_blank' title='View in Maps'>Get directions</a>\n        </div>";
        }
        else {
            return "\n        <div>\n          <b>Pok\u00E9stop</b>\n        </div>\n        <div>\n          Location: " + latitude.toFixed(6) + ", " + longitude.toFixed(7) + "\n        </div>\n        <div>\n          <a href='https://www.google.com/maps/dir/Current+Location/" + latitude + "," + longitude + "?hl=en' target='_blank' title='View in Maps'>Get directions</a>\n        </div>";
        }
    }
    exports.pokestopLabel = pokestopLabel;
});
//# sourceMappingURL=labels.js.map