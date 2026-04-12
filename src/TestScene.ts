import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Game } from "./Game";
import { WaterCell } from "./map/WaterCell";
import { WaterEngine } from "./map/WaterEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export class TestScene {

    constructor(public game: Game) {

        const light = new HemisphericLight("light", new Vector3(0, 1, -1), game.scene);

        let waterEngine = new WaterEngine();
        for (let i = 0; i < 21; i++) {
            for (let j = 0; j < 20; j++) {
                let cell = new WaterCell(waterEngine, i, j);
                if (i === 0 || i === 20 || j === 0 || j === 19) {
                    cell.isSolid = true;
                }
                if (i === 10 && j > 1) {
                    cell.isSolid = true;
                }
                if (i === 15 && j < 7) {
                    cell.isSolid = true;
                }
                if (!cell.isSolid && i < 10) {
                    cell.fillLevel = Math.random();
                }
            }
        }

        waterEngine.redraw();

        setInterval(() => {
            waterEngine.update();
            waterEngine.redraw();
        }, 15);

        setInterval(() => {
            let cell = waterEngine.getCell(1, 18);
            if (cell && !cell.isSolid) {
                cell.fillLevel = 1;
            }
        }, 5000);
    }
}