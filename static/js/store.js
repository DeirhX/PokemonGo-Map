//
// LocalStorage helpers
//
define(["require", "exports", "./environment"], function (require, exports, environment_1) {
    "use strict";
    var StoreTypes = {
        Boolean: {
            parse: function (str) {
                switch (str.toLowerCase()) {
                    case "1":
                    case "true":
                    case "yes":
                        return true;
                    default:
                        return false;
                }
            },
            stringify: function (b) {
                return b ? "true" : "false";
            }
        },
        JSON: {
            parse: function (str) {
                return JSON.parse(str);
            },
            stringify: function (json) {
                return JSON.stringify(json);
            }
        },
        Number: {
            parse: function (str) {
                return parseInt(str, 10);
            },
            stringify: function (num) {
                return num.toString();
            }
        },
        String: {
            parse: function (str) {
                return str;
            },
            stringify: function (str) {
                return str;
            }
        }
    };
    var StoreOptions = {
        map_style: {
            default: "roadmap",
            type: StoreTypes.String
        },
        remember_select_exclude: {
            default: [],
            type: StoreTypes.JSON
        },
        remember_select_notify: {
            default: [],
            type: StoreTypes.JSON
        },
        remember_select_rarity_notify: {
            default: [],
            type: StoreTypes.JSON
        },
        showGyms: {
            default: false,
            type: StoreTypes.Boolean
        },
        showPokemon: {
            default: true,
            type: StoreTypes.Boolean
        },
        showPokestops: {
            default: true,
            type: StoreTypes.Boolean
        },
        showLuredPokestopsOnly: {
            default: 0,
            type: StoreTypes.Number
        },
        showScanned: {
            default: false,
            type: StoreTypes.Boolean
        },
        showSpawnpoints: {
            default: false,
            type: StoreTypes.Boolean
        },
        playSound: {
            default: false,
            type: StoreTypes.Boolean
        },
        geoLocate: {
            default: false,
            type: StoreTypes.Boolean
        },
        lockMarker: {
            default: environment_1.isTouchDevice(),
            type: StoreTypes.Boolean
        },
        startAtUserLocation: {
            default: false,
            type: StoreTypes.Boolean
        },
        pokemonIcons: {
            default: "highres",
            type: StoreTypes.String
        },
        iconSizeModifier: {
            default: 0,
            type: StoreTypes.Number
        },
        searchMarkerStyle: {
            default: "google",
            type: StoreTypes.String
        }
    };
    exports.Store = {
        getOption: function (key) {
            var option = StoreOptions[key];
            if (!option) {
                throw new Error("Store key was not defined " + key);
            }
            return option;
        },
        get: function (key) {
            var option = this.getOption(key);
            var optionType = option.type;
            var rawValue = localStorage[key];
            if (rawValue === null || rawValue === undefined) {
                return option.default;
            }
            var value = optionType.parse(rawValue);
            return value;
        },
        set: function (key, value) {
            var option = this.getOption(key);
            var optionType = option.type || StoreTypes.String;
            var rawValue = optionType.stringify(value);
            localStorage[key] = rawValue;
        },
        reset: function (key) {
            localStorage.removeItem(key);
        }
    };
});
//# sourceMappingURL=store.js.map