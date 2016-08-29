
function removePokemonMarker (encounterId) { // eslint-disable-line no-unused-vars
    mapData.pokemons[encounterId].marker.setMap(null)
    mapData.pokemons[encounterId].hidden = true
}

