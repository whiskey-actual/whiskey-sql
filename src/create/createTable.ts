import mssql from 'mssql'
import { LogEngine } from 'whiskey-log';
import { ColumnDefinition } from '../components/columnDefinition';
import { ExecuteSqlStatement } from '../update/executeSqlStatement';
import { doesIndexExist } from '../read/doesIndexExist';
import { doesTableExist } from '../read/doesTableExist';

export async function CreateTable(le:LogEngine, sqlPool:mssql.ConnectionPool, tableName:string, columnDefinitions:ColumnDefinition[]):Promise<void> {

    le.logStack.push("CreateTable");

    
    

    try {

        if (!await doesTableExist(le, sqlPool, tableName)) {

            le.AddLogEntry(LogEngine.EntryType.Debug, `creating: ${tableName}`)
            let indexesToCreate:string[] = []
            const t = new mssql.Table(tableName);
            t.create = true;

            t.columns.add(`${tableName}ID`, mssql.Int, {nullable:false, primary: true, identity: true})
            t.columns.add(`${tableName}Description`, mssql.VarChar(255), {nullable:true})
            for(let i=0; i<columnDefinitions.length; i++) {
                t.columns.add(`${tableName}${columnDefinitions[i].columnName}`, columnDefinitions[i].columnType, {nullable:columnDefinitions[i].isNullable})

                if(columnDefinitions[i].isIndexed) {

                    const indexName:string = `IDX_${tableName}_${columnDefinitions[i].columnName}`

                    const indexExists:boolean = await doesIndexExist(le, sqlPool, indexName, tableName)
                    
                    if(!indexExists) {
                        indexesToCreate.push(`CREATE INDEX ${indexName} ON ${tableName}(${tableName}${columnDefinitions[i].columnName});`)
                    }

                }
            }
            t.rows.add(0, "default entry")

            const r = sqlPool.request()

            le.AddLogEntry(LogEngine.EntryType.Info, `CREATE TABLE ${tableName}`)

            try {
                await r.bulk(t)
            } catch(err) {
                le.AddLogEntry(LogEngine.EntryType.Error, `error in bulk(): ${err}`)
                
            }
            

            for(let i=0; i<indexesToCreate.length; i++) {
                let req = sqlPool.request()
                le.AddLogEntry(LogEngine.EntryType.Info, `CREATE INDEX ${indexesToCreate[i]}`)
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