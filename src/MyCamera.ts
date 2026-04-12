
import { ArcRotateCamera, Vector3 } from "@babylonjs/core";
import type { Game } from "./Game";

export class MyCamera extends ArcRotateCamera {

    constructor(public game: Game) {
        super("my-camera", - Math.PI * 0.5, Math.PI * 0.25, 10, Vector3.Zero(), game.scene);
        this.attachControl(game.engine.getRenderingCanvas(), true);
    }
}