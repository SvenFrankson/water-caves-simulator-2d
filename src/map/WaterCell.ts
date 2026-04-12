import type { WaterEngine } from "./WaterEngine";

export class WaterCell {

    public isSolid: boolean = false;
    public fillLevel: number = 0;
    public pressure: number = 0;

    constructor(public waterEngine: WaterEngine, public x: number, public y: number) {
        this.waterEngine.addCell(this);
    }

    public step(): void {

        if (this.fillLevel < 1) {
            this.pressure = this.fillLevel / 10;
        }

        let aboveCell = this.waterEngine.getCell(this.x, this.y + 1);
        if (aboveCell && !aboveCell.isSolid) {
            this.pressure = this.fillLevel / 10 + aboveCell.pressure;
        }

        let rightCell = this.waterEngine.getCell(this.x + 1, this.y);
        if (rightCell && !rightCell.isSolid) {
            this.pressure = this.pressure * 0.95 + rightCell.pressure * 0.05;
        }

        let leftCell = this.waterEngine.getCell(this.x - 1, this.y);
        if (leftCell && !leftCell.isSolid) {
            this.pressure = this.pressure * 0.95 + leftCell.pressure * 0.05;
        }

        let belowCell = this.waterEngine.getCell(this.x, this.y - 1);
        if (belowCell && !belowCell.isSolid) {
            let transfer = Math.min(this.fillLevel, 1 - belowCell.fillLevel) * 0.5;
            this.fillLevel -= transfer;
            belowCell.fillLevel += transfer;
        }

        let belowIsFilledOrSolid = !belowCell || belowCell.isSolid || belowCell.fillLevel >= 1;

        if (leftCell && !leftCell.isSolid && belowIsFilledOrSolid) {
            if (leftCell.pressure < this.pressure) {
                let transfer = (this.pressure - leftCell.pressure) * 0.5;
                this.fillLevel -= transfer;
                leftCell.fillLevel += transfer;
            }
        }
        if (rightCell && !rightCell.isSolid && belowIsFilledOrSolid) {
            if (rightCell.pressure < this.pressure) {
                let transfer = (this.pressure - rightCell.pressure) * 0.5;
                this.fillLevel -= transfer;
                rightCell.fillLevel += transfer;
            }
        }
        
        if (this.fillLevel > 1) {
            let overflow = this.fillLevel - 1;
            let adjacentCells = [aboveCell, rightCell, leftCell].filter(c => c && !c.isSolid) as WaterCell[];
            let transfer = overflow / adjacentCells.length;
            this.fillLevel = 1;
            for (let cell of adjacentCells) {
                cell.fillLevel += transfer;
            }
        }
    }
}