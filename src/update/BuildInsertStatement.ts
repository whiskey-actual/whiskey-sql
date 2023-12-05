import { LogEngine } from 'whiskey-log';
import { getAlphaArray } from 'whiskey-util';
import mssql from 'mssql'
import { SqlQueryPackage } from '../components/SqlQueryPackage';
import { ColumnValuePair } from '../components/columnValuePair';


export function BuildInsertStatement(le:LogEngine, sqlPool:mssql.ConnectionPool, TableToInsertTo:string, MatchConditions:ColumnValuePair[]):SqlQueryPackage {
    le.logStack.push("BuildInsertStatement")
    let output:SqlQueryPackage

    try {

        let insertStatement:string = `INSERT INTO [${TableToInsertTo}]`
        insertStatement += '('
        for(let i=0; i<MatchConditions.length; i++) {
            if(i>0) { insertStatement += `,`}
            insertStatement += `${MatchConditions[i].column}`
        }
        insertStatement += ')'
        insertStatement += ' VALUES ('

        let insertText:string = insertStatement

        const alphabet = getAlphaArray()

        const r = sqlPool.request()
        for(let i=0; i<MatchConditions.length; i++) {
            if(i>0) { insertStatement += ','; insertText += ','}
            insertStatement += `@KeyValue${alphabet[i]}`
            insertText += `'${MatchConditions[i].value}'`
            r.input(`KeyValue${alphabet[i]}`, MatchConditions[i].type, (MatchConditions[i].value || MatchConditions[i].value===0) ? MatchConditions[i].value : null)
            //this._le.AddLogEntry(LogEngine.EntryType.Info, LogEngine.EntryType.Note, `${MatchConditions[i].column}='${MatchConditions[i].value}'`)
        }
        insertStatement += ')'; insertText += ')'

        const sqp = new SqlQueryPackage(insertStatement, r)
        sqp.queryText= insertText
        output = sqp

    } catch(err) {
        le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
        throw(err)
    } finally {
        le.logStack.pop()
    }

    return output
}


