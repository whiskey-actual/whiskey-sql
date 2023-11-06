import { LogEngine } from 'whiskey-log';
import mssql, { IResult} from 'mssql'

export async function executeQuery(le:LogEngine, sqlPool:mssql.ConnectionPool, sqlQuery:string, sqlRequest:mssql.Request, logFrequency:number=1000):Promise<mssql.IResult<any>> {
    le.logStack.push("executeSql");
    le.AddLogEntry(LogEngine.EntryType.Debug, `executing: ${sqlQuery}`)
    let output:mssql.IResult<any>
    try {
        const r = sqlPool.request()
        r.parameters = sqlRequest.parameters
        r.verbose = true
        output = await r.query(sqlQuery)
    } catch(err) {
        le.AddLogEntry(LogEngine.EntryType.Error, `${sqlQuery}`)
        le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
        throw(err)
    } finally {
        le.logStack.pop()
    }
    return new Promise<IResult<any>>((resolve) => {resolve(output)})
}

