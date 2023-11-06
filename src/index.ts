// imports
import { LogEngine } from 'whiskey-log';
import { executePromisesWithProgress } from 'whiskey-util'
import { CreateTable } from './create';
import { Update } from './update'

import mssql, { IProcedureResult, IResult } from 'mssql'

export class ColumnValuePair {
    constructor(c:string, v:any, type:mssql.ISqlType|mssql.ISqlTypeFactoryWithNoParams|mssql.ISqlTypeWithLength) {
        this.column = c
        this.value = v
        this.type = type
    }
    public column:string
    public value:any
    public type:mssql.ISqlType|mssql.ISqlTypeFactoryWithNoParams|mssql.ISqlTypeWithLength
}

export class SqlQueryPackage {
    constructor(q:string, r:mssql.Request) {
        this.query = q
        this.request = r
    }
    public query:string
    public request:mssql.Request
    public queryText:string=''
}

export class DBEngine {

    constructor(logEngine:LogEngine, sqlConfig:any, persistLogFrequency:number=250) {
        this._le = logEngine;
        this._sqlPool = new mssql.ConnectionPool(sqlConfig)
        this._persistLogFrequency = persistLogFrequency
        this._le.AddLogEntry(LogEngine.EntryType.Success, `DBEngine initialized ( don't forget to call connect()! )`)
        
    }
    private _le:LogEngine
    private _sqlPool:mssql.ConnectionPool
    private _persistLogFrequency:number
    

    public async connect() {
        this._le.AddLogEntry(LogEngine.EntryType.Info, `connecting to mssql ..`)
        await this._sqlPool.connect()
        this._le.AddLogEntry(LogEngine.EntryType.Success, `.. connected.`)
    }

    public async disconnect() {
        this._le.AddLogEntry(LogEngine.EntryType.Info, `disconnecting from mssql ..`)
        await this._sqlPool.close()
        this._le.AddLogEntry(LogEngine.EntryType.Success, `.. disconnected.`)
    }

    public async executeSql(sqlQuery:string, sqlRequest:mssql.Request, logFrequency:number=1000):Promise<mssql.IResult<any>> {
        this._le.logStack.push("executeSql");
        this._le.AddLogEntry(LogEngine.EntryType.Debug, `executing: ${sqlQuery}`)
        let output:mssql.IResult<any>
        try {
            const r = this._sqlPool.request()
            r.parameters = sqlRequest.parameters
            r.verbose = true
            output = await r.query(sqlQuery)
        } catch(err) {
            this._le.AddLogEntry(LogEngine.EntryType.Error, `${sqlQuery}`)
            this._le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
            throw(err)
        } finally {
            this._le.logStack.pop()
        }
        return new Promise<IResult<any>>((resolve) => {resolve(output)})
    }

    public async executeSprocs(sprocName:string, sqlRequests:mssql.Request[], logFrequency:number=1000) {
        this._le.logStack.push("writeToSql");
        this._le.AddLogEntry(LogEngine.EntryType.Debug, `executing ${sprocName} for ${sqlRequests.length} items .. `)
        
        try {
            let executionArray:Promise<void|IProcedureResult<any>>[] = []

            for(let i=0; i<sqlRequests.length; i++) {
                const r = this._sqlPool.request()
                try {
                    r.parameters = sqlRequests[i].parameters
                    r.verbose = true
                    executionArray.push(
                        r
                        .execute(sprocName)
                        .catch((reason:any) =>{
                            this._le.AddLogEntry(LogEngine.EntryType.Error, `${reason}`)
                            console.debug(r)
                        })
                    )
                } catch(err) {
                    this._le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
                    console.debug(sqlRequests[i])
                }
                
            }

            await executePromisesWithProgress(this._le, executionArray, logFrequency)

        } catch(err) {
            this._le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
            throw(err)
        } finally {
            this._le.logStack.pop()
        }
    }

    public async selectColumns(objectName:string, columns:string[], MatchConditions:ColumnValuePair[]):Promise<mssql.IRecordSet<any>> {
        this._le.logStack.push("getID");
        this._le.AddLogEntry(LogEngine.EntryType.Debug, `getting ID: for \x1b[96m${objectName}\x1b[0m`)
        let output:mssql.IRecordSet<any>

        try {

            const sqpSelect:SqlQueryPackage = this.BuildSelectStatement(objectName, columns, MatchConditions)

            const result:mssql.IResult<any> = await this.executeSql(sqpSelect.query, sqpSelect.request)
            output = result.recordset

        } catch(err) {
            this._le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
            throw(err)
        } finally {
            this._le.logStack.pop()
        }

        return new Promise<mssql.IRecordSet<any>>((resolve) => {resolve(output)})
    }

    public async getID(objectName:string, MatchConditions:ColumnValuePair[], addIfMissing:boolean=true):Promise<number> {
        this._le.logStack.push("getID");
        this._le.AddLogEntry(LogEngine.EntryType.Debug, `getting ID: for \x1b[96m${objectName}\x1b[0m`)
        let output:number=0

        try {

            const sqpSelect:SqlQueryPackage = this.BuildSelectStatement(objectName, [objectName+'ID'], MatchConditions)
            //this._le.AddLogEntry(LogEngine.EntryType.Debug, LogEngine.EntryType.Note, sqpSelect.queryText)

            const result:mssql.IResult<any> = await this.executeSql(sqpSelect.query, sqpSelect.request)

            if(result.recordset.length!==0) {
                output = result.recordset[0][objectName+'ID']
            } else {
                if(addIfMissing) {

                    this._le.AddLogEntry(LogEngine.EntryType.Add, `${objectName}: did not find matching row, adding .. `)
                    const sqpInsert:SqlQueryPackage = this.BuildInsertStatement(objectName, MatchConditions)
                    try {
                        await this.executeSql(sqpInsert.query, sqpInsert.request)
                    } catch(err) {
                        this._le.AddLogEntry(LogEngine.EntryType.Error, sqpSelect.queryText)
                        this._le.AddLogEntry(LogEngine.EntryType.Error, sqpInsert.queryText)
                        this._le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
                        throw(err)
                    }
                    
                    
                    let newResult:mssql.IResult<any> = await this.executeSql(sqpSelect.query, sqpSelect.request)
                    if(newResult.recordset.length===0) {
                        throw(`ID not found for newly added row in ${objectName}!`)
                    } else {
                        output = newResult.recordset[0][objectName+'ID']
                    }

                }
                

            }
        } catch(err) {
            this._le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
            throw(err)
        } finally {
            this._le.logStack.pop()
        }

        return new Promise<number>((resolve) => {resolve(output)})
    }

    public async getSingleValue(table:string, idColumn:string, idValue:number, ColumnToSelect:string):Promise<any> {

        this._le.logStack.push("getSingleValue");
        this._le.AddLogEntry(LogEngine.EntryType.Debug, `getting \x1b[96m${ColumnToSelect}\x1b[0m from \x1b[96m${table}\x1b[0m where \x1b[96m${idColumn}\x1b[0m="\x1b[96m${idValue}\x1b[0m".. `)
        let output:any
        
        try {
            const r = this._sqlPool.request()
            r.input('idValue', mssql.Int, idValue)
            const query:string = `SELECT ${ColumnToSelect} FROM ${table} WHERE ${idColumn}=@idValue`
            const result:mssql.IResult<any> = await this.executeSql(query, r)
            if(result.recordset.length===0) {
                throw(`${table}.${idColumn}=${idValue} not found.`)
            } else {
                output = result.recordset[0][ColumnToSelect]
            }
        } catch(err) {
            this._le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
            throw(err)
        } finally {
            this._le.logStack.pop()
        }

        return new Promise<any>((resolve) => {resolve(output)})
    
    }

    private getAlphaArray():string[] {
        const alpha:number[] = Array.from(Array(26)).map((e, i) => i + 65);
        const alphabet:string[] = alpha.map((x) => String.fromCharCode(x));
        return alphabet
    }

    private BuildSelectStatement(TableToSelectFrom:string, ColumnsToSelect:string[], MatchConditions:ColumnValuePair[]):SqlQueryPackage {
        this._le.logStack.push("BuildSelectStatement")
        let output:SqlQueryPackage

        try {

            let selectQuery:string = `SELECT ${ColumnsToSelect.join(", ")} FROM ${TableToSelectFrom}(NOLOCK)`
            let selectText:string = selectQuery

            const alphabet = this.getAlphaArray()

            const r = this._sqlPool.request()
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
                //this._le.AddLogEntry(LogEngine.EntryType.Info, LogEngine.EntryType.Note, `${MatchConditions[i].column}='${MatchConditions[i].value}'`)
            }

            //console.debug(selectQuery)
            
            const sqp = new SqlQueryPackage(selectQuery, r)
            sqp.queryText = selectText

            output = sqp

        } catch(err) {
            this._le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
            throw(err)
        } finally {
            this._le.logStack.pop()
        }

        return output

    }

    private BuildInsertStatement(TableToInsertTo:string, MatchConditions:ColumnValuePair[]):SqlQueryPackage {
        this._le.logStack.push("BuildInsertStatement")
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

            const alphabet = this.getAlphaArray()

            const r = this._sqlPool.request()
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
            this._le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
            throw(err)
        } finally {
            this._le.logStack.pop()
        }

        return output
    }

}

module.exports = {
    CreateTable,
    Update
}