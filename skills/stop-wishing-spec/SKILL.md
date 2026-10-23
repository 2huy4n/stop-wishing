---
name: stop-wishing-spec
description: >-
  Turn the current conversation plus the docs/project.md requirement card into one written spec: assemble only what the user already said, never run a new interview, and mark every gap as Open instead of inventing it. Use when the requirement card is confirmed and the next step is a spec. 中文触发词：stop-wishing-spec、写规格、需求规格、把需求整理成文档、spec。
user-invocable: true
---

# stop-wishing-spec — write the spec from what was already said

Read-only for code. **Only `docs/specs/` is written.** One spec per confirmed card.

## 1) When to use

- The requirement card in `docs/project.md` is confirmed (tier medium/heavy, `stop-wishing` §4–§5).
- The user asks for a spec: "write the spec", "turn this into a document".
- Scope is agreed but still only lives in the conversation.

**Do not use it to:**

- **Collect new requirements.** That is `stop-wishing` §4. This skill never runs a new interview.
- **Split work into tickets.** That is `stop-wishing-tickets`.
- Review a change, audit a repo, or list debt (`stop-wishing-review` / `-audit` / `-debt`).

## 2) Inputs

| Input | Required | Where |
|---|---|---|
| Requirement card | Yes | `docs/project.md` |
| This conversation | Yes | what the user said, including corrections they made later |
| Existing specs | No | `docs/specs/` — avoid a duplicate `id` |
| Repo facts | Optional | entry points, stack, commands — to state constraints, never to invent intent |

**No card → stop, do not invent one.** Say: "I can't find `docs/project.md`. Run `stop-wishing` first so we agree on goal / boundary / acceptance — or paste the requirement and I'll write the card first."

**A gap becomes `Open`, not prose.** One line in §9 with who must decide it. Filling a gap with a plausible guess is the failure this repo exists to prevent.

## 3) Synthesise, do not interview

| Situation | What to write |
|---|---|
| The user said it in this conversation | Copy it, tightened. Keep their exact words where they were precise. |
| The card states it | Carry it over, preserving the card's meaning (§5 of `stop-wishing`). |
| Nobody said it, and it blocks nothing yet | §9 `Open`, with "decide before <milestone>". |
| Nobody said it, and nothing can start without it | Ask **exactly one** question, then continue. |
| Two statements contradict | Put **both** in §9 as a conflict, pick neither, ask which wins. |
| You would have to guess a number, name or API | §9 `Open`. Never a placeholder that reads like a decision. |

**Budget: one clarifying question for the whole run.** If more are needed, the card was not confirmed — send the user back to `stop-wishing` instead of interviewing them here.

## 4) File name and location

`docs/specs/<YYYY-MM-DD>-<slug>.md`

- `<YYYY-MM-DD>` = creation date, machine-local clock.
- `<slug>` = lowercase kebab from the title: ASCII letters and digits, `-` between words, ≤40 chars, drop articles, punctuation and filler. "Parse CSV exports" → `parse-csv-exports`.
- `id` = the file stem (`2026-10-23-parse-csv-exports`). Never renumber a file.
- Name collision → append `-2`, `-3`. Never overwrite an existing spec.

## 5) `card_sha256` — how to compute it

Purpose: prove the spec was written against *this* version of the card, and detect later drift.

Rule — byte-exact, because a validator must reproduce the same number:

1. Read `docs/project.md` as UTF-8.
2. Drop every line matching `^>\s*最后更新：` (the Chinese header line, full-width colon).
3. Join the remaining lines with `\n` — this normalises CRLF to LF.
4. SHA-256 over the UTF-8 bytes; lowercase hex.

```bash
node -e "const c=require('node:crypto'),f=require('node:fs');const t=f.readFileSync('docs/project.md','utf8').split(/\r?\n/).filter(l=>!/^>\s*\u6700\u540e\u66f4\u65b0\uff1a/.test(l)).join('\n');console.log(c.createHash('sha256').update(t,'utf8').digest('hex'))"
```

- The `\u` escapes are those Chinese characters written ASCII-only, so the command survives any terminal encoding. Do not "simplify" them back to literal CJK.
- **Do not widen the pattern.** English cards write `> Last updated:` — that line is **kept** in the hash. Changing the rule breaks agreement with the validator.
- Print the hash and copy it. Cannot compute (missing or unreadable file) → write `card_sha256: unknown` and say so. Never guess a hash.

## 6) Front matter — nine fields

| Field | Type | Rule |
|---|---|---|
| `id` | string | Same as the file stem. |
| `title` | string | One line, ≤80 chars, the user's own wording where possible. |
| `status` | enum | `draft` on write. `approved` only after explicit approval. `stale` when the card changed (hash mismatch). |
| `created` | ISO 8601 | `YYYY-MM-DDTHH:mm±HH:MM`, machine-local offset. Never reused. |
| `updated` | ISO 8601 | Same format. Equals `created` on first write. |
| `card_sha256` | hex | §5, or `unknown`. |
| `source` | string | `docs/project.md`. |
| `tickets` | array | `[]` on write. `stop-wishing-tickets` appends ids later. |
| `lang` | enum | `zh` or `en` — the language of the card and the conversation. |

**No offset in a timestamp is a bug** (`stop-wishing` §9): write `+08:00` or `-05:00` as the machine reports it, never a fixed value.

## 7) Body — ten sections, fixed order

| # | Section | What goes in | What stays out |
|---|---|---|---|
| 1 | Problem | Whose problem, what it looks like today, why now | Solutions |
| 2 | Goals | One line each, outcome-shaped | Implementation steps |
| 3 | Non-goals | What is explicitly **not** built, not touched, not added | "TBD" |
| 4 | Users and scenarios | Who, when, how often, what they do today | Personas nobody stated |
| 5 | Input and output | Format, sample, source / format, audience | File-by-file plans |
| 6 | Scope and boundaries | Modules in, modules out, dependencies allowed | Code design |
| 7 | Acceptance | Each item + how it is proven | "works well" |
| 8 | Constraints and dependencies | Stack, untouchables, budget, compliance, external services | Assumptions (§9) |
| 9 | Assumptions and open questions | Assumption → why → **cost if wrong**; Open → who decides | Guesses presented as facts |
| 10 | Change log | Date + what changed + why, newest first | Chat transcripts |

Every section exists even when empty: write `None.` — never delete a heading, or the next reader cannot tell "nothing" from "forgotten".

## 8) Non-negotiable rules

- **Acceptance is provable or it is not acceptance.** Each line names a command, a file to inspect, or an observable behaviour. "Feels right", "looks good", "works well" are rejected.
- **Non-goals is non-empty.** At least one explicit exclusion. Take it from the card's *explicitly not done* list; if the card lists none, take it from what the user ruled out in this conversation; if they ruled nothing out, that is the one question you are allowed to ask.
- **Assumptions carry a consequence.** Every assumption says what breaks if it is wrong and where to change it.
- **No implementation detail.** No function names, no file-by-file plan, no schema. Tickets own that; a spec that pre-writes the code is scope creep.
- **One claim, one place.** If a fact is in §2, do not repeat it in §7 — link it.

## 9) Offer the next step — once

After the file is written, offer once, in plain language:

> "Spec saved to `docs/specs/<id>.md`. Want me to split it into tickets? Each ticket gets its dependency order and a verify command."

- Offer **once**. Declined, skipped or subject changed → record it in the closing `Skipped:` line (`stop-wishing` §15) and never ask again.
- Never make the ticket set a precondition for work the user already approved.

## 10) Boundaries

- Write only `docs/specs/`. Do not modify code, tests, `install.js`, `README.md`, or `docs/project.md` — the card belongs to the user and changes only through `stop-wishing`.
- Never edit an `approved` spec silently: set `status: draft`, state why, then change it.
- On re-entry, recompute `card_sha256`. Different from the stored value → set `status: stale`, quote both hashes, ask before rewriting. A stale spec silently kept `approved` is worse than no spec.

## Closing

End with the mandatory sentence (`stop-wishing` §15):

```text
Skipped: <sections left empty or questions not answered>. Unverified: <facts not checked against the repo>. Risk: <main residual risk>.
```
