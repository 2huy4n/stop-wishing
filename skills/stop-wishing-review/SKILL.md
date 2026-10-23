---
name: stop-wishing-review
description: >-
  Review one change (a diff, branch or PR) on two separate axes — Intent (did it build what the spec asked, no more, no less) and Engineering (bugs, risk, scale, missing tests, speed, leanness, plus a code-smell baseline) — with every finding verified against the code. Use before merging a risky change or when asked to review a diff. 中文触发词：stop-wishing-review、审查改动、代码审查、上线前检查、diff 审查。
user-invocable: true
---

# stop-wishing-review — review one change

Read-only. **Do not modify code.** Review the change in front of you, not the whole repository (use `stop-wishing-audit` for that).

## 0) Two axes, deliberately separate

- **Intent** — did the change build the right thing? Does it match the spec: nothing missing, nothing extra, nothing faked?
- **Engineering** — will it break? Bugs, security, data loss, load, tests, speed, leanness, code shape.

A change can pass one axis and fail the other: code that follows every rule but implements the wrong feature (**Engineering pass, Intent fail**); code that does exactly what the issue asked but is unsafe under load (**Intent pass, Engineering fail**). Report the axes **separately and never rerank across them** — merging lets one axis hide the other.

## 1) Understand first (both axes)

- Read the **diff**, then every **caller** of the changed code, the **tests** around it, and the relevant **docs**.
- Trace the **real data flow**: where input comes from, what transforms it, where it is stored or sent.
- If a **signature or return value** changed, `grep` **all** callers — including tests, scripts and generated code. Missing a caller is a bug.
- State the **assumed load**: request rate, data size, concurrency, retention. "Scale" findings without a load assumption are guesses.

## 2) Axis 1 — Intent: did it do the right thing?

### Find the spec, in this order

1. `docs/project.md` — the requirement card (goal, scope, acceptance). This is the normal source in a stop-wishing project.
2. Issue references in commit messages (`#123`, `Closes #45`, `!67`).
3. A spec file or path the user names (`docs/`, `specs/`, `.scratch/`).
4. Ask the user. If they say there is no spec, **skip this axis** and write `Intent: no spec available — not reviewed`. Never invent requirements.

### Then check exactly three things

- **Missing or partial** — the spec asked for it, the diff does not deliver it (or only half). Quote the spec line.
- **Scope creep** — the diff adds behaviour, options or files nobody asked for. Name what and why it is extra.
- **Looks done, is wrong** — the feature exists but behaves differently from what the spec says (wrong default, wrong order, wrong recipient, wrong permission).

Every Intent finding must quote the spec line it is judged against. No spec line, no finding.

## 3) Axis 2 — Engineering: will it break?

### Six dimensions

1. **Bug** — wrong behavior, edge cases, off-by-one, null/empty, error paths, race conditions.
2. **Risk** — security (injection, authz, secrets, unsafe deserialization) and data loss (missing transactions, destructive migrations, no backup).
3. **Scale** — behavior at the stated real load: N+1 queries, unbounded memory, missing indexes, quadratic loops, retry storms.
4. **Missing test** — the change has no test for its main promise or its main failure mode.
5. **Speed** — user-visible latency and cost, not micro-optimizations.
6. **Lean** — delete dead code, reuse existing code, use the standard library, apply YAGNI, merge duplicates, split oversized functions.

### Smell baseline (12 checks, judgement calls only)

Use these when the repo documents no standards, and as a second pass when it does. They are heuristics, not violations.

**Naming and duplication**

1. **Mysterious Name** — a name that does not reveal what the value holds or the function does. Fix: rename until it does; if no honest name exists, the design is unclear.
2. **Duplicated Code** — the same logic shape appears twice in the change. Fix: keep one copy, call it from both.
3. **Repeated Switches** — the same type test or if-ladder recurs at several sites. Fix: one table both sites share, or polymorphism.

**Coupling**

4. **Feature Envy** — a function works mostly on another object's data rather than its own. Fix: move it beside the data it uses.
5. **Data Clumps** — the same few values travel together everywhere. Fix: give the group its own type and pass that.
6. **Message Chains** — callers walk a long chain of getters. Fix: ask the first object for the result.

**Abstraction**

7. **Primitive Obsession** — a string or number stands in for a real concept. Fix: give the concept a small type.
8. **Speculative Generality** — parameters, hooks or base classes for a need nobody has. Fix: delete until a real need appears.
9. **Refused Bequest** — a subclass ignores most of what it inherits. Fix: use composition instead of inheritance.
10. **Middle Man** — a layer that only forwards calls. Fix: remove it and call the target directly.

**Shape of change**

11. **Shotgun Surgery** — one logical change scatters edits across many files. Fix: gather what changes together into one module.
12. **Divergent Change** — one file is edited for several unrelated reasons. Fix: split by reason.

Rules for the baseline:

- **The repo overrides.** A documented project standard always wins; suppress any smell it endorses.
- **Always a judgement call.** Write "possible Feature Envy", never "violates".
- **Skip what tooling enforces.** A linter, formatter or type checker already covers it — do not repeat it.
- **No concrete case, no finding.** Name the file, the line and the situation.

## 4) Check before you report

Every finding must be **verified against the code**. Quote the line, name the path, or point to the test that proves it.

- **No concrete trigger scenario → not a finding.** "This might be slow" is noise; "this loops over every order for each user, so 10k users × 1k orders" is a finding.
- A `shortcut:` comment is a **recorded decision, not a problem**. Flag it only if the assumed load has passed the stated ceiling.
- Do not report style preferences as bugs. Do not invent requirements the change never promised.

## 5) How to run: two sub-agents, in parallel

- Spawn **one sub-agent per axis** with an isolated context: give each the diff command, the commit list, and its own source material (Axis 1: the spec text; Axis 2: the standards files plus the smell baseline above).
- **If the environment has no sub-agent tool, run the two axes sequentially** and say `Not parallel: sub-agent tool unavailable` in the report. Do not skip an axis because it cannot be parallelised.
- Aggregate the two reports **verbatim or lightly cleaned**. Do not merge, renumber across axes, or pick a single "worst finding" across them.

## 6) Output format

Start with:

```text
What this change does: <2–3 sentences in plain language.>
```

Then two sections, in this order:

```text
## Intent (vs spec)
Spec source: <docs/project.md | issue #123 | path | none>

I1. <title>
    What this is: <one sentence.>
    Problem: <the gap, with the quoted spec line.>
    Fix: <the smallest change that closes the gap.>
    If we skip it: <what the user gets instead of what they asked for.>
```

```text
## Engineering
E1. <title>  [Must fix | Should fix | Nice to have]
    What this is: <one sentence.>
    Problem: <the concrete failure, with file:line and trigger.>
    Fix: <the smallest change that removes the failure.>
    If we skip it: <what breaks, who notices, how bad.>
```

- **Must fix** — correctness, security, data loss, or a broken promise of the change.
- **Should fix** — real but non-blocking: missing test, scale risk within a year, meaningful speed cost.
- **Nice to have** — leanness, code shape and polish.

End with:

```text
Intent: <N findings | no spec available>
Engineering: <N findings; worst: ...>
Verdict: <ship / ship after Must fix / do not ship>
Lean: -N lines possible (delete X, reuse Y, stdlib Z)
Not checked: <what you did not read or could not run>
```

`Lean: -N lines possible` is an estimate with named opportunities; write `Lean: 0 lines possible` if none. `Not checked` is mandatory — never imply full coverage.

## 7) Closing

End with the mandatory sentence: `Skipped: <what was not reviewed>. Unverified: <what was not run>. Risk: <main residual risk>.`
