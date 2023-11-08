export function createColumnStatement(tableName:string, columnName:string, columnType:string, columnLength:number, isNullable:boolean=true, defaultValue:string|number|boolean|undefined=undefined, isIdentity:boolean=false) {

    let columnStatement:string=""

    columnStatement = "\t"
    columnStatement += `${tableName}${columnName}`
    columnStatement += `\t\t`
    columnStatement += `${columnType}`

    if (columnType==="VARCHAR" && (!columnLength || columnLength===0)) {
        columnLength=255
    }

    if(columnLength>0) {
        columnStatement += `(${columnLength})`
    }

    columnStatement += `\t\t`

    if(!isNullable) {columnStatement += `NOT `}

    columnStatement += `NULL`

    if(isIdentity) {
        columnStatement += `\t\tIDENTITY(1,1)`
    }

    if(defaultValue!==undefined) {
        columnStatement += `\t\tDEFAULT((${defaultValue}))`
    }

    columnStatement += ",\n"

    return columnStatement

}