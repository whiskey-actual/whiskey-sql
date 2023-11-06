// imports
import { LogEngine } from 'whiskey-log';

import { CreateTable } from './create';
import { UpdateTable, RowUpdate, ColumnUpdate } from './update'
import { SelectColumns } from './get';

import { ColumnValuePair } from './components/columnValuePair';
import { ColumnDefinition } from './components/columnDefinition';
import { GetID } from './get';

import mssql from 'mssql'

export class DBEngine {

    constructor(logEngine:LogEngine, sqlConfig:any) {
        this.le = logEngine;
        this.sqlPool = new mssql.ConnectionPool(sqlConfig)
        this.le.AddLogEntry(LogEngine.EntryType.Success, `DBEngine initialized ( don't forget to call connect()! )`)
        
    }
    private le:LogEngine
    private sqlPool:mssql.ConnectionPool

    public async connect() {
        this.le.AddLogEntry(LogEngine.EntryType.Info, `connecting to mssql ..`)
        await this.sqlPool.connect()
        this.le.AddLogEntry(LogEngine.EntryType.Success, `.. connected.`)
    }

    public async disconnect() {
        this.le.AddLogEntry(LogEngine.EntryType.Info, `disconnecting from mssql ..`)
        await this.sqlPool.close()
        this.le.AddLogEntry(LogEngine.EntryType.Success, `.. disconnected.`)
    }

    public async selectColumns(objectName:string, columns:string[], matchConditions:ColumnValuePair[]):Promise<mssql.IRecordSet<any>>{
        return await SelectColumns(this.le, this.sqlPool, objectName, columns, matchConditions)
    }

    public async updateTable(tableName:string, primaryKeyColumnName:string, rowUpdates:RowUpdate[], changeDetection=true):Promise<any> {
        return await UpdateTable(this.le, this.sqlPool, tableName, primaryKeyColumnName, rowUpdates, changeDetection)
    }

    public async createTable(tableName:string, columnDefinitions:ColumnDefinition[]):Promise<any> {
        return await CreateTable(tableName, columnDefinitions)
    }

}


export namespace DBEngine {
    exports = {
        ColumnValuePair,
        ColumnDefinition,
        RowUpdate,
        ColumnUpdate,
        GetID
    }
}