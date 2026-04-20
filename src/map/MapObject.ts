import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Game } from "../Game";
import type { TerrainEngine } from "./TerrainEngine";

export class MapObject extends Mesh {

    constructor(name: string, public i: number, public j: number, public terrainEngine: TerrainEngine) {
        super(name);
    }

    public updateWaterCells(): void { }
}