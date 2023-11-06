import { LogEngine } from 'whiskey-log';
import mssql from 'mssql'
import { SqlQueryPackage } from './components/sqlQueryPackage';
import { ColumnValuePair } from './components/columnValuePair';
import { SqlStatement } from './execute';

export async function SelectColumns(le:LogEngine, sqlPool:mssql.ConnectionPool, objectName:string, columns:string[], MatchConditions:ColumnValuePair[]):Promise<mssql.IRecordSet<any>> {
    le.logStack.push("getID");
    le.AddLogEntry(LogEngine.EntryType.Debug, `getting ID: for \x1b[96m${objectName}\x1b[0m`)
    let output:mssql.IRecordSet<any>

    try {

        const sqpSelect:SqlQueryPackage = BuildSelectStatement(le, sqlPool, objectName, columns, MatchConditions)

        const result:mssql.IResult<any> = await SqlStatement(le, sqlPool, sqpSelect.query, sqpSelect.request)
        output = result.recordset

    } catch(err) {
        le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
        throw(err)
    } finally {
        le.logStack.pop()
    }

    return new Promise<mssql.IRecordSet<any>>((resolve) => {resolve(output)})
}

export async function GetID(le:LogEngine, sqlPool:mssql.ConnectionPool, objectName:string, MatchConditions:ColumnValuePair[], addIfMissing:boolean=true):Promise<number> {
    le.logStack.push("getID");
    le.AddLogEntry(LogEngine.EntryType.Debug, `getting ID: for \x1b[96m${objectName}\x1b[0m`)
    let output:number=0

    try {

        const sqpSelect:SqlQueryPackage = BuildSelectStatement(le, sqlPool, objectName, [objectName+'ID'], MatchConditions)
        //le.AddLogEntry(LogEngine.EntryType.Debug, LogEngine.EntryType.Note, sqpSelect.queryText)

        const result:mssql.IResult<any> = await SqlStatement(le, sqlPool, sqpSelect.query, sqpSelect.request)

        if(result.recordset.length!==0) {
            output = result.recordset[0][objectName+'ID']
        } else {
            if(addIfMissing) {

                le.AddLogEntry(LogEngine.EntryType.Add, `${objectName}: did not find matching row, adding .. `)
                const sqpInsert:SqlQueryPackage = BuildInsertStatement(le, sqlPool, objectName, MatchConditions)
                try {
                    await SqlStatement(le, sqlPool, sqpInsert.query, sqpInsert.request)
                } catch(err) {
                    le.AddLogEntry(LogEngine.EntryType.Error, sqpSelect.queryText)
                    le.AddLogEntry(LogEngine.EntryType.Error, sqpInsert.queryText)
                    le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
                    throw(err)
                }
                
                
                let newResult:mssql.IResult<any> = await SqlStatement(le, sqlPool, sqpSelect.query, sqpSelect.request)
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

async function getSingleValue(le:LogEngine, sqlPool:mssql.ConnectionPool, table:string, idColumn:string, idValue:number, ColumnToSelect:string):Promise<any> {

    le.logStack.push("getSingleValue");
    le.AddLogEntry(LogEngine.EntryType.Debug, `getting \x1b[96m${ColumnToSelect}\x1b[0m from \x1b[96m${table}\x1b[0m where \x1b[96m${idColumn}\x1b[0m="\x1b[96m${idValue}\x1b[0m".. `)
    let output:any
    
    try {
        const r = sqlPool.request()
        r.input('idValue', mssql.Int, idValue)
        const query:string = `SELECT ${ColumnToSelect} FROM ${table} WHERE ${idColumn}=@idValue`
        const result:mssql.IResult<any> = await SqlStatement(le, sqlPool, query, r)
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

function BuildSelectStatement(le:LogEngine, sqlPool:mssql.ConnectionPool, TableToSelectFrom:string, ColumnsToSelect:string[], MatchConditions:ColumnValuePair[]):SqlQueryPackage {
    le.logStack.push("BuildSelectStatement")
    let output:SqlQueryPackage

    try {

        let selectQuery:string = `SELECT ${ColumnsToSelect.join(", ")} FROM ${TableToSelectFrom}(NOLOCK)`
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

function BuildInsertStatement(le:LogEngine, sqlPool:mssql.ConnectionPool, TableToInsertTo:string, MatchConditions:ColumnValuePair[]):SqlQueryPackage {
    le.logStack.push("BuildInsertStatement")
    let output:SqlQueryPackage

    try {

        let insertStatement:string = `INSERT INTO ${TableToInsertTo}`
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

function getAlphaArray():string[] {
    const alpha:number[] = Array.from(Array(26)).map((e, i) => i + 65);
    const alphabet:string[] = alpha.map((x) => String.fromCharCode(x));
    return alphabet
}

