import { Color3, ImportMeshAsync, Mesh, StandardMaterial, Vector3, VertexData } from "@babylonjs/core";
import type { Game } from "../Game";
import { ColorizeVertexDataInPlace, GetGLTFVertexData, MirrorZVertexDataInPlace, TriFlipVertexDataInPlace } from "../VertexDataUtils";
import { CELL_SIZE, WATER_CELLS_PER_TERRAIN_CELL, type TerrainEngine } from "./TerrainEngine";
import { MapObject } from "./MapObject";
import { MakeStandardMaterial } from "../MaterialUtils";
import { AnimationFactory } from "../AnimationFactory";

export class Door extends MapObject {

    public core: Mesh;
    public redMaterial: StandardMaterial;
    public greenMaterial: StandardMaterial;

    public animatePosition = AnimationFactory.EmptyVector3Callback;

    constructor(i: number, j: number, terrainEngine: TerrainEngine, public game: Game) {
        super("door", i, j, terrainEngine);

        this.terrainEngine.addObject(this);
        this.position.copyFromFloats(i * CELL_SIZE, j * CELL_SIZE, 0);

        this.core = new Mesh("door-core", this.game.scene);
        this.core.parent = this;

        this.material = MakeStandardMaterial(new Color3(0.05, 0.05, 0.1), 0.4, 0.2);
        this.redMaterial = MakeStandardMaterial(new Color3(0.9, 0.2, 0.2));
        this.greenMaterial = MakeStandardMaterial(new Color3(0.2, 0.9, 0.2));

        this.animatePosition = AnimationFactory.CreateVector3(this, this, "position")
        this.instantiate();        
    }

    public dispose(): void {
        this.terrainEngine.removeObject(this);
        super.dispose();
    }

    public async instantiate(): Promise<void> {
        let vData = await GetGLTFVertexData("meshes/plumbing.gltf", "door", this.game.scene);
        if (vData) {
            vData.applyToMesh(this);
        }
        let coreVData = await GetGLTFVertexData("meshes/plumbing.gltf", "door-core", this.game.scene);
        if (coreVData) {
            coreVData.applyToMesh(this.core);
        }
    }

    public closed: boolean = true;

    public open(): void {
        this.closed = false;
        this.core.material = this.greenMaterial;
        this.animatePosition(new Vector3(this.position.x, this.position.y, 0.8), 0.5);
        setTimeout(() => {
            this.updateWaterCells();
        }, 250);
    }

    public close(): void {
        this.closed = true;
        this.core.material = this.redMaterial;
        this.animatePosition(new Vector3(this.position.x, this.position.y, 0), 0.5);
        setTimeout(() => {
            this.updateWaterCells();
        }, 250);
    }

    public updateWaterCells(): void {
        for (let j = -1; j <= 1; j++) {
            let cell = this.terrainEngine.getCell(this.i, this.j + j);
            if (cell) {
                for (let ii = 0; ii < WATER_CELLS_PER_TERRAIN_CELL; ii++) {
                    for (let jj = 0; jj < WATER_CELLS_PER_TERRAIN_CELL; jj++) {
                        let waterCell = this.terrainEngine.waterEngine.getCell(this.i * WATER_CELLS_PER_TERRAIN_CELL + ii, (this.j + j) * WATER_CELLS_PER_TERRAIN_CELL + jj);
                        if (waterCell) {
                            if (this.closed) {
                                waterCell.isSolid = true;
                                waterCell.fillLevel = 1;
                            }
                            else {
                                waterCell.isSolid = false;
                                waterCell.fillLevel = 0;
                            }
                        }
                    }
                }
            }
        }
    }
}