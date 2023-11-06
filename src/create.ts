import mssql from 'mssql'
import { LogEngine } from 'whiskey-log';
import { ColumnDefinition } from './components/columnDefinition';
import { SqlStatement } from './execute';

export async function CreateTable(le:LogEngine, sqlPool:mssql.ConnectionPool, tableName:string, columnDefinitions:ColumnDefinition[]):Promise<void> {

    try {
        let indexesToCreate:string[] = []
        const t = new mssql.Table(tableName);
        t.create = true;

        t.columns.add(`${tableName}ID`, mssql.Int, {nullable:false, primary: true, identity: true})
        t.columns.add(`${tableName}Description`, mssql.VarChar(255), {nullable:true})
        for(let i=0; i<columnDefinitions.length; i++) {
            t.columns.add(columnDefinitions[i].columnName, columnDefinitions[i].columnType, {nullable:columnDefinitions[i].isNullable})

            if(columnDefinitions[i].isIndexed) {
                indexesToCreate.push(`CREATE INDEX IDX_${tableName}_${columnDefinitions[i].columnName} ON ${tableName}(${columnDefinitions[i].columnName});`)
            }
        }    
                
        await new mssql.Request().bulk(t)

        for(let i=0; i<indexesToCreate.length; i++) {
            const r = sqlPool.request()
            await SqlStatement(le, sqlPool, indexesToCreate[i], r)
        }

        
    } catch(err) {
        console.debug(err)
        throw(err)
    }

}