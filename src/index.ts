// imports
import { LogEngine } from 'whiskey-log';
import { Utilities } from 'whiskey-util'

import mssql, { IProcedureResult, IResult } from 'mssql'


export class TableUpdate {
    constructor(tableName:string, primaryKeyColumnName:string) {
        this.tableName=tableName
        this.primaryKeyColumnName=primaryKeyColumnName
    }
    public tableName:string = ''
    public primaryKeyColumnName:string = ''
    public RowUpdates:RowUpdate[] = []
}

export class RowUpdate {
    constructor(primaryKeyValue:number) {
        this.primaryKeyValue=primaryKeyValue
    }
    public updateName:string = ''
    public primaryKeyValue:number = 0
    public ColumnUpdates:ColumnUpdate[] = []
}

export class ColumnUpdate {
    constructor(ColumnName:string, ColumnType:mssql.ISqlType|mssql.ISqlTypeFactoryWithNoParams, ColumnValue:any) {
        this.ColumnName=ColumnName
        this.ColumnType=ColumnType
        this.ColumnValue=ColumnValue
    }
    public ColumnName:string = ''
    public ColumnType:mssql.ISqlType|mssql.ISqlTypeFactoryWithNoParams = mssql.Int
    public ColumnValue:any = undefined
}

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

export class UpdatePackage {
    public objectName:string=''
    public tableName:string = ''
    public idColumn:string = ''
    public UpdatePackageItems:UpdatePackageItem[]=[]
}

export class UpdatePackageItem {
    public idValue:number = 0
    public updateColumn:string = ''
    public updateValue:any = ''
    public columnType:mssql.ISqlType|mssql.ISqlTypeFactoryWithNoParams = mssql.Int
}

export class DBEngine {

    constructor(logEngine:LogEngine, sqlConfig:any, persistLogFrequency:number=250) {
        this._le = logEngine;
        this._sqlPool = new mssql.ConnectionPool(sqlConfig)
        this._persistLogFrequency = persistLogFrequency
        this._le.AddLogEntry(LogEngine.Severity.Info, LogEngine.Action.Success, `DBEngine initialized ( don't forget to call connect()! )`)
        
    }
    private _le:LogEngine
    private _sqlPool:mssql.ConnectionPool
    private _persistLogFrequency:number
    

    public async connect() {
        this._le.AddLogEntry(LogEngine.Severity.Info, LogEngine.Action.Note, `connecting to mssql ..`)
        await this._sqlPool.connect()
        this._le.AddLogEntry(LogEngine.Severity.Info, LogEngine.Action.Success, `.. connected.`)
    }

    public async disconnect() {
        this._le.AddLogEntry(LogEngine.Severity.Info, LogEngine.Action.Note, `disconnecting from mssql ..`)
        await this._sqlPool.close()
        this._le.AddLogEntry(LogEngine.Severity.Info, LogEngine.Action.Success, `.. disconnected.`)
    }

    public async executeSql(sqlQuery:string, sqlRequest:mssql.Request, logFrequency:number=1000):Promise<mssql.IResult<any>> {
        this._le.logStack.push("executeSql");
        let output:mssql.IResult<any>

        try {

            this._le.AddLogEntry(LogEngine.Severity.Debug, LogEngine.Action.Note, `executing: ${sqlQuery}`)
            
            const r = this._sqlPool.request()
            r.parameters = sqlRequest.parameters
            r.verbose = true
            output = await r.query(sqlQuery)

        } catch(err) {
            this._le.AddLogEntry(LogEngine.Severity.Error, LogEngine.Action.Note, `${err}`)
            throw(err)
        } finally {
            this._le.logStack.pop()
        }

        return new Promise<IResult<any>>((resolve) => {resolve(output)})
    }

    public async executeSprocs(sprocName:string, sqlRequests:mssql.Request[], logFrequency:number=1000) {
        this._le.logStack.push("writeToSql");

        try {

            this._le.AddLogEntry(LogEngine.Severity.Debug, LogEngine.Action.Note, `executing ${sprocName} for ${sqlRequests.length} items .. `)

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
                            this._le.AddLogEntry(LogEngine.Severity.Error, LogEngine.Action.Note, `${reason}`)
                            console.debug(r)
                        })
                    )
                } catch(err) {
                    this._le.AddLogEntry(LogEngine.Severity.Error, LogEngine.Action.Note, `${err}`)
                    console.debug(sqlRequests[i])
                }
                
            }

            await Utilities.executePromisesWithProgress(this._le, executionArray, logFrequency)

        } catch(err) {
            this._le.AddLogEntry(LogEngine.Severity.Error, LogEngine.Action.Note, `${err}`)
            throw(err)
        } finally {
            this._le.logStack.pop()
        }
    }

    public async getID(objectName:string, MatchConditions:ColumnValuePair[], addIfMissing:boolean=true):Promise<number> {
        this._le.logStack.push("getID");
        this._le.AddLogEntry(LogEngine.Severity.Debug, LogEngine.Action.Success, `getting ID: for \x1b[96m${objectName}\x1b[0m`)
        let output:number=0

        try {

            const sqpSelect:SqlQueryPackage = this.BuildSelectStatement(objectName, objectName+'ID', MatchConditions)
            //this._le.AddLogEntry(LogEngine.Severity.Debug, LogEngine.Action.Note, sqpSelect.queryText)

            const result:mssql.IResult<any> = await this.executeSql(sqpSelect.query, sqpSelect.request)

            if(result.recordset.length!==0) {
                output = result.recordset[0][objectName+'ID']
            } else {
                if(addIfMissing) {

                    this._le.AddLogEntry(LogEngine.Severity.Warning, LogEngine.Action.Add, `${objectName}: did not find matching row, adding .. `)
                    const sqpInsert:SqlQueryPackage = this.BuildInsertStatement(objectName, MatchConditions)
                    try {
                        await this.executeSql(sqpInsert.query, sqpInsert.request)
                    } catch(err) {
                        this._le.AddLogEntry(LogEngine.Severity.Error, LogEngine.Action.Note, sqpSelect.queryText)
                        this._le.AddLogEntry(LogEngine.Severity.Error, LogEngine.Action.Note, sqpInsert.queryText)
                        this._le.AddLogEntry(LogEngine.Severity.Error, LogEngine.Action.Note, `${err}`)
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
            this._le.AddLogEntry(LogEngine.Severity.Error, LogEngine.Action.Note, `${err}`)
            throw(err)
        } finally {
            this._le.logStack.pop()
        }

        return new Promise<number>((resolve) => {resolve(output)})
    }

    public async getSingleValue(table:string, idColumn:string, idValue:number, queryColumn:string):Promise<any> {

        this._le.logStack.push("getSingleValue");
        this._le.AddLogEntry(LogEngine.Severity.Debug, LogEngine.Action.Note, `getting \x1b[96m${queryColumn}\x1b[0m from \x1b[96m${table}\x1b[0m where \x1b[96m${idColumn}\x1b[0m="\x1b[96m${idValue}\x1b[0m".. `)
        let output:any
        
        try {
            const r = this._sqlPool.request()
            r.input('idValue', mssql.Int, idValue)
            const query:string = `SELECT ${queryColumn} FROM ${table} WHERE ${idColumn}=@idValue`
            const result:mssql.IResult<any> = await this.executeSql(query, r)
            if(result.recordset.length===0) {
                throw(`${table}.${idColumn}=${idValue} not found.`)
            } else {
                output = result.recordset[0][queryColumn]
            }
        } catch(err) {
            this._le.AddLogEntry(LogEngine.Severity.Error, LogEngine.Action.Note, `${err}`)
            throw(err)
        } finally {
            this._le.logStack.pop()
        }

        return new Promise<any>((resolve) => {resolve(output)})
    
    }

    public async performUpdates(updatePackage:UpdatePackage, changeDetection:boolean=false):Promise<void> {
        this._le.logStack.push("performUpdates");
        this._le.AddLogEntry(LogEngine.Severity.Info, LogEngine.Action.Note, `processing ${updatePackage.UpdatePackageItems.length} updates on \x1b[96m${updatePackage.tableName}\x1b[0m`)
        const startDate:Date = new Date()

        try {

            for(let i=0; i<updatePackage.UpdatePackageItems.length; i++) {

                let currentValue:any

                let changeDetected:boolean = false
                if(changeDetection) {
                    try {
                        currentValue = await this.getSingleValue(updatePackage.tableName, updatePackage.idColumn, updatePackage.UpdatePackageItems[i].idValue, updatePackage.UpdatePackageItems[i].updateColumn);
                        if(
                            updatePackage.UpdatePackageItems[i].updateValue
                            && (!currentValue || currentValue===null)
                            && currentValue!==updatePackage.UpdatePackageItems[i].updateValue
                        ) 
                        {
                            changeDetected=true
                        }
                    } catch(err) {
                        this._le.AddLogEntry(LogEngine.Severity.Error, LogEngine.Action.Note, `currentValue:"${currentValue}", "updateValue:"${updatePackage.UpdatePackageItems[i].updateValue}" :: ${err}`)
                        throw(err)
                    }
                }

                if(!changeDetection || (changeDetection && changeDetected)) {
                    this._le.AddLogEntry(LogEngine.Severity.Info, LogEngine.Action.Change, `\x1b[96m${updatePackage.objectName}\x1b[0m :: \x1b[96m${updatePackage.tableName}\x1b[0m.\x1b[96m${updatePackage.UpdatePackageItems[i].updateColumn}\x1b[0m: "\x1b[96m${currentValue}\x1b[0m"->"\x1b[96m${updatePackage.UpdatePackageItems[i].updateValue}\x1b[0m".. `)
                    const r = this._sqlPool.request()
                    r.input('idValue', mssql.Int, updatePackage.UpdatePackageItems[i].idValue)
                    r.input('updateValue', updatePackage.UpdatePackageItems[i].columnType, updatePackage.UpdatePackageItems[i].updateValue)
                    const queryText:string = `UPDATE ${updatePackage.tableName} SET ${updatePackage.UpdatePackageItems[i].updateColumn}=@updateValue WHERE ${updatePackage.idColumn}=@idValue`
                    await this.executeSql(queryText, r)
                } else {
                    // no update needed
                    this._le.AddLogEntry(LogEngine.Severity.Debug, LogEngine.Action.Success, `\x1b[96m${updatePackage.tableName}\x1b[0m.\x1b[96m${updatePackage.UpdatePackageItems[i].updateColumn}\x1b[0m: "\x1b[96m${currentValue}\x1b[0m"="\x1b[96m${updatePackage.UpdatePackageItems[i].updateValue}\x1b[0m".. `)
                }

                if(i>0 && i%this._persistLogFrequency===0) {
                    this._le.AddLogEntry(LogEngine.Severity.Info, LogEngine.Action.Success, Utilities.getProgressMessage(updatePackage.tableName, 'persisted', i, updatePackage.UpdatePackageItems.length, startDate, new Date))
                }

            }
        } catch(err) {
            this._le.AddLogEntry(LogEngine.Severity.Error, LogEngine.Action.Note, `${err}`)
            throw(err)
        } finally {
            this._le.AddLogEntry(LogEngine.Severity.Info, LogEngine.Action.Success, Utilities.getProgressMessage(updatePackage.tableName, 'persisted', updatePackage.UpdatePackageItems.length, updatePackage.UpdatePackageItems.length, startDate, new Date))
            this._le.logStack.pop()
        }

        return new Promise<void>((resolve) => {resolve()})

    }

    public async updateTable(tableUpdate:TableUpdate, changeDetection:boolean=false):Promise<void> {
        this._le.logStack.push(tableUpdate.tableName);
        this._le.AddLogEntry(LogEngine.Severity.Debug, LogEngine.Action.Note, `updating ${tableUpdate.RowUpdates.length} rows on \x1b[96m${tableUpdate.tableName}\x1b[0m`)
        try {

            for(let i=0; i<tableUpdate.RowUpdates.length; i++) {

                let selectQuery = 'SELECT '

                // iterate through the column updates to build the select statement
                for(let j=0; j<tableUpdate.RowUpdates[i].ColumnUpdates.length; j++) {
                    selectQuery += tableUpdate.RowUpdates[i].ColumnUpdates[j].ColumnName
                    if(j<tableUpdate.RowUpdates[i].ColumnUpdates.length-1) {selectQuery += ','}
                    selectQuery += ' '
                }

                selectQuery += `FROM ${tableUpdate.tableName} WHERE ${tableUpdate.primaryKeyColumnName}=@PrimaryKeyValue`

                //this._le.AddLogEntry(LogEngine.Severity.Debug, LogEngine.Action.Note, selectQuery);

                const r = this._sqlPool.request()
                r.input('PrimaryKeyValue', mssql.Int, tableUpdate.RowUpdates[i].primaryKeyValue)

                const result = await this.executeSql(selectQuery, r)
                
                let columnUpdateStatements:string[] = []

                const updateRequest = this._sqlPool.request()
                updateRequest.input('PrimaryKeyValue', mssql.Int, tableUpdate.RowUpdates[i].primaryKeyValue)
                
                // iterate over the column updates again to compare values, and build the update statement
                for(let j=0; j<tableUpdate.RowUpdates[i].ColumnUpdates.length; j++) {

                    const currentValue:any = result.recordset[0][tableUpdate.RowUpdates[i].ColumnUpdates[j].ColumnName]
                    const newValue:any = tableUpdate.RowUpdates[i].ColumnUpdates[j].ColumnValue

                    if(newValue && (!currentValue || currentValue==null || newValue.toString().trim()!==currentValue.toString().trim())) {

                        // dont log timestamp changes, because they are expected on nearly every update.
                        if(tableUpdate.RowUpdates[i].ColumnUpdates[j].ColumnType!==mssql.DateTime2) {
                            this._le.AddLogEntry(LogEngine.Severity.Info, LogEngine.Action.Change, `\x1b[96m${tableUpdate.RowUpdates[i].updateName}\x1b[0m :: \x1b[96m${tableUpdate.tableName}\x1b[0m.\x1b[96m${tableUpdate.RowUpdates[i].ColumnUpdates[j].ColumnName}\x1b[0m: "\x1b[96m${currentValue}\x1b[0m"->"\x1b[96m${newValue}\x1b[0m".. `)
                        }
                        columnUpdateStatements.push(`${tableUpdate.RowUpdates[i].ColumnUpdates[j].ColumnName}=@${tableUpdate.RowUpdates[i].ColumnUpdates[j].ColumnName}`)
                        updateRequest.input(tableUpdate.RowUpdates[i].ColumnUpdates[j].ColumnName, tableUpdate.RowUpdates[i].ColumnUpdates[j].ColumnType, tableUpdate.RowUpdates[i].ColumnUpdates[j].ColumnValue)
                    }
                }

                // do we have updates to perform?
                if(columnUpdateStatements.length>0) {

                    let updateStatement:string = `UPDATE ${tableUpdate.tableName} SET `

                    for(let j=0; j<columnUpdateStatements.length; j++) {
                        updateStatement += columnUpdateStatements[j]
                        if(j<columnUpdateStatements.length-1) { updateStatement += ','}
                        updateStatement += ' '
                    }

                    updateStatement += `WHERE ${tableUpdate.primaryKeyColumnName}=@PrimaryKeyValue`

                    try {
                        await this.executeSql(updateStatement, updateRequest)
                    } catch(err) {
                        this._le.AddLogEntry(LogEngine.Severity.Error, LogEngine.Action.Note, updateStatement);
                        this._le.AddLogEntry(LogEngine.Severity.Error, LogEngine.Action.Note, `${err}`);
                        throw(err)
                    }
                }
            }
        } catch(err) {
            this._le.AddLogEntry(LogEngine.Severity.Error, LogEngine.Action.Note, `${err}`)
            throw(err)
        } finally {
            //this._le.AddLogEntry(LogEngine.Severity.Info, LogEngine.Action.Success, Utilities.getProgressMessage(updatePackage.tableName, 'persisted', updatePackage.UpdatePackageItems.length, updatePackage.UpdatePackageItems.length, startDate, new Date))
            this._le.logStack.pop()
        }

        return new Promise<void>((resolve) => {resolve()})

    }

    private getAlphaArray():string[] {
        const alpha:number[] = Array.from(Array(26)).map((e, i) => i + 65);
        const alphabet:string[] = alpha.map((x) => String.fromCharCode(x));
        return alphabet
    }

    private BuildSelectStatement(TableToSelectFrom:string, ColumnToSelect:string, MatchConditions:ColumnValuePair[]):SqlQueryPackage {
        this._le.logStack.push("BuildSelectStatement")
        let output:SqlQueryPackage

        try {

            let selectQuery:string = `SELECT ${ColumnToSelect} FROM ${TableToSelectFrom}(NOLOCK) WHERE`
            let selectText:string = selectQuery

            const alphabet = this.getAlphaArray()

            const r = this._sqlPool.request()
            for(let i=0; i<MatchConditions.length; i++) {
                if(i>0) { selectQuery += ' AND'; selectText += ' AND'}
                if(MatchConditions[i].value===undefined) {
                    selectQuery += ` ${MatchConditions[i].column} IS NULL`
                    selectText +=` ${MatchConditions[i].column} IS NULL`
                } else {
                    selectQuery += ` ${MatchConditions[i].column}=@KeyValue${alphabet[i]}`
                    selectText +=` ${MatchConditions[i].column}='${MatchConditions[i].value}'`
                }
             
                r.input(`KeyValue${alphabet[i]}`, MatchConditions[i].type, (MatchConditions[i].value || MatchConditions[i].value===0) ? MatchConditions[i].value : null)
                //this._le.AddLogEntry(LogEngine.Severity.Info, LogEngine.Action.Note, `${MatchConditions[i].column}='${MatchConditions[i].value}'`)
            }

            //console.debug(selectQuery)
            
            const sqp = new SqlQueryPackage(selectQuery, r)
            sqp.queryText = selectText

            output = sqp

        } catch(err) {
            this._le.AddLogEntry(LogEngine.Severity.Error, LogEngine.Action.Note, `${err}`)
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
                //this._le.AddLogEntry(LogEngine.Severity.Info, LogEngine.Action.Note, `${MatchConditions[i].column}='${MatchConditions[i].value}'`)
            }
            insertStatement += ')'; insertText += ')'

            const sqp = new SqlQueryPackage(insertStatement, r)
            sqp.queryText= insertText
            output = sqp

        } catch(err) {
            this._le.AddLogEntry(LogEngine.Severity.Error, LogEngine.Action.Note, `${err}`)
            throw(err)
        } finally {
            this._le.logStack.pop()
        }

        return output
    }





}