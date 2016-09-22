/// <reference path="../../../typings/globals/jquery/index.d.ts" />

import {applyLoginState} from "./visual";
import {ILocation} from "./location";
import {IMember} from "./members";
import {core} from "../core/base";

export class Member implements IMember {
    public id: number;
    public email: string;
    public username: string;
    public token: string;
    public locations: ILocation[];

    public refreshLocations(): void {
        throw "not implemented";
    }
}

export function getLoginStateAsync (callback: (result: IMember) => void) {
    $.ajax({
        url: "get_auth",
        type: "GET",
        data: {},
        dataType: "json",
    }).done(member => {
        applyLoginState(member);
        callback(member);
        updateCurrentMember(member);
    });
}

export function setLoginStateAsync (googleToken: string, callback: (result: IMember) => void) {
    $.ajax({
        url: "set_auth",
        type: "GET",
        data: {idToken: googleToken},
        dataType: "json",
    }).done(member => {
        applyLoginState(member);
        callback(member);
        updateCurrentMember(member);
    });
}

export function serverSignOut(callback?: () => void) {
    setLoginStateAsync(null, (member) => {
        if (callback) {
            callback();
        }
    });
}

function updateCurrentMember(member: IMember) {
    if (!member) {
        member = new Member();
        member.id = 0;
        member.locations = [];
    }

    const previous = core.members.current;
    if (previous && (previous.id === member.id)) {
        core.members.MemberChanged.fire({previous: previous, current: previous });
    } else {
        core.members.MemberChanged.fire({previous: previous, current: member });
    }
    core.members.current = member;
}
