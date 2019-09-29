// {"dawdle": "header", "originalLanguage": "typescript"}
import { assert } from 'chai'

import * as stdlib from '../../src/stdlib'
import * as compiler from '../../src/compiler'

const customEnv = compiler.letsToEnv(stdlib.env,
// {"dawdle": "begin"}
{"section":[
{"let":[{"relation":"user:"},
{"section":[{"relation_literal":[
    {"rl_headers":[{"header":":user_id"},{"header":":name"}]},
    {"rl_row":[{"number":"1"},{"string":"\"Tom\""}]},
    {"rl_row":[{"number":"2"},{"string":"\"Alf\""}]},
    {"rl_row":[{"number":"3"},{"string":"\"Jon\""}]}]}]}]},
{"let":[{"relation":"basket:"},
{"section":[{"relation_literal":[
    {"rl_headers":[{"header":":basket_id"},{"header":":user_id"},{"header":":date"}]},
    {"rl_row":[{"string":"\"a\""},{"number":"1"},{"datetime":"~2018-01-20"}]},
    {"rl_row":[{"string":"\"b\""},{"number":"1"},{"datetime":"~2017-01-20"}]},
    {"rl_row":[{"string":"\"c\""},{"number":"3"},{"datetime":"~2019-01-20"}]},
    {"rl_row":[{"string":"\"d\""},{"number":"1"},{"datetime":"~2015-01-20"}]}]}]}]},
{"let":[{"relation":"purchase:"},
{"section":[{"relation_literal":[
    {"rl_headers":[{"header":":purchase_id"},{"header":":basket_id"},{"header":":product_id"},{"header":":qty"}]},
    {"rl_row":[{"string":"\"i\""},{"string":"\"a\""},{"string":"\"A\""},{"number":"4"}]},
    {"rl_row":[{"string":"\"ii\""},{"string":"\"a\""},{"string":"\"C\""},{"number":"2"}]},
    {"rl_row":[{"string":"\"iii\""},{"string":"\"b\""},{"string":"\"A\""},{"number":"3"}]},
    {"rl_row":[{"string":"\"iv\""},{"string":"\"c\""},{"string":"\"B\""},{"number":"2"}]},
    {"rl_row":[{"string":"\"v\""},{"string":"\"c\""},{"string":"\"B\""},{"number":"1"}]},
    {"rl_row":[{"string":"\"vi\""},{"string":"\"a\""},{"string":"\"B\""},{"number":"1"}]}]}]}]},
{"let":[{"relation":"product:"},
{"section":[{"relation_literal":[
    {"rl_headers":[{"header":":product_id"},{"header":":price"}]},
    {"rl_row":[{"string":"\"A\""},{"number":"4"}]},
    {"rl_row":[{"string":"\"B\""},{"number":"3"}]},
    {"rl_row":[{"string":"\"C\""},{"number":"9"}]},
    {"rl_row":[{"string":"\"D\""},{"number":"1"}]},
    {"rl_row":[{"string":"\"E\""},{"number":"2"}]}]}]}]},
{"let":[{"relation":"basket_discount__join:"},
{"section":[{"relation_literal":[
    {"rl_headers":[{"header":":join_basket_discount_id"},{"header":":basket_id"},{"header":":discount_id"}]},
    {"rl_row":[{"string":"\"l\""},{"string":"\"a\""},{"string":"\"x\""}]},
    {"rl_row":[{"string":"\"m\""},{"string":"\"b\""},{"string":"\"y\""}]},
    {"rl_row":[{"string":"\"n\""},{"string":"\"a\""},{"string":"\"y\""}]},
    {"rl_row":[{"string":"\"o\""},{"string":"\"c\""},{"string":"\"x\""}]}]}]}]},
{"let":[{"relation":"discount:"},
{"section":[{"relation_literal":[
    {"rl_headers":[{"header":":discount_id"},{"header":":multiplier"}]},
    {"rl_row":[{"string":"\"x\""},{"number":"0.8"}]},
    {"rl_row":[{"string":"\"y\""},{"number":"0.9"}]}]}]}]},
    {"line":[{"set":[]}]}]}
// {"dawdle": "end"}
)
export const defaultEnv = stdlib.env.merge(customEnv)

const whut =
// "Show user 1's latest basket,
//  with the basket totals, the totals of each product (pre-discount)
//  rank by date, and each basket by product_id"
// {"dawdle": "begin"}
{"section":[
{"let":[{"relation":"purchase__with_products:"},
{"section":[
    {"line":[{"relation":"purchase:"}]},
    {"line":[{"operator":"J"},{"relation":"product:"}]},
    {"line":[{"operator":"^"},{"header":":product_rank"},{"var":"rank"},{"header":":product_id"},{"named_value":[{"var":"partition_by"},{"header":":basket_id"}]}]},
    {"line":[{"operator":"^"},{"header":":product_total"},{"var":"multiply"},{"header":":qty"},{"header":":price"}]}]}]},
{"let":[{"relation":"basket__with_discount_price__most_recent_two:"},
{"section":[
    {"line":[{"relation":"basket:"}]},
    {"line":[{"operator":"J"},{"relation":"basket_discount__join:"}]},
    {"line":[{"operator":"J"},{"relation":"discount:"}]},
    {"line":[{"operator":"G"},{"all_headers":"basket:*"},
{"section":[{"aggregator":[{"header":":max_discount"},{"var":"min"},{"header":":multiplier"}]}]}]},
    {"line":[{"operator":"J"},{"relation":"purchase__with_products:"}]},
    {"line":[{"operator":"G"},{"all_headers":"basket:*"},{"header":":max_discount"},
{"section":[{"aggregator":[{"header":":basket_total"},{"var":"sum"},{"header":":product_total"}]}]}]},
    {"line":[{"operator":"^"},{"header":":after_discount"},{"var":"multiply"},{"header":":basket_total"},{"header":":max_discount"}]},
    {"line":[{"operator":"^"},{"header":":basket_rank"},{"var":"rank"},{"header":":date"},{"named_value":[{"var":"desc"},{"bool":"true"}]},{"named_value":[{"var":"partition_by"},{"header":":user_id"}]}]},
    {"line":[{"operator":">"},{"var":"lt"},{"header":":basket_rank"},{"number":"2"}]}]}]},
{"let":[{"relation":"specific_user:"},
{"section":[
    {"line":[{"relation":"user:"}]},
    {"line":[{"operator":">"},{"var":"eq"},{"header":":user_id"},{"number":"1"}]}]}]},
    {"line":[{"relation":"specific_user:"}]},
    {"line":[{"operator":"J"},{"relation":"basket__with_discount_price__most_recent_two:"}]},
    {"line":[{"operator":"J"},{"relation":"purchase__with_products:"}]}]}
// {"dawdle": "end"}
