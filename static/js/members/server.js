/// <reference path="../../../typings/globals/jquery/index.d.ts" />
define(["require", "exports", "./visual"], function (require, exports, visual_1) {
    "use strict";
    var memberChangeCallback;
    var Member = (function () {
        function Member() {
        }
        return Member;
    }());
    exports.Member = Member;
    function getLoginStateAsync(callback) {
        $.ajax({
            url: "get_auth",
            type: "GET",
            data: {},
            dataType: "json"
        }).done(function (member) {
            visual_1.applyLoginState(member);
            callback(member);
            if (memberChangeCallback) {
                memberChangeCallback(member);
            }
        });
    }
    exports.getLoginStateAsync = getLoginStateAsync;
    function serverSignOut(callback) {
        setLoginStateAsync(null, function (member) {
            if (callback) {
                callback();
            }
        });
    }
    exports.serverSignOut = serverSignOut;
    function setLoginStateAsync(googleToken, callback) {
        $.ajax({
            url: "set_auth",
            type: "GET",
            data: { idToken: googleToken },
            dataType: "json"
        }).done(function (member) {
            visual_1.applyLoginState(member);
            callback(member);
            if (memberChangeCallback) {
                memberChangeCallback(member);
            }
        });
    }
    exports.setLoginStateAsync = setLoginStateAsync;
    function registerChangeCallback(callback) {
        if (memberChangeCallback) {
            throw "Don't do it twice, fool";
        }
        memberChangeCallback = callback;
    }
    exports.registerChangeCallback = registerChangeCallback;
});
//# sourceMappingURL=server.js.map