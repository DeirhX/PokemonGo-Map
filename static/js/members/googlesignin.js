define(["require", "exports", "./visual", "./server"], function (require, exports, visual_1, server_1) {
    "use strict";
    function finishInit(callback) {
        gapi.load('auth2', function () {
            /**
             * Retrieve the singleton for the GoogleAuth library and set up the
             * client.
             */
            /*
            auth2 = gapi.auth2.init({
                client_id: '1025081464444-8jrri89ukacqpevqsle7sv0v6lva7g5i.apps.googleusercontent.com'
            });
            */
            var auth2 = gapi.auth2.getAuthInstance();
            auth2.then(function () { return callback(); });
        });
    }
    exports.finishInit = finishInit;
    function connectButtons() {
        function die(user) {
            alert('Fuck you');
        }
        var auth2 = gapi.auth2.getAuthInstance();
        //    $('#g-signin-1').data('onsuccess', die);
        //    $('#g-signin-2').data('onsuccess', die);
        var fuckyou = $('#g-signin-2')[0];
        // auth2.attachClickHandler(fuckyou);
        //auth2.attachClickHandler('g-signin-2', {}, die, onFailure);
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
        var auth2 = gapi.auth2.getAuthInstance();
        if (auth2.isSignedIn.get()) {
            auth2.signOut().then(function () {
                console.log('Google Sign-in: User signed out.');
            });
        }
    }
    exports.clientSignOut = clientSignOut;
    /**
     * Handle sign-in failures.
     */
    var onFailure = function (error) {
        console.log(error);
    };
});
//# sourceMappingURL=googlesignin.js.map