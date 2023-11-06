import mssql from 'mssql'

export class ColumnValuePair {
    constructor(c:string, v:any, type:mssql.ISqlType|mssql.ISqlTypeFactoryWithNoParams|mssql.ISqlTypeWithLength) {
        this.column = c
        this.value = v
        this.type = type
    }
    public column:string
    public value:any
    public type:mssql.ISqlType|mssql.ISqlTypeFactoryWithNoParams|mssql.ISqlTypeWithLength
}