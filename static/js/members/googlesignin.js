/// <reference path="../../../typings/globals/gapi.auth2/gapi.auth2.d.ts" />
define(["require", "exports", "./visual", "./server"], function (require, exports, visual_1, server_1) {
    "use strict";
    var auth2;
    function finishInit(callback) {
        gapi.load("auth2", function () {
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
            auth2.then(function () {
                auth2.currentUser.listen(function (user) {
                    if (user.isSignedIn()) {
                        onClientSignIn(user);
                    }
                    else {
                    }
                });
                callback();
            }, function () { console.log("Failed to initialize Google Auth"); });
        });
    }
    exports.finishInit = finishInit;
    function connectButtons() {
        $(".g-signout2").click(function () {
            clientSignOut();
            server_1.serverSignOut();
        });
    }
    exports.connectButtons = connectButtons;
    function onClientSignIn(googleUser) {
        var profile = googleUser.getBasicProfile();
        console.log('Google Sign-in ID: ' + profile.getId());
        console.log('Google Sign-in Name: ' + profile.getName());
        console.log('Google Sign-in Image URL: ' + profile.getImageUrl());
        console.log('Google Sign-in Email: ' + profile.getEmail());
        server_1.setLoginStateAsync(googleUser.getAuthResponse().id_token, function (member) {
            visual_1.applyLoginState(member);
        });
    }
    exports.onClientSignIn = onClientSignIn;
    function clientSignOut() {
        if (auth2.isSignedIn.get()) {
            auth2.signOut().then(function () {
                console.log('Google Sign-in: User signed out.');
            });
        }
    }
    exports.clientSignOut = clientSignOut;
});
//# sourceMappingURL=googlesignin.js.map