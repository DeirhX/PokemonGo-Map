define(["require", "exports", "./map/core"], function (require, exports, core_1) {
    "use strict";
    exports.notifiedPokemon = [];
    exports.notifiedRarity = [];
    var notifySound = new Audio("static/sounds/ding.mp3");
    function initNotifications() {
        if (!Notification) {
            console.log("could not load notifications");
            return;
        }
        if (Notification.permission !== "granted") {
            Notification.requestPermission();
        }
    }
    exports.initNotifications = initNotifications;
    function sendNotification(title, text, icon, lat, lng) {
        if (!("Notification" in window)) {
            return false; // Notifications are not present in browser
        }
        if (Notification.permission !== "granted") {
            Notification.requestPermission();
        }
        else {
            var notification_1 = new Notification(title, {
                icon: icon,
                body: text,
                sound: "sounds/ding.mp3"
            });
            notification_1.onclick = function () {
                window.focus();
                notification_1.close();
                core_1.centerMap(lat, lng, 20);
            };
        }
    }
    exports.sendNotification = sendNotification;
    function playNotifySound() {
        notifySound.play();
    }
    exports.playNotifySound = playNotifySound;
});
//# sourceMappingURL=notifications.js.map