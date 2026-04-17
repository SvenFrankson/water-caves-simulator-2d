import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { WaterCell } from "./WaterCell";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Game } from "../Game";
import { MeshBuilder } from "@babylonjs/core";
import { WaterEngine } from "./WaterEngine";
import { RockGenerator } from "./RockGenerator";
import type { TerrainCell } from "./TerrainCell";

export var CELL_SIZE = 1;
export var WATER_CELL_SIZE_RATIO = 1;
export var WATER_CELLS_PER_TERRAIN_CELL = Math.floor(1 / WATER_CELL_SIZE_RATIO);
export var WATER_CELL_SIZE = CELL_SIZE * WATER_CELL_SIZE_RATIO;
export var HALF_WATER_CELL_SIZE = WATER_CELL_SIZE / 2;

export class TerrainEngine {
    
    public cells: TerrainCell[][] = [];

    public frame: Mesh;
    public rockMesh?: Mesh;
    public contourLevel: number = 0.5;

    public rockMaterial: StandardMaterial;
    public frameMaterial: StandardMaterial;

    public rockGenerator: RockGenerator;
    public waterEngine: WaterEngine;

    constructor(public width: number = 20, public height: number = 20, public game: Game) {
        this.rockMaterial = new StandardMaterial("solid-material");
        this.rockMaterial.diffuseColor.set(0.9, 1, 1);
        this.rockMaterial.specularColor.set(0.1, 0.1, 0.1);

        this.frameMaterial = new StandardMaterial("solid-material");
        this.frameMaterial.diffuseColor.set(0.2, 0.2, 0.2);

        this.frame = MeshBuilder.CreateBox("frame", { width: 1, height: 1, depth: 1 });
        this.frame.material = this.frameMaterial;
        
        this.rockMesh = new Mesh("rock-mesh");
        this.rockMesh.material = this.rockMaterial;

        this.waterEngine = new WaterEngine(width * WATER_CELLS_PER_TERRAIN_CELL, height * WATER_CELLS_PER_TERRAIN_CELL, game);
        this.rockGenerator = new RockGenerator(this, this.game);
    }

    public async initializeRockGenerator(): Promise<void> {   
        await this.rockGenerator.init();
    }

    public redrawRocks(): void {   
        if (this.rockGenerator.initialized) {
            let vertexData = this.rockGenerator.generateRockVertexData();
            vertexData.applyToMesh(this.rockMesh!);
        }
    }

    public setWidthAndHeight(width: number, height: number): void {
        this.width = width;
        this.height = height;

        this.frame.position.set(CELL_SIZE * (this.width / 2 - 0.5), CELL_SIZE * (this.height / 2 - 0.5), 0.5 + 0.6);
        this.frame.scaling.set(CELL_SIZE * this.width, CELL_SIZE * this.height, 1);

        this.waterEngine.setWidthAndHeight(width * WATER_CELLS_PER_TERRAIN_CELL, height * WATER_CELLS_PER_TERRAIN_CELL);
    }

    public addCell(cell: TerrainCell) {
        if (!this.cells[cell.i]) {
            this.cells[cell.i] = [];
        }
        this.cells[cell.i][cell.j] = cell;
    }

    public getCell(x: number, y: number): TerrainCell | undefined {
        if (this.cells[x]) {
            return this.cells[x][y];
        }
        return undefined;
    }

    public setWaterCellFillLevel(i: number, j: number, fillLevel: number): void {
        for (let ii = 0; ii < WATER_CELLS_PER_TERRAIN_CELL; ii++) {
            for (let jj = 0; jj < WATER_CELLS_PER_TERRAIN_CELL; jj++) {
                let waterCell = this.waterEngine.getCell(WATER_CELLS_PER_TERRAIN_CELL * i + ii, WATER_CELLS_PER_TERRAIN_CELL * j + jj);
                if (waterCell) {
                    waterCell.fillLevel = fillLevel;
                }
            }
        }
    }

    public neighbourize(): void {
        for (let i = 0; i < this.width; i++) {
            for (let j = 0; j < this.height; j++) {
                let cell = this.getCell(i, j);
                if (cell) {
                    cell.neighbours[0][0] = this.getCell(i - 1, j - 1);
                    cell.neighbours[0][1] = this.getCell(i - 1, j);
                    cell.neighbours[0][2] = this.getCell(i - 1, j + 1);
                    cell.neighbours[1][0] = this.getCell(i, j - 1);
                    cell.neighbours[1][1] = cell;
                    cell.neighbours[1][2] = this.getCell(i, j + 1);
                    cell.neighbours[2][0] = this.getCell(i + 1, j - 1);
                    cell.neighbours[2][1] = this.getCell(i + 1, j);
                    cell.neighbours[2][2] = this.getCell(i + 1, j + 1);
                }
            }
        }
    }

    public syncWaterAndRocks(): void {
        for (let i = 0; i < this.width; i++) {
            for (let j = 0; j < this.height; j++) {
                let cell = this.getCell(i, j);
                for (let ii = 0; ii < WATER_CELLS_PER_TERRAIN_CELL; ii++) {
                    for (let jj = 0; jj < WATER_CELLS_PER_TERRAIN_CELL; jj++) {
                        let waterCell = this.waterEngine.getCell(WATER_CELLS_PER_TERRAIN_CELL * i + ii, WATER_CELLS_PER_TERRAIN_CELL * j + jj);
                        if (cell && waterCell) {
                            waterCell.isSolid = cell.isSolid;
                            if (waterCell.isSolid) {
                                waterCell.fillLevel = 1;
                            }
                        }
                    }
                }
            }
        }
    }

    public update(): void {
        this.waterEngine.update();
    }
}