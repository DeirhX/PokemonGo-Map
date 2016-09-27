define(["require", "exports", "../core/base"], function (require, exports, base_1) {
    "use strict";
    var notificationsSupported = false;
    exports.notifiedPokemon = [];
    exports.notifiedRarity = [];
    var notifySound;
    if (Audio) {
        notifySound = new Audio("static/sounds/ding.mp3");
    }
    function initNotifications() {
        /*
        if (ServiceWorkerRegistration && ServiceWorkerRegistration.showNotification) {
            console.log("New notification system activated.");
            if (Notification.permission !== "granted") {
                Notification.requestPermission();
            }
            return true;
        }
        */
        if (!("Notification" in window)) {
            return false; // Notifications are not present in browser
        }
        if (!Notification) {
            console.log("could not load notifications");
            return false;
        }
        if (Notification.permission !== "granted") {
            Notification.requestPermission();
        }
        notificationsSupported = true;
        return true;
    }
    exports.initNotifications = initNotifications;
    function sendNotification(title, text, icon, lat, lng) {
        if (!notificationsSupported) {
            return false; // Notifications are not present in browser
        }
        var onClick = function () {
            window.focus();
            base_1.core.map.centerMap(lat, lng, 20);
        };
        {
            if (Notification.permission !== "granted") {
                Notification.requestPermission();
            }
            else {
                try {
                    var notification_1 = new Notification(title, {
                        icon: icon,
                        body: text,
                        sound: "sounds/ding.mp3",
                    });
                    notification_1.onclick = function () {
                        onClick();
                        notification_1.close();
                    };
                }
                catch (e) {
                    if (e.name === "TypeError") {
                        notificationsSupported = false;
                        return false;
                    }
                }
            }
        }
    }
    exports.sendNotification = sendNotification;
    function playNotifySound() {
        notifySound.play();
    }
    exports.playNotifySound = playNotifySound;
    function isNewNotificationSupported() {
        if (!("Notification" in window) || !Notification.requestPermission) {
            return false;
        }
        if (Notification.permission === "granted") {
            throw new Error('You must only call this *before* calling Notification.requestPermission(), otherwise this feature detect would bug the user with an actual notification!');
        }
        try {
            new Notification("");
        }
        catch (e) {
            if (e.name === 'TypeError') {
                return false;
            }
        }
        return true;
    }
});
//# sourceMappingURL=notifications.js.map