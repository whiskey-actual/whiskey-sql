import mssql from 'mssql'

export class ColumnUpdate {
    constructor(ColumnName:string, ColumnType:mssql.ISqlType|mssql.ISqlTypeFactoryWithNoParams, ColumnValue:any, changeDetection:boolean=true) {
        this.ColumnName=ColumnName
        this.ColumnType=ColumnType
        this.ColumnValue=ColumnValue
        this.changeDetection=changeDetection
    }
    public ColumnName:string = ''
    public ColumnType:mssql.ISqlType|mssql.ISqlTypeFactoryWithNoParams = mssql.Int
    public ColumnValue:any = undefined
    public changeDetection:boolean = true
}