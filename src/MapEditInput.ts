import { Matrix } from "@babylonjs/core/Maths/math.vector";
import type { Game } from "./Game";
import { CELL_SIZE, WATER_CELL_SIZE, type TerrainEngine } from "./map/TerrainEngine";
import { Mesh, Vector3 } from "@babylonjs/core";
import { Duck } from "./Duck";
import { Door } from "./map/Door";

enum MapEditBrush {
    None,
    Rock,
    Eraser,
    Water
}

export class MapEditInput {

    public brush: MapEditBrush = MapEditBrush.None;
    public erasingRock: number = -1;
    public pointerIsDown: boolean = false;

    public rockButton: HTMLButtonElement;
    public eraserButton: HTMLButtonElement;
    public waterButton: HTMLButtonElement;

    public draggedObject: Mesh | null = null;
    public dragOffset: Vector3 = Vector3.Zero();

    constructor(public game: Game, public terrainEngine: TerrainEngine) {
        this.rockButton = document.getElementById("brush-rock") as HTMLButtonElement;
        this.eraserButton = document.getElementById("brush-eraser") as HTMLButtonElement;
        this.waterButton = document.getElementById("brush-water") as HTMLButtonElement;

        this.rockButton.addEventListener("click", () => {
            if (this.brush === MapEditBrush.Rock) {
                this.brush = MapEditBrush.None;
                this.rockButton.classList.remove("selected");
            }
            else {
                this.brush = MapEditBrush.Rock;
                this.rockButton.classList.add("selected");
                this.eraserButton.classList.remove("selected");
                this.waterButton.classList.remove("selected");
            }
        });

        this.eraserButton.addEventListener("click", () => {
            if (this.brush === MapEditBrush.Eraser) {
                this.brush = MapEditBrush.None;
                this.eraserButton.classList.remove("selected");
            }
            else {
                this.brush = MapEditBrush.Eraser;
                this.eraserButton.classList.add("selected");
                this.rockButton.classList.remove("selected");
                this.waterButton.classList.remove("selected");
            }
        });

        this.waterButton.addEventListener("click", () => {
            if (this.brush === MapEditBrush.Water) {
                this.brush = MapEditBrush.None;
                this.waterButton.classList.remove("selected");
            }
            else {
                this.brush = MapEditBrush.Water;
                this.waterButton.classList.add("selected");
                this.rockButton.classList.remove("selected");
                this.eraserButton.classList.remove("selected");
            }
        });
    }

    public connect() {
        this.game.canvas.addEventListener("pointerdown", this._onPointerDown);
        this.game.canvas.addEventListener("pointerup", this._onPointerUp);
        this.game.scene.onBeforeRenderObservable.add(this._update);
    }

    public disconnect() {
        this.game.canvas.removeEventListener("pointerdown", this._onPointerDown);
        this.game.canvas.removeEventListener("pointerup", this._onPointerUp);
        this.game.scene.onBeforeRenderObservable.removeCallback(this._update);
    }

    private _update = () => {
        if (this.pointerIsDown) {
            let ray = this.game.scene.createPickingRay(this.game.scene.pointerX, this.game.scene.pointerY, Matrix.Identity(), this.game.camera);
            let pickResult = this.game.scene.pickWithRay(ray, (mesh) => mesh === this.terrainEngine.frame);
            if (pickResult && pickResult.hit && pickResult.pickedMesh) {
                if (this.draggedObject) {
                    this.draggedObject.position.copyFrom(pickResult.pickedPoint!).subtractInPlace(this.dragOffset);
                    this.draggedObject.position.z = 0;
                }
                else {
                    let i = Math.round(pickResult.pickedPoint!.x / CELL_SIZE);
                    let j = Math.round(pickResult.pickedPoint!.y / CELL_SIZE);
                    let iWater = Math.round(pickResult.pickedPoint!.x / WATER_CELL_SIZE);
                    let jWater = Math.round(pickResult.pickedPoint!.y / WATER_CELL_SIZE);
                    let cell = this.terrainEngine.getCell(i, j);
                    let waterCell = this.terrainEngine.waterEngine.getCell(iWater, jWater);
                    if (cell) {
                        if (this.brush === MapEditBrush.Rock) {
                            if (!cell.isSolid) {
                                cell.isSolid = true;
                                this.terrainEngine.syncWaterAndRocks();
                                this.terrainEngine.redrawRocks();
                            }
                        }
                        else if (this.brush === MapEditBrush.Eraser) {
                            if (i > 0 && j > 0 && i < this.terrainEngine.width - 1 && j < this.terrainEngine.height - 1) {
                                if (cell.isSolid && this.erasingRock != 0) {
                                    cell.isSolid = false;
                                    this.terrainEngine.syncWaterAndRocks();
                                    this.terrainEngine.setWaterCellFillLevel(i, j, 0);
                                    this.terrainEngine.redrawRocks();
                                    this.erasingRock = 1;
                                }
                                else if (waterCell && !waterCell.isSolid && this.erasingRock != 1) {
                                    waterCell.fillLevel = 0;
                                    this.erasingRock = 0;
                                }

                            }
                        }
                        else if (this.brush === MapEditBrush.Water) {
                            if (waterCell && !waterCell.isSolid && waterCell.fillLevel < 0.001) {
                                waterCell.fillLevel = 1;
                            }
                        }
                    }
                }
            }
        }
    }

    private _onPointerDown = (_evt: PointerEvent) => {
        this.pointerIsDown = true;
        let ray = this.game.scene.createPickingRay(this.game.scene.pointerX, this.game.scene.pointerY, Matrix.Identity(), this.game.camera);
        let pickResult = this.game.scene.pickWithRay(ray, (mesh) => {
            return mesh && mesh.parent instanceof Duck || mesh instanceof Door;
        });

        if (pickResult && pickResult.hit && pickResult.pickedMesh?.parent instanceof Duck) {
            this.draggedObject = pickResult.pickedMesh.parent;
            let pickedPoint = pickResult.pickedPoint!;
            this.dragOffset.copyFrom(pickedPoint).subtractInPlace(this.draggedObject.position);
            this.game.camera.detachControl();
        }
        
        if (pickResult && pickResult.hit && pickResult.pickedMesh instanceof Door) {
            if (pickResult.pickedMesh.closed) {
                pickResult.pickedMesh.open();
            }
            else {
                pickResult.pickedMesh.close();
            }
        }

        if (this.brush !== MapEditBrush.None) {
            this.game.camera.detachControl();
        }
    }
    
    private _onPointerUp = (_evt: PointerEvent) => {
        this.draggedObject = null;
        this.pointerIsDown = false;
        this.game.camera.attachControl(this.game.canvas, true);
        this.erasingRock = -1;
    }
}