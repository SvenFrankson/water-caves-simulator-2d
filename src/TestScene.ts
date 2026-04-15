import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Game } from "./Game";
import { WaterCell } from "./map/WaterCell";
import { WaterEngine } from "./map/WaterEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MapEditInput } from "./MapEditInput";

export class TestScene {

    public waterEngine: WaterEngine;

    constructor(public game: Game, size: number = 40) {

        const light = new HemisphericLight("light", new Vector3(0, 1, 0), game.scene);
        light.intensity = 1;
        light.groundColor = new Color3(0.1, 0.1, 0.1);

        this.waterEngine = new WaterEngine(size, size, this.game);
        this.setWidthAndHeight(size, size);
        
        this.waterEngine.neighbourize();

        game.camera.target.copyFromFloats(this.waterEngine.width / 2, this.waterEngine.height / 2, 0);
        game.camera.radius = 50;
        game.camera.alpha = - Math.PI * 0.5;
        game.camera.beta = Math.PI * 0.5;

        this.waterEngine.initializeRockGenerator().then(() => {
            this.waterEngine.redrawRocks();
        });

        this.waterEngine.redraw();

        let mapEditInput = new MapEditInput(game, this.waterEngine);
        mapEditInput.connect();

        game.scene.onBeforeRenderObservable.add(this._update);

        document.body.querySelector("#brush-reset-s")?.addEventListener("click", () => {
            this.setWidthAndHeight(20, 20);
        });
        document.body.querySelector("#brush-reset-m")?.addEventListener("click", () => {
            this.setWidthAndHeight(40, 40);
        });
        document.body.querySelector("#brush-reset-l")?.addEventListener("click", () => {
            this.setWidthAndHeight(60, 60);
        });
    }

    public _update = () => {
        this.waterEngine.update();

        this.waterEngine.redraw();
    }

    public dispose() {
        this.waterEngine.dispose();
        this.game.scene.onBeforeRenderObservable.removeCallback(this._update);
    }

    public setWidthAndHeight(width: number, height: number) {
        this.waterEngine.setWidthAndHeight(width, height);

        this.waterEngine.cells = [];
        for (let i = 0; i < this.waterEngine.width; i++) {
            for (let j = 0; j < this.waterEngine.height; j++) {
                let cell = new WaterCell(this.waterEngine, i, j);
                if (i === 0 || i === this.waterEngine.width - 1 || j === 0 || j === this.waterEngine.height - 1) {
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
                if (i === 29 && j < 7) {
                    cell.isSolid = true;
                    cell.fillLevel = 1;
                }
                if (!cell.isSolid && i < 5) {
                    cell.fillLevel = Math.random() * 0.5 + 0.5;
                }
            }
        }
        
        this.waterEngine.neighbourize();
        this.waterEngine.redrawRocks();

        this.game.camera.target.copyFromFloats(this.waterEngine.width / 2, this.waterEngine.height / 2, 0);
        this.game.camera.radius = Math.max(this.waterEngine.width, this.waterEngine.height) * 2;
        this.game.camera.lowerRadiusLimit = 15;
        this.game.camera.upperRadiusLimit = Math.max(this.waterEngine.width, this.waterEngine.height) * 3;
    }
}