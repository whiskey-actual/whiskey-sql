// imports
import { LogEngine } from 'whiskey-log';

import { CreateTable } from './create';
import { Update } from './update'

import mssql from 'mssql'

export class DBEngine {

    constructor(logEngine:LogEngine, sqlConfig:any) {
        this._le = logEngine;
        this._sqlPool = new mssql.ConnectionPool(sqlConfig)
        this._le.AddLogEntry(LogEngine.EntryType.Success, `DBEngine initialized ( don't forget to call connect()! )`)
        
    }
    private _le:LogEngine
    private _sqlPool:mssql.ConnectionPool

    public async connect() {
        this._le.AddLogEntry(LogEngine.EntryType.Info, `connecting to mssql ..`)
        await this._sqlPool.connect()
        this._le.AddLogEntry(LogEngine.EntryType.Success, `.. connected.`)
    }

    public async disconnect() {
        this._le.AddLogEntry(LogEngine.EntryType.Info, `disconnecting from mssql ..`)
        await this._sqlPool.close()
        this._le.AddLogEntry(LogEngine.EntryType.Success, `.. disconnected.`)
    }

}

module.exports = {
    CreateTable,
    Update
}