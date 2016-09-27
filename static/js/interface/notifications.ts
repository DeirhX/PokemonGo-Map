import {core} from "../core/base";
declare var Notification; // TODO: Get api typing
let notificationsSupported = false;
declare var ServiceWorkerRegistration;

export let notifiedPokemon = [];
export let notifiedRarity = [];

let notifySound: HTMLAudioElement;
if (Audio) { // Damn Safari. Planet of the apes.
    notifySound = new Audio("static/sounds/ding.mp3");
}


export function initNotifications(): boolean {
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

export function sendNotification (title, text, icon, lat, lng) {
    if (!notificationsSupported) {
        return false; // Notifications are not present in browser
    }

    let onClick = () => {
        window.focus();
        core.map.centerMap(lat, lng, 20);
    };


    {
        if (Notification.permission !== "granted") {
            Notification.requestPermission();
        } else {
            try {
                const notification = new Notification(title, {
                    icon,
                    body: text,
                    sound: "sounds/ding.mp3",
                });
                notification.onclick = () => {
                    onClick();
                    notification.close();
                };
            } catch (e) {
                if (e.name === "TypeError") {
                    notificationsSupported = false;
                    return false;
                }
            }
        }
    }
}

export function playNotifySound() {
    notifySound.play();
}


function isNewNotificationSupported(): boolean {
    if (!("Notification" in window) || !Notification.requestPermission) {
        return false;
    }
    if (Notification.permission === "granted") {
        throw new Error('You must only call this *before* calling Notification.requestPermission(), otherwise this feature detect would bug the user with an actual notification!');
    }

    try {
        new Notification("");
    } catch (e) {
        if (e.name === 'TypeError') {
            return false;
        }
    }
    return true;
}