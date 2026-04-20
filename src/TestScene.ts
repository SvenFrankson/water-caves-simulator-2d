import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Game } from "./Game";
import { WaterCell } from "./map/WaterCell";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MapEditInput } from "./MapEditInput";
import { Duck } from "./Duck";
import { CELL_SIZE, TerrainEngine, WATER_CELLS_PER_TERRAIN_CELL } from "./map/TerrainEngine";
import { TerrainCell } from "./map/TerrainCell";
import { Door } from "./map/Door";

export class TestScene {

    public terrainEngine: TerrainEngine;
    public testDuck: Duck;

    constructor(public game: Game, size: number = 40) {

        const light = new HemisphericLight("light", new Vector3(1, 3, -2), game.scene);
        light.intensity = 1;
        light.groundColor = new Color3(0.1, 0.1, 0.1);

        this.terrainEngine = new TerrainEngine(size, size, this.game);
        this.setWidthAndHeight(size, size);
        
        this.terrainEngine.neighbourize();

        game.camera.target.copyFromFloats(this.terrainEngine.width / 2, this.terrainEngine.height / 2, 0);
        game.camera.radius = 50;
        game.camera.alpha = - Math.PI * 0.5;
        game.camera.beta = Math.PI * 0.5;

        this.terrainEngine.initializeRockGenerator().then(() => {
            this.terrainEngine.redrawRocks();
        });

        this.terrainEngine.waterEngine.redraw();

        let mapEditInput = new MapEditInput(game, this.terrainEngine);
        mapEditInput.connect();

        game.scene.onBeforeRenderObservable.add(this._update);

        this.testDuck = new Duck("duck", game, this.terrainEngine);

        document.body.querySelector("#brush-reset-s")?.addEventListener("click", () => {
            this.setWidthAndHeight(20, 20);
        });
        document.body.querySelector("#brush-reset-m")?.addEventListener("click", () => {
            this.setWidthAndHeight(40, 40);
        });
        document.body.querySelector("#brush-reset-l")?.addEventListener("click", () => {
            this.setWidthAndHeight(60, 60);
        });
        document.body.querySelector("#brush-reset-plumbing")?.addEventListener("click", () => {
            this.setWidthAndHeight(40, 40);
            this._addFillAndSinkTest();
        });
    }

    public _update = () => {
        this.terrainEngine.update();

        this.terrainEngine.waterEngine.redraw();
    }

    public setWidthAndHeight(width: number, height: number) {
        this.terrainEngine.setWidthAndHeight(width, height);

        this.terrainEngine.clear();
        if (false) {
            this._generateTest1();
        }
        this._generateTest2();
        
        this.terrainEngine.neighbourize();
        this.terrainEngine.waterEngine.neighbourize();
        this.terrainEngine.redrawRocks();

        this.game.camera.target.copyFromFloats(this.terrainEngine.width / 2, this.terrainEngine.height / 2, 0).scaleInPlace(CELL_SIZE);
        this.game.camera.radius = Math.max(this.terrainEngine.width, this.terrainEngine.height) * 2;
        this.game.camera.lowerRadiusLimit = 15;
        this.game.camera.upperRadiusLimit = Math.max(this.terrainEngine.width, this.terrainEngine.height) * 3;

        if (this.testDuck) {
            this.testDuck.position.copyFromFloats(this.terrainEngine.width / 2, this.terrainEngine.height / 2, 0).scaleInPlace(CELL_SIZE);
        }
    }

    private _generateTest1(): void {
        for (let i = 0; i < this.terrainEngine.width; i++) {
            for (let j = 0; j < this.terrainEngine.height; j++) {
                let cell = new TerrainCell(this.terrainEngine, i, j);
                if (i === 0 || i === this.terrainEngine.width - 1 || j === 0 || j === this.terrainEngine.height - 1) {
                    cell.isSolid = true;
                }
                if (i === 10 && j > 2) {
                    cell.isSolid = true;
                }
                if (j === 20 && i < 7) {
                    cell.isSolid = true;
                }
                if (j === 30 && i < 7) {
                    cell.isSolid = true;
                }
                if (j === 15 && i > 3 && i < 10) {
                    cell.isSolid = true;
                }
                if (j === 25 && i > 3 && i < 10) {
                    cell.isSolid = true;
                }
                if (i === 15 && j < 30) {
                    cell.isSolid = true;
                }
                if (i === 29 && j < 7) {
                    cell.isSolid = true;
                }
                if (!cell.isSolid && i < 10) {
                }
            }
        }
    }

    private _generateTest2(): void {
        for (let i = 0; i < this.terrainEngine.width; i++) {
            for (let j = 0; j < this.terrainEngine.height; j++) {
                let cell = new TerrainCell(this.terrainEngine, i, j);
                cell.isSolid = true;
                for (let ii = 0; ii < WATER_CELLS_PER_TERRAIN_CELL; ii++) {
                    for (let jj = 0; jj < WATER_CELLS_PER_TERRAIN_CELL; jj++) {
                        let waterCell = new WaterCell(this.terrainEngine.waterEngine, WATER_CELLS_PER_TERRAIN_CELL * i + ii, WATER_CELLS_PER_TERRAIN_CELL * j + jj);
                        waterCell.isSolid = false;
                    }
                }
            }
        }

        for (let n = 0; n < this.terrainEngine.width / 2; n++) {
            let i = Math.floor(Math.random() * (this.terrainEngine.width - 2)) + 1;
            let j = Math.floor(Math.random() * (this.terrainEngine.height - 2)) + 1;
            let r = Math.floor(Math.random() * this.terrainEngine.width / 8 + this.terrainEngine.width / 16);
            for (let di = -r; di <= r; di++) {
                for (let dj = -r; dj <= r; dj++) {
                    if (i + di <= 0 || i + di >= this.terrainEngine.width - 1 || j + dj <= 0 || j + dj >= this.terrainEngine.height - 1) {
                        
                    }
                    else if (di * di + dj * dj > (r + 0.5) * (r + 0.5)) {
                        
                    }
                    else {
                        let cell = this.terrainEngine.getCell(i + di, j + dj);
                        if (cell) {
                            cell.isSolid = false;
                        }
                    }
                }
            }
        }

        this.terrainEngine.syncWaterAndRocks();

        for (let i = 0; i < this.terrainEngine.waterEngine.width; i++) {
            for (let j = 0; j < this.terrainEngine.waterEngine.height; j++) {
                let waterCell = this.terrainEngine.waterEngine.getCell(i, j);
                if (waterCell && !waterCell.isSolid) {
                    waterCell.fillLevel = Math.random();
                }
            }
        }

        
        this.terrainEngine.waterEngine.redrawDebugWaterCellsMesh();
    }

    private _addFillAndSinkTest(): void {

        let i = 0;
        let j = 0;
        let r = 5;
        for (let di = -r; di <= r; di++) {
            for (let dj = -r; dj <= r; dj++) {
                if (i + di <= 0 || i + di >= this.terrainEngine.width - 1 || j + dj <= 0 || j + dj >= this.terrainEngine.height - 1) {
                    
                }
                else if (di * di + dj * dj > (r + 0.5) * (r + 0.5)) {
                    
                }
                else {
                    let cell = this.terrainEngine.getCell(i + di, j + dj);
                    if (cell) {
                        cell.isSolid = false;
                    }
                }
            }
        }

        i = this.terrainEngine.width - 1;
        j = this.terrainEngine.height - 1;
        for (let di = -r; di <= r; di++) {
            for (let dj = -r; dj <= r; dj++) {
                if (i + di <= 0 || i + di >= this.terrainEngine.width - 1 || j + dj <= 0 || j + dj >= this.terrainEngine.height - 1) {
                    
                }
                else if (di * di + dj * dj > (r + 0.5) * (r + 0.5)) {
                    
                }
                else {
                    let cell = this.terrainEngine.getCell(i + di, j + dj);
                    if (cell) {
                        cell.isSolid = false;
                    }
                }
            }
        }

        this.terrainEngine.syncWaterAndRocks();
        this.terrainEngine.redrawRocks();

        let sink = this.terrainEngine.waterEngine.getCell(2, 2);
        if (sink) {
            sink.sinkRate = 10;
        }
        let fill = this.terrainEngine.waterEngine.getCell(this.terrainEngine.waterEngine.width - 3, this.terrainEngine.waterEngine.height - 3);
        if (fill) {
            fill.fillRate = 5;
        }
        this.terrainEngine.waterEngine.redrawDebugWaterCellsMesh();

        let door = new Door(8, 8, this.terrainEngine, this.game);
        door.close();
    }
}