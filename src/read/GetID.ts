import { LogEngine } from 'whiskey-log';
import mssql from 'mssql'
import { SqlQueryPackage } from '../components/SqlQueryPackage';
import { ColumnValuePair } from '../components/columnValuePair';
import { ExecuteSqlStatement } from '../update/ExecuteSqlStatement';
import { BuildInsertStatement } from '../update/BuildInsertStatement'
import { BuildComplexSelectStatement } from './BuildComplexSelectStatement';


export async function GetID(le:LogEngine, sqlPool:mssql.ConnectionPool, objectName:string, MatchConditions:ColumnValuePair[], addIfMissing:boolean=true):Promise<number> {
    le.logStack.push("getID");
    le.AddLogEntry(LogEngine.EntryType.Debug, `getting ID: for \x1b[96m${objectName}\x1b[0m`)
    let output:number=0

    try {

        const sqpSelect:SqlQueryPackage = BuildComplexSelectStatement(le, sqlPool, objectName, [objectName+'ID'], MatchConditions)
        //le.AddLogEntry(LogEngine.EntryType.Debug, LogEngine.EntryType.Note, sqpSelect.queryText)

        const result:mssql.IResult<any> = await ExecuteSqlStatement(le, sqlPool, sqpSelect)

        if(result.recordset.length!==0) {
            output = result.recordset[0][objectName+'ID']
        } else {
            if(addIfMissing) {

                le.AddLogEntry(LogEngine.EntryType.Add, `${objectName}: did not find matching row, adding .. `)
                const sqpInsert:SqlQueryPackage = BuildInsertStatement(le, sqlPool, objectName, MatchConditions)
                try {
                    await ExecuteSqlStatement(le, sqlPool, sqpInsert)
                } catch(err) {
                    le.AddLogEntry(LogEngine.EntryType.Error, sqpSelect.queryText || '')
                    le.AddLogEntry(LogEngine.EntryType.Error, sqpInsert.queryText || '')
                    le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
                    throw(err)
                }
                
                
                let newResult:mssql.IResult<any> = await ExecuteSqlStatement(le, sqlPool, sqpSelect)
                if(newResult.recordset.length===0) {
                    throw(`ID not found for newly added row in ${objectName}!`)
                } else {
                    output = newResult.recordset[0][objectName+'ID']
                }

            }
            

        }
    } catch(err) {
        le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
        throw(err)
    } finally {
        le.logStack.pop()
    }

    return new Promise<number>((resolve) => {resolve(output)})
}
