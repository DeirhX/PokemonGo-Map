
function pad (num: number, len: number) {
    let iter = 1;
    let maxNum = 10;
    let outStr = "";
    while (iter < len) {
        if (num < maxNum) {
            outStr += "0";
        }
        iter++;
        maxNum *= 10;
    }
    return outStr + num;
}

function getTypeSpan (type) {
    return `<span style='padding: 2px 5px; text-transform: uppercase; color: white; margin-right: 2px; border-radius: 4px; font-size: 0.8em; vertical-align: text-bottom; background-color: ${type['color']}'>${type['type']}</span>`
}

export function pokemonLabel (name, rarity, types, disappearTime, id, latitude, longitude, encounterId): string {
    const disappearDate = new Date(disappearTime);
    const rarityDisplay = rarity ? "(" + rarity + ")" : "";
    let typesDisplay = "";
    for (let type of types) {
      typesDisplay += getTypeSpan(type)  ;
    }
    const contentstring = `
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
      </div>`

    return contentstring;
  }
