import { LogEngine } from "whiskey-log";
import mssql from 'mssql'
import { ExecuteSqlStatement } from "../update/executeSqlStatement";

export async function doesTableExist(le:LogEngine, sqlPool:mssql.ConnectionPool, tableName:string):Promise<boolean> {
    le.logStack.push("doesTableExist");
    le.AddLogEntry(LogEngine.EntryType.Debug, `checking table: ${tableName}`)
    let output:boolean=false
    try {
        const r = sqlPool.request()
        const query:string = `SELECT OBJECT_ID FROM information_schema.tables WHERE table_schema='${tableName}' AND table_name='${tableName}';`
        const result = await ExecuteSqlStatement(le, sqlPool, query, r)
        if(result.rowsAffected.length>0) {
            output=true
        }
        console.debug(result)
    } catch(err) {
        le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
        throw(err)
    } finally {
        le.logStack.pop()
    }

    return new Promise<boolean>((resolve) => {resolve(output)})

}