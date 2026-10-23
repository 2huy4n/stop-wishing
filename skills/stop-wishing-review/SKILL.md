---
name: stop-wishing-review
description: >-
  Review one change (a diff, branch or PR), not the whole repo, across six dimensions — bugs, risk, scale, missing tests, speed and leanness — with every finding verified against the code. Use before merging a risky change or when asked to review a diff. 中文触发词：stop-wishing-review、审查改动、代码审查、上线前检查、diff 审查。
user-invocable: true
---

# stop-wishing-review — review one change

Read-only. **Do not modify code.** Review the change in front of you, not the entire repository (use `stop-wishing-audit` for that).

## 1) Understand before judging

- Read the **diff**, then every **caller** of the changed code, the **tests** around it, and the relevant **docs**.
- Trace the **real data flow**: where input comes from, what transforms it, where it is stored or sent.
- If a **signature or return value** changed, `grep` **all** callers — including tests, scripts and generated code. Missing a caller is a bug.
- State the **assumed load**: request rate, data size, concurrency, retention. "Scale" findings without a load assumption are guesses.

## 2) Six dimensions

1. **Bug** — wrong behavior, edge cases, off-by-one, null/empty, error paths, race conditions.
2. **Risk** — security (injection, authz, secrets, unsafe deserialization) and data loss (missing transactions, destructive migrations, no backup).
3. **Scale** — behavior at the stated real load: N+1 queries, unbounded memory, missing indexes, quadratic loops, retry storms.
4. **Missing test** — the change has no test for its main promise or its main failure mode.
5. **Speed** — user-visible latency and cost, not micro-optimizations.
6. **Lean** — delete dead code, reuse existing code, use the standard library, apply YAGNI, merge duplicates, split oversized functions.

## 3) Check before you report

Every finding must be **verified against the code**. Quote the line, name the path, or point to the test that proves it.

- **No concrete trigger scenario → not a finding.** "This might be slow" is noise; "this loops over every order for each user, so 10k users × 1k orders" is a finding.
- A `shortcut:` comment is a **recorded decision, not a problem**. Flag it only if the assumed load has passed the stated ceiling.
- Do not report style preferences as bugs. Do not invent requirements the change never promised.

## 4) Output format

Start with:

```text
What this change does: <2–3 sentences in plain language.>
```

Then three groups, with **continuous numbering across all groups**:

```text
Must fix
1. <title>
   What this is: <one sentence.>
   Problem: <the concrete failure, with file:line and trigger.>
   Fix: <the smallest change that removes the failure.>
   If we skip it: <what breaks, who notices, how bad.>

Should fix
2. ...

Nice to have
3. ...
```

- **Must fix** — correctness, security, data loss, or a broken promise of the change.
- **Should fix** — real but non-blocking: missing test, scale risk within a year, meaningful speed cost.
- **Nice to have** — leanness and polish.

End with exactly:

```text
Verdict: <ship / ship after Must fix / do not ship>
Lean: -N lines possible (delete X, reuse Y, stdlib Z)
Not checked: <what you did not read or could not run>
```

`Lean: -N lines possible` is an estimate with named opportunities; write `Lean: 0 lines possible` if none. `Not checked` is mandatory — never imply full coverage.

## 5) Closing

End with the mandatory sentence: `Skipped: <what was not reviewed>. Unverified: <what was not run>. Risk: <main residual risk>.`
