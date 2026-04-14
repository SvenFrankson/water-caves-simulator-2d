import { Matrix } from "@babylonjs/core";
import type { Game } from "./Game";
import type { WaterEngine } from "./map/WaterEngine";

export class MapEditInput {

    constructor(public game: Game, public waterEngine: WaterEngine) {

    }

    public connect() {
        this.game.canvas.addEventListener("pointerdown", this._onPointerDown);
    }

    private _onPointerDown = (evt: PointerEvent) => {
        let ray = this.game.scene.createPickingRay(this.game.scene.pointerX, this.game.scene.pointerY, Matrix.Identity(), this.game.camera);
        let pickResult = this.game.scene.pickWithRay(ray, (mesh) => mesh === this.waterEngine.frame);
        if (pickResult && pickResult.hit && pickResult.pickedMesh) {
            let i = Math.round(pickResult.pickedPoint!.x);
            let j = Math.round(pickResult.pickedPoint!.y);
            let cell = this.waterEngine.getCell(i, j);
            if (cell) {
                if (cell.isSolid) {
                    cell.isSolid = false;
                    cell.fillLevel = 0;
                }
                else {
                    cell.isSolid = true;
                    cell.fillLevel = 1;
                }
            }
            this.waterEngine.redrawRocks();
        }
    }
}