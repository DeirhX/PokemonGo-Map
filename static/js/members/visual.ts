/// <reference path="../../../typings/globals/jquery/index.d.ts" />

import {IMember} from "./server";

$("#logged-in").hide();
$("#logged-out").hide();

export function applyLoginState (userInfo: IMember) {
    if (userInfo.id) {
        // console.log("Applying login state");
        $("#logged-out").hide();
        $("#logged-in").show();
        $("#email").html(userInfo.email + "#" + userInfo.id);
        $("#username").val(userInfo.username);
    } else {
        // console.log("Applying logged-out state");
        $("#logged-in").hide();
        $("#logged-out").show();
        $("#email").html();
        $("#username").val();
    }
}
