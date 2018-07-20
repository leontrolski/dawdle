import functools
import inspect
import sys


def get_default_args(f):
    signature = inspect.signature(f)
    return {
        k: v.default
        for k, v in signature.parameters.items()
        if v.default is not inspect.Parameter.empty
    }


def expander(ast):
    return ast


def kwargs_to_ast(kwargs):
    return kwargs


def tests_to_ast(tests):
    return tests


class Dawdle(object):
    def __init__(self, env):
        self.env = env
        self.registered_functions = set()

    def register(self, tests=()):
        def decorator(f):
            self.registered_functions.add(f)
            f.tests = tests
            f.kwargs = get_default_args(f)
            f.ast = f()

            @functools.wraps(f)
            def inner(**kwargs):
                outcome = f(**kwargs)
                outcome['kwarg_values'] = kwargs
                return outcome
            return inner
        return decorator

    def exec(self):
        if '--dawdle' in sys.argv:
            print('d.env', self.env)
            for f in self.registered_functions:
                print('f.ast', f.ast)
                print('f.kwargs', f.kwargs)
                print('f.tests', f.tests)

                lines, first_line_number = inspect.getsourcelines(f)
                offset = next(
                    i for i, line in enumerate(lines)
                    if line.strip().endswith('):'))
                lines = lines[offset + 1:]
                first_line_number = first_line_number + offset + 1

                print('lines: ', first_line_number, 'to: ', first_line_number + len(lines) - 1)


def run(ast):
    return ast


class Row(dict):
    def __repr__(self):
        return '<Row: {}>'.format(super(Row, self).__repr__())

    def __hash__(self):
        return hash(frozenset(self.items()))


class Relation(set):
    def __init__(self, l=None, headers=None):
        self._headers = None if headers is None else frozenset(headers)
        if l is not None:
            super(Relation, self).__init__(Row(n) for n in l)
        else:
            super(Relation, self).__init__()

    def __repr__(self):
        if not self.headers:
            return '<Relation (empty)>'
        return '<Relation headers={} length={}>'.format(self.headers, len(self))

    def __hash__(self):
        return hash(frozenset(hash(n) for n in self))

    @property
    def one(self):
        row = self.pop()
        self.add(row)
        return row

    @property
    def headers(self):
        if self._headers is None:
            self._headers = frozenset(self.one.keys())
        return self._headers

