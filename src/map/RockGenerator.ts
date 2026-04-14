import { ImportMeshAsync, Mesh, Vector3, VertexData } from "@babylonjs/core";
import type { WaterEngine } from "./WaterEngine";
import type { Game } from "../Game";
import { CloneVertexData, MergeVertexDatas, RotateAngleAxisVertexDataInPlace, RotateVertexDataInPlace, TranslateVertexDataInPlace } from "../VertexDataUtils";

export class RockGenerator {

    public partialVertexDatas: VertexData[] = [];
    public initialized: boolean = false;
    
    constructor(public waterEngine: WaterEngine, public game: Game) {

    }

    public async init(): Promise<void> {
        let data = await ImportMeshAsync("public/meshes/blocks.babylon", this.game.scene);
        
        let block1000 = data.meshes.find(mesh => mesh.name === "1000-block");
        let block1100 = data.meshes.find(mesh => mesh.name === "1100-block");
        let block1101 = data.meshes.find(mesh => mesh.name === "1101-block");
        let block1111 = data.meshes.find(mesh => mesh.name === "1111-block");
        let block1010 = data.meshes.find(mesh => mesh.name === "1010-block");

        if (block1000 instanceof Mesh && block1100 instanceof Mesh && block1101 instanceof Mesh && block1111 instanceof Mesh && block1010 instanceof Mesh) {
            let vertexData1000 = VertexData.ExtractFromMesh(block1000);
            let vertexData1100 = VertexData.ExtractFromMesh(block1100);
            let vertexData1101 = VertexData.ExtractFromMesh(block1101);
            let vertexData1111 = VertexData.ExtractFromMesh(block1111);
            let vertexData1010 = VertexData.ExtractFromMesh(block1010);

            
            this.partialVertexDatas[1] = vertexData1000;
            this.partialVertexDatas[2] = RotateAngleAxisVertexDataInPlace(CloneVertexData(vertexData1000), Math.PI / 2, new Vector3(0, 0, 1));
            this.partialVertexDatas[3] = vertexData1100;
            this.partialVertexDatas[4] = RotateAngleAxisVertexDataInPlace(CloneVertexData(vertexData1000), Math.PI, new Vector3(0, 0, 1));
            this.partialVertexDatas[6] = RotateAngleAxisVertexDataInPlace(CloneVertexData(vertexData1100), Math.PI / 2, new Vector3(0, 0, 1));
            this.partialVertexDatas[7] = RotateAngleAxisVertexDataInPlace(CloneVertexData(vertexData1101), Math.PI / 2, new Vector3(0, 0, 1));
            this.partialVertexDatas[8] = RotateAngleAxisVertexDataInPlace(CloneVertexData(vertexData1000), 3 * Math.PI / 2, new Vector3(0, 0, 1));
            this.partialVertexDatas[9] = RotateAngleAxisVertexDataInPlace(CloneVertexData(vertexData1100), 3 * Math.PI / 2, new Vector3(0, 0, 1));
            this.partialVertexDatas[11] = vertexData1101;
            this.partialVertexDatas[12] = RotateAngleAxisVertexDataInPlace(CloneVertexData(vertexData1100), Math.PI, new Vector3(0, 0, 1));
            this.partialVertexDatas[13] = RotateAngleAxisVertexDataInPlace(CloneVertexData(vertexData1101), 3 * Math.PI / 2, new Vector3(0, 0, 1));
            this.partialVertexDatas[14] = RotateAngleAxisVertexDataInPlace(CloneVertexData(vertexData1101), Math.PI, new Vector3(0, 0, 1));
            this.partialVertexDatas[15] = vertexData1111;

            this.partialVertexDatas[5] = vertexData1010;
            this.partialVertexDatas[10] = RotateAngleAxisVertexDataInPlace(CloneVertexData(vertexData1010), Math.PI / 2, new Vector3(0, 0, 1));
        }

        this.initialized = true;
    }

    public generateRockVertexData(): VertexData {
        let vertexDataParts: VertexData[] = [];

        for (let i = 0; i < this.waterEngine.width; i++) {
            for (let j = 0; j < this.waterEngine.height; j++) {
                let cell00 = this.waterEngine.getCell(i, j);
                let cell10 = this.waterEngine.getCell(i + 1, j);
                let cell11 = this.waterEngine.getCell(i + 1, j + 1);
                let cell01 = this.waterEngine.getCell(i, j + 1);

                let ref = 0;
                if (cell00 && cell00.isSolid) {
                    ref += 1;
                }
                if (cell10 && cell10.isSolid) {
                    ref += 2;
                }
                if (cell11 && cell11.isSolid) {
                    ref += 4;
                }
                if (cell01 && cell01.isSolid) {
                    ref += 8;
                }

                let vertexDataPart = this.partialVertexDatas[ref];
                if (vertexDataPart) {
                    let vertexDataPartClone = CloneVertexData(vertexDataPart);
                    TranslateVertexDataInPlace(vertexDataPartClone, new Vector3(i + 0.5, j + 0.5, 0));
                    vertexDataParts.push(vertexDataPartClone);
                }
            }
        }

        return MergeVertexDatas(...vertexDataParts);
    }
}