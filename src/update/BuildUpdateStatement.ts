import { LogEngine } from "whiskey-log"
import mssql from 'mssql'
import { RowUpdate } from "../components/RowUpdate"
import { ColumnUpdate } from "../components/ColumnUpdate"
import { SqlQueryPackage } from "../components/SqlQueryPackage"

export async function BuildUpdateStatement(le:LogEngine, sqlPool:mssql.ConnectionPool, tableName:string, primaryKeyColumnName:string, rowUpdate:RowUpdate, existingRow:mssql.IResult<any>):Promise<SqlQueryPackage|void> {

    let output:SqlQueryPackage|void

    try {

        let columnUpdateStatements:string[] = []

        const updateRequest = sqlPool.request()
        updateRequest.input('PrimaryKeyValue', mssql.Int, rowUpdate.primaryKeyValue)
        
        // iterate over the column updates again to compare values, and build the update statement
        for(let j=0; j<rowUpdate.ColumnUpdates.length; j++) {

            const cu:ColumnUpdate = rowUpdate.ColumnUpdates[j]

            const currentValue:any = existingRow.recordset[0][cu.ColumnName]
            const newValue:any = cu.ColumnValue
            const changeDetection:boolean = cu.changeDetection

            if((newValue && !currentValue) || (newValue && currentValue && newValue.toString().trim()!==currentValue.toString().trim()))
            {
                    // dont log timestamp changes, because they are expected on nearly every update.
                    if(changeDetection && cu.ColumnType!==mssql.DateTime2) {
                        //le.AddLogEntry(LogEngine.EntryType.Change, `\x1b[96m${tableName}\x1b[0m.\x1b[96m${cu.ColumnName}\x1b[0m: "\x1b[96m${currentValue}\x1b[0m"->"\x1b[96m${newValue}\x1b[0m".. `, rowUpdate.updateName)
                    }
                    columnUpdateStatements.push(`${cu.ColumnName}=@${cu.ColumnName}`)
                    updateRequest.input(cu.ColumnName, cu.ColumnType, cu.ColumnValue)
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

            updateStatement += `WHERE [${primaryKeyColumnName}]=@PrimaryKeyValue`

            output = new SqlQueryPackage(updateStatement, updateRequest)
        } else {
            le.AddLogEntry(LogEngine.EntryType.Debug, `no update needed`, rowUpdate.updateName)
        }

    } catch(err) {
        le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
        throw(err)
    } finally {
        le.logStack.pop()
    }
    
    return new Promise<SqlQueryPackage|void>((resolve) => {resolve(output)})

}