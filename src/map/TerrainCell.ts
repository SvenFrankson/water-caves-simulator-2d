import type { TerrainEngine } from "./TerrainEngine";

export class TerrainCell {

    public isSolid: boolean = false;

    public neighbours: (TerrainCell | undefined)[][] = [[], [], []];
    public get cellTop(): TerrainCell | undefined {
        return this.neighbours[1][2];
    }
    public get cellRight(): TerrainCell | undefined {
        return this.neighbours[2][1];
    }
    public get cellBottom(): TerrainCell | undefined {
        return this.neighbours[1][0];
    }
    public get cellLeft(): TerrainCell | undefined {
        return this.neighbours[0][1];
    }

    constructor(public terrainEngine: TerrainEngine, public i: number, public j: number) {
        this.terrainEngine.addCell(this);
    }
}