import mssql from 'mssql'

export class ColumnDefinition {
    constructor(columnName:string, columnType:mssql.ISqlTypeFactoryWithNoParams|mssql.ISqlTypeWithLength, isNullable:boolean=true) {
        this.columnName=columnName
        this.columnType=columnType
        this.isNullable=isNullable
    }
    public columnName:string=''
    public columnType:mssql.ISqlTypeFactoryWithNoParams|mssql.ISqlTypeWithLength=mssql.Int
    public isNullable:boolean=false
    public isIndexed:boolean=false
}