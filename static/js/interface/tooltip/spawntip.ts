import {pad, getGoogleSprite} from "../../utils";
import {pokemonSprites} from "../../assets/sprites";
import {Store} from "../../store";

export interface ISpawnChance {
    chance: number;
    pokemon_id: number;
}

export interface ISpawnDetail {
    latitude: number;
    longitude: number;
    spawn: number; // timestamp
    despawn: number; // timestamp
    rank: number;
    chances: ISpawnChance[];
}

export function generateSpawnTooltip(spawnDetail: ISpawnDetail) {
    const rankChanceMod = 1 - (0.75 / spawnDetail.rank);
    let table = "";
    spawnDetail.chances.sort((a, b) => ((a.chance < b.chance) ? +1 : ((a.chance > b.chance) ? -1 : 0)));
    const maxEntries = 5;
    for (let i = 0; i < Math.min(spawnDetail.chances.length, maxEntries); ++i) {
        const entry = spawnDetail.chances[i];
        const pokemonIndex = entry.pokemon_id - 1;
        const sprite = pokemonSprites[Store.get("pokemonIcons")] || pokemonSprites["highres"];
        const iconSize = 32;
        const icon = getGoogleSprite(pokemonIndex, sprite, iconSize);
        table += `
          <span class="spawn-entry"><div><a href='http://www.pokemon.com/us/pokedex/${entry.pokemon_id}' target='_blank' title='View in Pokedex'>
              <icon style='width: ${icon.size.width}px; height: ${icon.size.height}px; background-image: url("${icon.url}"); 
              background-size: ${icon.scaledSize.width}px ${icon.scaledSize.height}px; background-position: -${icon.origin.x}px -${icon.origin.y}px; background-repeat: no-repeat;'></icon></a>
          </div><div class="chance">${Math.round(entry.chance * rankChanceMod)}%</div></span>`;
        // <span>${entry.chance}%</span>
    }
    const despawnTime = new Date(spawnDetail.despawn);
    const spawnTime = new Date(spawnDetail.spawn);
    return `
           <div>
             <div class="spawn-window">
              <div>
                <div class="header">Most likely to appear:</div>
                <div class="spawn-table">
                  ${table}
                </div>
              </div>
              
              <div class="spawn-timing">
                  <div class="spawn-inactive" spawns-at='${spawnTime.getTime()}'>
                      Next spawn at: 
                      <span class='label-nextspawn'>${pad(spawnTime.getHours(), 2)}:${pad(spawnTime.getMinutes(), 2)}:${pad(spawnTime.getSeconds(), 2)}</span> 
                      <span class='label-countdown appear-countdown' disappears-at='${spawnTime.getTime()}'>(00m00s)</span>
                  </div>
                  <div class="spawn-active" despawns-at='${despawnTime.getTime()}'>
                      Disappears in: 
                      <span class='label-countdown disappear-countdown' disappears-at='${despawnTime.getTime()}'>(00m00s)</span>
                  </div>
              </div>
              <div>
                <a href='https://www.google.com/maps/dir/Current+Location/${spawnDetail.latitude},${spawnDetail.longitude}' target='_blank' title='View in Maps'>Get directions</a>
              </div>
             </div>
            </div>`;
}
