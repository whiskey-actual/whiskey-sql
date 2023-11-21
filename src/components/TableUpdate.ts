import { RowUpdate } from "./RowUpdate"

export class TableUpdate {
    constructor(tableName:string, primaryKeyColumnName:string) {
        this.tableName=tableName
        this.primaryKeyColumnName=primaryKeyColumnName
    }
    public tableName:string
    public primaryKeyColumnName:string
    public RowUpdates:RowUpdate[] = []
}