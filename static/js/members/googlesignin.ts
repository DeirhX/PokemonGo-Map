/// <reference path="../../../typings/globals/gapi.auth2/gapi.auth2.d.ts" />

import {applyLoginState} from "./visual";
import {setLoginStateAsync, serverSignOut} from "./server";

let auth2: gapi.auth2.GoogleAuth;

export function finishInit(callback: () => void) {
    gapi.load("auth2", () => {
        /**
         * Retrieve the singleton for the GoogleAuth library and set up the
         * client.
         */
        /*
        auth2 = gapi.auth2.init({
            client_id: '1025081464444-8jrri89ukacqpevqsle7sv0v6lva7g5i.apps.googleusercontent.com'
        });
        */
        auth2 = gapi.auth2.getAuthInstance();
        auth2.then( () =>  {
            auth2.currentUser.listen((user) => {
                if (user.isSignedIn()) {
                    onClientSignIn(user);
                } else {

                }
            });
            callback();
        }, () => {console.log("Failed to initialize Google Auth"); });
    });
}

export function connectButtons() {

    $(".g-signout2").click(() => {
        clientSignOut();
        serverSignOut();
    });
}

export function onClientSignIn (googleUser) {
    let profile = googleUser.getBasicProfile();
    console.log('Google Sign-in ID: ' + profile.getId());
    console.log('Google Sign-in Name: ' + profile.getName());
    console.log('Google Sign-in Image URL: ' + profile.getImageUrl());
    console.log('Google Sign-in Email: ' + profile.getEmail());

    setLoginStateAsync(googleUser.getAuthResponse().id_token, (member) => {
        applyLoginState(member);
    });
}

export function clientSignOut() {
    auth2 = gapi.auth2.getAuthInstance();
    if (auth2.isSignedIn.get()) {
        auth2.signOut().then(function () {
            console.log('Google Sign-in: User signed out.');
        });
    }
}

