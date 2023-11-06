import { LogEngine } from 'whiskey-log';
import { executePromisesWithProgress } from 'whiskey-util'
import mssql, { IResult, IProcedureResult } from 'mssql'


export async function SqlStatement(le:LogEngine, sqlPool:mssql.ConnectionPool, sqlQuery:string, sqlRequest:mssql.Request, logFrequency:number=1000):Promise<mssql.IResult<any>> {
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

export async function StoredProcedure(le:LogEngine, sqlPool:mssql.ConnectionPool, sprocName:string, sqlRequests:mssql.Request[], logFrequency:number=1000) {
    le.logStack.push("writeToSql");
    le.AddLogEntry(LogEngine.EntryType.Debug, `executing ${sprocName} for ${sqlRequests.length} items .. `)
    
    try {
        let executionArray:Promise<void|IProcedureResult<any>>[] = []

        for(let i=0; i<sqlRequests.length; i++) {
            const r = sqlPool.request()
            try {
                r.parameters = sqlRequests[i].parameters
                r.verbose = true
                executionArray.push(
                    r
                    .execute(sprocName)
                    .catch((reason:any) =>{
                        le.AddLogEntry(LogEngine.EntryType.Error, `${reason}`)
                        console.debug(r)
                    })
                )
            } catch(err) {
                le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
                console.debug(sqlRequests[i])
            }
            
        }

        await executePromisesWithProgress(le, executionArray, logFrequency)

    } catch(err) {
        le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
        throw(err)
    } finally {
        le.logStack.pop()
    }
}

