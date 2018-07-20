# dsl: venv/python $THIS --dawdle
import datetime
import inspect
import types

from dawdle import Dawdle, run, Relation


vet = Relation(
    headers=['name', 'address'],
)
# test data
animal = Relation([
    {'animal': 'cat', 'age': 1},
    {'animal': 'dog', 'age': 3},
])


d = Dawdle(dict(
    vet=vet,
))


@d.register(tests=[dict(
    foo='whut',
    animal=animal,
)])
def tester_1(
    foo=str,
    animal=Relation,
):
    return {
        'query': [
            {'opener': '>'},
            {'function': 'like'},
            {'args': [
                {'var': 'foo', 'type': 'string'},
            ]},
        ]
    }


print(run(tester_1(foo='bar', animal=animal)))

d.exec()



