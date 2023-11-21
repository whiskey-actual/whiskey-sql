// imports
import { LogEngine } from 'whiskey-log';

import { CreateTable } from './create/createTable';
import { performTableUpdates } from './update/performTableUpdates'
import { doesTableExist } from './read/doesTableExist';
import { GetID, GetSingleValue, SelectColumns } from './get';


import { ColumnValuePair } from './components/columnValuePair';
import { ColumnDefinition } from './create/columnDefinition';
import { RowUpdate } from './components/RowUpdate';

import mssql from 'mssql'
import { TableUpdate } from './components/TableUpdate';

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

    public async performTableUpdates(tableUpdates:TableUpdate):Promise<any> {
        return await performTableUpdates(this.le, this.sqlPool, tableUpdates)
    }

    public async createTable(tableName:string, columnDefinitions:ColumnDefinition[]):Promise<void> {
        const tableExists = await doesTableExist(this.le, this.sqlPool, tableName)
        if(!tableExists) {
            await CreateTable(this.le, this.sqlPool, tableName, columnDefinitions)
        } else {
            this.le.AddLogEntry(LogEngine.EntryType.Info, `table [${tableName}] exists, skipping ..`)
        }
        return new Promise<void>((resolve) => {resolve()})
    }

    public async getID(objectName:string, matchConditions:ColumnValuePair[], addIfMissing:boolean=true):Promise<number> {
        return await GetID(this.le, this.sqlPool, objectName, matchConditions, addIfMissing)
    }

    public async getSingleValue(table:string, idColumn:string, idValue:number, columnToSelect:string):Promise<any> {
        return await GetSingleValue(this.le, this.sqlPool, table, idColumn, idValue, columnToSelect)
    }

}

export namespace DBEngine {
    ColumnDefinition
}