var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
define(["require", "exports", "../bar", "../tooltip/spawntip"], function (require, exports, bar_1, spawntip_1) {
    "use strict";
    var SpawnBar = (function (_super) {
        __extends(SpawnBar, _super);
        function SpawnBar() {
            _super.apply(this, arguments);
        }
        SpawnBar.prototype.displaySpawn = function (spawnDetail) {
            var $root = $(this.getRoot()).find(".spawn-detail");
            $root.data("spawn", spawnDetail);
            $root.find(".overall.spawn-table").html(spawntip_1.overallProbabilityTable(spawnDetail, 16));
            $root.find(".hourly.spawn-table").html(spawntip_1.hourlyProbabilityTable(spawnDetail, 7));
            spawntip_1.updateSpawnTooltip(spawnDetail, this.getRoot(), true);
        };
        return SpawnBar;
    }(bar_1.Bar));
    exports.SpawnBar = SpawnBar;
    var spawnBar = new SpawnBar("spawn");
    exports.__esModule = true;
    exports["default"] = spawnBar;
});
//# sourceMappingURL=spawnbar.js.map