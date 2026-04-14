import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Game } from "./Game";
import { WaterCell } from "./map/WaterCell";
import { WaterEngine } from "./map/WaterEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core";
import { MapEditInput } from "./MapEditInput";

export class TestScene {

    constructor(public game: Game) {

        const light = new HemisphericLight("light", new Vector3(0, 1, 0), game.scene);
        light.intensity = 1;
        light.groundColor = new Color3(0.1, 0.1, 0.1);

        let waterEngine = new WaterEngine(40, 40, this.game);
        for (let i = 0; i < waterEngine.width; i++) {
            for (let j = 0; j < waterEngine.height; j++) {
                let cell = new WaterCell(waterEngine, i, j);
                if (i === 0 || i === waterEngine.width - 1 || j === 0 || j === waterEngine.height - 1) {
                    cell.isSolid = true;
                    cell.fillLevel = 1;
                }
                if (i === 10 && j > 2) {
                    cell.isSolid = true;
                    cell.fillLevel = 1;
                }
                if (j === 20 && i < 7) {
                    cell.isSolid = true;
                    cell.fillLevel = 1;
                }
                if (j === 30 && i < 7) {
                    cell.isSolid = true;
                    cell.fillLevel = 1;
                }
                if (j === 15 && i > 3 && i < 10) {
                    cell.isSolid = true;
                    cell.fillLevel = 1;
                }
                if (j === 25 && i > 3 && i < 10) {
                    cell.isSolid = true;
                    cell.fillLevel = 1;
                }
                if (i === 15 && j < 7) {
                    cell.isSolid = true;
                    cell.fillLevel = 1;
                }
                if (i === 29 && j < 15) {
                    cell.isSolid = true;
                    cell.fillLevel = 1;
                }
                if (!cell.isSolid && i < 5) {
                    cell.fillLevel = Math.random() * 0.5 + 0.5;
                }
            }
        }
        
        waterEngine.neighbourize();

        game.camera.target.copyFromFloats(waterEngine.width / 2, waterEngine.height / 2, 0);
        game.camera.radius = 50;
        game.camera.alpha = - Math.PI * 0.5;
        game.camera.beta = Math.PI * 0.5;

        waterEngine.instantiateMesh();

        waterEngine.initializeRockGenerator().then(() => {
            waterEngine.redrawRocks();
        });

        waterEngine.redraw();

        let mapEditInput = new MapEditInput(game, waterEngine);
        mapEditInput.connect();

        game.scene.registerBeforeRender(() => {
            waterEngine.update();
            waterEngine.update();
            waterEngine.redraw();
        });

        setInterval(() => {
            let x = Math.floor(Math.random() * waterEngine.width);
            let y = Math.floor(0.8 * waterEngine.height + Math.random() * 0.2 * waterEngine.height);
            let cell = waterEngine.getCell(x, y);
            if (cell && !cell.isSolid) {
                cell.fillLevel = 1;
            }

        }, 500);
    }
}