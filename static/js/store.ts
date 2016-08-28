//
// LocalStorage helpers
//

import {isTouchDevice} from "./environment";
interface IStoreType {
    parse(strValue: string): any;
    stringify(value: any): string;
}

interface IStoreTypes {
    Boolean: IStoreType;
    JSON: IStoreType;
    Number: IStoreType;
    String: IStoreType;
}

interface IStore {
  getOption(key);
  get(key);
  set(key, value);
  reset(key);
}

const StoreTypes: IStoreTypes = {
  Boolean: {
     parse(str) {
      switch (str.toLowerCase()) {
        case "1":
        case "true":
        case "yes":
          return true;
        default:
          return false;
      }
    },
    stringify(b: boolean) {
      return b ? "true" : "false";
    },
  },
  JSON: {
    parse(str: string) {
      return JSON.parse(str);
    },
    stringify (json: any) {
      return JSON.stringify(json);
    },
  },
  Number: {
    parse(str: string) {
      return parseInt(str, 10);
    },
    stringify(num: number) {
      return num.toString();
    },
  },
  String: {
    parse(str: string) {
      return str;
    },
    stringify(str: string) {
      return str;
    },
  },
};

const StoreOptions = {
  map_style: {
    default: "roadmap",
    type: StoreTypes.String,
  },
  remember_select_exclude: {
    default: [],
    type: StoreTypes.JSON,
  },
  remember_select_notify: {
    default: [],
    type: StoreTypes.JSON,
  },
  remember_select_rarity_notify: {
    default: [],
    type: StoreTypes.JSON,
  },
  showGyms: {
    default: false,
    type: StoreTypes.Boolean,
  },
  showPokemon: {
    default: true,
    type: StoreTypes.Boolean,
  },
  showPokestops: {
    default: true,
    type: StoreTypes.Boolean,
  },
  showLuredPokestopsOnly: {
    default: 0,
    type: StoreTypes.Number,
  },
  showScanned: {
    default: false,
    type: StoreTypes.Boolean,
  },
  showSpawnpoints: {
    default: false,
    type: StoreTypes.Boolean,
  },
  playSound: {
    default: false,
    type: StoreTypes.Boolean,
  },
  geoLocate: {
    default: false,
    type: StoreTypes.Boolean,
  },
  lockMarker: {
    default: isTouchDevice(), // default to true if touch device
    type: StoreTypes.Boolean,
  },
  startAtUserLocation: {
    default: false,
    type: StoreTypes.Boolean,
  },
  pokemonIcons: {
    default: "highres",
    type: StoreTypes.String,
  },
  iconSizeModifier: {
    default: 0,
    type: StoreTypes.Number,
  },
  searchMarkerStyle: {
    default: "google",
    type: StoreTypes.String,
  },
};

export const Store = {
  getOption(key) {
    let option = StoreOptions[key];
    if (!option) {
      throw new Error("Store key was not defined " + key);
    }
    return option;
  },
  get(key) {
    let option = this.getOption(key);
    let optionType = option.type;
    let rawValue = localStorage[key];
    if (rawValue === null || rawValue === undefined) {
      return option.default;
    }
    let value = optionType.parse(rawValue);
    return value;
  },
  set(key, value) {
    let option = this.getOption(key);
    let optionType = option.type || StoreTypes.String;
    let rawValue = optionType.stringify(value);
    localStorage[key] = rawValue;
  },
  reset(key) {
    localStorage.removeItem(key);
  },
};
