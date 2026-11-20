"""Load `haem_rules.yaml` and evaluate its rule conditions safely.

Rule conditions are small Python-syntax expressions kept in the data file so a clinician can read and amend them
(`mch_pg < 27 or mcv_fl < 80`). They are NEVER passed to `eval`: each is parsed with `ast` and walked by a tiny
interpreter that allows only boolean operators, `not`, comparisons, names that are declared inputs, and constants. The
loader rejects a rule that uses anything else.

Unknown never satisfies a threshold: an ordered comparison (`<`, `<=`, `>`, `>=`) with a missing (`None`) operand is
False. The validity rules at the head of the table turn missing inputs into an 'incomplete' label before any threshold
rule can matter.
"""

from __future__ import annotations

import ast
import hashlib
import operator
from collections.abc import Callable, Mapping
from functools import lru_cache
from importlib.resources import files

import yaml

from bayan.core.contracts import HaemLabel
from bayan.haem.models import (
    CBC_ONLY_LABELS,
    HPLC_LABELS,
    HaemRule,
    HaemRuleset,
)

Value = str | int | float | bool | None

_BOOL_OPS = (ast.And, ast.Or)
_CMP_OPS = (ast.Is, ast.IsNot, ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE)
_ALLOWED_NODES = (
    ast.Expression,
    ast.BoolOp,
    ast.UnaryOp,
    ast.Not,
    ast.Compare,
    ast.Name,
    ast.Load,
    ast.Constant,
    *_BOOL_OPS,
    *_CMP_OPS,
)


class RuleError(ValueError):
    """A rule condition is malformed or uses something the interpreter does not allow."""


def parse_condition(text: str, allowed_names: frozenset[str]) -> ast.Expression:
    try:
        tree = ast.parse(text, mode="eval")
    except SyntaxError as exc:
        msg = f"cannot parse condition {text!r}: {exc.msg}"
        raise RuleError(msg) from exc
    for node in ast.walk(tree):
        if not isinstance(node, _ALLOWED_NODES):
            msg = f"condition {text!r} uses a disallowed construct: {type(node).__name__}"
            raise RuleError(msg)
        if isinstance(node, ast.Name) and node.id not in allowed_names:
            msg = f"condition {text!r} uses an undeclared name {node.id!r}"
            raise RuleError(msg)
        if isinstance(node, ast.UnaryOp) and not isinstance(node.op, ast.Not):
            msg = f"condition {text!r} may only use 'not' as a unary operator"
            raise RuleError(msg)
    return tree


_IDENTITY_EQUALITY: dict[type[ast.cmpop], Callable[[object, object], bool]] = {
    ast.Is: operator.is_,
    ast.IsNot: operator.is_not,
    ast.Eq: operator.eq,
    ast.NotEq: operator.ne,
}
_ORDERED: dict[type[ast.cmpop], Callable[[float, float], bool]] = {
    ast.Lt: operator.lt,
    ast.LtE: operator.le,
    ast.Gt: operator.gt,
    ast.GtE: operator.ge,
}


def _compare(op: ast.cmpop, left: Value, right: Value) -> bool:
    kind = type(op)
    if kind in _IDENTITY_EQUALITY:
        return _IDENTITY_EQUALITY[kind](left, right)
    if left is None or right is None or isinstance(left, str) or isinstance(right, str):
        return False  # unknown (or non-numeric) never satisfies a threshold
    return _ORDERED[kind](left, right)


def _eval_boolop(node: ast.BoolOp, ctx: Mapping[str, Value]) -> bool:
    if isinstance(node.op, ast.And):
        return all(bool(_eval(v, ctx)) for v in node.values)
    return any(bool(_eval(v, ctx)) for v in node.values)


def _eval_compare(node: ast.Compare, ctx: Mapping[str, Value]) -> bool:
    left = _eval(node.left, ctx)
    for op, comparator in zip(node.ops, node.comparators, strict=True):
        right = _eval(comparator, ctx)
        if not _compare(op, left, right):
            return False
        left = right
    return True


def _eval(node: ast.AST, ctx: Mapping[str, Value]) -> Value:
    if isinstance(node, ast.Expression):
        return _eval(node.body, ctx)
    if isinstance(node, ast.Constant):
        value = node.value
        if value is None or isinstance(value, str | int | float | bool):
            return value
        msg = f"unsupported constant {value!r}"
        raise RuleError(msg)
    if isinstance(node, ast.Name):
        return ctx[node.id]
    if isinstance(node, ast.UnaryOp):
        return not _eval(node.operand, ctx)
    if isinstance(node, ast.BoolOp):
        return _eval_boolop(node, ctx)
    if isinstance(node, ast.Compare):
        return _eval_compare(node, ctx)
    msg = f"unsupported node {type(node).__name__}"
    raise RuleError(msg)


def evaluate(tree: ast.Expression, ctx: Mapping[str, Value]) -> bool:
    return bool(_eval(tree, ctx))


class CompiledRuleset:
    """The ruleset with every condition parsed once and checked against the declared input names."""

    def __init__(self, ruleset: HaemRuleset, content_hash: str) -> None:
        self.ruleset = ruleset
        self.version = f"bayan-haem-{ruleset.meta.version}+{content_hash[:12]}"
        self.names = frozenset(ruleset.inputs)
        self.compiled: dict[str, ast.Expression] = {}
        self.override_compiled: dict[tuple[str, int], ast.Expression] = {}
        for rule in ruleset.rules:
            self.compiled[rule.id] = parse_condition(rule.condition, self.names)
            for i, override in enumerate(rule.label_overrides):
                self.override_compiled[(rule.id, i)] = parse_condition(
                    override.condition, self.names
                )

    def labels_for(self, rule: HaemRule) -> tuple[HaemLabel, ...]:
        """Every label a rule can produce (none for an annotate rule)."""
        if rule.type == "annotate":
            return ()
        if rule.label is not None:
            return (rule.label, *(o.label for o in rule.label_overrides))
        assert rule.label_s1 is not None
        assert rule.label_s2 is not None
        return (rule.label_s1, rule.label_s2)


def _check_vocabulary(ruleset: HaemRuleset) -> None:
    """A CBC-only stage may only ever emit the three CBC labels; the HPLC stage only the eight HPLC labels."""
    for rule in ruleset.rules:
        if rule.type != "terminal":
            continue
        s1_labels: list[str] = []
        s2_labels: list[str] = []
        if rule.label is not None:
            labels = [rule.label, *(o.label for o in rule.label_overrides)]
            if rule.stage in ("ALL", "S1"):
                s1_labels += labels
            if rule.stage in ("ALL", "S2"):
                s2_labels += labels
        else:
            assert rule.label_s1 is not None
            assert rule.label_s2 is not None
            s1_labels.append(rule.label_s1)
            s2_labels.append(rule.label_s2)
        for label in s1_labels:
            if label not in CBC_ONLY_LABELS:
                msg = f"rule {rule.id}: label {label!r} is not allowed at the CBC-only stage"
                raise RuleError(msg)
        for label in s2_labels:
            if label not in HPLC_LABELS:
                msg = f"rule {rule.id}: label {label!r} is not allowed at the CBC-plus-HPLC stage"
                raise RuleError(msg)
    missing = [
        lab for lab in (*CBC_ONLY_LABELS, *HPLC_LABELS) if lab not in ruleset.label_descriptions
    ]
    if missing:
        msg = f"label_descriptions is missing {sorted(missing)}"
        raise RuleError(msg)


def _read_text() -> str:
    return files("bayan").joinpath("data", "haem_rules.yaml").read_text(encoding="utf-8")


@lru_cache(maxsize=1)
def load_haem_ruleset() -> CompiledRuleset:
    text = _read_text()
    raw: object = yaml.safe_load(text)
    if not isinstance(raw, dict):
        msg = "haem_rules.yaml must be a YAML mapping"
        raise RuleError(msg)
    data: dict[str, object] = {str(k): v for k, v in raw.items()}
    sources = data.get("sources")
    if isinstance(sources, dict):
        data["sources"] = {
            str(k): {**v, "id": str(k), "year": str(v.get("year", ""))}
            for k, v in sources.items()
            if isinstance(v, dict)
        }
    fixtures = data.get("fixtures")
    if isinstance(fixtures, list):
        renamed = []
        for f in fixtures:
            if isinstance(f, dict):
                g = dict(f)
                g["fixture_class"] = g.pop("class")
                renamed.append(g)
        data["fixtures"] = renamed
    ruleset = HaemRuleset.model_validate(data)
    ids = [r.id for r in ruleset.rules]
    if len(ids) != len(set(ids)):
        msg = "duplicate rule id in haem_rules.yaml"
        raise RuleError(msg)
    for rule in ruleset.rules:
        if rule.source.id not in ruleset.sources:
            msg = f"rule {rule.id}: unknown source {rule.source.id}"
            raise RuleError(msg)
    _check_vocabulary(ruleset)
    digest = hashlib.sha256(text.replace("\r\n", "\n").encode("utf-8")).hexdigest()
    return CompiledRuleset(ruleset, digest)
