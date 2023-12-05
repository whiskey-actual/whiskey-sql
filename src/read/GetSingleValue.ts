import { LogEngine } from 'whiskey-log';
import { getAlphaArray } from 'whiskey-util';
import mssql from 'mssql'
import { SqlQueryPackage } from '../components/SqlQueryPackage';
import { ExecuteSqlStatement } from '../update/ExecuteSqlStatement';

export async function GetSingleValue(le:LogEngine, sqlPool:mssql.ConnectionPool, table:string, idColumn:string, idValue:number, ColumnToSelect:string):Promise<any> {
    le.logStack.push("getSingleValue");
    le.AddLogEntry(LogEngine.EntryType.Debug, `getting \x1b[96m${ColumnToSelect}\x1b[0m from \x1b[96m${table}\x1b[0m where \x1b[96m${idColumn}\x1b[0m="\x1b[96m${idValue}\x1b[0m".. `)
    let output:any
    
    try {
        const r = sqlPool.request()
        r.input('idValue', mssql.Int, idValue)
        const sqp:SqlQueryPackage = new SqlQueryPackage(`SELECT ${ColumnToSelect} FROM [${table}](NOLOCK) WHERE ${idColumn}=@idValue`, r)
        const result:mssql.IResult<any> = await ExecuteSqlStatement(le, sqlPool, sqp)
        if(result.recordset.length===0) {
            throw(`${table}.${idColumn}=${idValue} not found.`)
        } else {
            output = result.recordset[0][ColumnToSelect]
        }
    } catch(err) {
        le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
        throw(err)
    } finally {
        le.logStack.pop()
    }

    return new Promise<any>((resolve) => {resolve(output)})

}