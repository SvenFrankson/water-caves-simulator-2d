import { Engine, Scene } from "@babylonjs/core";
import { TestScene } from "./TestScene";
import { MyCamera } from "./MyCamera";

export class Game {

    public engine: Engine;
    public scene: Scene;
    public camera: MyCamera;

    constructor(canvas: HTMLCanvasElement) {
        this.engine = new Engine(canvas, true)
        this.scene = new Scene(this.engine);
        this.camera = new MyCamera(this);

        window.addEventListener("resize", () => {
            this.onResize();
        });
    }

    public start() {
        const testScene = new TestScene(this);
        this.engine.runRenderLoop(() => {
            this.scene.render()
        })
    }

    public onResize() {
        this.engine.resize();
    }
}