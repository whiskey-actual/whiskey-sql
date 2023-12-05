import { LogEngine } from 'whiskey-log';
import mssql from 'mssql'
import { SqlQueryPackage } from '../components/SqlQueryPackage';
import { ColumnValuePair } from '../components/columnValuePair';
import { ExecuteSqlStatement } from '../update/ExecuteSqlStatement';
import { BuildComplexSelectStatement } from './BuildComplexSelectStatement';

export async function SelectColumns(le:LogEngine, sqlPool:mssql.ConnectionPool, objectName:string, columns:string[], MatchConditions:ColumnValuePair[]):Promise<mssql.IRecordSet<any>> {
    le.logStack.push("SelectColumns");
    le.AddLogEntry(LogEngine.EntryType.Debug, `getting ID: for \x1b[96m${objectName}\x1b[0m`)
    let output:mssql.IRecordSet<any>

    try {
        const sqpSelect:SqlQueryPackage = BuildComplexSelectStatement(le, sqlPool, objectName, columns, MatchConditions)
        const result:mssql.IResult<any> = await ExecuteSqlStatement(le, sqlPool, sqpSelect)
        output = result.recordset
    } catch(err) {
        le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
        throw(err)
    } finally {
        le.logStack.pop()
    }

    return new Promise<mssql.IRecordSet<any>>((resolve) => {resolve(output)})
}