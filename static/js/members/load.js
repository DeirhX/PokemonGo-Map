define((require) => {
    var googlePlatform = require(["async!https://apis.google.com/js/client:platform.js"], () => {
        "use strict";
        var signin = require("googlesignin");
        var server = require("server");

        server.getLoginStateAsync((member) => {
            if (!member.id) {
                signin.signOut();
            }
        });

        return {
            onSignIn: signin.onSignIn,
            signOut: signin.signOut,
            requestSignOut: server.requestSignOut,
        }
    });

    return {
        onSignIn: googlePlatform.onSignIn,
        signOut: googlePlatform.signOut,
        requestSignOut: googlePlatform.requestSignOut,
    }
});


