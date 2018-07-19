import functools
import inspect


def get_default_args(f):
    signature = inspect.signature(f)
    return {
        k: v.default
        for k, v in signature.parameters.items()
        if v.default is not inspect.Parameter.empty
    }


def expander(ast):
    return ast


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
                return f(**kwargs)
            return inner
        return decorator


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

