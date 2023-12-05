import mssql from 'mssql'
import { LogEngine } from 'whiskey-log';
import { ExecuteSqlStatement } from './ExecuteSqlStatement';
import { TableUpdate } from '../components/TableUpdate';
import { executePromisesWithProgress } from 'whiskey-util';
import { BuildSelectStatement } from './BuildSelectStatement';
import { BuildUpdateStatement } from './BuildUpdateStatement';


export async function performTableUpdates(le:LogEngine, sqlPool:mssql.ConnectionPool, tableUpdate:TableUpdate):Promise<void> {
    le.logStack.push("performTableUpdates");
    
    try {
        
        le.AddLogEntry(LogEngine.EntryType.Info, `.. updating ${tableUpdate.RowUpdates.length} rows on \x1b[96m${tableUpdate.tableName}\x1b[0m`)

        let updates:Promise<mssql.IResult<any>>[] = []

        for(let i=0; i<tableUpdate.RowUpdates.length; i++) {            

            const ru = tableUpdate.RowUpdates[i]

            // select the existing row
            const sqlSelectQueryPackage = await BuildSelectStatement(le, sqlPool, tableUpdate.tableName, tableUpdate.primaryKeyColumnName, tableUpdate.RowUpdates[i])
            const existingRow = await ExecuteSqlStatement(le, sqlPool, sqlSelectQueryPackage)
            le.AddLogEntry(LogEngine.EntryType.Info, `.. got existing row ..`)

    
            const sqlUpdateQueryPackage = await BuildUpdateStatement(le, sqlPool, tableUpdate.tableName, tableUpdate.primaryKeyColumnName, ru, existingRow)
            le.AddLogEntry(LogEngine.EntryType.Info, `.. built update ..`)

            try {
                updates.push(ExecuteSqlStatement(le, sqlPool, sqlUpdateQueryPackage))
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

        await executePromisesWithProgress(le, updates)

    } catch(err) {
        le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
        throw(err)
    } finally {
        //this.le.AddLogEntry(LogEngine.EntryType.Info, LogEngine.EntryType.Success, Utilities.getProgressMessage(updatePackage.tableName, 'persisted', updatePackage.UpdatePackageItems.length, updatePackage.UpdatePackageItems.length, startDate, new Date))
        le.logStack.pop()
    }

    return new Promise<void>((resolve) => {resolve()})

}