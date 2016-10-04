/// <reference path="../../../../typings/globals/jquery/index.d.ts" />

import {pad} from "../../utils";
import {ILocation} from "../../members/location";
import {i8ln} from "../../assets/strings";
import entities from "../../data/entities";
import {IPokemon} from "../../data/entities";
import {ISpawn} from "../../data/spawn";
import {IGym} from "../../data/entities";
import {getGymLevel} from "../../data/entities";

function getTypeSpan(type) {
    return `<span style='padding: 2px 5px; text-transform: uppercase; color: white; margin-right: 2px; border-radius: 4px; font-size: 0.8em; vertical-align: text-bottom; background-color: ${type['color']}'>${type['type']}</span>`
}

export function getColorByDate (value) {
    // Changes the color from red to green over 15 mins
    let diff = (Date.now() - value) / 1000 / 60 / 15;

    if (diff > 1) {
        diff = 1;
    }

    // value from 0 to 1 - Green to Red
    const hue = ((1 - diff) * 120).toString(10);
    return ["hsl(", hue, ",100%,50%)"].join("");
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

export function updateAllLabelsDisappearTime() {
    $(".label-countdown").each((index, element) => {
        if (!$(element).hasClass("disabled")) {
            updateDisappearTime(element);
        }
    });
}

export function pokemonLabel(pokemon: IPokemon): string {
    const disappearDate = new Date(pokemon.disappear_time);
    const rarityDisplay = pokemon.pokemon_rarity ? "(" + pokemon.pokemon_rarity + ")" : "";
    let typesDisplay = "";
    for (let type of pokemon.pokemon_types) {
        typesDisplay += getTypeSpan(type);
    }
    let details = "";
    if (pokemon.individual_attack != null) {
    let iv = (pokemon.individual_attack + pokemon.individual_defense + pokemon.individual_stamina) / 45 * 100;
    details = `
      <div>
        <b>${iv.toFixed(1)}% </b>IV (${pokemon.individual_attack}A / ${pokemon.individual_defense}D / ${pokemon.individual_stamina}S)
      </div>
      <div>
        Moves: <b>${i8ln(entities.staticData.attacks[pokemon.attack_1].name)}</b> / <b>${i8ln(entities.staticData.attacks[pokemon.attack_2].name)}</b>
      </div>
      `;
    }
    return `
      <div>
        <b>${pokemon.pokemon_name}</b>
        <span> - </span>
        <small>
          <a href='http://www.pokemon.com/us/pokedex/${pokemon.pokemon_id}' target='_blank' title='View in Pokedex'>#${pokemon.pokemon_id}</a>
        </small>
        <span> ${rarityDisplay}</span>
        <span> - </span>
        <small>${typesDisplay}</small>
      </div>
      ${details}
      <div>
        Disappears at ${pad(disappearDate.getHours(), 2)}:${pad(disappearDate.getMinutes(), 2)}:${pad(disappearDate.getSeconds(), 2)}
        <span class='label-countdown' disappears-at='${pokemon.disappear_time}'>(00m00s)</span>
      </div>
      <div>
        <a href='javascript:excludePokemon(${pokemon.pokemon_id})'>Exclude</a>&nbsp;&nbsp
        <a href='javascript:notifyAboutPokemon(${pokemon.pokemon_id})'>Notify</a>&nbsp;&nbsp
        <a href='javascript:removePokemonMarker("${pokemon.encounter_id}")'>Remove</a>&nbsp;&nbsp
        <a href='https://www.google.com/maps/dir/Current+Location/${pokemon.latitude},${pokemon.longitude}?hl=en' target='_blank' title='View in Maps'>Get directions</a>
      </div>`;
    /*
      <div>
        Location: ${pokemon.latitude.toFixed(6)}, ${pokemon.longitude.toFixed(7)}
      </div>

     */
}

export function spawnLabel(spawn: ISpawn) {
    return `
        <div id="spawn-content">
          <b>Loading...</b>
        </div>`;
}

export function gymLabel(gym: IGym, teamName: string) {
    const gymColor = ["0, 0, 0, .4", "74, 138, 202, .6", "240, 68, 58, .6", "254, 217, 40, .6"];
    if (gym.team_id === 0) {
        return `
        <div>
          <center>
            <div>
              <b style='color:rgba(${gymColor[gym.team_id]})'>${teamName}</b><br>
              <img height='70px' style='padding: 5px;' src='static/forts/${teamName}_large.png'>
            </div>
            <div>
              Location: ${gym.latitude.toFixed(6)}, ${gym.longitude.toFixed(7)}
            </div>
            <div>
              <a href='https://www.google.com/maps/dir/Current+Location/${gym.latitude},${gym.longitude}?hl=en' target='_blank' title='View in Maps'>Get directions</a>
            </div>
          </center>
        </div>`;
    } else {
        const gymLevel = getGymLevel(gym);
        return `
        <div>
          <center>
            <div style='padding-bottom: 2px'>
              Gym owned by:
            </div>
            <div>
              <b style='color:rgba(${gymColor[gym.team_id]})'>Team ${teamName}</b><br>
              <img height='70px' style='padding: 5px;' src='static/forts/${teamName}_large.png'>
            </div>
            <div>
              Level: ${gymLevel} | Prestige: ${gym.gym_points}
            </div>
            <div>
              Location: ${gym.latitude.toFixed(6)}, ${gym.longitude.toFixed(7)}
            </div>
            <div>
              <a href='https://www.google.com/maps/dir/Current+Location/${gym.latitude},$gym.{longitude}?hl=en' target='_blank' title='View in Maps'>Get directions</a>
            </div>
          </center>
        </div>`;
    }
}

export function pokestopLabel(expireTime, latitude, longitude) {
    if (expireTime && new Date(expireTime) > new Date()) {
        const expireDate = new Date(expireTime);
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

export function locationLabel(location: ILocation): string {
    let lehtml = `
    <div>
      <b>Pokéradar: ${location.name}</b>
    </div>
    <div>
      Strength: ${Math.round((location.size + 4) / 5)}
    </div>
    <div>
      Spawns watched: <b>${location.spawns}</b>
    </div>`;
    if (location.relation === 1) {
        lehtml += `<div><b>Owned</b> ${location.expiry ? (" until " + new Date(location.expiry).toDateString()) : ""}</div>`;
    } else if (location.relation === 0) {
        lehtml += `<div><i>Shared</i> ${location.expiry ? (" until " + new Date(location.expiry).toDateString()) : ""}</div>`;
    } else {
        lehtml += `<div>
          Needs ${location.pokecubes} pokecubes / day
        </div>`;
    }
    return lehtml;
    /*
    <div>
      Location: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}
    </div>`;
    */
}
