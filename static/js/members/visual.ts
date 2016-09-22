/// <reference path="../../../typings/globals/jquery/index.d.ts" />

import {Core} from "../data/entities";
import {IMember} from "./members";

$("#logged-in").hide();
$("#logged-out").hide();

export function applyLoginState (member: IMember) {
    Core.member = member;
    if (member.id) {
        // console.log("Applying login state");
        $("#logged-out").hide();
        $("#logged-in").show();
        $("#email").html(member.email + "#" + member.id);
        $("#username").val(member.username);
        let sharedLocations = $("#shared-locations");
        let ownedLocations = $("#owned-locations");
        sharedLocations.html("");
        ownedLocations.html("");
        for (let location of member.locations) {
            if (location.relation === 0) {
                sharedLocations.append($("<option></option>").val(location.id).data("value", location).text(location.name));
            } else if (location.relation === 1) {
                ownedLocations.append($("<option></option>").val(location.id).data("value", location).text(location.name));
            }
        }
    } else {
        // console.log("Applying logged-out state");
        $("#logged-in").hide();
        $("#logged-out").show();
        $("#email").html("");
        $("#username").val();
        let sharedLocations = $("#shared-locations-guest");
        sharedLocations.html("");
        for (let location of member.locations) {
            if (location.relation === 0) {
                sharedLocations.append($("<option></option>").val(location.id).data("value", location).text(location.name));
            }
        }
    }
}
