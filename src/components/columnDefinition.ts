import mssql from 'mssql'

export class ColumnDefinition {
    constructor(columnName:string, columnType:mssql.ISqlTypeFactoryWithNoParams|mssql.ISqlTypeWithLength, isNullable:boolean=true, isIndexed:boolean=false) {
        this.columnName=columnName
        this.columnType=columnType
        this.isNullable=isNullable
        this.isIndexed=isIndexed
    }
    public columnName:string=''
    public columnType:mssql.ISqlTypeFactoryWithNoParams|mssql.ISqlTypeWithLength=mssql.Int
    public isNullable:boolean=false
    public isIndexed:boolean=false
}