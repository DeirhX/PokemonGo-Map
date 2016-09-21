
import {Google} from "./map/map";

export function clearSelection () {
    if ((document as any).selection) {
        (document as any).selection.empty();
    } else if (window.getSelection) {
        window.getSelection().removeAllRanges();
    }
}

export function pad(num: number, len: number) {
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

export function getGoogleSprite (index, sprite, displayHeight) {
    displayHeight = Math.max(displayHeight, 3)
    const scale = displayHeight / sprite.iconHeight;
    // Crop icon just a tiny bit to avoid bleedover from neighbor
    const scaledIconSize = new Google.maps.Size(scale * sprite.iconWidth - 1, scale * sprite.iconHeight - 1);
    const scaledIconOffset = new Google.maps.Point(
        (index % sprite.columns) * sprite.iconWidth * scale + 0.5,
        Math.floor(index / sprite.columns) * sprite.iconHeight * scale + 0.5);
    const scaledSpriteSize = new Google.maps.Size(scale * sprite.spriteWidth, scale * sprite.spriteHeight);
    const scaledIconCenterOffset = new Google.maps.Point(scale * sprite.iconWidth / 2, scale * sprite.iconHeight / 2);

    return {
        url: sprite.filename,
        size: scaledIconSize,
        scaledSize: scaledSpriteSize,
        origin: scaledIconOffset,
        anchor: scaledIconCenterOffset,
    };
}

export function addEventsListener(obj, events, callback) {
    const names = events.split(" ");
    for (let name of names) {
        obj.addEventListener(name, callback);
    }
}