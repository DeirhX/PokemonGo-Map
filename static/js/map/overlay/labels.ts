/// <reference path="../../../../typings/globals/jquery/index.d.ts" />

import {pad} from "../../utils";

function getTypeSpan(type) {
    return `<span style='padding: 2px 5px; text-transform: uppercase; color: white; margin-right: 2px; border-radius: 4px; font-size: 0.8em; vertical-align: text-bottom; background-color: ${type['color']}'>${type['type']}</span>`
}

export function updateDisappearTime(element) {
    const disappearsAt = new Date(parseInt(element.getAttribute("disappears-at"), 10));
    const now = new Date();

    const difference = Math.abs(disappearsAt.getTime() - now.getTime());
    const hours = Math.floor(difference / 36e5);
    const minutes = Math.floor((difference - (hours * 36e5)) / 6e4);
    const seconds = Math.floor((difference - (hours * 36e5) - (minutes * 6e4)) / 1e3);
    let timestring = "";

    if (disappearsAt < now) {
        timestring = "(expired)";
    } else {
        timestring = "(";
        if (hours > 0) {
            timestring = hours + "h";
        }

        timestring += ("0" + minutes).slice(-2) + "m";
        timestring += ("0" + seconds).slice(-2) + "s";
        timestring += ")";
    }

    $(element).text(timestring);
};

export function pokemonLabel(name, rarity, types, disappearTime, id, latitude, longitude, encounterId): string {
    const disappearDate = new Date(disappearTime);
    const rarityDisplay = rarity ? "(" + rarity + ")" : "";
    let typesDisplay = "";
    for (let type of types) {
        typesDisplay += getTypeSpan(type);
    }
    return `
      <div>
        <b>${name}</b>
        <span> - </span>
        <small>
          <a href='http://www.pokemon.com/us/pokedex/${id}' target='_blank' title='View in Pokedex'>#${id}</a>
        </small>
        <span> ${rarityDisplay}</span>
        <span> - </span>
        <small>${typesDisplay}</small>
      </div>
      <div>
        Disappears at ${pad(disappearDate.getHours(), 2)}:${pad(disappearDate.getMinutes(), 2)}:${pad(disappearDate.getSeconds(), 2)}
        <span class='label-countdown' disappears-at='${disappearTime}'>(00m00s)</span>
      </div>
      <div>
        Location: ${latitude.toFixed(6)}, ${longitude.toFixed(7)}
      </div>
      <div>
        <a href='javascript:excludePokemon(${id})'>Exclude</a>&nbsp;&nbsp
        <a href='javascript:notifyAboutPokemon(${id})'>Notify</a>&nbsp;&nbsp
        <a href='javascript:removePokemonMarker("${encounterId}")'>Remove</a>&nbsp;&nbsp
        <a href='https://www.google.com/maps/dir/Current+Location/${latitude},${longitude}?hl=en' target='_blank' title='View in Maps'>Get directions</a>
      </div>`;
}

export function spawnLabel(id, latitude, longitude, spawnTime) {
    return `
        <div id="spawn-content">
          <b>Loading...</b>
        </div>`;
}

export function gymLabel(teamName, teamId, gymPoints, latitude, longitude) {
    const gymColor = ["0, 0, 0, .4", "74, 138, 202, .6", "240, 68, 58, .6", "254, 217, 40, .6"]
    if (teamId === 0) {
        return `
        <div>
          <center>
            <div>
              <b style='color:rgba(${gymColor[teamId]})'>${teamName}</b><br>
              <img height='70px' style='padding: 5px;' src='static/forts/${teamName}_large.png'>
            </div>
            <div>
              Location: ${latitude.toFixed(6)}, ${longitude.toFixed(7)}
            </div>
            <div>
              <a href='https://www.google.com/maps/dir/Current+Location/${latitude},${longitude}?hl=en' target='_blank' title='View in Maps'>Get directions</a>
            </div>
          </center>
        </div>`;
    } else {
        const gymPrestige = [2000, 4000, 8000, 12000, 16000, 20000, 30000, 40000, 50000]
        let gymLevel = 1
        while (gymPoints >= gymPrestige[gymLevel - 1]) {
            gymLevel++
        }
        return `
        <div>
          <center>
            <div style='padding-bottom: 2px'>
              Gym owned by:
            </div>
            <div>
              <b style='color:rgba(${gymColor[teamId]})'>Team ${teamName}</b><br>
              <img height='70px' style='padding: 5px;' src='static/forts/${teamName}_large.png'>
            </div>
            <div>
              Level: ${gymLevel} | Prestige: ${gymPoints}
            </div>
            <div>
              Location: ${latitude.toFixed(6)}, ${longitude.toFixed(7)}
            </div>
            <div>
              <a href='https://www.google.com/maps/dir/Current+Location/${latitude},${longitude}?hl=en' target='_blank' title='View in Maps'>Get directions</a>
            </div>
          </center>
        </div>`;
    }
}

export function pokestopLabel(expireTime, latitude, longitude) {
    if (expireTime && new Date(expireTime) > new Date()) {
        const expireDate = new Date(expireTime)

        return  `
        <div>
          <b>Lured Pokéstop</b>
        </div>
        <div>
          Lure expires at ${pad(expireDate.getHours(), 2)}:${pad(expireDate.getMinutes(), 2)}:${pad(expireDate.getSeconds(), 2)}
          <span class='label-countdown' disappears-at='${expireTime}'>(00m00s)</span>
        </div>
        <div>
          Location: ${latitude.toFixed(6)}, ${longitude.toFixed(7)}
        </div>
        <div>
          <a href='https://www.google.com/maps/dir/Current+Location/${latitude},${longitude}?hl=en' target='_blank' title='View in Maps'>Get directions</a>
        </div>`;
    } else {
        return `
        <div>
          <b>Pokéstop</b>
        </div>
        <div>
          Location: ${latitude.toFixed(6)}, ${longitude.toFixed(7)}
        </div>
        <div>
          <a href='https://www.google.com/maps/dir/Current+Location/${latitude},${longitude}?hl=en' target='_blank' title='View in Maps'>Get directions</a>
        </div>`;
    }
}
