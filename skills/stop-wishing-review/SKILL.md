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

## 2) Route to details

| Need | Read |
|---|---|
| Find the spec, check drift, run the three Intent checks, resolve `docs/agents/issue-tracker.md` or `docs/issues/` refs | `INTENT.md` |
| Six Engineering dimensions, the 12-smell baseline, finding rules | `ENGINEERING.md` |
| Two sub-agents, output format, severity and closing | `REPORT.md` |

Read `INTENT.md` and `ENGINEERING.md` before forming findings; read `REPORT.md` before planning the run and before writing. If the environment has no sub-agent tool, run the two axes sequentially and say `Not parallel: sub-agent tool unavailable` in the report. Do not skip an axis because it cannot be parallelised.

## 3) Evidence gate

Every finding must be **verified against the code**. Quote the line, name the path, or point to the test that proves it.

- **No concrete trigger scenario → not a finding.** "This might be slow" is noise; "this loops over every order for each user, so 10k users × 1k orders" is a finding.
- A `shortcut:` comment is a **recorded decision, not a problem**. Flag it only if the assumed load has passed the stated ceiling.
- Do not report style preferences as bugs. Do not invent requirements the change never promised.

## 4) Closing

End with the mandatory sentence: `Skipped: <what was not reviewed>. Unverified: <what was not run>. Risk: <main residual risk>.`
