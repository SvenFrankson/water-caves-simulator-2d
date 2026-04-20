import { Vector2, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { WaterCell } from "./WaterCell";
import { EaseOutCirc } from "../Easing";
import type { Game } from "../Game";
import { ColorizeVertexDataInPlace, MergeVertexDatas, MirrorZVertexDataInPlace, RotateAngleAxisVertexDataInPlace, TriFlipVertexDataInPlace } from "../VertexDataUtils";
import { CELL_SIZE, WATER_CELL_SIZE } from "./TerrainEngine";
import { Color3, ImportMeshAsync, Texture } from "@babylonjs/core";

export class WaterEngineVertex {

    public position: Vector3 = Vector3.Zero();
    public connections: WaterEngineVertex[] = [];
    public visibility: number = 0.5;
    public pressure: number = 0.5;

    constructor(public x: number, public y: number, public waterEngine?: WaterEngine) {
        this.position.set(x, y, 0).scaleInPlace(WATER_CELL_SIZE);
    }

    public connectTo(vertex: WaterEngineVertex) {
        if (!this.connections.includes(vertex)) {
            this.connections.push(vertex);
            if (this.connections.length > 2) {
                console.warn("Vertex has more than 2 connections!");
            }

            vertex.connectTo(this);
        }
    }

    public disconnectFrom(vertex: WaterEngineVertex) {
        let index = this.connections.indexOf(vertex);
        if (index >= 0) {
            this.connections.splice(index, 1);
            vertex.disconnectFrom(this);
        }
    }

    public disconnectAll() {
        for (let vertex of this.connections) {
            vertex.disconnectFrom(this);
        }
        this.connections = [];
    }
}

export class WaterEngine {

    public cells: WaterCell[][] = [];
    public contourLevel: number = 0.5;

    public waterMaterial: StandardMaterial;
    public faucetMaterial: StandardMaterial;
    public sinkMaterial: StandardMaterial;
    
    public waterMesh?: Mesh;
    public debugWaterCellMesh?: Mesh;

    public vertices: WaterEngineVertex[][] = [];
    public threshold: number = 0.0001;

    public updatesPerFrame: number = 2;

    public plumbingFaucetVertexData?: VertexData;
    public plumbingSinkVertexData?: VertexData;
    
    constructor(public width: number = 20, public height: number = 20, public game: Game) {
        this.waterMaterial = new StandardMaterial("water-material");
        this.waterMaterial.diffuseTexture = new Texture("water.png", this.game.scene);
        this.waterMaterial.diffuseColor.set(1, 1, 1);
        this.waterMaterial.specularColor.set(0.1, 0.1, 0.1);
        this.waterMaterial.alpha = 0.9;

        this.faucetMaterial = new StandardMaterial("solid-material");
        this.faucetMaterial.diffuseColor.set(0.3, 1, 0.6);
        this.faucetMaterial.specularColor.set(0.3, 0.3, 0.3);

        this.sinkMaterial = new StandardMaterial("solid-material");
        this.sinkMaterial.diffuseColor.set(0.6, 1, 0.3);
        this.sinkMaterial.specularColor.set(0.3, 0.3, 0.3);

        this.setWidthAndHeight(width, height);

        this.waterMesh = new Mesh("water-mesh");
        this.waterMesh.material = this.waterMaterial;
        
        this.debugWaterCellMesh = new Mesh("debug-water-cell-mesh");
    }

    public dispose(): void {
        this.waterMesh?.dispose();
        this.debugWaterCellMesh?.dispose();
    }

    public setWidthAndHeight(width: number, height: number): void {
        this.width = width;
        this.height = height;

        this.vertices = [];
        for (let i = 0; i <= this.width; i++) {
            this.vertices[i] = [];
            for (let j = 0; j <= this.height; j++) {
                this.vertices[i][j] = new WaterEngineVertex(i - 0.5, j - 0.5, this);
            }
        }
    }

    public addCell(cell: WaterCell) {
        if (!this.cells[cell.i]) {
            this.cells[cell.i] = [];
        }
        this.cells[cell.i][cell.j] = cell;
    }

    public getCell(i: number, j: number): WaterCell | undefined {
        if (this.cells[i]) {
            return this.cells[i][j];
        }
        return undefined;
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

    private _pts: Vector3[] = [Vector3.Zero(), Vector3.Zero(), Vector3.Zero(), Vector3.Zero(), Vector3.Zero(), Vector3.Zero(), Vector3.Zero(), Vector3.Zero()];
    private _uvs: Vector2[] = [Vector2.Zero(), Vector2.Zero(), Vector2.Zero(), Vector2.Zero()];
    private _visibilities: number[] = [0, 0, 0, 0];
    private _pressures: number[] = [0, 0, 0, 0];

    private async _initializePlumbingVertexData(): Promise<void> {
        if (!this.plumbingFaucetVertexData) {
            return new Promise((resolve) => {
                ImportMeshAsync("meshes/plumbing.gltf", this.game.scene).then(data => {

                    let sinkFrame = data.meshes.find(m => m.name === "1-sink_primitive1");
                    let sinkHole = data.meshes.find(m => m.name === "1-sink_primitive0");
                    if (sinkFrame instanceof Mesh && sinkHole instanceof Mesh) {
                        let sinkFrameVData = VertexData.ExtractFromMesh(sinkFrame);
                        ColorizeVertexDataInPlace(sinkFrameVData, new Color3(1, 1, 1));
                        let sinkHoleVData = VertexData.ExtractFromMesh(sinkHole);
                        ColorizeVertexDataInPlace(sinkHoleVData, new Color3(0, 0, 0));
                        let vData = MergeVertexDatas(sinkFrameVData, sinkHoleVData);

                        MirrorZVertexDataInPlace(vData);
                        TriFlipVertexDataInPlace(vData);
                        RotateAngleAxisVertexDataInPlace(vData, Math.PI, new Vector3(0, 1, 0));
                        
                        this.plumbingSinkVertexData = vData;

                    }

                    data.meshes.forEach(mesh => {
                        if (mesh instanceof Mesh && mesh.name === "0-faucet") {
                            let vData = VertexData.ExtractFromMesh(mesh);
                            ColorizeVertexDataInPlace(vData, new Color3(1, 1, 1));
                            MirrorZVertexDataInPlace(vData);
                            TriFlipVertexDataInPlace(vData);
                            RotateAngleAxisVertexDataInPlace(vData, Math.PI, new Vector3(0, 1, 0));
                            
                            this.plumbingFaucetVertexData = vData;
                        }

                        mesh.dispose(true);
                    });
                    resolve();
                });
            });
        }
    }

    public async redrawDebugWaterCellsMesh(): Promise<void> {
        this.debugWaterCellMesh?.dispose();
        this.debugWaterCellMesh = new Mesh("debug-water-cell-mesh");

        await this._initializePlumbingVertexData();

        for (let i = 0; i < this.width; i++) {
            for (let j = 0; j < this.height; j++) {
                let cell = this.getCell(i, j);
                if (cell) {
                    if (cell.sinkRate > 0) {
                        let box = MeshBuilder.CreateBox("sink-box", { width : WATER_CELL_SIZE * 0.5, height: WATER_CELL_SIZE * 0.5, depth: CELL_SIZE * 2 }, this.game.scene);
                        this.plumbingSinkVertexData?.applyToMesh(box);
                        box.position.set(cell.i * WATER_CELL_SIZE, cell.j * WATER_CELL_SIZE, 0);
                        box.rotation.set(0, 0, Math.PI);
                        box.parent = this.debugWaterCellMesh;
                        box.material = this.sinkMaterial;
                    }
                    else if (cell.fillRate > 0) {
                        let box = MeshBuilder.CreateBox("fill-box", { width : WATER_CELL_SIZE * 0.5, height: WATER_CELL_SIZE * 0.5, depth: CELL_SIZE * 2 }, this.game.scene);
                        this.plumbingFaucetVertexData?.applyToMesh(box);
                        box.position.set(cell.i * WATER_CELL_SIZE, cell.j * WATER_CELL_SIZE, 0);
                        box.parent = this.debugWaterCellMesh;
                        box.material = this.faucetMaterial;
                    }
                }
            }
        }
    }

    public redraw() {
        this.updateVertices();

        for (let i = 0; i < this.cells.length; i++) {
            const column = this.cells[i];
            if (column) {
                for (let j = 0; j < column.length; j++) {
                    const cell = column[j];
                    if (cell) {
                        if (!cell.isSolid) {
                            if (cell.fillLevel >= this.threshold) {
                                let visibility = EaseOutCirc(cell.visibleFillLevel);

                                this.vertices[cell.i][cell.j].visibility *= 0.9;
                                this.vertices[cell.i][cell.j].visibility += visibility * 0.1;
                                this.vertices[cell.i + 1][cell.j].visibility *= 0.9;
                                this.vertices[cell.i + 1][cell.j].visibility += visibility * 0.1;
                                this.vertices[cell.i][cell.j + 1].visibility *= 0.9;
                                this.vertices[cell.i][cell.j + 1].visibility += visibility * 0.1;
                                this.vertices[cell.i + 1][cell.j + 1].visibility *= 0.9;
                                this.vertices[cell.i + 1][cell.j + 1].visibility += visibility * 0.1;

                                let pressure = cell.pressure;
                                this.vertices[cell.i][cell.j].pressure *= 0.9;
                                this.vertices[cell.i][cell.j].pressure += pressure * 0.1;
                                this.vertices[cell.i + 1][cell.j].pressure *= 0.9;
                                this.vertices[cell.i + 1][cell.j].pressure += pressure * 0.1;
                                this.vertices[cell.i][cell.j + 1].pressure *= 0.9;
                                this.vertices[cell.i][cell.j + 1].pressure += pressure * 0.1;
                                this.vertices[cell.i + 1][cell.j + 1].pressure *= 0.9;
                                this.vertices[cell.i + 1][cell.j + 1].pressure += pressure * 0.1;
                            }
                        }
                    }
                }
            }
        }

        let vertexDataParts: VertexData[] = [];
        for (let i = 0; i < this.cells.length; i++) {
            const column = this.cells[i];
            if (column) {
                for (let j = 0; j < column.length; j++) {
                    const cell = column[j];
                    if (cell) {
                        if (!cell.isSolid) {
                            if (cell.fillLevel < this.threshold) {
                                
                            }
                            else {
                                let pts = this._pts;
                                pts[0].copyFrom(this.vertices[cell.i][cell.j].position);
                                pts[1].copyFrom(this.vertices[cell.i + 1][cell.j].position);
                                pts[2].copyFrom(this.vertices[cell.i + 1][cell.j + 1].position);
                                pts[3].copyFrom(this.vertices[cell.i][cell.j + 1].position);
                                pts[4].copyFrom(this.vertices[cell.i][cell.j].position);
                                pts[5].copyFrom(this.vertices[cell.i + 1][cell.j].position);
                                pts[6].copyFrom(this.vertices[cell.i + 1][cell.j + 1].position);
                                pts[7].copyFrom(this.vertices[cell.i][cell.j + 1].position);

                                let visibilities = this._visibilities;
                                visibilities[0] = this.vertices[cell.i][cell.j].visibility;
                                visibilities[1] = this.vertices[cell.i + 1][cell.j].visibility;
                                visibilities[2] = this.vertices[cell.i + 1][cell.j + 1].visibility;
                                visibilities[3] = this.vertices[cell.i][cell.j + 1].visibility;
                                
                                let f = (x: number) => {
                                    return Math.cos(x * Math.PI) * 0.5 + 0.5;
                                }
                                let pressures = this._pressures;
                                pressures[0] = this.vertices[cell.i][cell.j].pressure / 3;
                                pressures[0] = f(pressures[0]);
                                pressures[1] = this.vertices[cell.i + 1][cell.j].pressure / 3;
                                pressures[1] = f(pressures[1]);
                                pressures[2] = this.vertices[cell.i + 1][cell.j + 1].pressure / 3;
                                pressures[2] = f(pressures[2]);
                                pressures[3] = this.vertices[cell.i][cell.j + 1].pressure / 3;
                                pressures[3] = f(pressures[3]);
                                
                                pts[0].z = - visibilities[0] * 0.5;
                                pts[1].z = - visibilities[1] * 0.5;
                                pts[2].z = - visibilities[2] * 0.5;
                                pts[3].z = - visibilities[3] * 0.5;
                                pts[4].z = visibilities[0] * 0.5;
                                pts[5].z = visibilities[1] * 0.5;
                                pts[6].z = visibilities[2] * 0.5;
                                pts[7].z = visibilities[3] * 0.5;

                                let vertexData = new VertexData();
                                vertexData.positions = [
                                    pts[0].x, pts[0].y, pts[0].z,
                                    pts[1].x, pts[1].y, pts[1].z,
                                    pts[2].x, pts[2].y, pts[2].z,
                                    pts[3].x, pts[3].y, pts[3].z,
                                    
                                    pts[5].x, pts[5].y, pts[5].z,
                                    pts[4].x, pts[4].y, pts[4].z,
                                    pts[7].x, pts[7].y, pts[7].z,
                                    pts[6].x, pts[6].y, pts[6].z
                                ];
                                vertexData.uvs = [
                                    pts[0].x + cell.uvPos.x, pts[0].y + cell.uvPos.y,
                                    pts[1].x + cell.uvPos.x, pts[1].y + cell.uvPos.y,
                                    pts[2].x + cell.uvPos.x, pts[2].y + cell.uvPos.y,
                                    pts[3].x + cell.uvPos.x, pts[3].y + cell.uvPos.y,
                                    pts[1].x + cell.uvPos.x, pts[1].y + cell.uvPos.y,
                                    pts[0].x + cell.uvPos.x, pts[0].y + cell.uvPos.y,
                                    pts[3].x + cell.uvPos.x, pts[3].y + cell.uvPos.y,
                                    pts[2].x + cell.uvPos.x, pts[2].y + cell.uvPos.y
                                ];
                                vertexData.indices = [
                                    0, 1, 2, 0, 2, 3,
                                    4, 5, 6, 4, 6, 7
                                ];

                                vertexData.colors = [
                                    1 - visibilities[0], 1, 1, visibilities[0],
                                    1 - visibilities[1], 1, 1, visibilities[1],
                                    1 - visibilities[2], 1, 1, visibilities[2],
                                    1 - visibilities[3], 1, 1, visibilities[3],
                                    1 - visibilities[0], 1, 1, visibilities[0],
                                    1 - visibilities[1], 1, 1, visibilities[1],
                                    1 - visibilities[2], 1, 1, visibilities[2],
                                    1 - visibilities[3], 1, 1, visibilities[3]
                                ];

                                /*
                                vertexData.colors = [
                                    pressures[0], 0, 1 - pressures[0], 1,
                                    pressures[1], 0, 1 - pressures[1], 1,
                                    pressures[2], 0, 1 - pressures[2], 1,
                                    pressures[3], 0, 1 - pressures[3], 1,
                                    pressures[0], 0, 1 - pressures[0], 1,
                                    pressures[1], 0, 1 - pressures[1], 1,
                                    pressures[2], 0, 1 - pressures[2], 1,
                                    pressures[3], 0, 1 - pressures[3], 1
                                ];
                                */

                                if (cell && cell.cellTop && (cell.cellTop.fillLevel < this.threshold || cell.cellTop.isSolid)) {
                                    let n = vertexData.positions.length / 3;

                                    vertexData.positions.push(pts[3].x, pts[3].y, pts[3].z);
                                    vertexData.positions.push(pts[2].x, pts[2].y, pts[2].z);
                                    vertexData.positions.push(pts[6].x, pts[6].y, pts[6].z);
                                    vertexData.positions.push(pts[7].x, pts[7].y, pts[7].z);

                                    vertexData.uvs.push(pts[3].x + cell.uvPos.x, pts[3].z + cell.uvPos.z);
                                    vertexData.uvs.push(pts[2].x + cell.uvPos.x, pts[2].z + cell.uvPos.z);
                                    vertexData.uvs.push(pts[6].x + cell.uvPos.x, pts[6].z + cell.uvPos.z);
                                    vertexData.uvs.push(pts[7].x + cell.uvPos.x, pts[7].z + cell.uvPos.z);

                                    vertexData.indices.push(n, n + 1, n + 2, n, n + 2, n + 3);

                                    vertexData.colors.push(1 - visibilities[3] * 0.5, 1, 1, visibilities[3]);
                                    vertexData.colors.push(1 - visibilities[2] * 0.5, 1, 1, visibilities[2]);
                                    vertexData.colors.push(1 - visibilities[2] * 0.5, 1, 1, visibilities[2]);
                                    vertexData.colors.push(1 - visibilities[3] * 0.5, 1, 1, visibilities[3]);
                                }
                                if (cell && cell.cellRight && (cell.cellRight.fillLevel < this.threshold || cell.cellRight.isSolid)) {
                                    let n = vertexData.positions.length / 3;
                                    vertexData.positions.push(pts[1].x, pts[1].y, pts[1].z);
                                    vertexData.positions.push(pts[5].x, pts[5].y, pts[5].z);
                                    vertexData.positions.push(pts[6].x, pts[6].y, pts[6].z);
                                    vertexData.positions.push(pts[2].x, pts[2].y, pts[2].z);

                                    vertexData.uvs.push(pts[1].x + cell.uvPos.x, pts[1].z + cell.uvPos.z);
                                    vertexData.uvs.push(pts[5].x + cell.uvPos.x, pts[5].z + cell.uvPos.z);
                                    vertexData.uvs.push(pts[6].x + cell.uvPos.x, pts[6].z + cell.uvPos.z);
                                    vertexData.uvs.push(pts[2].x + cell.uvPos.x, pts[2].z + cell.uvPos.z);

                                    vertexData.indices.push(n, n + 1, n + 2, n, n + 2, n + 3);

                                    vertexData.colors.push(1 - visibilities[1], 1, 1, visibilities[1]);
                                    vertexData.colors.push(1 - visibilities[5 - 4], 1, 1, visibilities[5 - 4]);
                                    vertexData.colors.push(1 - visibilities[6 - 4], 1, 1, visibilities[6 - 4]);
                                    vertexData.colors.push(1 - visibilities[2], 1, 1, visibilities[2]);
                                }
                                if (cell && cell.cellLeft && (cell.cellLeft.fillLevel < this.threshold || cell.cellLeft.isSolid)) {
                                    let n = vertexData.positions.length / 3;
                                    vertexData.positions.push(pts[4].x, pts[4].y, pts[4].z);
                                    vertexData.positions.push(pts[0].x, pts[0].y, pts[0].z);
                                    vertexData.positions.push(pts[3].x, pts[3].y, pts[3].z);
                                    vertexData.positions.push(pts[7].x, pts[7].y, pts[7].z);

                                    vertexData.uvs.push(pts[4].x + cell.uvPos.x, pts[4].z + cell.uvPos.z);
                                    vertexData.uvs.push(pts[0].x + cell.uvPos.x, pts[0].z + cell.uvPos.z);
                                    vertexData.uvs.push(pts[3].x + cell.uvPos.x, pts[3].z + cell.uvPos.z);
                                    vertexData.uvs.push(pts[7].x + cell.uvPos.x, pts[7].z + cell.uvPos.z);

                                    vertexData.indices.push(n, n + 1, n + 2, n, n + 2, n + 3);

                                    vertexData.colors.push(1 - visibilities[4 - 4], 1, 1, visibilities[4 - 4]);
                                    vertexData.colors.push(1 - visibilities[0], 1, 1, visibilities[0]);
                                    vertexData.colors.push(1 - visibilities[3], 1, 1, visibilities[3]);
                                    vertexData.colors.push(1 - visibilities[7 - 4], 1, 1, visibilities[7 - 4]);
                                }

                                let r = cell.flowDirection.length() * 4;
                                for (let i = 0; i < vertexData.colors.length / 4; i++) {
                                    vertexData.colors[i * 4 + 0] = r;
                                    vertexData.colors[i * 4 + 1] = 1;
                                    vertexData.colors[i * 4 + 2] = 1;
                                    vertexData.colors[i * 4 + 3] = 1;
                                }

                                vertexData.normals = [];
                                VertexData.ComputeNormals(vertexData.positions, vertexData.indices, vertexData.normals);

                                vertexDataParts.push(vertexData);
                            }
                        }
                    }
                }
            }
        }

        MergeVertexDatas(...vertexDataParts).applyToMesh(this.waterMesh!);
        if (this.waterMesh) {
            this.waterMesh.refreshBoundingInfo();
        }
    }

    public disconnectAllVertices() {
        for (let i = 0; i <= this.width; i++) {
            for (let j = 0; j <= this.height; j++) {
                this.vertices[i][j].disconnectAll();
            }
        }
    }

    public updateVertices() {
        let threshold = this.threshold / 10;

        for (let i = 0; i <= this.width; i++) {
            for (let j = 0; j <= this.height; j++) {
                let vertex = this.vertices[i][j];

                let cell00 = this.getCell(i - 1, j - 1);
                let cell10 = this.getCell(i, j - 1);
                let cell01 = this.getCell(i - 1, j);
                let cell11 = this.getCell(i, j);

                let needDraw: number = 0;
                if (!cell00 || cell00.isSolid || cell00.visibleFillLevel < threshold) {
                    needDraw++;
                }
                if (!cell10 || cell10.isSolid || cell10.visibleFillLevel < threshold) {
                    needDraw += 2;
                }
                if (!cell01 || cell01.isSolid || cell01.visibleFillLevel < threshold) {
                    needDraw += 4;
                }
                if (!cell11 || cell11.isSolid || cell11.visibleFillLevel < threshold) {
                    needDraw += 8;
                }

                if (needDraw === 0) {
                    vertex.position.x = vertex.position.x * 0.95 + WATER_CELL_SIZE * (i - 0.5) * 0.05;
                    vertex.position.y = vertex.position.y * 0.95 + WATER_CELL_SIZE * (j - 0.5) * 0.05;
                    continue;
                }
                if (needDraw === 15) {
                    continue;
                }

                let f = 0.5;
                let newP = Vector2.Zero();
                let count = 0;
                if (cell00 && !cell00.isSolid && cell00.visibleFillLevel >= threshold) {
                    newP.addInPlace(cell00.corners[1][1].scale(1 - cell00.visibleFillLevel));
                    count += 1 - cell00.visibleFillLevel;
                }
                if (cell10 && !cell10.isSolid && cell10.visibleFillLevel >= threshold) {
                    newP.addInPlace(cell10.corners[0][1].scale(1 - cell10.visibleFillLevel));
                    count += 1 - cell10.visibleFillLevel;
                }
                if (cell01 && !cell01.isSolid && cell01.visibleFillLevel >= threshold) {
                    newP.addInPlace(cell01.corners[1][0].scale(1 - cell01.visibleFillLevel));
                    count += 1 - cell01.visibleFillLevel;
                }
                if (cell11 && !cell11.isSolid && cell11.visibleFillLevel >= threshold) {
                    newP.addInPlace(cell11.corners[0][0].scale(1 - cell11.visibleFillLevel));
                    count += 1 - cell11.visibleFillLevel;
                }

                if (count < threshold) {
                    
                }
                else {
                    newP.scaleInPlace(1 / count);
                    vertex.position.x = vertex.position.x * f + newP.x * (1 - f);
                    vertex.position.y = vertex.position.y * f + newP.y * (1 - f);
                }
            }
        }
    }

    private _ticTac: number = 0;
    public update(): void {
        this._ticTac = (this._ticTac + 1) % 2;
        for (let i = 0; i < this.cells.length; i++) {
            let column: WaterCell[];
            if (this._ticTac === 0) {
                column = this.cells[i];
            }
            else {
                column = this.cells[this.cells.length - 1 - i];
            }
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