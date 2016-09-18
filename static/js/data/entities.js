/// <reference path="../../../typings/globals/jquery/index.d.ts" />
define(["require", "exports"], function (require, exports) {
    "use strict";
    exports.gymTypes = ["Uncontested", "Mystic", "Valor", "Instinct"];
    var MapData = (function () {
        function MapData() {
            this.pokemons = {};
            this.gyms = {};
            this.pokestops = {};
            this.lurePokemons = {};
            this.scanned = {};
            this.spawnpoints = {};
        }
        return MapData;
    }());
    exports.MapData = MapData;
    exports.mapData = new MapData();
    function clearAllMapData() {
        exports.mapData = new MapData();
    }
    exports.clearAllMapData = clearAllMapData;
});
//# sourceMappingURL=entities.js.map