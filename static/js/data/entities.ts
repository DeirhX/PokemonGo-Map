/// <reference path="../../../typings/globals/jquery/index.d.ts" />
import {updateDisappearTime} from "../map/overlay/labels";
import {pad} from "../utils";

export const gymTypes = ['Uncontested', 'Mystic', 'Valor', 'Instinct'];

const entities = {

};


export function fastForwardSpawnTimes (spawnTemplate) {
    var now = new Date();
    if (now > spawnTemplate.disappearsAt) {
        var hourDiff = Math.floor(Math.abs(now - spawnTemplate.disappearsAt) / 36e5) + 1;
        spawnTemplate.appearsAt.setHours(spawnTemplate.appearsAt.getHours() + hourDiff);
        spawnTemplate.disappearsAt.setHours(spawnTemplate.disappearsAt.getHours() + hourDiff);
    }
}

export function updateSpawnCycle (element, first = null) {
    var spawn = $(element).data('spawn');
    if (!spawn) {
        return;
    }
    var marker = $(element).data('marker');
    var inactiveContent = $(element).find('.spawn-inactive');
    var activeContent = $(element).find('.spawn-active');
    var now = new Date();
    var justAppeared, justDisappeared;

    if (now > spawn.appearsAt) {
        justAppeared = true;
    }
    if (now > spawn.disappearsAt) {
        justAppeared = false;
        justDisappeared = true;

        fastForwardSpawnTimes(spawn);
        activeContent.attr("despawns-at", spawn.disappearsAt.getTime());
        inactiveContent.attr("spawns-at", spawn.appearsAt.getTime());
    }

    if (first) { // Initial update
        justAppeared = justDisappeared = false;
        if (now >= spawn.appearsAt && now <= spawn.disappearsAt) {
            justAppeared = true;
        } else {
            justDisappeared = true;
        }
    }

    if (justAppeared) { // Switch to 'active' state
        inactiveContent.hide();
        activeContent.show();
        activeContent.find(".disappear-countdown").removeClass("disabled");
        inactiveContent.find(".appear-countdown").addClass("disabled");
        if (marker) {
            marker.setOpacity(1.0);
        }
    } else if (justDisappeared) {
        activeContent.hide();
        inactiveContent.show();
        inactiveContent.find(".appear-countdown").removeClass("disabled");
        activeContent.find(".disappear-countdown").addClass("disabled");

        inactiveContent.find(".label-nextspawn")[0].innerHTML = pad(spawn.appearsAt.getHours(), 2) +
            ':' + pad(spawn.appearsAt.getMinutes(), 2) + ':' + pad(spawn.appearsAt.getSeconds(), 2);
        if (marker) {
            marker.setOpacity(0.3);
        }
    }

    if (justAppeared || justDisappeared) { // Immediately update countdowns if state has changed
        activeContent.find('.disappear-countdown').attr('disappears-at', spawn.disappearsAt.getTime());
        inactiveContent.find('.appear-countdown').attr('disappears-at', spawn.appearsAt.getTime());
        updateDisappearTime(activeContent.find('.disappear-countdown')[0]);
        updateDisappearTime(inactiveContent.find('.appear-countdown')[0]);
    }
}

export var updateAllSpawnCycles = function () {
    $('.spawn-timing').each(function (index, element) {
        updateSpawnCycle($(element));
    });
};


