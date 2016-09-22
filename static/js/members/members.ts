/// <reference path="../../../typings/globals/require/index.d.ts" />

import * as server from "./server";
import * as signin from "./googlesignin";
import {ILocation} from "./location";
import {LiteEvent} from "../core/events";

export interface IMember {
    id: number;
    email: string;
    username: string;
    token: string;
    locations: ILocation[];

    refreshLocations(): void;
}

export interface IMemberChanged {
    previous: IMember;
    current: IMember;
}
export class Membership {
    public current: IMember;
    public get MemberChanged(): LiteEvent<IMemberChanged> { return this.memberChanged; }

    private memberChanged = new LiteEvent<IMemberChanged>();

    constructor() {
        initializeMembership();
    }
}

export function initializeMembership() {
    require(["https://apis.google.com/js/platform.js"], () => {
        "use strict";

        server.getLoginStateAsync((member) => {
            signin.finishInit(() => {
                signin.connectButtons();
                if (!member.id) {
                    signin.clientSignOut();
                }
            });
        });
    });
}

