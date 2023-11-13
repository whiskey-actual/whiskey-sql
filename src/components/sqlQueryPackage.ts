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

