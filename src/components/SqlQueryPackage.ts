import mssql from 'mssql'

export class SqlQueryPackage {
    constructor(sqlQuery:string, sqlRequest:mssql.Request, queryText?:string) {
        this.query = sqlQuery
        this.request = sqlRequest
        this.queryText = queryText
    }
    public query:string
    public request:mssql.Request
    public queryText?:string
}

