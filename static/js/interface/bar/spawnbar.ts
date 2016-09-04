import {Bar} from "../bar";
import {ISpawnDetail} from "../../data/spawn";
import {nextSpawnProbabilityTable, updateSpawnTooltip} from "../tooltip/spawntip";

class SpawnBar extends Bar {
    public displaySpawn(spawnDetail: ISpawnDetail) {
        let $root = $(this.getRoot()).find(".spawn-detail");
        $root.data("spawn", spawnDetail);
        $root.find(".spawn-table").html(nextSpawnProbabilityTable(spawnDetail));
        updateSpawnTooltip(spawnDetail, this.getRoot(), true);
    }
}

let spawnBar = new SpawnBar("spawn");
export default spawnBar;

