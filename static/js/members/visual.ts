/// <reference path="../../../typings/globals/jquery/index.d.ts" />

$("#logged-in").hide();
$("#logged-out").hide();

export function applyLoginState (userInfo) {
    if (userInfo.id) {
        $("#logged-out").hide();
        $("#logged-in").show();
        $("#username").html(userInfo.username);
    } else {
        $("#logged-in").hide();
        $("#logged-out").show();
        $("#username").html();
    }
}
