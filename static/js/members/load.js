define((require) => {
    var googlePlatform = require(["https://apis.google.com/js/platform.js"], () => {
        "use strict";
        var signin = require("./googlesignin");
        var server = require("./server");

        server.getLoginStateAsync((member) => {
            signin.finishInit(() => {
                signin.connectButtons();
                if (!member.id) {
                    signin.clientSignOut();
                }
            });
        });

        return {
            onSignIn: signin.onSignIn,
            signOut: signin.signOut,
            requestSignOut: server.requestSignOut,
        }
    });
});


