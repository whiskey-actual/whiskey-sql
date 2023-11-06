import mssql from 'mssql'
import { LogEngine } from 'whiskey-log';
import { ColumnDefinition } from './components/columnDefinition';

export async function CreateTable(tableName:string, columnDefinitions:ColumnDefinition[]):Promise<void> {

    var t = new mssql.Table(tableName);
    t.create = true;

    t.columns.add(`${tableName}ID`, mssql.Int, {nullable:false, primary: true, identity: true})
    for(let i=0; i<columnDefinitions.length; i++) {
        t.columns.add(columnDefinitions[i].columnName, columnDefinitions[i].columnType, {nullable:columnDefinitions[i].isNullable})
    }    

    new mssql.Request().bulk(t, function(err:Error, results:mssql.IBulkResult) {
        if(err) {
            Promise.reject(err.message)
        } else {
            Promise.resolve(true)
        }
    })

}