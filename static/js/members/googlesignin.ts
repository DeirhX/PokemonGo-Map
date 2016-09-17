import {clearAllMapData} from "../data/entities";
import {applyLoginState} from "./visual";
import {setLoginStateAsync} from "./server";

var gapi : any;

export function onSignIn (googleUser) {
    let profile = googleUser.getBasicProfile();
    console.log('Google Sign-in ID: ' + profile.getId());
    console.log('Google Sign-in Name: ' + profile.getName());
    console.log('Google Sign-in Image URL: ' + profile.getImageUrl());
    console.log('Google Sign-in Email: ' + profile.getEmail());

    setLoginStateAsync(googleUser.getAuthResponse().id_token, (member) => {
        applyLoginState(member);
        clearAllMapData();
    });
}

export function signOut() {
    var auth2 = gapi.auth2.getAuthInstance();
    auth2.signOut().then(function () {
        console.log('Google Sign-in: User signed out.');
    });
    clearAllMapData();
}


// Maybe sucks below this line //

/**
 * The Sign-In client object.
 */
var auth2;

/**
 * Initializes the Sign-In client.
 */
function startGoogleSignin() {
    gapi.load('auth2', function(){
        /**
         * Retrieve the singleton for the GoogleAuth library and set up the
         * client.
         */
        auth2 = gapi.auth2.init({
            client_id: '1025081464444-8jrri89ukacqpevqsle7sv0v6lva7g5i.apps.googleusercontent.com'
        });

        // Attach the click handler to the sign-in button
        auth2.attachClickHandler('signin-button', {}, onSuccess, onFailure);
    });
};

/**
 * Handle successful sign-ins.
 */
var onSuccess = function(user) {
    console.log('Signed in as ' + user.getBasicProfile().getName());
 };

/**
 * Handle sign-in failures.
 */
var onFailure = function (error) {
    console.log(error);
};


