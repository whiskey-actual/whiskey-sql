import { LogEngine } from "whiskey-log";
import mssql from 'mssql'
import { SqlStatement } from "../execute";

export async function doesTableExist(le:LogEngine, sqlPool:mssql.ConnectionPool, tableName:string):Promise<boolean> {

    let output:boolean=false
    try {
        const r = sqlPool.request()
        const query:string = `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='${tableName}' AND table_name='${tableName}');`
        const result = await SqlStatement(le, sqlPool, query, r)
        if(result.rowsAffected.length===0) {
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