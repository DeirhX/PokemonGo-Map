define(["require", "exports", "./map/core"], function (require, exports, core_1) {
    "use strict";
    function clearSelection() {
        if (document.selection) {
            document.selection.empty();
        }
        else if (window.getSelection) {
            window.getSelection().removeAllRanges();
        }
    }
    exports.clearSelection = clearSelection;
    function pad(num, len) {
        var iter = 1;
        var maxNum = 10;
        var outStr = "";
        while (iter < len) {
            if (num < maxNum) {
                outStr += "0";
            }
            iter++;
            maxNum *= 10;
        }
        return outStr + num;
    }
    exports.pad = pad;
    function getGoogleSprite(index, sprite, displayHeight) {
        displayHeight = Math.max(displayHeight, 3);
        var scale = displayHeight / sprite.iconHeight;
        // Crop icon just a tiny bit to avoid bleedover from neighbor
        var scaledIconSize = new core_1["default"].google.maps.Size(scale * sprite.iconWidth - 1, scale * sprite.iconHeight - 1);
        var scaledIconOffset = new core_1["default"].google.maps.Point((index % sprite.columns) * sprite.iconWidth * scale + 0.5, Math.floor(index / sprite.columns) * sprite.iconHeight * scale + 0.5);
        var scaledSpriteSize = new core_1["default"].google.maps.Size(scale * sprite.spriteWidth, scale * sprite.spriteHeight);
        var scaledIconCenterOffset = new core_1["default"].google.maps.Point(scale * sprite.iconWidth / 2, scale * sprite.iconHeight / 2);
        return {
            url: sprite.filename,
            size: scaledIconSize,
            scaledSize: scaledSpriteSize,
            origin: scaledIconOffset,
            anchor: scaledIconCenterOffset
        };
    }
    exports.getGoogleSprite = getGoogleSprite;
    function addEventsListener(obj, events, callback) {
        var names = events.split(" ");
        for (var _i = 0, names_1 = names; _i < names_1.length; _i++) {
            var name_1 = names_1[_i];
            obj.addEventListener(name_1, callback);
        }
    }
    exports.addEventsListener = addEventsListener;
});
//# sourceMappingURL=utils.js.map