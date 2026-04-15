import { Vector2 } from "@babylonjs/core/Maths/math.vector";
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
        
        this.pressure = this.fillLevel / 1;
        this.flowDirection.scaleInPlace(0.9);

        let aboveCell = this.waterEngine.getCell(this.x, this.y + 1);
        let leftCell = this.waterEngine.getCell(this.x - 1, this.y);
        let rightCell = this.waterEngine.getCell(this.x + 1, this.y);
        if (aboveCell && !aboveCell.isSolid) {
            this.pressure = this.pressure + aboveCell.pressure;
        }
        else {
            let aboveLeftCell = this.waterEngine.getCell(this.x - 1, this.y + 1);
            let aboveRightCell = this.waterEngine.getCell(this.x + 1, this.y + 1);
            if (leftCell && !leftCell.isSolid && aboveLeftCell && !aboveLeftCell.isSolid) {
                this.pressure = this.pressure + aboveLeftCell.pressure;
            }
            else if (rightCell && !rightCell.isSolid && aboveRightCell && !aboveRightCell.isSolid) {
                this.pressure = this.pressure + aboveRightCell.pressure;
            }
        }

        if (leftCell && !leftCell.isSolid && rightCell && !rightCell.isSolid) {
            this.pressure = this.pressure / 2 + leftCell.pressure / 4 + rightCell.pressure / 4;
        }
        else if (leftCell && !leftCell.isSolid) {
            this.pressure = this.pressure * 0.8 + leftCell.pressure * 0.2;
        }
        else if (rightCell && !rightCell.isSolid) {
            this.pressure = this.pressure * 0.8 + rightCell.pressure * 0.2;
        }

        this.pressure = Math.max(this.pressure, 0);

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

        let belowIsFilledOrSolid = !belowCell || belowCell.isSolid || belowCell.fillLevel >= 0.6;

        let tic = () => {
            if (leftCell && !leftCell.isSolid && belowIsFilledOrSolid) {
                if (leftCell.pressure < this.pressure && this.fillLevel > leftCell.fillLevel * 0.6) {
                    let transfer = (this.pressure - leftCell.pressure);
                    transfer = Math.max(0, Math.min(transfer, (this.fillLevel - leftCell.fillLevel * 0.6) / 2));
                    this.fillLevel -= transfer;
                    leftCell.fillLevel += transfer;
                    this.flowDirection.x -= transfer;
                }
            }
        }
        
        let tac = () => {
            if (rightCell && !rightCell.isSolid && belowIsFilledOrSolid) {
                if (rightCell.pressure < this.pressure && this.fillLevel > rightCell.fillLevel * 0.6) {
                    let transfer = (this.pressure - rightCell.pressure);
                    transfer = Math.max(0, Math.min(transfer, (this.fillLevel - rightCell.fillLevel * 0.6) / 2));
                    this.fillLevel -= transfer;
                    rightCell.fillLevel += transfer;
                    this.flowDirection.x += transfer;
                }
            }
        }

        tic();
        tac();
        
        if (this.fillLevel > 1) {
            let overflow = this.fillLevel - 1;
            let weight = 1;
            if (this.cellTop && !this.cellTop.isSolid) {
                weight += 2;
            }
            if (this.cellRight && !this.cellRight.isSolid) {
                weight += 1;
            }
            if (this.cellBottom && !this.cellBottom.isSolid) {
                weight += 0.5;
            }
            if (this.cellLeft && !this.cellLeft.isSolid) {
                weight += 1;
            }

            let transfer = overflow / weight;
            this.fillLevel -= transfer * (weight - 1);

            if (this.cellTop && !this.cellTop.isSolid) {
                this.cellTop.fillLevel += transfer * 2;
                this.flowDirection.y += transfer * 2;
            }
            if (this.cellRight && !this.cellRight.isSolid) {
                this.cellRight.fillLevel += transfer * 1;
                this.flowDirection.x += transfer * 1;
            }
            if (this.cellBottom && !this.cellBottom.isSolid) {
                this.cellBottom.fillLevel += transfer * 0.5;
                this.flowDirection.y -= transfer * 0.5;
            }
            if (this.cellLeft && !this.cellLeft.isSolid) {
                this.cellLeft.fillLevel += transfer * 1;
                this.flowDirection.x -= transfer * 1;
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
            if (bottom && (bottom.isSolid || bottom.fillLevel > 0.9)) {
                this.emptyAnchor.y -= 0.5;
            }
        }
        let left = neighbours[0][1];
        if (left && (left.isSolid || left.fillLevel > 0.9)) {
            this.emptyAnchor.x -= 0.5;
        }
        let right = neighbours[2][1];
        if (right && (right.isSolid || right.fillLevel > 0.9)) {
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
        this.visibleFillLevel = Math.max(Math.min(this.visibleFillLevel, 1), 0);

        if (this.flowDirection.length() > 1) {
            this.flowDirection.normalize();
        }
    }
}