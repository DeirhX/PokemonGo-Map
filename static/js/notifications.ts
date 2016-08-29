import {centerMap} from "./map/core";

declare var Notification; // TODO: Get api typing

export function initNotifications() {
    if (!Notification) {
        console.log("could not load notifications")
        return;
    }

    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    }
}

export function sendNotification (title, text, icon, lat, lng) {
    if (!("Notification" in window)) {
        return false; // Notifications are not present in browser
    }

    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    } else {
        const notification = new Notification(title, {
            icon,
            body: text,
            sound: "sounds/ding.mp3",
        })

        notification.onclick = () => {
            window.focus()
            notification.close()

            centerMap(lat, lng, 20);
        };
    }
}
