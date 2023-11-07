import mssql from 'mssql'

export class ColumnDefinition {
    constructor(columnName:string, columnType:string, isNullable:boolean=true, isIndexed:boolean=false, columnLength:number=0, defaultValue:string|number|boolean|undefined=undefined) {
        this.columnName=columnName
        this.columnType=columnType
        this.columnLength=columnLength
        this.isNullable=isNullable
        this.isIndexed=isIndexed
        this.defaultValue=defaultValue
    }
    public columnName:string=''
    public columnType:string=''
    public columnLength:number=0
    public isNullable:boolean=false
    public isIndexed:boolean=false
    public defaultValue:string|number|boolean|undefined=undefined
}