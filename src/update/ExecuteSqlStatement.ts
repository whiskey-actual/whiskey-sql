import { LogEngine } from 'whiskey-log';
import mssql, { IResult } from 'mssql'
import { SqlQueryPackage } from '../components/SqlQueryPackage';

export async function ExecuteSqlStatement(le:LogEngine, sqlPool:mssql.ConnectionPool, sqlQueryPackage:SqlQueryPackage, logFrequency:number=1000):Promise<mssql.IResult<any>> {
    le.logStack.push("ExecuteSqlStatement");
    le.AddLogEntry(LogEngine.EntryType.Info, `executing: ${sqlQueryPackage.query}`)
    let output:mssql.IResult<any>
    try {
        const r = sqlPool.request()
        r.parameters = sqlQueryPackage.request.parameters
        r.verbose = true
        output = await r.query(sqlQueryPackage.query)
    } catch(err) {
        console.debug(sqlQueryPackage)
        le.AddLogEntry(LogEngine.EntryType.Error, `${sqlQueryPackage.query}`)
        le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
        throw(err)
    } finally {
        le.logStack.pop()
    }
    return new Promise<IResult<any>>((resolve) => {resolve(output)})
}