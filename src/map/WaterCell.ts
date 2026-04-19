import { Vector2 } from "@babylonjs/core/Maths/math.vector";
import type { WaterEngine } from "./WaterEngine";
import { WATER_CELL_SIZE } from "./TerrainEngine";

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
    
    public fillRate: number = 0;
    public sinkRate: number = 0;

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

    constructor(public waterEngine: WaterEngine, public i: number, public j: number) {
        this.waterEngine.addCell(this);
        this.emptyAnchor.set(i, j - 0.5).scaleInPlace(WATER_CELL_SIZE);
    }

    public gloup = 0;
    public step(): void {
        let dt = this.waterEngine.game.engine.getDeltaTime() / 1000;
        dt = Math.min(dt, 1 / 60);
        dt = dt / this.waterEngine.updatesPerFrame;
        this.gloup += dt;

        if (this.isSolid) {
            this.visibleFillLevel = 1;
            return;
        }
        
        this.pressure = WATER_CELL_SIZE * this.fillLevel / 5;
        this.flowDirection.scaleInPlace(0.95);

        if (this.cellTop && !this.cellTop.isSolid) {
            this.pressure = this.pressure + this.cellTop.pressure;
        }
        else {
            let d = 1;
            let searchLeft = true;
            let searchRight = true;
            while (searchLeft || searchRight) {
                if (searchLeft) {
                    let searchLeftCell = this.waterEngine.getCell(this.i - d, this.j);
                    if (searchLeftCell && !searchLeftCell.isSolid) {
                        let aboveSearchLeftCell = this.waterEngine.getCell(this.i - d, this.j + 1);
                        if (aboveSearchLeftCell && !aboveSearchLeftCell.isSolid) {
                            this.pressure = this.pressure + aboveSearchLeftCell.pressure;
                            searchLeft = false;
                            searchRight = false;
                        }
                    }
                    else {
                        searchLeft = false;
                    }
                }
                if (searchRight) {
                    let searchRightCell = this.waterEngine.getCell(this.i + d, this.j);
                    if (searchRightCell && !searchRightCell.isSolid) {
                        let aboveSearchRightCell = this.waterEngine.getCell(this.i + d, this.j + 1);
                        if (aboveSearchRightCell && !aboveSearchRightCell.isSolid) {
                            this.pressure = this.pressure + aboveSearchRightCell.pressure;
                            searchLeft = false;
                            searchRight = false;
                        }
                    }
                    else {
                        searchRight = false;
                    }
                }
                d++;
            }
        }

        if (this.cellLeft && !this.cellLeft.isSolid && this.cellRight && !this.cellRight.isSolid) {
            this.pressure = this.pressure * 0.4 + this.cellLeft.pressure * 0.3 + this.cellRight.pressure * 0.3;
        }
        else if (this.cellLeft && !this.cellLeft.isSolid) {
            this.pressure = this.pressure * 0.5 + this.cellLeft.pressure * 0.5;
        }
        else if (this.cellRight && !this.cellRight.isSolid) {
            this.pressure = this.pressure * 0.5 + this.cellRight.pressure * 0.5;
        }

        this.pressure = Math.max(this.pressure, 0);

        let belowCell = this.waterEngine.getCell(this.i, this.j - 1);
        if (belowCell && !belowCell.isSolid) {
            let flowRate = 60 * dt;
            if (belowCell.fillLevel < 0.001) {
                if (this.cellTop && this.cellTop.fillLevel > this.fillLevel) {
                    //flowRate = 0;
                }
            }
            let transfer = Math.min(this.fillLevel, 1 - belowCell.fillLevel) * flowRate;
            this.fillLevel -= transfer;
            this.flowDirection.y -= transfer;
            belowCell.fillLevel += transfer;
        }

        let belowIsFilledOrSolid = !belowCell || belowCell.isSolid || belowCell.fillLevel >= 0.5;

        let tic = () => {
            if (this.cellLeft && !this.cellLeft.isSolid && belowIsFilledOrSolid) {
                if (this.cellLeft.pressure < this.pressure && this.fillLevel > this.cellLeft.fillLevel * 0.9) {
                    let transfer = (this.pressure - this.cellLeft.pressure) * 200 * dt;
                    transfer = Math.max(0, Math.min(transfer, (this.fillLevel - this.cellLeft.fillLevel * 0.9) / 2));
                    this.fillLevel -= transfer;
                    this.cellLeft.fillLevel += transfer;
                    this.flowDirection.x -= transfer;
                }
            }
        }
        
        let tac = () => {
            if (this.cellRight && !this.cellRight.isSolid && belowIsFilledOrSolid) {
                if (this.cellRight.pressure < this.pressure && this.fillLevel > this.cellRight.fillLevel * 0.9) {
                    let transfer = (this.pressure - this.cellRight.pressure) * 200 * dt;
                    transfer = Math.max(0, Math.min(transfer, (this.fillLevel - this.cellRight.fillLevel * 0.9) / 2));
                    this.fillLevel -= transfer;
                    this.cellRight.fillLevel += transfer;
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
                weight += 1;
            }
            if (this.cellRight && !this.cellRight.isSolid) {
                weight += 1;
            }
            if (this.cellBottom && !this.cellBottom.isSolid) {
                weight += 0;
            }
            if (this.cellLeft && !this.cellLeft.isSolid) {
                weight += 1;
            }

            let transfer = overflow / weight;
            this.fillLevel -= transfer * (weight - 1);

            if (this.cellTop && !this.cellTop.isSolid) {
                this.cellTop.fillLevel += transfer * 1;
                this.flowDirection.y += transfer * 1;
            }
            if (this.cellRight && !this.cellRight.isSolid) {
                this.cellRight.fillLevel += transfer * 1;
                this.flowDirection.x += transfer * 1;
            }
            if (this.cellBottom && !this.cellBottom.isSolid) {
                this.cellBottom.fillLevel += transfer * 0;
                this.flowDirection.y -= transfer * 0;
            }
            if (this.cellLeft && !this.cellLeft.isSolid) {
                this.cellLeft.fillLevel += transfer * 1;
                this.flowDirection.x -= transfer * 1;
            }
        }

        let neighbours: (WaterCell | undefined)[][] = [
            [this.waterEngine.getCell(this.i - 1, this.j - 1), this.waterEngine.getCell(this.i - 1, this.j), this.waterEngine.getCell(this.i - 1, this.j + 1)],
            [this.waterEngine.getCell(this.i, this.j - 1), /* this cell */ this.waterEngine.getCell(this.i, this.j), this.waterEngine.getCell(this.i, this.j + 1)],
            [this.waterEngine.getCell(this.i + 1, this.j - 1), this.waterEngine.getCell(this.i + 1, this.j), this.waterEngine.getCell(this.i + 1, this.j + 1)],
        ];

        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 2; j++) {
                let cell = neighbours[i][j];
                if (cell) {
                    let f = cell.isSolid ? 2 : cell.fillLevel;
                    f = f / 8;
                    this.emptyAnchor.x = this.emptyAnchor.x * (1 - f) + WATER_CELL_SIZE * cell.i * f;
                    this.emptyAnchor.y = this.emptyAnchor.y * (1 - f) + WATER_CELL_SIZE * cell.j * f;
                }
            }
        }

        for (let i = 0; i < 3; i++) {
            let bottom = neighbours[i][0];
            if (bottom && (bottom.isSolid || bottom.fillLevel > 0.9)) {
                this.emptyAnchor.y -= WATER_CELL_SIZE * 0.5;
            }
        }
        let left = neighbours[0][1];
        if (left) {
            if (left.isSolid) {
                this.emptyAnchor.x -= WATER_CELL_SIZE * 1;
            }
            else if (left.fillLevel > 0.9) {
                this.emptyAnchor.x -= WATER_CELL_SIZE * 0.5;
            }
        }
        let right = neighbours[2][1];
        if (right) {
            if (right.isSolid) {
                this.emptyAnchor.x += WATER_CELL_SIZE * 1;
            }
            else if (right.fillLevel > 0.9) {
                this.emptyAnchor.x += WATER_CELL_SIZE * 0.5;
            }
        }

        if (this.fillRate > 0) {
            this.emptyAnchor.copyFromFloats(this.i * WATER_CELL_SIZE, this.j * WATER_CELL_SIZE);
        }

        this.sqrtFillLevel = Math.sqrt(Math.min(Math.max(0, this.fillLevel), 1));
        this.emptyAnchor.x = Math.max((this.i - 0.5) * WATER_CELL_SIZE, Math.min((this.i + 0.5) * WATER_CELL_SIZE, this.emptyAnchor.x));
        this.emptyAnchor.y = Math.max((this.j - 0.5) * WATER_CELL_SIZE, Math.min((this.j + 0.5) * WATER_CELL_SIZE, this.emptyAnchor.y));


        this.corners[0][0].set(this.i * this.sqrtFillLevel * WATER_CELL_SIZE + this.emptyAnchor.x * (1 - this.sqrtFillLevel), this.j * this.sqrtFillLevel * WATER_CELL_SIZE + this.emptyAnchor.y * (1 - this.sqrtFillLevel));
        this.corners[0][1].set(this.i * this.sqrtFillLevel * WATER_CELL_SIZE + this.emptyAnchor.x * (1 - this.sqrtFillLevel), this.j * this.sqrtFillLevel * WATER_CELL_SIZE + this.emptyAnchor.y * (1 - this.sqrtFillLevel));
        this.corners[1][0].set(this.i * this.sqrtFillLevel * WATER_CELL_SIZE + this.emptyAnchor.x * (1 - this.sqrtFillLevel), this.j * this.sqrtFillLevel * WATER_CELL_SIZE + this.emptyAnchor.y * (1 - this.sqrtFillLevel));
        this.corners[1][1].set(this.i * this.sqrtFillLevel * WATER_CELL_SIZE + this.emptyAnchor.x * (1 - this.sqrtFillLevel), this.j * this.sqrtFillLevel * WATER_CELL_SIZE + this.emptyAnchor.y * (1 - this.sqrtFillLevel));

        this.corners[0][0].x -= this.sqrtFillLevel * 0.5 * WATER_CELL_SIZE;
        this.corners[0][0].y -= this.sqrtFillLevel * 0.5 * WATER_CELL_SIZE;
        this.corners[0][1].x -= this.sqrtFillLevel * 0.5 * WATER_CELL_SIZE;
        this.corners[0][1].y += this.sqrtFillLevel * 0.5 * WATER_CELL_SIZE;
        this.corners[1][0].x += this.sqrtFillLevel * 0.5 * WATER_CELL_SIZE;
        this.corners[1][0].y -= this.sqrtFillLevel * 0.5 * WATER_CELL_SIZE;
        this.corners[1][1].x += this.sqrtFillLevel * 0.5 * WATER_CELL_SIZE;
        this.corners[1][1].y += this.sqrtFillLevel * 0.5 * WATER_CELL_SIZE;

        this.visibleFillLevel = this.visibleFillLevel * 0.95 + this.fillLevel * 0.05;
        this.visibleFillLevel = this.fillLevel;
        this.visibleFillLevel = Math.max(Math.min(this.visibleFillLevel, 1), 0);

        if (this.flowDirection.length() > 1) {
            this.flowDirection.normalize();
        }

        if (this.sinkRate > 0) {
            let sinkRateRate = this.sinkRate * (1 + Math.sin(this.gloup * 7) * 0.8);
            let sinkAmount = Math.min(this.fillLevel, sinkRateRate * dt);
            this.fillLevel -= sinkAmount;
        }
        if (this.fillRate > 0) {
            let randomFillRate = this.fillRate * (1 + Math.sin(this.gloup * 7) * 0.8);
            let fillAmount = Math.min(1 - this.fillLevel, randomFillRate * dt);
            if (this.cellBottom) {
                fillAmount = Math.min(1 - this.cellBottom.fillLevel, randomFillRate * dt);
            }
            this.fillLevel += fillAmount;
        }
    }
}