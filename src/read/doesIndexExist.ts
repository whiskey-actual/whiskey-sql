import { LogEngine } from "whiskey-log";
import mssql from 'mssql'
import { ExecuteSqlStatement } from "../update/executeSqlStatement";

export async function doesIndexExist(le:LogEngine, sqlPool:mssql.ConnectionPool, indexName:string, tableName:string):Promise<boolean> {
    le.logStack.push("doesIndexExist");
    le.AddLogEntry(LogEngine.EntryType.Debug, `checking index: ${indexName}`)

    let output:boolean=false
    try {
        const r = sqlPool.request()
        const query:string = `SELECT OBJECT_ID FROM sys.indexes WHERE name='${indexName}' AND object_id=OBJECT_ID('${tableName}');`
        const result = await ExecuteSqlStatement(le, sqlPool, query, r)
        if(result.rowsAffected.length>0) {
            le.AddLogEntry(LogEngine.EntryType.Info, `.. index ${tableName} exists`)
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