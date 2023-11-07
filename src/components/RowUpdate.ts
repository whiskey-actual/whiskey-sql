import { ColumnUpdate } from "./ColumnUpdate"

export class RowUpdate {
    constructor(primaryKeyValue:number) {
        this.primaryKeyValue=primaryKeyValue
    }
    public updateName:string = ''
    public primaryKeyValue:number = 0
    public ColumnUpdates:ColumnUpdate[] = []
}