import { Mesh, VertexData } from "@babylonjs/core/Meshes";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import type { WaterEngine } from "./map/WaterEngine";
import type { Game } from "./Game";
import { registerBuiltInLoaders } from "@babylonjs/loaders/dynamic";
import { Color3, StandardMaterial, Vector3 } from "@babylonjs/core";
import { ColorizeVertexDataInPlace, MirrorZVertexDataInPlace, TriFlipVertexDataInPlace } from "./VertexDataUtils";
registerBuiltInLoaders();

export class Duck extends Mesh {

    public velocity: Vector3 = Vector3.Zero();
    public lateralVelocity: number = 0;
    public dragX = 0.5;
    public dragY = 0.5;
    
    constructor(name: string, public game: Game, public waterEngine: WaterEngine) {
        super(name);
        this.position.copyFromFloats(waterEngine.width / 2, waterEngine.height / 2, 0).scaleInPlace(waterEngine.cellSize);

        ImportMeshAsync("meshes/duck.gltf", this.game.scene).then(data => {
            data.meshes.forEach(mesh => {

                let myMesh = new Mesh(mesh.name + "_col", this.game.scene);
                myMesh.parent = this;
                myMesh.position.copyFromFloats(0, 0, 0);
                myMesh.rotation.copyFromFloats(0, 0, 0);
                myMesh.scaling.copyFromFloats(1, 1, 1);

                
                if (mesh instanceof Mesh) {
                    let vData = VertexData.ExtractFromMesh(mesh);
                    ColorizeVertexDataInPlace(vData, new Color3(1, 1, 1));
                    MirrorZVertexDataInPlace(vData);
                    TriFlipVertexDataInPlace(vData);
                    vData.applyToMesh(myMesh);
                }
                
                let material = new StandardMaterial(mesh.name + "_std", this.game.scene);
                //material.diffuseColor = mesh.material.albedoColor;
                material.diffuseColor.copyFromFloats(1, 1, 0);
                material.specularColor = new Color3(0.3, 0.3, 0.3);
                material.emissiveColor = new Color3(0.4, 0.4, 0.4);
                myMesh.material = material;

                mesh.dispose(true);
            });
        });

        this.game.scene.onBeforeRenderObservable.add(this._update);
    }

    private _update = () => {
        let dt = this.game.engine.getDeltaTime() / 1000;
        dt = Math.min(dt, 0.1);

        let i = Math.round(this.position.x / this.waterEngine.cellSize);
        let j = Math.round(this.position.y / this.waterEngine.cellSize);
        let cell = this.waterEngine.getCell(i, j);
        let cellAbove = cell?.cellTop;
        let flowX = 0;
        let flowY = 0;
        if (cell) {
            let targetY = 0;
            let fill = 0;
            if (!cell.isSolid && cell.fillLevel > 0.0001) {
                targetY = Math.max(targetY, (cell.corners[0][1].y + cell.corners[1][1].y) / 2);
                fill = Math.max(fill, cell.fillLevel);
                flowX = cell.flowDirection.x;
                flowY = cell.flowDirection.y;

                //targetY = Math.max(targetY, cell.y - 0.5 + cell.visibleFillLevel);
            }
            if (cellAbove && !cellAbove.isSolid && cellAbove.fillLevel > 0.0001) {
                targetY = Math.max(targetY, (cellAbove.corners[0][1].y + cellAbove.corners[1][1].y) / 2);
                fill = Math.max(fill, cellAbove.fillLevel);
                if (Math.abs(cellAbove.flowDirection.x) > Math.abs(flowX)) {
                    flowX = cellAbove.flowDirection.x;
                }
                if (Math.abs(cellAbove.flowDirection.y) > Math.abs(flowY)) {
                    flowY = cellAbove.flowDirection.y;
                }

                //targetY = Math.max(targetY, cellAbove.y - 0.5 + cellAbove.visibleFillLevel);
            }
            /*
            DrawDebugLine(
                new Vector3(cell.x, targetY, 2),
                new Vector3(cell.x, targetY, -2),
                2,
            )
            DrawDebugLine(
                new Vector3(cell.x, cell.y, 2),
                new Vector3(cell.x, cell.y, -2),
                2,
                Color3.Red()
            )
            */
            
            let dY = targetY - this.position.y;
            if (dY > 0) {
                dY = Math.min(dY, 0.5);
                this.velocity.y += fill * 100 * dY * dt;
                this.dragX = 2;
                this.dragY = 5;
            }
            else {
                this.dragX = this.dragX * 0.5 + 0.01 * 0.5;
                this.dragY = this.dragY * 0.5 + 0.01 * 0.5;
            }
            let dragForce = new Vector3(this.velocity.x * -this.dragX, this.velocity.y * -this.dragY, 0);
            this.velocity.addInPlace(dragForce.scale(1 * dt));
            this.velocity.addInPlace(new Vector3(0, -9.81, 0).scale(1 * dt));
            this.velocity.x += 200 * flowX * dt;
            this.velocity.y += 200 * flowY * dt;

            this.lateralVelocity = this.lateralVelocity * 0.9 + this.velocity.x * 0.1;

            this.rotation.y += this.velocity.length() * 0.5 * dt;
            this.rotation.z = - this.lateralVelocity * 0.1;

            let r = 0.5;
            let s = 0.6;
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    let neighbour = cell.neighbours[i][j];
                    if (neighbour && neighbour.isSolid) {
                        let dx = this.position.x - neighbour.i * this.waterEngine.cellSize;
                        let dy = (this.position.y + 0.5) - neighbour.j * this.waterEngine.cellSize;
                        if (Math.abs(dx) < r + s || Math.abs(dy) < r + s) {
                            let projX = Math.min(neighbour.i * this.waterEngine.cellSize + r, Math.max(neighbour.i * this.waterEngine.cellSize - r, this.position.x));
                            let projY = Math.min(neighbour.j * this.waterEngine.cellSize + r, Math.max(neighbour.j * this.waterEngine.cellSize - r, this.position.y + 0.5));
                            let d = Math.sqrt((this.position.x - projX) ** 2 + (this.position.y + 0.5 - projY) ** 2);
                            if (d < r) {
                                let overlap = r - d;
                                let norm: Vector3;
                                if (d < r / 10) {
                                    norm = new Vector3(this.position.x - neighbour.i * this.waterEngine.cellSize, this.position.y + 0.5 - neighbour.j * this.waterEngine.cellSize, 0).normalize();
                                }
                                else {
                                    norm = new Vector3(this.position.x - projX, this.position.y + 0.5 - projY, 0).normalize();
                                }
                                let dot = this.velocity.x * norm.x + this.velocity.y * norm.y;
                                if (dot < 0) {
                                    this.velocity.x = this.velocity.x - 2 * dot * norm.x;
                                    this.velocity.y = this.velocity.y - 2 * dot * norm.y;
                                    this.velocity.scaleInPlace(0.5);
                                    this.position.x += norm.x * overlap;
                                    this.position.y += norm.y * overlap;
                                }
                            }
                        }
                    }
                }
            }

            if (this.velocity.lengthSquared() > 100 * 100) {
                this.velocity.normalize().scaleInPlace(100);
            }
            this.position.addInPlace(this.velocity.scale(dt));
        }
    }
}