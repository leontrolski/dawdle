import { isEmpty, intersperse, isNil } from 'ramda'
import * as m from 'mithril'

import { Node, Value, is } from './parser'
import { DerivedState, Block, RelationAPI, Setters, nodesPerLine, isSpacer } from './shared'

// constants that map to css
export const SVG_OFFSET = 1000
export const INFO_ORIGINAL_GAP = 50

const ConnectingLine = (isFocused: boolean)=>{
    const markerId = `marker-${(Math.random() * 10E18).toString()}`  // hack to name markers so they change colour correctly
    return m('svg.connecting-line', {width: INFO_ORIGINAL_GAP, height: 2 * SVG_OFFSET},
        isFocused?
            m('marker', {id: markerId, refX: 5, refY: 5, markerWidth: 8, markerHeight: 8},
                m('circle[cx=5][cy=5][r=3]', {style: {stroke: 'none', fill: 'black'}}))
            : null,
        m('line', {
            x1: 0,
            y1: SVG_OFFSET,
            x2: INFO_ORIGINAL_GAP,
            y2: SVG_OFFSET,
            'marker-end': isFocused? `url(#${markerId})` : '',
            style: {stroke: isFocused? 'black' : 'gray'}
        }))
}

const HeaderEl = (headerValue: string)=>m('.button.button-outline.header.pre', headerValue)
// TODO: convert these to {type: value:} and make a component for each type
const Null = ()=>m('em.null', 'null')
const Cell = (cellValue)=>m('td.cell', isNil(cellValue)? Null() : cellValue.type? cellValue.value : cellValue)
const Table = (o: RelationAPI, isFocused: boolean)=>m('table.table',
    {class: isFocused? 'table-focused' : ''},
    m('thead',
        isEmpty(o.headers)? m('th.cell.cell-header', m('em', 'no headers')) : o.headers.map(header=>m('th.cell.cell-header', HeaderEl(header)))),
    m('tbody', o.rows.map(row=>m('tr', row.map(Cell))))
)
const CompiledValue = (o: Node, isFocused: boolean)=>{
    if(o.compiledType === 'headers') return o.compiledValue.map(header=>HeaderEl(header.value))
    if(o.compiledType === 'set') return [
        '[', intersperse(', ', o.compiledValue.map((v: Value)=>is.header(v)? HeaderEl(v.value) : v.value)), ']']
    if(o.compiledType === 'relation') return Table(o.compiledValue as RelationAPI, isFocused)
    return null
}
const Errors = (block: Block)=>m(
    '.source',
    block.errors.map(error=>m('.pre.error', error.message))
)
const Info = (setters: Setters, s: DerivedState, block: Block)=>
    block.astWithHeaders === null? null : m(
        '.source',
        {id: block.infoId, 'to-editor-id': block.editorId},
        m('.test-case-options', Object.keys(block.testCases).map(testCaseName=>m(
            'button.button.button-small',
            {class: testCaseName === block.selectedTestCaseName? '' : 'button-outline'},
            testCaseName
        ))),
        nodesPerLine(block.astWithHeaders)
            .filter(o=>o.compiledType)
            .map((o, i)=>{
                if(isSpacer(o)) return m('.spacer')
                const isFocused =  s.ui.mouseovered.blockI === block.blockI && s.ui.mouseovered.lineI === i
                return m(
                    '.compiled-line',
                    {'to-line': o.lineI, onmouseover: ()=>setters.mouseovered(block.blockI, i)},
                    CompiledValue(o, isFocused),
                    ConnectingLine(isFocused)
                )
            }),
    )
const Original = (block: Block)=>m(
    '.source.right',
    {class: `language-${block.language}`},
    m('', {id: block.editorId, language: block.language}, block.source),
)
const SaveButton = (setters: Setters, s: DerivedState)=>m(
    '.button.button-editor.button-save',
    {
        onclick: s.areAnyErrors? (): null=>null : ()=>setters.saveStateToFile(),
        class: s.areAnyErrors? 'button-cant-save' : '',
        title: s.areAnyErrors? "Can't save as there are errors" : '',
    },
    'save'
)
export const View = (setters: Setters, s: DerivedState)=>m('.root',
    m('.options', ''),
    s.blocks.map((block)=>
        m('.block',
            isEmpty(block.errors)? Info(setters, s, block) : Errors(block),
            Original(block))),
    m('.editor-buttons',
        SaveButton(setters, s),
        m('.button.button-editor.button-reload', {
            onclick: ()=>setters.fromServerState(),
        }, 'reload from file'),
        m('.button.button-editor', 'show default env')),
    s.ui.HTTPError?
        m('.http-error.pre', s.ui.HTTPError,
            m('.editor-buttons', m('.button', {
                onclick: ()=>setters.httpError(null),
            }, 'dismiss'))):
        null,
)
