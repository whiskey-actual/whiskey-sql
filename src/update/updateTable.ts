import mssql from 'mssql'
import { LogEngine } from 'whiskey-log';
import { ExecuteSqlStatement } from './executeSqlStatement';
import { RowUpdate } from '../components/RowUpdate';


export async function UpdateTable(le:LogEngine, sqlPool:mssql.ConnectionPool, tableName:string, primaryKeyColumnName:string, rowUpdates:RowUpdate[]):Promise<void> {
    le.logStack.push(tableName);
    le.AddLogEntry(LogEngine.EntryType.Debug, `updating ${rowUpdates.length} rows on \x1b[96m${tableName}\x1b[0m`)
    try {

        for(let i=0; i<rowUpdates.length; i++) {

            let selectQuery = 'SELECT '

            // iterate through the column updates to build the select statement
            for(let j=0; j<rowUpdates[i].ColumnUpdates.length; j++) {
                selectQuery += rowUpdates[i].ColumnUpdates[j].ColumnName
                if(j<rowUpdates[i].ColumnUpdates.length-1) {selectQuery += ','}
                selectQuery += ' '
            }

            selectQuery += `FROM [${tableName}] WHERE ${primaryKeyColumnName}=@PrimaryKeyValue`

            //this.le.AddLogEntry(LogEngine.EntryType.Debug, LogEngine.EntryType.Note, selectQuery);

            const r = sqlPool.request()
            r.input('PrimaryKeyValue', mssql.Int, rowUpdates[i].primaryKeyValue)

            const result = await ExecuteSqlStatement(le, sqlPool, selectQuery, r)
            
            let columnUpdateStatements:string[] = []

            const updateRequest = sqlPool.request()
            updateRequest.input('PrimaryKeyValue', mssql.Int, rowUpdates[i].primaryKeyValue)
            
            // iterate over the column updates again to compare values, and build the update statement
            for(let j=0; j<rowUpdates[i].ColumnUpdates.length; j++) {

                const currentValue:any = result.recordset[0][rowUpdates[i].ColumnUpdates[j].ColumnName]
                const newValue:any = rowUpdates[i].ColumnUpdates[j].ColumnValue
                const changeDetection:boolean = rowUpdates[i].ColumnUpdates[j].changeDetection

                if((newValue && !currentValue) || (newValue && currentValue && newValue.toString().trim()!==currentValue.toString().trim()))
                {
                        // dont log timestamp changes, because they are expected on nearly every update.
                        if(changeDetection && rowUpdates[i].ColumnUpdates[j].ColumnType!==mssql.DateTime2) {
                            le.AddLogEntry(LogEngine.EntryType.Change, `\x1b[96m${tableName}\x1b[0m.\x1b[96m${rowUpdates[i].ColumnUpdates[j].ColumnName}\x1b[0m: "\x1b[96m${currentValue}\x1b[0m"->"\x1b[96m${newValue}\x1b[0m".. `, rowUpdates[i].updateName)
                        }
                        columnUpdateStatements.push(`${rowUpdates[i].ColumnUpdates[j].ColumnName}=@${rowUpdates[i].ColumnUpdates[j].ColumnName}`)
                        updateRequest.input(rowUpdates[i].ColumnUpdates[j].ColumnName, rowUpdates[i].ColumnUpdates[j].ColumnType, rowUpdates[i].ColumnUpdates[j].ColumnValue)
                }
            }

            // do we have updates to perform?
            if(columnUpdateStatements.length>0) {

                let updateStatement:string = `UPDATE [${tableName}] SET `

                for(let j=0; j<columnUpdateStatements.length; j++) {
                    updateStatement += columnUpdateStatements[j]
                    if(j<columnUpdateStatements.length-1) { updateStatement += ','}
                    updateStatement += ' '
                }

                updateStatement += `WHERE ${primaryKeyColumnName}=@PrimaryKeyValue`

                try {
                    await ExecuteSqlStatement(le, sqlPool, updateStatement, updateRequest)
                } catch(err) {
                    le.AddLogEntry(LogEngine.EntryType.Error, updateStatement);
                    le.AddLogEntry(LogEngine.EntryType.Error, `${err}`);
                    for(let i=0; i<rowUpdates.length; i++) {
                        for(let j=0; j<rowUpdates[i].ColumnUpdates.length; j++) {
                            console.debug(rowUpdates[i].ColumnUpdates[j])
                        }
                    }
                    throw(err)
                }
            }
        }
    } catch(err) {
        le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
        throw(err)
    } finally {
        //this.le.AddLogEntry(LogEngine.EntryType.Info, LogEngine.EntryType.Success, Utilities.getProgressMessage(updatePackage.tableName, 'persisted', updatePackage.UpdatePackageItems.length, updatePackage.UpdatePackageItems.length, startDate, new Date))
        le.logStack.pop()
    }

    return new Promise<void>((resolve) => {resolve()})

}