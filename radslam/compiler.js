const parser = require('./parser')

const R = require('ramda')

const getType = o=>Object.keys(o)[0]

const compiler = (env, ast)=>{
    const topLevel = ast.section
    const processBlock = (block, parentScope)=>{

    }
    const letsAndDefs = topLevel.filter(
        o=>[parser.types.let, parser.types.def].includes(getType(o)))
    return letsAndDefs
}

module.exports = {compiler}