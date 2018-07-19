# dsl: venv/python $THIS --dawdle
import datetime
import inspect
import types

from dawdle import Dawdle, run, Relation


vet = Relation(headers=[
    'name', 'address',
])
# test data
animal = Relation([
    {'animal': 'cat', 'age': 1},
    {'animal': 'dog', 'age': 3},
])


d = Dawdle(dict(
    vet=vet,
))


@d.register(
    foo='whut',
    animal=animal,
)
def tester(
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


# print(run(tester(foo='bar')))


if __name__ == '__main__':
    import sys
    if sys.argv == [__file__, '--dawdle']:
        print('d.env', d.env)
        for f in d.registered_functions:
            print('f.ast', f.ast)
            print('f.env', f.env)

            lines, first_line_number = inspect.getsourcelines(f)
            offset = next(
                i for i, line in enumerate(lines)
                if line.strip().endswith('):'))
            lines = lines[offset + 1:]
            first_line_number = first_line_number + offset + 1

            print('lines: ', first_line_number, 'to: ', first_line_number + len(lines) - 1)




