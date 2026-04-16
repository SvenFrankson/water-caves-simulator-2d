import { Mesh } from "@babylonjs/core/Meshes";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import type { WaterEngine } from "./map/WaterEngine";
import type { Game } from "./Game";
import { registerBuiltInLoaders } from "@babylonjs/loaders/dynamic";
import { DrawDebugLine } from "./Debug";
import { Color3, PBRMaterial, StandardMaterial, Vector3 } from "@babylonjs/core";
registerBuiltInLoaders();

export class Duck extends Mesh {

    public velocity: Vector3 = Vector3.Zero();
    public lateralVelocity: number = 0;
    
    constructor(name: string, public game: Game, public waterEngine: WaterEngine) {
        super(name);
        this.position.copyFromFloats(waterEngine.width / 2, waterEngine.height / 2, 0);

        ImportMeshAsync("meshes/duck.gltf", this.game.scene).then(data => {
            data.meshes.forEach(mesh => {
                mesh.parent = this;
                mesh.position.copyFromFloats(0, 0, 0);
                mesh.rotation.copyFromFloats(0, 0, 0);

                console.log(mesh.material);

                if (mesh.material instanceof PBRMaterial) {
                    let material = new StandardMaterial(mesh.material.name + "_std", this.game.scene);
                    material.diffuseColor = mesh.material.albedoColor;
                    material.specularColor = new Color3(0.5, 0.5, 0.5);
                    material.emissiveColor = mesh.material.albedoColor.scale(0.5);
                    mesh.material = material;
                }
            });
        });

        this.game.scene.onBeforeRenderObservable.add(this._update);
    }

    private _update = () => {
        let dt = this.game.engine.getDeltaTime() / 1000;

        let i = Math.round(this.position.x);
        let j = Math.round(this.position.y);
        let cell = this.waterEngine.getCell(i, j);
        let cellAbove = cell?.cellTop;
        if (cell) {
            let targetY = 0;
            let fill = 0;
            if (!cell.isSolid && cell.fillLevel > 0.0001) {
                targetY = Math.max(targetY, (cell.corners[0][1].y + cell.corners[1][1].y) / 2);
                fill = Math.max(fill, cell.fillLevel);
                //targetY = Math.max(targetY, cell.y - 0.5 + cell.visibleFillLevel);
            }
            if (cellAbove && !cellAbove.isSolid && cellAbove.fillLevel > 0.0001) {
                targetY = Math.max(targetY, (cellAbove.corners[0][1].y + cellAbove.corners[1][1].y) / 2);
                fill = Math.max(fill, cellAbove.fillLevel);
                //targetY = Math.max(targetY, cellAbove.y - 0.5 + cellAbove.visibleFillLevel);
            }
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
            
            let dragX = 0.01;
            let dragY = 0.01;
            let dY = targetY - this.position.y;
            if (dY > 0) {
                dY = Math.min(dY, 0.5);
                this.velocity.y += fill * 100 * dY * dt;
                dragX = 1;
                dragY = 5;
            }
            let dragForce = new Vector3(this.velocity.x * -dragX, this.velocity.y * -dragY, 0);
            this.velocity.addInPlace(dragForce.scale(1 * dt));
            this.velocity.addInPlace(new Vector3(0, -9.81, 0).scale(1 * dt));
            this.velocity.x += 200 * cell.flowDirection.x * dt;
            this.velocity.y += 200 * cell.flowDirection.y * dt;

            this.lateralVelocity = this.lateralVelocity * 0.9 + this.velocity.x * 0.1;

            this.rotation.y += this.velocity.length() * 0.5 * dt;
            this.rotation.z = - this.lateralVelocity * 0.1;

            let r = 0.5;
            let s = 0.6;
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    let neighbour = cell.neighbours[i][j];
                    if (neighbour && neighbour.isSolid) {
                        let dx = this.position.x - neighbour.x;
                        let dy = (this.position.y + 0.5) - neighbour.y;
                        if (Math.abs(dx) < r + s || Math.abs(dy) < r + s) {
                            let projX = Math.min(neighbour.x + r, Math.max(neighbour.x - r, this.position.x));
                            let projY = Math.min(neighbour.y + r, Math.max(neighbour.y - r, this.position.y + 0.5));
                            let d = Math.sqrt((this.position.x - projX) ** 2 + (this.position.y + 0.5 - projY) ** 2);
                            if (d < r) {
                                let overlap = r - d;
                                let norm: Vector3;
                                if (d < r / 10) {
                                    norm = new Vector3(this.position.x - neighbour.x, this.position.y + 0.5 - neighbour.y, 0).normalize();
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

            this.position.addInPlace(this.velocity.scale(dt));
        }
    }
}