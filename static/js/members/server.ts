/// <reference path="../../../typings/globals/jquery/index.d.ts" />

import {applyLoginState} from "./visual";
import {ILocation} from "./location";
import {IMember, members} from "./members";

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
    if (members.current.id === member.id) {
        members.MemberChanged.fire({previous: members.current, current: members.current });
    } else {
        members.MemberChanged.fire({previous: members.current, current: member });
    }
    members.current = member;
}