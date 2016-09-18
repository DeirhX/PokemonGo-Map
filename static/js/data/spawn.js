define(["require", "exports"], function (require, exports) {
    "use strict";
    (function (SpawnState) {
        SpawnState[SpawnState["Spawning"] = 0] = "Spawning";
        SpawnState[SpawnState["Waiting"] = 1] = "Waiting";
    })(exports.SpawnState || (exports.SpawnState = {}));
    var SpawnState = exports.SpawnState;
    var Spawn = (function () {
        function Spawn(json) {
            this.id = json.id;
            this.latitude = json.latitude;
            this.longitude = json.longitude;
            this.nextSpawn = new Date(json.nextSpawn);
            this.nextDespawn = new Date(json.nextDespawn);
            this.update(new Date());
        }
        Spawn.prototype.isSpawning = function () {
            return this.state === SpawnState.Spawning;
        };
        Spawn.prototype.update = function (now) {
            if (now > this.nextDespawn) {
                this.cycleNext(now);
            }
            this.prevState = this.state;
            if (now > this.nextSpawn) {
                this.state = SpawnState.Spawning;
            }
            else {
                this.state = SpawnState.Waiting;
            }
            return this.prevState !== this.state;
        };
        Spawn.prototype.cycleNext = function (now) {
            var hourDiff = Math.floor(Math.abs(now.getTime() - this.nextDespawn.getTime()) / 36e5) + 1;
            this.nextSpawn.setHours(this.nextSpawn.getHours() + hourDiff);
            this.nextDespawn.setHours(this.nextDespawn.getHours() + hourDiff);
        };
        return Spawn;
    }());
    exports.Spawn = Spawn;
    var SpawnDetail = (function () {
        function SpawnDetail(spawn, json) {
            this.spawn = spawn;
            this.rank = json.rank;
            this.overall = json.overall;
            this.hourly = json.hourly;
            spawn.detail = this;
        }
        return SpawnDetail;
    }());
    exports.SpawnDetail = SpawnDetail;
    var HourlyChance = (function () {
        function HourlyChance(hourlyChance) {
            this.hour = hourlyChance.hour;
            this.chances = hourlyChance.chances.slice();
        }
        return HourlyChance;
    }());
    exports.HourlyChance = HourlyChance;
});
//# sourceMappingURL=spawn.js.map