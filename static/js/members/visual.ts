/// <reference path="../../../typings/globals/jquery/index.d.ts" />

$("#logged-in").hide();
$("#logged-out").hide();

export function applyLoginState (userInfo) {
    if (userInfo.id) {
        $("#logged-out").hide();
        $("#logged-in").show();
        $("#email").html(userInfo.email);
    } else {
        $("#logged-in").hide();
        $("#logged-out").show();
        $("#email").html();
    }
}
