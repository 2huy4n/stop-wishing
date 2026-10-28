# Review report

## How to run: two sub-agents, in parallel

- Spawn **one sub-agent per axis** with an isolated context: give each the diff command, the commit list, and its own source material (Axis 1: `INTENT.md` plus the spec text; Axis 2: the standards files plus `ENGINEERING.md`).
- **If the environment has no sub-agent tool, run the two axes sequentially** and say `Not parallel: sub-agent tool unavailable` in the report. Do not skip an axis because it cannot be parallelised.
- Aggregate the two reports **verbatim or lightly cleaned**. Do not merge, renumber across axes, or pick a single "worst finding" across them.

## Output format

Start with:

```text
What this change does: <2–3 sentences in plain language.>
```

Then two sections, in this order:

```text
## Intent (vs spec)
Spec source: <docs/specs/<file>.md (card matches | drift | draft) | docs/project.md | issue #123 | path | none>

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

## Closing

End with the mandatory sentence: `Skipped: <what was not reviewed>. Unverified: <what was not run>. Risk: <main residual risk>.`
