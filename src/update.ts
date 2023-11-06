import mssql from 'mssql'
import { LogEngine } from 'whiskey-log';
import { executeQuery } from './execute';

export class Update {
    constructor(logEngine:LogEngine, sqlConfig:any, tableName:string, primaryKeyColumnName:string) {
        this.le = logEngine
        this.sqlPool = new mssql.ConnectionPool(sqlConfig)
        this.tableName=tableName
        this.primaryKeyColumnName=primaryKeyColumnName
    }
    private le:LogEngine
    private sqlPool:mssql.ConnectionPool
    public tableName:string = ''
    public primaryKeyColumnName:string = ''
    public RowUpdates:RowUpdate[] = []

    public async execute(changeDetection:boolean=false):Promise<void> {
        this.le.logStack.push(this.tableName);
        this.le.AddLogEntry(LogEngine.EntryType.Debug, `updating ${this.RowUpdates.length} rows on \x1b[96m${this.tableName}\x1b[0m`)
        try {

            for(let i=0; i<this.RowUpdates.length; i++) {

                let selectQuery = 'SELECT '

                // iterate through the column updates to build the select statement
                for(let j=0; j<this.RowUpdates[i].ColumnUpdates.length; j++) {
                    selectQuery += this.RowUpdates[i].ColumnUpdates[j].ColumnName
                    if(j<this.RowUpdates[i].ColumnUpdates.length-1) {selectQuery += ','}
                    selectQuery += ' '
                }

                selectQuery += `FROM ${this.tableName} WHERE ${this.primaryKeyColumnName}=@PrimaryKeyValue`

                //this.le.AddLogEntry(LogEngine.EntryType.Debug, LogEngine.EntryType.Note, selectQuery);

                const r = this.sqlPool.request()
                r.input('PrimaryKeyValue', mssql.Int, this.RowUpdates[i].primaryKeyValue)

                const result = await executeQuery(this.le, this.sqlPool, selectQuery, r)
                
                let columnUpdateStatements:string[] = []

                const updateRequest = this.sqlPool.request()
                updateRequest.input('PrimaryKeyValue', mssql.Int, this.RowUpdates[i].primaryKeyValue)
                
                // iterate over the column updates again to compare values, and build the update statement
                for(let j=0; j<this.RowUpdates[i].ColumnUpdates.length; j++) {

                    const currentValue:any = result.recordset[0][this.RowUpdates[i].ColumnUpdates[j].ColumnName]
                    const newValue:any = this.RowUpdates[i].ColumnUpdates[j].ColumnValue

                    if((newValue && !currentValue) || (newValue && currentValue && newValue.toString().trim()!==currentValue.toString().trim()))
                    {
                            // dont log timestamp changes, because they are expected on nearly every update.
                            if(this.RowUpdates[i].ColumnUpdates[j].ColumnType!==mssql.DateTime2) {
                                this.le.AddLogEntry(LogEngine.EntryType.Change, `\x1b[96m${this.tableName}\x1b[0m.\x1b[96m${this.RowUpdates[i].ColumnUpdates[j].ColumnName}\x1b[0m: "\x1b[96m${currentValue}\x1b[0m"->"\x1b[96m${newValue}\x1b[0m".. `, this.RowUpdates[i].updateName)
                            }
                            columnUpdateStatements.push(`${this.RowUpdates[i].ColumnUpdates[j].ColumnName}=@${this.RowUpdates[i].ColumnUpdates[j].ColumnName}`)
                            updateRequest.input(this.RowUpdates[i].ColumnUpdates[j].ColumnName, this.RowUpdates[i].ColumnUpdates[j].ColumnType, this.RowUpdates[i].ColumnUpdates[j].ColumnValue)
                    }
                }

                // do we have updates to perform?
                if(columnUpdateStatements.length>0) {

                    let updateStatement:string = `UPDATE ${this.tableName} SET `

                    for(let j=0; j<columnUpdateStatements.length; j++) {
                        updateStatement += columnUpdateStatements[j]
                        if(j<columnUpdateStatements.length-1) { updateStatement += ','}
                        updateStatement += ' '
                    }

                    updateStatement += `WHERE ${this.primaryKeyColumnName}=@PrimaryKeyValue`

                    try {
                        await executeQuery(this.le, this.sqlPool, updateStatement, updateRequest)
                    } catch(err) {
                        this.le.AddLogEntry(LogEngine.EntryType.Error, updateStatement);
                        this.le.AddLogEntry(LogEngine.EntryType.Error, `${err}`);
                        console.debug(this)
                        for(let i=0; i<this.RowUpdates.length; i++) {
                            for(let j=0; j<this.RowUpdates[i].ColumnUpdates.length; j++) {
                                console.debug(this.RowUpdates[i].ColumnUpdates[j])
                            }
                        }
                        throw(err)
                    }
                }
            }
        } catch(err) {
            this.le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
            throw(err)
        } finally {
            //this.le.AddLogEntry(LogEngine.EntryType.Info, LogEngine.EntryType.Success, Utilities.getProgressMessage(updatePackage.tableName, 'persisted', updatePackage.UpdatePackageItems.length, updatePackage.UpdatePackageItems.length, startDate, new Date))
            this.le.logStack.pop()
        }

        return new Promise<void>((resolve) => {resolve()})

    }
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


