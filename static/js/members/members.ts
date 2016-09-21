/// <reference path="../../../typings/globals/require/index.d.ts" />

import * as server from "./server";
import * as signin from "./googlesignin";

var googlePlatform = require(["https://apis.google.com/js/1platform.js"], () => {
    "use strict";

    server.getLoginStateAsync((member) => {
        signin.finishInit(() => {
            signin.connectButtons();
            if (!member.id) {
                signin.clientSignOut();
            }
        });
    });
});


