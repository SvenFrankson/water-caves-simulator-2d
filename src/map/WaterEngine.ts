import { Mesh, MeshBuilder, StandardMaterial } from "@babylonjs/core";
import { WaterCell } from "./WaterCell";

export class WaterEngine {

    public cells: WaterCell[][] = [];

    public solidMaterial: StandardMaterial;
    public waterMaterial: StandardMaterial;
    public testMeshes?: Mesh[][] = [];
    
    constructor() {
        this.solidMaterial = new StandardMaterial("solid-material");
        this.solidMaterial.diffuseColor.set(0.5, 0.5, 0.5);

        this.waterMaterial = new StandardMaterial("water-material");
        this.waterMaterial.diffuseColor.set(0, 0, 1);
    }

    public addCell(cell: WaterCell) {
        if (!this.cells[cell.x]) {
            this.cells[cell.x] = [];
        }
        this.cells[cell.x][cell.y] = cell;
    }

    public getCell(x: number, y: number): WaterCell | undefined {
        if (this.cells[x]) {
            return this.cells[x][y];
        }
        return undefined;
    }

    public redraw() {

        for (let i = 0; i < this.cells.length; i++) {
            const column = this.cells[i];
            if (column) {
                for (let j = 0; j < column.length; j++) {
                    const cell = column[j];
                    if (cell) {
                        let cellMesh = this.testMeshes?.[i]?.[j];
                        if (!cellMesh) {
                            cellMesh = MeshBuilder.CreatePlane("cell-" + i + "-" + j, { size: 1 });
                            let material = new StandardMaterial("cell-" + i + "-" + j + "-material");
                            material.diffuseColor.set(0.5, 0.5, 0.5);
                            cellMesh.material = material;
                            cellMesh.position.set(i, j, 0);
                            if (!this.testMeshes) {
                                this.testMeshes = [];
                            }
                            if (!this.testMeshes[i]) {
                                this.testMeshes[i] = [];
                            }
                            this.testMeshes[i][j] = cellMesh;
                        }
                        if (!cell.isSolid) {
                            cellMesh.scaling.y = cell.fillLevel;
                            cellMesh.position.y = j - 0.5 + cell.fillLevel / 2;
                            if (cellMesh.material instanceof StandardMaterial) {
                                cellMesh.material.diffuseColor.set(cell.pressure, 0, 1 - cell.pressure);
                            }
                        }
                    }
                }
            }
        }
    }

    public update(): void {
        let i0 = Math.floor(Math.random() * this.cells.length);
        for (let i = 0; i < this.cells.length; i++) {
            const column = this.cells[(i + i0) % this.cells.length];
            if (column) {
                for (let j = 0; j < column.length; j++) {
                    const cell = column[j];
                    if (cell) {
                        cell.step();
                    }
                }
            }
        }
    }
}