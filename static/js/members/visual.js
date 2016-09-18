/// <reference path="../../../typings/globals/jquery/index.d.ts" />
define(["require", "exports"], function (require, exports) {
    "use strict";
    $("#logged-in").hide();
    $("#logged-out").hide();
    function applyLoginState(userInfo) {
        if (userInfo.id) {
            $("#logged-out").hide();
            $("#logged-in").show();
            $("#username").html(userInfo.username);
        }
        else {
            $("#logged-in").hide();
            $("#logged-out").show();
            $("#username").html();
        }
    }
    exports.applyLoginState = applyLoginState;
});
//# sourceMappingURL=visual.js.map