import { Mesh, VertexData } from "@babylonjs/core/Meshes";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import type { WaterEngine } from "./map/WaterEngine";
import type { Game } from "./Game";
import { registerBuiltInLoaders } from "@babylonjs/loaders/dynamic";
import { Color3, StandardMaterial, Vector3 } from "@babylonjs/core";
import { ColorizeVertexDataInPlace, MirrorZVertexDataInPlace, TriFlipVertexDataInPlace } from "./VertexDataUtils";
import { CELL_SIZE, WATER_CELL_SIZE, type TerrainEngine } from "./map/TerrainEngine";
import { CircleSquareIntersection } from "./Math2D";
import { DrawDebugLine } from "./Debug";
registerBuiltInLoaders();

export class Duck extends Mesh {

    public velocity: Vector3 = Vector3.Zero();
    public lateralVelocity: number = 0;
    public dragX = 0.5;
    public dragY = 0.5;
    
    constructor(name: string, public game: Game, public terrainEngine: TerrainEngine) {
        super(name);
        this.position.copyFromFloats(terrainEngine.width / 2, terrainEngine.height / 2, 0).scaleInPlace(CELL_SIZE);

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

        let r = 0.5;
        let i = Math.round(this.position.x / CELL_SIZE);
        let j = Math.round(this.position.y / CELL_SIZE);
        let cell = this.terrainEngine.getCell(i, j);
        let iWater = Math.round(this.position.x / WATER_CELL_SIZE);
        let jWater = Math.round((this.position.y) / WATER_CELL_SIZE);
        let waterCell = this.terrainEngine.waterEngine.getCell(iWater, jWater);
        let flowX = 0;
        let flowY = 0;
        if (cell && waterCell) {
            let inWater = false;
            let dY = -1;
            let fill = 0;

            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    let neighbour = waterCell.neighbours[i][j];
                    if (neighbour && neighbour.visibleFillLevel > 0.0001) {
                        let intersection = CircleSquareIntersection(
                            this.position.x,
                            this.position.y + 0.5,
                            r,
                            neighbour.i * WATER_CELL_SIZE,
                            neighbour.j * WATER_CELL_SIZE,
                            WATER_CELL_SIZE
                        );
                        if (intersection) {
                            let f = intersection.penetration / r;
                            if (intersection.penetration > r * 0.5) {
                                dY = Math.max(dY, (neighbour.corners[0][1].y + neighbour.corners[1][1].y) / 2 - this.position.y);
                                fill += neighbour.visibleFillLevel * f;
                            }
                            flowX += neighbour.flowDirection.x * f;
                            flowY += neighbour.flowDirection.y * f;
                            inWater = true;
                        }
                    }
                }
            }

            fill = Math.min(fill, 1);

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
            
            
            if (dY > 0) {
                dY = Math.min(dY, 1);
                this.velocity.y += 60 * dY * dt;
            }

            if (inWater) {
                this.dragX = 1;
                this.dragY = 3;
            }
            else {
                this.dragX = this.dragX * 0.5 + 0.01 * 0.5;
                this.dragY = this.dragY * 0.5 + 0.01 * 0.5;
            }
            
            let dragForce = new Vector3(this.velocity.x * -this.dragX, this.velocity.y * -this.dragY, 0);
            this.velocity.addInPlace(dragForce.scale(1 * dt));
            this.velocity.addInPlace(new Vector3(0, -9.81, 0).scale(1 * dt));
            this.velocity.x += 100 * flowX * dt;
            this.velocity.y += 100 * flowY * dt;

            this.lateralVelocity = this.lateralVelocity * 0.9 + this.velocity.x * 0.1;

            this.rotation.y += this.velocity.length() * 0.5 * dt;
            this.rotation.z = - this.lateralVelocity * 0.1;

            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    let neighbour = cell.neighbours[i][j];
                    if (neighbour && neighbour.isSolid) {
                        let intersection = CircleSquareIntersection(this.position.x, this.position.y + 0.5, r, neighbour.i * CELL_SIZE, neighbour.j * CELL_SIZE, CELL_SIZE);
                        if (intersection) {
                            let overlap = intersection.penetration;
                            let norm = new Vector3(intersection.nX, intersection.nY, 0);
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

            if (this.velocity.lengthSquared() > 100 * 100) {
                this.velocity.normalize().scaleInPlace(100);
            }
            this.position.addInPlace(this.velocity.scale(dt));
        }
    }
}