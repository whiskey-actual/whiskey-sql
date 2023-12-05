import mssql from 'mssql'
import { RowUpdate } from "../components/RowUpdate"
import { LogEngine } from 'whiskey-log';
import { SqlQueryPackage } from '../components/SqlQueryPackage';

export async function BuildSelectStatement(le:LogEngine, sqlPool:mssql.ConnectionPool, tableName:string, primaryKeyColumnName:string, rowUpdate:RowUpdate):Promise<SqlQueryPackage> {
    le.logStack.push("BuildSelectStatement");
    let output:SqlQueryPackage
    try {    
        const r = sqlPool.request()
        r.input('PrimaryKeyValue', mssql.Int, rowUpdate.primaryKeyValue)

        // iterate through the column updates to build the select statement
        let selectQuery = 'SELECT '
        for(let j=0; j<rowUpdate.ColumnUpdates.length; j++) {
            selectQuery += rowUpdate.ColumnUpdates[j].ColumnName
            if(j<rowUpdate.ColumnUpdates.length-1) {selectQuery += ','}
            selectQuery += ' '
        }
        selectQuery += `FROM [${tableName}](NOLOCK) WHERE [${primaryKeyColumnName}]=@PrimaryKeyValue`
        output = new SqlQueryPackage(selectQuery, r, selectQuery)
    } catch(err) {
        le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
        throw(err)
    } finally {
        le.logStack.pop()
    }
    
    return new Promise<SqlQueryPackage>((resolve) => {resolve(output)})

}