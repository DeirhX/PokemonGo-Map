define(["require", "exports"], function (require, exports) {
    "use strict";
    exports.pokemonSprites = {
        normal: {
            columns: 12,
            iconWidth: 30,
            iconHeight: 30,
            spriteWidth: 360,
            spriteHeight: 390,
            filename: "static/icons-sprite.png",
            name: "Normal"
        },
        highres: {
            columns: 7,
            iconWidth: 65,
            iconHeight: 65,
            spriteWidth: 455,
            spriteHeight: 1430,
            filename: "static/icons-large-sprite.png",
            name: "High-Res"
        },
        shuffle: {
            columns: 7,
            iconWidth: 65,
            iconHeight: 65,
            spriteWidth: 455,
            spriteHeight: 1430,
            filename: "static/icons-shuffle-sprite.png",
            name: "Shuffle"
        }
    };
    function getPokestopIcon(item) {
        var isLured = item["lure_expiration"] && item["lure_expiration"] > new Date().getTime();
        var imagename = isLured ? "PstopLured" : "Pstop";
        return "static/forts/" + imagename + ".png";
    }
    exports.getPokestopIcon = getPokestopIcon;
});
//# sourceMappingURL=sprites.js.map