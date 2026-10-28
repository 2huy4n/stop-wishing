---
name: stop-wishing-tickets
description: >-
  Split one spec into tracer-bullet tickets, each declaring blocked_by so the set forms a dependency DAG: work starts on the thinnest end-to-end slice and nothing is built out of order. Use when a spec is settled and the next step is a work breakdown. 中文触发词：stop-wishing-tickets、拆工单、任务拆分、tracer bullet、依赖顺序。
user-invocable: true
---

# stop-wishing-tickets — split a spec into ordered tickets

Read-only for code. **Only `docs/tickets/` and the spec's `tickets:` array are written.**
## 1) When to use

- A spec in `docs/specs/` is settled and the work is bigger than one session.
- The user asks to break work down: "split it", "make tickets", "what is the order".

**Do not use it to:** one small change (just do it), collect requirements (`stop-wishing`), write the spec (`stop-wishing-spec`), or re-plan a repo-wide cleanup (`stop-wishing-audit` / `-debt`).

**Spec not `approved`?** Ask once: "This spec is still `draft`. Split it anyway, or approve it first?" Take the answer; never split silently and never treat silence as approval.
## 2) Inputs

| Input | Required | Where |
|---|---|---|
| Spec | Yes | `docs/specs/<id>.md` (or a path the user names) |
| Existing tickets | No | `docs/tickets/` — for numbering and to avoid duplicates |
| Issue tracker | No | `docs/agents/issue-tracker.md` — issues are not tickets; use it only to resolve inbound issue refs, while ticket files always stay in `docs/tickets/` |
| Triage labels | No | `docs/agents/triage-labels.md` — only for describing an inbound issue's triage role; it never changes ticket status (`todo/doing/done/dropped`) or location |
| Repo facts | Optional | to write real verify commands, never to invent scope |

**No spec → ask, do not improvise.** "Point me at the spec, or run `stop-wishing-spec` first — I won't invent a scope to split."

**Inbound issue refs.** If a ticket references `#123` or `!67`, resolve it through `docs/agents/issue-tracker.md` when present; otherwise look for `docs/issues/<n>.md` or a matching file under `docs/issues/`. Never copy an issue into `docs/tickets/` or treat the issue tracker as the ticket directory.

**Triage roles.** If an issue quote uses a triage role (`needs-triage`, `ready`, `blocked`, `in-progress`, `done`), read `docs/agents/triage-labels.md` for the word the tracker actually uses. Do not map a triage role onto a ticket status; tickets stay `todo/doing/done/dropped`.
## 3) Tracer bullet first

A **tracer bullet** is the thinnest change that touches every layer the feature needs and produces one observable result. It proves the path end to end before anything is built wide.

- Ticket `0001` is always the tracer bullet, and every other ticket `blocked_by` it unless it is genuinely independent.
- Each ticket = **one session** of work, independently verifiable; each touches **one module or area**. Cross-module work is two tickets with a dependency.
- More than **5 acceptance items** → split. Accepting more than five things at once is how "done" becomes nobody's job.
## 4) File name and location

`docs/tickets/<NNNN>-<slug>.md`

- `NNNN` = 4-digit, zero-padded, **global and monotonic** across the repo. Never reused, never renumbered, gaps are fine.
- `<slug>` = lowercase kebab, ASCII, ≤40 chars, from the ticket title. Same slug twice → rename one slug, not the number.
- Never overwrite an existing ticket file.
## 5) Allocating the number

1. List `docs/tickets/` (top level only). Match `^(\d{4})-[a-z0-9-]+\.md$`.
2. Take the **maximum** match and add 1; start at `0001` on an empty or missing directory.
3. Create with an **exclusive write** (`flag: "wx"` — O_CREAT|O_EXCL). It must fail rather than clobber.
4. `EEXIST` → re-scan and retry. **Maximum 3 attempts**, then stop and report the collision instead of guessing a number.
5. Result above `9999` → stop with an error. Do not widen to 5 digits and do not recycle numbers.

**Never number by counting files.** Counting reuses numbers as soon as one ticket is deleted, and two agents running at once will count the same total.
## 6) Front matter — eleven fields

| Field | Type | Rule |
|---|---|---|
| `id` | string | The 4-digit number, quoted (`"0007"`), so YAML does not read it as octal/`7`. |
| `title` | string | One line, imperative, ≤80 chars. |
| `spec` | string | The spec `id` this ticket serves. |
| `status` | enum | `todo` on write; `doing`, `done`, `dropped` later. |
| `blocked_by` | array | Ticket ids only. `[]` = ready now. |
| `owner` | string or null | `null` until claimed; a person or agent name, never "TBD". |
| `created` | ISO 8601 | `YYYY-MM-DDTHH:mm±HH:MM`, machine-local offset. |
| `updated` | ISO 8601 | Equals `created` on write. |
| `acceptance` | array | Each item provable; numbered in the body, listed here verbatim. |
| `verify` | array | Commands that prove it, copy-pasteable. Empty array is a red flag, not a style. |
| `estimate` | enum | `S` one file / small; `M` a few files; `L` more than a few — an `L` usually means split it. |
## 7) Body template

```markdown
# <NNNN> <title>
## Goal
One sentence: after this ticket, what can be done that could not be done before.
## Context
What the reader needs to start without re-reading the whole spec: the spec section, the files involved, the current behaviour.
## Scope
**In:** what this ticket changes.
**Out:** what it deliberately does not — the next ticket's job.
## Acceptance
1. <provable statement>
2. <provable statement>
## Verify
```bash
<command>   # expected: <output or exit code>
```
## Notes
Risks, decisions, anything the next ticket needs to know.
```
## 8) Dependency rules (the DAG)

- `blocked_by` may only name tickets that **exist on disk** right now. A dependency on a ticket you have not written yet is a broken graph.
- **No self-reference** (`0003` blocked by `0003`); **no cycles** — `A → B → A` is rejected, not "fixed" by reordering.
- `done` and `dropped` tickets **cannot block** others. If one does, report it and ask whether to re-point the dependency; never rewrite someone else's graph silently.
- Order by dependency, not by preference. Say which tickets can run **in parallel** (independent leaves).
- More than ~12 open tickets for one spec → ask whether phase 2 belongs in this spec at all.
## 9) Validate before reporting

```bash
node "<skill-base>/../stop-wishing/scripts/check-tickets.js" --dir <project root>
```

`<skill-base>` is the directory holding this `SKILL.md`; resolve it before running, never against the project root. Exit `0` = clean, `1` = errors found, `2` = usage or I/O problem. Paste the raw output.

**If the script is not there yet**, write `check-tickets.js: not present — graph checked by hand` and list what you checked (uniqueness, self-reference, cycles, unknown ids, orphan status). Never report a clean run you did not see.
## 10) Write the ids back

Append the created ids to the spec's `tickets:` array — `docs/specs/` only. Do not rewrite the spec body, and do not mark the spec `approved` on the way through.
## 11) Boundaries

- Write only `docs/tickets/` plus that one array in the spec.
- No code, no tests, no `install.js`, no `README.md`.
- Never delete or renumber a ticket: `status: dropped` keeps the history.
- Never invent an estimate as a promise. `S/M/L` is a sizing hint; if the user needs dates, that is a separate conversation.
## Closing

End with the mandatory sentence (`stop-wishing` §15):

```text
Skipped: <tickets not written and why>. Unverified: <graph checks not run>. Risk: <main residual risk>.
```
