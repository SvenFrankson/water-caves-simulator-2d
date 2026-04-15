import { Matrix } from "@babylonjs/core/Maths/math.vector";
import type { Game } from "./Game";
import type { WaterEngine } from "./map/WaterEngine";

enum MapEditBrush {
    None,
    Rock,
    Eraser,
    Water
}

export class MapEditInput {

    public brush: MapEditBrush = MapEditBrush.None;
    public pointerIsDown: boolean = false;

    public rockButton: HTMLButtonElement;
    public eraserButton: HTMLButtonElement;
    public waterButton: HTMLButtonElement;

    constructor(public game: Game, public waterEngine: WaterEngine) {
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
            let pickResult = this.game.scene.pickWithRay(ray, (mesh) => mesh === this.waterEngine.frame);
            if (pickResult && pickResult.hit && pickResult.pickedMesh) {
                let i = Math.round(pickResult.pickedPoint!.x);
                let j = Math.round(pickResult.pickedPoint!.y);
                let cell = this.waterEngine.getCell(i, j);
                if (cell) {
                    if (this.brush === MapEditBrush.Rock) {
                        if (!cell.isSolid) {
                            cell.isSolid = true;
                            cell.fillLevel = 1;
                            this.waterEngine.redrawRocks();
                        }
                    }
                    else if (this.brush === MapEditBrush.Eraser) {
                        if (i > 0 && j > 0 && i < this.waterEngine.width - 1 && j < this.waterEngine.height - 1) {
                            cell.fillLevel = 0;
                            if (cell.isSolid) {
                                cell.isSolid = false;
                                this.waterEngine.redrawRocks();
                            }
                        }
                    }
                    else if (this.brush === MapEditBrush.Water) {
                        if (!cell.isSolid && cell.fillLevel < 0.001) {
                            cell.fillLevel = 1;
                        }
                    }
                }
            }
        }
    }

    private _onPointerDown = (_evt: PointerEvent) => {
        this.pointerIsDown = true;
        if (this.brush !== MapEditBrush.None) {
            this.game.camera.detachControl();
        }
    }
    
    private _onPointerUp = (_evt: PointerEvent) => {
        this.pointerIsDown = false;
        this.game.camera.attachControl(this.game.canvas, true);
    }
}