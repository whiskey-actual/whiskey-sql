import mssql from 'mssql'

export class SqlQueryPackage {
    constructor(q:string, r:mssql.Request) {
        this.query = q
        this.request = r
    }
    public query:string
    public request:mssql.Request
    public queryText:string=''
}

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