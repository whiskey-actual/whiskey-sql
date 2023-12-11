import mssql from 'mssql'
import { LogEngine } from 'whiskey-log';
import { ExecuteSqlStatement } from './ExecuteSqlStatement';
import { TableUpdate } from '../components/TableUpdate';
import { executePromisesWithProgress } from 'whiskey-util';
import { BuildSelectStatement } from '../read/BuildSelectStatement';
import { BuildUpdateStatement } from './BuildUpdateStatement';
import { SqlQueryPackage } from '../components/SqlQueryPackage';
import { getProgressMessage } from 'whiskey-util';


export async function performTableUpdates(le:LogEngine, sqlPool:mssql.ConnectionPool, tableUpdate:TableUpdate, logFrequency:number=1000):Promise<void> {
    le.logStack.push("performTableUpdates");
    
    try {
        
        let updates:SqlQueryPackage[] = []

        // determine what needs updating ..
        le.AddLogEntry(LogEngine.EntryType.Info, `.. finding updates for ${tableUpdate.RowUpdates.length} rows`, tableUpdate.tableName)
        const timeStartBuildUpdates:Date = new Date()
        for(let i=0; i<tableUpdate.RowUpdates.length; i++) {            

            const ru = tableUpdate.RowUpdates[i]

            // select the existing row
            const sqlSelectQueryPackage = BuildSelectStatement(le, sqlPool, tableUpdate.tableName, tableUpdate.primaryKeyColumnName, tableUpdate.RowUpdates[i])
            const existingRow = await ExecuteSqlStatement(le, sqlPool, sqlSelectQueryPackage)

            // build the update
            const sqlUpdateQueryPackage = await BuildUpdateStatement(le, sqlPool, tableUpdate.tableName, tableUpdate.primaryKeyColumnName, ru, existingRow)

            if(sqlUpdateQueryPackage) {
                try {
                    updates.push(sqlUpdateQueryPackage)
                } catch(err) {
                    le.AddLogEntry(LogEngine.EntryType.Error, sqlUpdateQueryPackage.query);
                    le.AddLogEntry(LogEngine.EntryType.Error, `${err}`);
                    for(let i=0; i<tableUpdate.RowUpdates.length; i++) {
                        for(let j=0; j<tableUpdate.RowUpdates[i].ColumnUpdates.length; j++) {
                            console.debug(tableUpdate.RowUpdates[i].ColumnUpdates[j])
                        }
                    }
                    throw(err)
                }
            }

            if(i>0 && (i%logFrequency===0)) {le.AddLogEntry(LogEngine.EntryType.Info, getProgressMessage('', 'built', i, tableUpdate.RowUpdates.length, timeStartBuildUpdates, new Date()), tableUpdate.tableName);}
        }
        le.AddLogEntry(LogEngine.EntryType.Success, getProgressMessage('', 'built', tableUpdate.RowUpdates.length, tableUpdate.RowUpdates.length, timeStartBuildUpdates, new Date()), tableUpdate.tableName);

        // perform the updates
        le.AddLogEntry(LogEngine.EntryType.Info, `${updates.length} updates needed`, tableUpdate.tableName)
        const timeStartPerformUpdates:Date = new Date()
        for(let i=0; i<updates.length; i++) {
            await ExecuteSqlStatement(le, sqlPool, updates[i])
            if(i>0 && (i%logFrequency===0)) {le.AddLogEntry(LogEngine.EntryType.Info, getProgressMessage('', 'performed', i, updates.length, timeStartPerformUpdates, new Date()), tableUpdate.tableName);}
        }
        le.AddLogEntry(LogEngine.EntryType.Success, getProgressMessage('', 'performed', updates.length, updates.length, timeStartPerformUpdates, new Date()), tableUpdate.tableName);
        //await executePromisesWithProgress(le, updates)

    } catch(err) {
        le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
        throw(err)
    } finally {
        //this.le.AddLogEntry(LogEngine.EntryType.Info, LogEngine.EntryType.Success, Utilities.getProgressMessage(updatePackage.tableName, 'persisted', updatePackage.UpdatePackageItems.length, updatePackage.UpdatePackageItems.length, startDate, new Date))
        le.logStack.pop()
    }

    return new Promise<void>((resolve) => {resolve()})

}