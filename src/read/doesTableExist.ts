import { LogEngine } from "whiskey-log";
import mssql from 'mssql'
import { ExecuteSqlStatement } from "../update/executeSqlStatement";

export async function doesTableExist(le:LogEngine, sqlPool:mssql.ConnectionPool, tableName:string):Promise<boolean> {
    le.logStack.push("doesTableExist");
    let output:boolean=false
    try {
        const r = sqlPool.request()
        const query:string = `SELECT TABLE_NAME FROM information_schema.tables WHERE table_name='${tableName}';`
        const result = await ExecuteSqlStatement(le, sqlPool, query, r)
        if(result.rowsAffected[0]>0) {
            le.AddLogEntry(LogEngine.EntryType.Info, `.. table [${tableName} exists.`)
            output=true
        }
    } catch(err) {
        le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
        throw(err)
    } finally {
        le.logStack.pop()
    }

    return new Promise<boolean>((resolve) => {resolve(output)})

}