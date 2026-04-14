import { Vector2 } from "@babylonjs/core";
import type { WaterEngine } from "./WaterEngine";

export class WaterCell {

    public isSolid: boolean = false;
    public fillLevel: number = 0;
    public visibleFillLevel: number = 0;
    public sqrtFillLevel: number = 0;
    public pressure: number = 0;
    public flowDirection: Vector2 = Vector2.Zero();
    public emptyAnchor: Vector2 = Vector2.Zero();
    public corners: Vector2[][] = [[Vector2.Zero(), Vector2.Zero()], [Vector2.Zero(), Vector2.Zero()]];
    public drawn: boolean = false;

    public neighbours: (WaterCell | undefined)[][] = [[], [], []];
    public get cellTop(): WaterCell | undefined {
        return this.neighbours[1][2];
    }
    public get cellRight(): WaterCell | undefined {
        return this.neighbours[2][1];
    }
    public get cellBottom(): WaterCell | undefined {
        return this.neighbours[1][0];
    }
    public get cellLeft(): WaterCell | undefined {
        return this.neighbours[0][1];
    }

    constructor(public waterEngine: WaterEngine, public x: number, public y: number) {
        this.waterEngine.addCell(this);
        this.emptyAnchor.set(x, y - 0.5);
    }

    public step(): void {

        if (this.isSolid) {
            this.visibleFillLevel = 1;
            return;
        }
        
        if (this.fillLevel < 1) {
            this.pressure = this.fillLevel / 10;
        }
        this.flowDirection.scaleInPlace(0.9);

        let aboveCell = this.waterEngine.getCell(this.x, this.y + 1);
        if (aboveCell && !aboveCell.isSolid) {
            this.pressure = this.fillLevel / 10 + aboveCell.pressure;
        }

        let rightCell = this.waterEngine.getCell(this.x + 1, this.y);
        if (rightCell && !rightCell.isSolid) {
            this.pressure = this.pressure * 0.9 + rightCell.pressure * 0.1;
        }

        let leftCell = this.waterEngine.getCell(this.x - 1, this.y);
        if (leftCell && !leftCell.isSolid) {
            this.pressure = this.pressure * 0.9 + leftCell.pressure * 0.1;
        }

        let belowCell = this.waterEngine.getCell(this.x, this.y - 1);
        if (belowCell && !belowCell.isSolid) {
            let flowRate = 0.7;
            if (belowCell.fillLevel < 0.001) {
                if (aboveCell && aboveCell.fillLevel > this.fillLevel) {
                    //flowRate = 0;
                }
            }
            let transfer = Math.min(this.fillLevel, 1 - belowCell.fillLevel) * flowRate;
            this.fillLevel -= transfer;
            this.flowDirection.y -= transfer;
            belowCell.fillLevel += transfer;
        }

        let belowIsFilledOrSolid = !belowCell || belowCell.isSolid || belowCell.fillLevel >= 0.5;

        if (leftCell && !leftCell.isSolid && belowIsFilledOrSolid) {
            if (leftCell.pressure < this.pressure && this.fillLevel > leftCell.fillLevel * 0.9) {
                let transfer = (this.pressure - leftCell.pressure) * 3;
                transfer = Math.min(transfer, (this.fillLevel - leftCell.fillLevel * 0.9) / 2);
                this.fillLevel -= transfer;
                leftCell.fillLevel += transfer;
                this.flowDirection.x -= transfer;
            }
        }
        if (rightCell && !rightCell.isSolid && belowIsFilledOrSolid) {
            if (rightCell.pressure < this.pressure && this.fillLevel > rightCell.fillLevel * 0.9) {
                let transfer = (this.pressure - rightCell.pressure) * 3;
                transfer = Math.min(transfer, (this.fillLevel - rightCell.fillLevel * 0.9) / 2);
                this.fillLevel -= transfer;
                rightCell.fillLevel += transfer;
                this.flowDirection.x += transfer;
            }
        }
        
        if (this.fillLevel > 1) {
            let overflow = this.fillLevel - 1;
            let adjacentCells = [aboveCell, rightCell, leftCell].filter(c => c && !c.isSolid) as WaterCell[];
            let transfer = overflow / adjacentCells.length;
            this.fillLevel = 1;
            for (let cell of adjacentCells) {
                cell.fillLevel += transfer;
                if (cell === aboveCell) {
                    this.flowDirection.y += transfer;
                } else if (cell === leftCell) {
                    this.flowDirection.x -= transfer;
                } else if (cell === rightCell) {
                    this.flowDirection.x += transfer;
                }
            }
        }

        let neighbours: (WaterCell | undefined)[][] = [
            [this.waterEngine.getCell(this.x - 1, this.y - 1), this.waterEngine.getCell(this.x - 1, this.y), this.waterEngine.getCell(this.x - 1, this.y + 1)],
            [this.waterEngine.getCell(this.x, this.y - 1), /* this cell */ this.waterEngine.getCell(this.x, this.y), this.waterEngine.getCell(this.x, this.y + 1)],
            [this.waterEngine.getCell(this.x + 1, this.y - 1), this.waterEngine.getCell(this.x + 1, this.y), this.waterEngine.getCell(this.x + 1, this.y + 1)],
        ];

        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                let cell = neighbours[i][j];
                if (cell) {
                    let f = cell.isSolid ? 1 : cell.fillLevel;
                    f = f / 8;
                    this.emptyAnchor.x = this.emptyAnchor.x * (1 - f) + cell.x * f;
                    this.emptyAnchor.y = this.emptyAnchor.y * (1 - f) + cell.y * f;
                }
            }
        }

        for (let i = 0; i < 3; i++) {
            let bottom = neighbours[i][0];
            if (bottom && (bottom.isSolid || bottom.fillLevel > 0.8)) {
                this.emptyAnchor.y -= 0.5;
            }
        }
        let left = neighbours[0][1];
        if (left && (left.isSolid || left.fillLevel > 0.8)) {
            this.emptyAnchor.x -= 0.5;
        }
        let right = neighbours[2][1];
        if (right && (right.isSolid || right.fillLevel > 0.8)) {
            this.emptyAnchor.x += 0.5;
        }

        this.sqrtFillLevel = Math.sqrt(Math.min(Math.max(0, this.fillLevel), 1));
        this.emptyAnchor.x = Math.max(this.x - 0.5, Math.min(this.x + 0.5, this.emptyAnchor.x));
        this.emptyAnchor.y = Math.max(this.y - 0.5, Math.min(this.y + 0.5, this.emptyAnchor.y));


        this.corners[0][0].set(this.x * this.sqrtFillLevel + this.emptyAnchor.x * (1 - this.sqrtFillLevel), this.y * this.sqrtFillLevel + this.emptyAnchor.y * (1 - this.sqrtFillLevel));
        this.corners[0][1].set(this.x * this.sqrtFillLevel + this.emptyAnchor.x * (1 - this.sqrtFillLevel), this.y * this.sqrtFillLevel + this.emptyAnchor.y * (1 - this.sqrtFillLevel));
        this.corners[1][0].set(this.x * this.sqrtFillLevel + this.emptyAnchor.x * (1 - this.sqrtFillLevel), this.y * this.sqrtFillLevel + this.emptyAnchor.y * (1 - this.sqrtFillLevel));
        this.corners[1][1].set(this.x * this.sqrtFillLevel + this.emptyAnchor.x * (1 - this.sqrtFillLevel), this.y * this.sqrtFillLevel + this.emptyAnchor.y * (1 - this.sqrtFillLevel));

        this.corners[0][0].x -= this.sqrtFillLevel * 0.5;
        this.corners[0][0].y -= this.sqrtFillLevel * 0.5;
        this.corners[0][1].x -= this.sqrtFillLevel * 0.5;
        this.corners[0][1].y += this.sqrtFillLevel * 0.5;
        this.corners[1][0].x += this.sqrtFillLevel * 0.5;
        this.corners[1][0].y -= this.sqrtFillLevel * 0.5;
        this.corners[1][1].x += this.sqrtFillLevel * 0.5;
        this.corners[1][1].y += this.sqrtFillLevel * 0.5;

        this.visibleFillLevel = this.visibleFillLevel * 0.95 + this.fillLevel * 0.05;
        this.visibleFillLevel = this.fillLevel;

        if (this.flowDirection.length() > 1) {
            this.flowDirection.normalize();
        }
    }
}