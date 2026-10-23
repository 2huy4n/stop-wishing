---
name: stop-wishing-audit
description: >-
  Audit a whole repository — architecture, build, dependencies, entry points, tests and real data flows — across six dimensions (bug, risk, scale, missing test, speed, lean), capped at 20 verified findings. Use when taking over an unfamiliar repo or asking for a codebase health check. 中文触发词：stop-wishing-audit、全仓审计、代码体检、接手项目、仓库审计。
user-invocable: true
---

# stop-wishing-audit — audit a whole repository

Read-only. **Do not modify code.** For a single diff or PR, use `stop-wishing-review`.

## 1) Map before you judge

Before reading code, write down:

- **README** — claimed purpose, setup, known limitations.
- **Build and deploy** — scripts, CI, container/cloud config, environment variables, release process.
- **Dependencies** — runtime and dev, versions, lockfile, license flags.
- **Entry points** — HTTP routes, CLI commands, jobs, event handlers, UI pages.
- **Tests** — what is covered, what is mocked, what never runs.
- **Assumed load** — users, requests, data size, concurrency, retention. State it; if unknown, say so and audit against a named assumption.

Then trace the **main flows** end to end:

1. User input → validation → storage/response.
2. Money and billing (if any) → rounding, idempotency, refunds.
3. Authentication and authorization → session, roles, tenancy boundaries.
4. Data writes → transactions, migrations, backups, deletion.
5. Background jobs and queues → retries, ordering, poison messages.
6. Cross-process shared state → caches, locks, files, environment.

## 2) Six dimensions

1. **Bug** — wrong behavior, edge cases, error paths, races.
2. **Risk** — security and data loss: injection, authz gaps, secrets, unsafe migrations, no backup.
3. **Scale** — behavior at the stated load: N+1, unbounded memory, missing indexes, quadratic loops.
4. **Missing test** — the main promise or main failure mode has no test.
5. **Speed** — user-visible latency and cost, not micro-optimizations.
6. **Lean** — delete dead code, reuse, stdlib, YAGNI, merge, split.

## 3) Check before you report

Every finding must be **verified against the code** — quote the line, name the path, or point to the proving test.

- **No concrete trigger scenario → not a finding.** State the input, the path and the consequence.
- A `shortcut:` comment records a decision; flag it only when the assumed load has passed its ceiling.
- Do not report style preferences or invent requirements the repo never claimed.
- If you cannot verify a suspicion, put it in `Not checked`, not in a finding group.

## 4) Output format

Start with:

```text
What this repo does: <2–3 sentences in plain language.>
```

Then three groups, with **continuous numbering across all groups**:

```text
Must fix
1. <title>
   What this is: <one sentence.>
   Problem: <concrete failure, with file:line and trigger.>
   Fix: <smallest change that removes the failure.>
   If we skip it: <what breaks, who notices, how bad.>

Should fix
2. ...

Nice to have
3. ...
```

- **Must fix** — correctness, security, data loss, or a contract the repo publicly claims.
- **Should fix** — real but non-blocking: missing test, scale risk, meaningful speed cost.
- **Nice to have** — leanness and polish.

**Cap: at most 20 findings.** If more exist, say `Omitted: N further findings` and name their areas. Never silently truncate.

End with exactly:

```text
Verdict: <healthy / fix Must-fix items before growth / unsafe to grow>
Lean: -N lines possible (delete X, reuse Y, stdlib Z)
Not checked: <what you did not read or could not run>
```

`Not checked` is mandatory — an audit without a coverage statement is a false claim.

## 5) Closing

End with the mandatory sentence: `Skipped: <what was not audited>. Unverified: <what was not run>. Risk: <main residual risk>.`
