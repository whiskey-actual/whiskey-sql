import mssql, { rows } from 'mssql'
import { LogEngine } from 'whiskey-log';
import { ColumnDefinition } from './columnDefinition';
import { ExecuteSqlStatement } from '../update/executeSqlStatement';
import { doesIndexExist } from '../read/doesIndexExist';
import { doesTableExist } from '../read/doesTableExist';

export async function CreateTable(le:LogEngine, sqlPool:mssql.ConnectionPool, tableName:string, columnDefinitions:ColumnDefinition[]):Promise<void> {

    le.logStack.push("CreateTable");
    le.AddLogEntry(LogEngine.EntryType.Info, `CREATE TABLE ${tableName}`)

    try {

        if (!await doesTableExist(le, sqlPool, tableName)) {

            let indexesToCreate:string[] = []
            const t = new mssql.Table(tableName);
            t.create = true;

            let seedRowValues:(string|number|boolean|Date|Buffer|null|undefined)[] = []

            let creationQuery:string = `CREATE TABLE [dbo].[${tableName}] (\n`

            creationQuery += `\t[${tableName}ID]\t\tINT\t\tNOT NULL\t\tIDENTITY(1,1),\n`
            //t.columns.add(`${tableName}ID`, mssql.Int, {nullable:false, identity: true, primary: true})
            //seedRowValues.push(0)

            creationQuery += `\t[${tableName}Description]\t\tVARCHAR(255)\t\tNULL,\n`
            //t.columns.add(`${tableName}Description`, mssql.VarChar(255), {nullable:true})
            //seedRowValues.push("unknown")

            for(let i=0; i<columnDefinitions.length; i++) {

                const typeObject:any = Object(columnDefinitions[i].columnType)

                let columnType:string = "INT"

                switch(typeObject) {
                    case "sql.Int":
                        columnType="INT"
                        break;
                    case "sql.Bit":
                        columnType="BIT"
                        break;
                    default:
                        switch(typeObject.type) {
                            case "sql.VarChar":
                                columnType=`VARCHAR(${columnDefinitions[i].columnType.length})`
                                break;
                            case "sql.DateTime2":
                                columnType="DATETIME2"
                                break;
                            default:
                                console.debug(typeObject)
                                throw 'column type not supported'
                                break;
                        }
                        break;
                }

                

                creationQuery += `\t[${tableName}${columnDefinitions[i].columnName}]`
                creationQuery += `\t${columnType}`
                creationQuery += `\t${columnDefinitions[i].isNullable ? 'NULL' : 'NOT NULL'},\n`

                //t.columns.add(`${tableName}${columnDefinitions[i].columnName}`, columnDefinitions[i].columnType, {nullable:columnDefinitions[i].isNullable})

                if(columnDefinitions[i].isIndexed) {

                    const indexName:string = `IDX_${tableName}_${columnDefinitions[i].columnName}`

                    const indexExists:boolean = await doesIndexExist(le, sqlPool, indexName, tableName)
                    
                    if(!indexExists) {
                        indexesToCreate.push(`CREATE INDEX ${indexName} ON [${tableName}](${tableName}${columnDefinitions[i].columnName});`)
                    }
                }

                seedRowValues.push(columnDefinitions[i].seedValue)
                
            }

            creationQuery += `  CONSTRAINT [PK_${tableName}] PRIMARY KEY CLUSTERED ([${tableName}ID ASC])`
            creationQuery += `);
            `
            //t.rows.add.apply(seedRowValues)

            const r = sqlPool.request()
            try {
                await ExecuteSqlStatement(le, sqlPool, creationQuery, r)
            } catch(err) {
                le.AddLogEntry(LogEngine.EntryType.Error, `error in bulk(): ${err}`)
                
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
