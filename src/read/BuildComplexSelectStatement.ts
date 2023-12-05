import { LogEngine } from 'whiskey-log';
import { getAlphaArray } from 'whiskey-util';
import mssql from 'mssql'
import { SqlQueryPackage } from '../components/SqlQueryPackage';
import { ColumnValuePair } from '../components/columnValuePair';


export function BuildComplexSelectStatement(le:LogEngine, sqlPool:mssql.ConnectionPool, TableToSelectFrom:string, ColumnsToSelect:string[], MatchConditions:ColumnValuePair[]):SqlQueryPackage {
    le.logStack.push("BuildComplexSelectStatement")
    let output:SqlQueryPackage

    try {

        let selectQuery:string = `SELECT ${ColumnsToSelect.join(", ")} FROM [${TableToSelectFrom}](NOLOCK)`
        let selectText:string = selectQuery

        const alphabet = getAlphaArray()

        const r = sqlPool.request()
        for(let i=0; i<MatchConditions.length; i++) {
            if(i===0) { selectQuery += ' WHERE '; selectText += ' WHERE '}
            if(i>0) { selectQuery += ' AND '; selectText += ' AND '}
            if(MatchConditions[i].value===undefined) {
                selectQuery += `${MatchConditions[i].column} IS NULL`
                selectText +=` ${MatchConditions[i].column} IS NULL`
            } else {
                selectQuery += `${MatchConditions[i].column}=@KeyValue${alphabet[i]}`
                selectText +=`${MatchConditions[i].column}='${MatchConditions[i].value}'`
            }
            
            r.input(`KeyValue${alphabet[i]}`, MatchConditions[i].type, (MatchConditions[i].value || MatchConditions[i].value===0) ? MatchConditions[i].value : null)
            //le.AddLogEntry(LogEngine.EntryType.Info, LogEngine.EntryType.Note, `${MatchConditions[i].column}='${MatchConditions[i].value}'`)
        }

        //console.debug(selectQuery)
        
        const sqp = new SqlQueryPackage(selectQuery, r)
        sqp.queryText = selectText

        output = sqp

    } catch(err) {
        le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
        throw(err)
    } finally {
        le.logStack.pop()
    }

    return output

}