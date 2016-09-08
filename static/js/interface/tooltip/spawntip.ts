/// <reference path="../../../../typings/globals/jquery/index.d.ts" />

import {pad, getGoogleSprite} from "../../utils";
import {pokemonSprites} from "../../assets/sprites";
import {Store} from "../../store";
import {ISpawnDetail, SpawnState} from "../../data/spawn";
import {updateDisappearTime} from "../../map/overlay/labels";

export function generateSpawnTooltip(spawnDetail: ISpawnDetail): string {
    let table = overallProbabilityTable(spawnDetail, 5);
    let spawn = spawnDetail.spawn;
    return `
           <div>
             <div class="spawn-detail">
              <div>
                <div class="header">Most likely to appear:</div>
                <div class="overall spawn-table">
                  ${table}
                </div>
              </div>
              
              <div class="spawn-timing">
                  <div class="spawn-inactive" spawns-at='${spawn.nextSpawn.getTime()}'>
                      Next spawn at: 
                      <span class='label-nextspawn'>${pad(spawn.nextSpawn.getHours(), 2)}:${pad(spawn.nextSpawn.getMinutes(), 2)}:${pad(spawn.nextSpawn.getSeconds(), 2)}</span> 
                      <span class='label-countdown appear-countdown' disappears-at='${spawn.nextSpawn.getTime()}'>(00m00s)</span>
                  </div>
                  <div class="spawn-active" despawns-at='${spawn.nextDespawn.getTime()}'>
                      Disappears in: 
                      <span class='label-countdown disappear-countdown' disappears-at='${spawn.nextDespawn.getTime()}'>(00m00s)</span>
                  </div>
              </div>
              <div>
                <a href='https://www.google.com/maps/dir/Current+Location/${spawn.latitude},${spawn.longitude}' target='_blank' title='View in Maps'>Get directions</a>
              </div>
             </div>
            </div>`;
}

export function overallProbabilityTable(spawnDetail: ISpawnDetail, maxEntries: number = 100): string {
    let table = "";
    let chances = spawnDetail.overall.slice();
    chances.sort((a, b) => ((a.chance < b.chance) ? +1 : ((a.chance > b.chance) ? -1 : 0)));
    for (let i = 0; i < Math.min(chances.length, maxEntries); ++i) {
        const entry = chances[i];
        const pokemonIndex = entry.pokemonId - 1;
        const sprite = pokemonSprites[Store.get("pokemonIcons")] || pokemonSprites.highres;
        const iconSize = 32;
        const icon = getGoogleSprite(pokemonIndex, sprite, iconSize);
        table += `
          <span class="spawn-entry"><div><a href='http://www.pokemon.com/us/pokedex/${entry.pokemonId}' target='_blank' title='View in Pokedex'>
              <icon style='width: ${icon.size.width}px; height: ${icon.size.height}px; background-image: url("${icon.url}"); 
              background-size: ${icon.scaledSize.width}px ${icon.scaledSize.height}px; background-position: -${icon.origin.x}px -${icon.origin.y}px; background-repeat: no-repeat;'></icon></a>
          </div><div class="chance">${Math.round(100 * entry.chance)}%</div></span>`;
        // <span>${entry.chance}%</span>
    }
    return table;
}

export function hourlyProbabilityTable(spawnDetail: ISpawnDetail, maxEntries: number = 100): string {
    let table = "";
    const now = new Date();
    const hourOffset = Math.round(now.getTimezoneOffset() / 60);
    let hourlySpawns = spawnDetail.hourly.slice();
    for (let hourlySpawn of hourlySpawns) {
        hourlySpawn.hour = (hourlySpawn.hour - hourOffset) % 24; // Convert to local time
    }
    const thisHour = new Date().getHours();
    const spawnMinute = spawnDetail.spawn.nextSpawn.getMinutes();
    hourlySpawns.sort((a, b) => {     // Sort so this hour is on top
        if (a.hour > b.hour) {
            return (a.hour >= thisHour && b.hour < thisHour) ? -1 : +1;
        } else if (a.hour < b.hour) {
            return (a.hour < thisHour && b.hour >= thisHour) ? +1 : -1;
        }
        return 0;
    });
    for (let hourly of hourlySpawns) {
        let row = "";
        let chances = hourly.chances.slice();
        chances.sort((a, b) => ((a.chance < b.chance) ? +1 : ((a.chance > b.chance) ? -1 : 0)));
        for (let i = 0; i < Math.min(chances.length, maxEntries); ++i) {
            const entry = chances[i];
            const pokemonIndex = entry.pokemonId - 1;
            const sprite = pokemonSprites[Store.get("pokemonIcons")] || pokemonSprites.highres;
            const iconSize = 32;
            const icon = getGoogleSprite(pokemonIndex, sprite, iconSize);
            row += `
          <span class="spawn-entry"><div><a href='http://www.pokemon.com/us/pokedex/${entry.pokemonId}' target='_blank' title='View in Pokedex'>
              <icon style='width: ${icon.size.width}px; height: ${icon.size.height}px; background-image: url("${icon.url}"); 
              background-size: ${icon.scaledSize.width}px ${icon.scaledSize.height}px; background-position: -${icon.origin.x}px -${icon.origin.y}px; background-repeat: no-repeat;'></icon></a>
          </div><div class="chance">${Math.round(100 * entry.chance)}%</div></span>`;
            // <span>${entry.chance}%</span>
        }
        table += `<tr><td><span>${hourly.hour}</span><span>:${pad(spawnMinute, 2)}</span></td><td>${row}</td></tr>`;
    }
    return `<table>${table}</table>`;
}

export function updateSpawnTooltip (detail: ISpawnDetail, element: Element, forceUpdate: boolean = false) {

    let justAppeared = detail.spawn.state === SpawnState.Spawning && (detail.spawn.state !== detail.spawn.prevState || forceUpdate);
    let justDisappeared = detail.spawn.state === SpawnState.Waiting && (detail.spawn.state !== detail.spawn.prevState || forceUpdate);

    let inactiveContent = $(element).find(".spawn-inactive");
    let activeContent = $(element).find(".spawn-active");

    if (justAppeared || justDisappeared) {
        activeContent.attr("despawns-at", detail.spawn.nextDespawn.getTime());
        inactiveContent.attr("spawns-at", detail.spawn.nextSpawn.getTime());
    }

    if (justAppeared) { // Switch to "active" state
        inactiveContent.hide();
        activeContent.show();
        activeContent.find(".disappear-countdown").removeClass("disabled");
        inactiveContent.find(".appear-countdown").addClass("disabled");
    } else if (justDisappeared) {
        activeContent.hide();
        inactiveContent.show();
        inactiveContent.find(".appear-countdown").removeClass("disabled");
        activeContent.find(".disappear-countdown").addClass("disabled");

        inactiveContent.find(".label-nextspawn")[0].innerHTML = pad(detail.spawn.nextSpawn.getHours(), 2) +
            ":" + pad(detail.spawn.nextSpawn.getMinutes(), 2) + ":" + pad(detail.spawn.nextSpawn.getSeconds(), 2);
    }

    if (justAppeared || justDisappeared) { // Immediately update countdowns if state has changed
        activeContent.find(".disappear-countdown").attr("disappears-at", detail.spawn.nextDespawn.getTime());
        inactiveContent.find(".appear-countdown").attr("disappears-at", detail.spawn.nextSpawn.getTime());
        updateDisappearTime(activeContent.find(".disappear-countdown")[0]);
        updateDisappearTime(inactiveContent.find(".appear-countdown")[0]);
    }
}

export var updateAllSpawnTooltips = () => $(".spawn-detail").each(
    (index, element) => {
        let spawn = $(element).data("spawn");
        if (spawn) {
            updateSpawnTooltip(spawn, element);
        }
    });
