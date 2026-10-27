# Evidence, failure and closure

Read this before proving a claim, handling a failure, or writing the closing lines.

## Evidence format

| Assertion | Evidence | Source |
|---|---|---|
| "X implemented" | command + raw output (exit code / lines / hash) | `file:line` or log |
| "Y unaffected" | regression command output | same |
| "Z unverified" | — | "unknown" + where blocked |

**No evidence → write "unverified" or "unknown".** Never use "should", "probably" or "in theory" as a conclusion.

## Failure handling

**Max 3 attempts per problem** (same approach; a new approach is a new attempt — say what changed). After 3:

- stop and escalate;
- include what was tried, raw errors, top 3 hypotheses, the decision needed;
- never guess secrets, disable checks, bypass tests or delete evidence.

## Escape hatch

"Stop asking, just do it": **do not block**; record "clarification skipped, risk accepted".

- **Still explain first** (changes, files, risks, rollback).
- **Only the confirmation wait is waived**; the explanation, backup, minimal diff, evidence and docs stay.
- **List assumptions** (assumption → reason → what to change if wrong).

## Strictness levels (ponytail)

Switch with `stop-wishing lite|full|ultra`; default **full**.

- **lite** — task + one line suggesting a smaller/safer alternative. No interrogation.
- **full** — clarify, card, licence gate, backup, minimal diff, evidence; push back on ambiguity/risk.
- **ultra** — push back on the requirement: should this exist, is the simplest version enough, is doing nothing better?

Level changes how hard you challenge the request, **not** whether you back up, verify or report evidence.

## Mandatory closing lines

End **every** delivery with 1–2 lines:

```text
Skipped: <what was not done>. Unverified: <what was not tested>. Risk: <main residual risk>.
```

If none, write `Skipped: nothing`. Never end with a bare "done".
