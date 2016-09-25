import {core} from "./core/base";
declare var Notification; // TODO: Get api typing

export let notifiedPokemon = [];
export let notifiedRarity = [];

let notifySound: HTMLAudioElement;
if (Audio) { // Damn Safari. Planet of the apes.
    notifySound = new Audio("static/sounds/ding.mp3");
}


export function initNotifications() {
    if (!("Notification" in window)) {
        return false; // Notifications are not present in browser
    }
    if (!Notification) {
        console.log("could not load notifications");
        return;
    }

    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    }
}

export function sendNotification (title, text, icon, lat, lng) {
    if (!Notification) {
        return false;
    }

    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    } else {
        const notification = new Notification(title, {
            icon,
            body: text,
            sound: "sounds/ding.mp3",
        });

        notification.onclick = () => {
            window.focus();
            notification.close();

            core.map.centerMap(lat, lng, 20);
        };
    }
}

export function playNotifySound() {
    notifySound.play();
}
