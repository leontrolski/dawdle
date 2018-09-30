import { FunctionAPI, DawdleModuleAPI } from "./shared"
import { Header, Value, types, NodeSingle } from "./parser"
import { Env, toJSONValue } from "./compiler"
import * as R from "ramda"

function wrapFunctionAPI(name, functionAPI: FunctionAPI){
    return {
        [name]: {
            type: 'let',
            value: [{type: 'var', value: name}, functionAPI]
        }
    }
}
function makeRowFilterFunction(name: string, f: (a: any, ...bs: any[])=>any){  // TODO: maybe improve the type of `f`
    return wrapFunctionAPI(
        name,
        {
            type: 'filter',
            name: name,
            args: [],  // TODO: make all these do something
            func: (rel, a: Header, ...bs: Value[])=>{
                const iToFilterOn = rel.headers.indexOf(a.value.slice(1))
                return {
                    headers: rel.headers,
                    rows: rel.rows.filter(row=>f(row[iToFilterOn], ...bs.map(b=>toJSONValue(b as NodeSingle))))
                }
            }
        }
    )
}
function sqlLikeToRegex(str: string): RegExp {
    const escaped = str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")
    const replaceSQL = escaped.replace(/%/g, '.+').replace(/_/g, '.')
    return new RegExp(`^${replaceSQL}$`)
}
export const env: Env = R.mergeAll([
    makeRowFilterFunction('eq', (a, b)=>a === b),
    makeRowFilterFunction('lt', (a, b)=>a < b),
    makeRowFilterFunction('gt', (a, b)=>a > b),
    makeRowFilterFunction('lte', (a, b)=>a <= b),
    makeRowFilterFunction('gte', (a, b)=>a >= b),
    makeRowFilterFunction('like', (a, b)=>sqlLikeToRegex(b).test(a)),
    makeRowFilterFunction('isnull', (a)=>R.isNil(a)),
    makeRowFilterFunction('isnotnull', (a)=>!R.isNil(a)),
])
