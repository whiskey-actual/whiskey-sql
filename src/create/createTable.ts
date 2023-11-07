import mssql, { rows } from 'mssql'
import { LogEngine } from 'whiskey-log';
import { ColumnDefinition } from './columnDefinition';
import { ExecuteSqlStatement } from '../update/executeSqlStatement';
import { doesIndexExist } from '../read/doesIndexExist';
import { doesTableExist } from '../read/doesTableExist';
import { createColumnStatement } from './createColumnStatement';

export async function CreateTable(le:LogEngine, sqlPool:mssql.ConnectionPool, tableName:string, columnDefinitions:ColumnDefinition[]):Promise<void> {

    le.logStack.push("CreateTable");
    le.AddLogEntry(LogEngine.EntryType.Info, `CREATE TABLE ${tableName}`)

    try {

        if (!await doesTableExist(le, sqlPool, tableName)) {

            let indexesToCreate:string[] = []
            const t = new mssql.Table(tableName);
            t.create = true;

            let seedRowValues:(string|number|boolean|Date|Buffer|null|undefined)[] = []


            let creationQuery:string = ""

            creationQuery += `CREATE TABLE [dbo].[${tableName}] (`
            
            // add identity column
            creationQuery += createColumnStatement(tableName, "ID", "INT", 0, false, undefined, true)
            seedRowValues.push(0)

            // add description column
            creationQuery += createColumnStatement(tableName, "Description", "VARCHAR", 255, true)
            seedRowValues.push("unknown")

            for(let i=0; i<columnDefinitions.length; i++) {

                const currentColumn = columnDefinitions[i]

                creationQuery += createColumnStatement(tableName, currentColumn.columnName, currentColumn.columnType, currentColumn.columnLength, currentColumn.isNullable, currentColumn.defaultValue)

                if(columnDefinitions[i].isIndexed) {

                    const indexName:string = `IDX_${tableName}_${columnDefinitions[i].columnName}`
                    const indexExists:boolean = await doesIndexExist(le, sqlPool, indexName, tableName)
                    if(!indexExists) {
                        indexesToCreate.push(`CREATE INDEX ${indexName} ON [${tableName}](${tableName}${columnDefinitions[i].columnName});`)
                    }
                }
                seedRowValues.push(columnDefinitions[i].defaultValue)
            }
            creationQuery += `);`

            const r = sqlPool.request()
            try {
                await ExecuteSqlStatement(le, sqlPool, creationQuery, r)
            } catch(err) {
                le.AddLogEntry(LogEngine.EntryType.Error, `error creating table ${tableName}: ${err}`)
                console.debug(creationQuery);
            }

            for(let i=0; i<indexesToCreate.length; i++) {
                let req = sqlPool.request()
                le.AddLogEntry(LogEngine.EntryType.Info, `${indexesToCreate[i]}`)
                await ExecuteSqlStatement(le, sqlPool, indexesToCreate[i], req)
            }
        } else {
            le.AddLogEntry(LogEngine.EntryType.Info, `table ${tableName} exists, skipping ..`)
        }
        
    } catch(err) {
        le.AddLogEntry(LogEngine.EntryType.Error, `${err}`)
        throw(err)
    } finally {
        le.logStack.pop()
    }
    return new Promise<void>((resolve) => {resolve()})
}