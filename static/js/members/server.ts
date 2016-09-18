/// <reference path="../../../typings/globals/jquery/index.d.ts" />

import {applyLoginState} from "./visual";

export interface IMember {
    id: number;
    username: string;
    token: string;
}

let memberChangeCallback: (result: IMember) => void;

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
    }).done(member => {
        applyLoginState(member);
        callback(member);
        if (memberChangeCallback) {
            memberChangeCallback(member);
        }
    });
}

export function serverSignOut(callback?: () => void) {
    setLoginStateAsync(null, (member) => {
        if (callback) {
            callback();
        }
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
        if (memberChangeCallback) {
            memberChangeCallback(member);
        }
    });
}

export function registerChangeCallback(callback: (result: IMember) => void) {
    if (memberChangeCallback) {
        throw "Don't do it twice, fool";
    }
    memberChangeCallback = callback;
}
