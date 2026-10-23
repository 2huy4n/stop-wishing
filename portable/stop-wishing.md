# stop-wishing · portable edition (full text + hard-constraint quick reference + script usage)

> Generated 2026-10-23T14:27+08:00 from `skills/stop-wishing/SKILL.md` (regenerate: `node skills/stop-wishing/scripts/build-portable.js`).
> This file = the full SKILL.md body (including §9) + the quick reference below + script usage.
> The three satellite skills (review / audit / debt) are separate directories under `skills/`.

# stop-wishing — align before you code

> One vague instruction → one small, acceptable change. Explain first, get authorization, back up first.

## 1) When to use

- One-line goal, no boundary or acceptance.
- A wishful phrase (§2).
- Changing an existing repo.
- Adding a dependency, font, icon/image, API or template snippet (§7).
- User says "explain first", "back up first", "no hardcoding", "init project docs", or names `stop-wishing`.
- You are about to guess.

**First sentence: report the tier and why (§4).**

## 2) Definition

**Wishing-driven programming = vague instruction → AI invents goal, boundary, acceptance → ships "looks right" code → first clarification forces a big rework → the pile becomes a mess.**

Not AI hallucination: source is **user-side** missing goal/boundary/acceptance, not model-invented facts; symptom is runnable-but-wrong code and rework, not broken references; cure is clarify + requirement card + minimal diff, not docs + tests + evidence.

**Three ambiguities:** **Goal** (whose problem, what it looks like), **Boundary** (in/out, files, dependencies), **Acceptance** (what is done, how proven, who checks).

**Wishful phrases (any → heavy):** "whatever / you decide / make it look good / good enough"; "build X" with no scenario; "optimize / refactor / make it professional"; "same as X" minus the part; "ship then fix"; 3+ features, no priority; screenshot only, no data or I/O.

## 3) User profile and how to speak

**Default: zero technical background or "acted on a whim"** — can judge "looks right", not jargon or cost.

- **Plain language**: conclusion/analogy first, term second; translate on first use.
- **No jargon** ("just add middleware and make it idempotent").
- **≤3 questions per round**, most important first; A/B/C options.
- **Say what each question affects** (cost, risk, rework); "you decide" is not failure — use §6.

### Term table (12+)

| Term | Plain meaning / impact |
|---|---|
| API | Rules programs talk; keys, fees |
| Dependency | Others' part; size, vulns, license (§7) |
| Refactor | Internals only; regression risk |
| Deploy | Others can reach it; domain, cost, on-call |
| Idempotent | Ten runs = one; retries double-charge |
| Git | Snapshots; undo safety (§8) |
| Env variable | Config outside code; machine moves (§9) |
| Rollback | Last good state; recovery time |
| Viral license | Forces open; GPL/AGPL never commercial-closed (§7) |
| Dynamic linking | Runtime library; LGPL still refused commercial-closed |
| Derivative work | Legally a "child"; open-source scope |
| Regression test | Old tests rerun; merge safety (§8) |

## 4) Ambiguity tiers (report first)

Judged by **ambiguity, not change size**: one CSS line can be heavy; a 20-file rename can be light.

| Tier | Test | Handling |
|---|---|---|
| **Light** | Goal/boundary/acceptance: one sentence each | Verbal card (§5), start |
| **Medium** | Exactly **1** missing | Ask it (≤3), confirm; `docs/project.md` if it exists |
| **Heavy** | **2+** missing or a wishful phrase | Card into `docs/project.md`; start after confirmation |

**Opening:** "Let me align first: this is **medium** — goal and acceptance are clear, but **boundary** is not. That decides whether I touch other files, so one question first…" Announce tier changes; never change silently.

## 5) Requirement card

Seven fields: 1. **Goal** — whose problem, what it becomes. 2. **Users and scenario** — who, when, how often. 3. **Input/output** — in/out, format, example. 4. **Scope and boundaries** — included **and explicitly not done**. 5. **Acceptance** — command, screenshot, comparison or sign-off. 6. **Constraints** — stack, untouchables, budget/time, compliance. 7. **Delivery form** — **prototype** (rough OK) or **production** (maintainable, tested, documented).

Plus **Assumptions** (value + reason + cost if wrong) and **Open questions** (not blocking; when each must be decided). Light: verbal. **Medium/heavy: `docs/project.md`; confirm before starting.**

### AGENTS.md — ask before writing

When `docs/` is created or first used in a repo, add one opening question:

> "Do you want a repo-root `AGENTS.md` pointing to these docs, so any agent working here reads them automatically?"

- **Only write after an explicit yes** — run `init-docs.js --agents-md`. Silence, "maybe" or a changed subject is **no**.
- **Never overwrite** an existing `AGENTS.md` or `CLAUDE.md`: it is the user's own steering file. Offer to append a short `## Project docs` block instead; if they decline, skip.
- Keep it to **pointers only** (5–10 lines). Never paste the documents into it: it sits in every future conversation and costs tokens.

## 6) Defaults

"Don't know / you decide / anything": give **one recommendation** (not a menu), **one plain reason**, **record it in Assumptions**, continue — not a failed question. Never read "you decide" as scope expansion; never decide outside Assumptions.

## 7) License gate

**Ask use first:** A) not sure / B) self-use / C) free closed distribution / D) open source / E) commercial (paid or internal). **No or vague answer → commercial closed-source**, recorded.

| License | Self-use | Free closed distribution | Open source (same license) | Commercial closed |
|---|---|---|---|---|
| MIT / Apache-2.0 / BSD / ISC / 0BSD / Unlicense / CC0 | ✅ | ✅ | ✅ | ✅ (keep notices) |
| GPL / AGPL | ✅ | ❌ | ✅ (whole derivative same license) | ❌ viral, always refused |
| LGPL | ✅ | ⚠️ dynamic link + replaceable only | ✅ | ❌ always refused (see note) |
| No LICENSE | ⚠️ self-use only, risk recorded | ❌ | ❌ | ❌ |
| Custom/commercial | Read clauses; unclear → refuse as commercial closed | Same | Same | Same |

> **LGPL strict:** "dynamic link + replaceable" leaves legal room for commercial closed-source, but needs case-by-case argument, notices and a truly replaceable library. This skill treats LGPL like GPL/AGPL: **commercial closed-source always refused.**

**Scope:** code dependencies, **fonts**, **icons/images**, **third-party API terms**, **template/sample snippets** — all pass the gate.

**Own-code exception:** "I wrote it" is not enough. Record in Assumptions: **source** (repo/path), **author statement** (exact words), **date** (ISO 8601 + offset). Missing one → third-party. Only that source skips; the exception **does not spread**.

**Deliverable:** `docs/LICENSES.md`, one line each: **Name | Version | License | Commercial usability | Source URL**; never blank.

## 8) Work loop (fixed order)

1. **Clarify** — report tier (§4), ask ≤3 questions.
2. **Confirm the card** — seven fields + assumptions + open questions; medium/heavy into `docs/project.md`.
3. **Search** — repo → GitHub → official docs; **record keywords and licenses**.
4. **Explain first** — what changes, affected files/behavior, risks, **rollback**; **wait for confirmation**.
5. **Back up** — git tag `pre-<change>-YYYYMMDD-HHmm`; no git: `.bak-YYYYMMDD-HHmm`.
6. **Minimal diff** — only what is necessary (no full rewrite, §9).
7. **Verify with evidence** — run commands, paste raw output (§10).
8. **Update docs** — `project.md` (card) / `progress.md` (timeline) / `todo.md` (next) / `structure.md` (layout) / `content.md` (copy/data).
9. **Report** — changed, evidence, searched, unverified.

## 9) Hard constraints

- **No hardcoding**: absolute paths, secrets, magic numbers (thresholds/timeouts/ports), URLs, ports, model names → config, env vars or named constants; defaults overridable by arguments.
- **Timestamps**: ISO 8601 with the **machine's local UTC offset** (UTC+9 → `+09:00`, never hardcoded `+08:00`); only in the file-header block and `progress.md`.
- **No full rewrite**: single-file diff >**50%** or **300 lines** → explain and **get approval**.
- **Search trail**: keywords, links and conclusions in `progress.md` or the report.
- **Irreversible needs human approval**: delete files/dirs, change a database, `git reset --hard`, overwrite unbacked config, install into system dirs, restart services.
- **No scope creep**: no unrequested refactors, formatting or dependency upgrades.
- **Unknown licenses escalate**: any license outside the §7 matrix is reported to the user before use; never guess its terms.

**File-header block** — top-of-file comment before the first code/title line; latest only. Example: `// 2026-10-20T18:50+08:00 · change: X from A to B; why: C; rollback: git checkout pre-qa-fix-20261020-1849`

## 10) Evidence format

| Assertion | Evidence | Source |
|---|---|---|
| "X implemented" | command + raw output (exit code/lines/hash) | `file:line` or log |
| "Y unaffected" | regression command output | same |
| "Z unverified" | — | "unknown" + where blocked |

**No evidence → "unverified" or "unknown".** Never "should/probably/in theory" as a conclusion.

## 11) Conflict resolution

Highest first: 1) **safety/irreversible risk**; 2) **explicit user instruction**; 3) **evidence** (measurement > docs > memory); 4) **minimal diff**; 5) **reuse**; 6) **beauty/consistency**. Satisfy both when possible; rank only on real conflict, and say what was sacrificed.

## 12) Failure handling

**Max 3 attempts per problem** (same approach; a new one is a new attempt — say what changed). After 3, **stop and escalate**: what was tried, raw errors, top 3 hypotheses, needed decision. Never guess secrets, disable checks, bypass tests or delete evidence.

## 13) Escape hatch

"Stop asking, just do it": **do not block**; record "clarification skipped, risk accepted". **Still explain first** (changes, files, risks, rollback). **Only the confirmation wait is waived**; §8's explanation stays. Backup, minimal diff, evidence and docs stay. **List assumptions** (assumption → reason → what to change if wrong).

## 14) Strictness levels (ponytail)

Switch with `stop-wishing lite|full|ultra`; default **full**.

- **lite** — Task + one line suggesting a smaller/safer alternative. No interrogation.
- **full** — Clarify, card, license gate, backup, minimal diff, evidence; push back on ambiguity/risk.
- **ultra** — Push back on the requirement: should this exist, is the simplest version enough, is doing nothing better?

Level changes how hard you challenge the request, **not** whether you back up, verify or report evidence.

## 15) Mandatory closing lines

End **every** delivery with 1–2 lines: `Skipped: <what was not done>. Unverified: <what was not tested>. Risk: <main residual risk>.` If none, `Skipped: nothing`. Never end with a bare "done".

## 16) Never cut

Never trade for speed or scope — even in lite: validation; error handling that prevents data loss; security; accessibility; hardware calibration; anything the user explicitly asked for. If a request requires cutting one, stop and say so.

## 17) Satellite skills

**stop-wishing-review** — review one change (diff + callers + tests). **stop-wishing-audit** — audit a whole repo. **stop-wishing-debt** — ledger from `shortcut:` markers.

## Bundled scripts

`scripts/` contains `check-env.js`, `init-docs.js`, `check-hardcode.js` and `build-portable.js` (zero dependencies). `install.js` installs all four skills (`--tool`/`--dest`/`--target`/`--verify`/`--dry-run`/`--force`; exit 0/1/2/3/4). Usage details: `README.md` and `node install.js --help`.

---

## Hard constraints quick reference (condensed from §9; the body above is authoritative)

- **No hardcoding**: absolute paths, secrets, magic numbers (thresholds/timeouts/ports), URLs, ports, model names → config, env vars or named constants; defaults overridable by arguments.
- **Timestamps**: ISO 8601 with the **machine's local UTC offset** (UTC+9 → `+09:00`, never hardcoded `+08:00`); only in the file-header block and `progress.md`.
- **No full rewrite**: single-file diff >**50%** or **300 lines** → explain and **get approval**.
- **Search trail**: keywords, links and conclusions in `progress.md` or the report.
- **Irreversible needs human approval**: delete files/dirs, change a database, `git reset --hard`, overwrite unbacked config, install into system dirs, restart services.
- **No scope creep**: no unrequested refactors, formatting or dependency upgrades.
- **Unknown licenses escalate**: any license outside the §7 matrix is reported to the user before use; never guess its terms.

---

## Script usage (zero dependencies, Node.js)

Run from the repository root:

```bash
# 1) Readiness: git / bash / node / git repo; exit 0 ready, 1 missing a critical item
node skills/stop-wishing/scripts/check-env.js

# 2) Generate the 7 project docs (zh/en, including LICENSES.md); exit 0 OK, 1 bad args or exists, 2 template missing
node skills/stop-wishing/scripts/init-docs.js --lang zh --dir .

# 3) Scan hardcoding: absolute paths / secrets / URLs / ports / magic numbers; supports .hardcodeignore
#    exit 0 clean (or all suppressed), 2 unsuppressed hits or invalid ignore file
node skills/stop-wishing/scripts/check-hardcode.js --path . --threshold 1000

# 4) Install all four skills into a skills root (default: ~/.agents/skills)
node install.js --dry-run
node install.js --tool dsh --verify
node install.js --tool claude --verify

# 5) Regenerate this portable file
node skills/stop-wishing/scripts/build-portable.js
```

Satellite skills are documented separately: `skills/stop-wishing-review`, `skills/stop-wishing-audit`, `skills/stop-wishing-debt`.
