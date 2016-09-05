import {Bar} from "../bar";
import {ISpawnDetail} from "../../data/spawn";
import {overallProbabilityTable, updateSpawnTooltip, hourlyProbabilityTable} from "../tooltip/spawntip";

export class SpawnBar extends Bar {
    public displaySpawn(spawnDetail: ISpawnDetail) {
        let $root = $(this.getRoot()).find(".spawn-detail");
        $root.data("spawn", spawnDetail);
        $root.find(".overall.spawn-table").html(overallProbabilityTable(spawnDetail));
        $root.find(".hourly.spawn-table").html(hourlyProbabilityTable(spawnDetail));
        updateSpawnTooltip(spawnDetail, this.getRoot(), true);
    }
}

let spawnBar = new SpawnBar("spawn");
export default spawnBar;

