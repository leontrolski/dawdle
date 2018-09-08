import {foo, bar} from './server'
import * as m from 'mithril'

let View = ()=>m('h1', ['yoho', foo, bar(6)])

m.mount(document.body, {view: View})
