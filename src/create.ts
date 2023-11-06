import mssql from 'mssql'

export namespace Creator {

    export class TableDefinition {
            constructor(tableName:string) {
                this.tableName=tableName
            }
            public tableName:string = ''
            public ColumnDefinitions:ColumnDefinition[] = []

            public async make():Promise<void> {

                var t = new mssql.Table(this.tableName);
                t.create = true;

                t.columns.add(`${this.tableName}ID`, mssql.Int, {nullable:false, primary: true, identity: true})
                for(let i=0; i<this.ColumnDefinitions.length; i++) {
                    t.columns.add(this.ColumnDefinitions[i].columnName, this.ColumnDefinitions[i].columnType, {nullable:this.ColumnDefinitions[i].isNullable})
                }    

                new mssql.Request().bulk(t, function(err:Error, results:mssql.IBulkResult) {
                    if(err) {
                        Promise.reject(err.message)
                    } else {
                        Promise.resolve(true)
                    }
                })

            }
    }

    export class ColumnDefinition {
        constructor(columnName:string, columnType:mssql.ISqlTypeFactoryWithNoParams, isNullable:boolean=true) {
            this.columnName=columnName
            this.columnType=columnType
            this.isNullable=isNullable
        }
        public columnName:string=''
        public columnType:mssql.ISqlTypeFactoryWithNoParams=mssql.Int
        public isNullable:boolean=false
    }

}