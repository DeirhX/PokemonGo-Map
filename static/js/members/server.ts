/// <reference path="../../../typings/globals/jquery/index.d.ts" />

import {applyLoginState} from "./visual";

interface IMember {
    id: number;
    username: string;
    token: string;
}

export class Member implements IMember {
    public id: number;
    public username: string;
    public token: string;
}

export function getLoginStateAsync (callback: (result: IMember) => void) {
    $.ajax({
        url: "get_auth",
        type: "GET",
        data: {},
        dataType: "json",
    }).done(result => {
        applyLoginState(result);
        callback(result);
    });
}

export function requestSignOut(callback: () => void) {
    setLoginStateAsync(null, (member) => {callback(); });
}

export function setLoginStateAsync (googleToken: string, callback: (result: IMember) => void) {
    $.ajax({
        url: "set_auth",
        type: "GET",
        data: {idToken: googleToken},
        dataType: "json",
    }).done(result => {
        applyLoginState(result);
        callback(result);
    });
}

