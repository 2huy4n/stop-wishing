---
name: stop-wishing-setup
description: >-
  Configure one repository for this skill family: probe what is already there, settle where issues, labels, domain docs and the AGENTS.md pointer block live, then write only the files this skill owns. Use on a repo's first run, or when the repo conventions change. 中文触发词：stop-wishing-setup、初始化仓库、配置项目、仓库约定、setup。
user-invocable: true
---

# stop-wishing-setup — configure the repo once

Read-only until the user answers. Writes **three small files and one marked block**, nothing else.

## 1) When to use

- A repository is using this skill family for the first time.
- Repo conventions changed: issues moved, labels renamed, glossary relocated, a second package appeared.

**Do not use it to:**

- Collect requirements — that is `stop-wishing` §4–§5.
- Write, review or audit code.
- Generate the seven project docs (`project`, `content`, `structure`, `progress`, `todo`, `discipline`, `LICENSES`). That is `init-docs.js`, and this skill never writes them.

## 2) One writer per file

Two writers on one path is how documents start contradicting each other. The split is absolute:

| Path | Owner | This skill |
|---|---|---|
| `docs/project.md`, `content.md`, `structure.md`, `progress.md`, `todo.md`, `discipline.md`, `LICENSES.md` | `init-docs.js` | **Never writes, never edits** |
| `docs/agents/issue-tracker.md`, `domain.md`, `triage-labels.md` | **this skill** | writes |
| `AGENTS.md` → the `## Project docs` block between the markers | **this skill** | rewrites the block only |
| Every other part of `AGENTS.md` / `CLAUDE.md` | the user | never touched, byte for byte |

- **This skill never creates `AGENTS.md`.** No file → say "run `init-docs.js --agents-md` first, or skip the pointer block", and continue without it.
- `CLAUDE.md` is never created either. If it exists and the user picks it, the same marked block goes there — and only there.

## 3) Detect first — report, then ask

Read-only. No network, no `gh auth`, no `git fetch`. Print the findings as a table **before** the first question; the answers depend on them.

| Probe | How | Why it matters |
|---|---|---|
| Git present? | `git rev-parse --is-inside-work-tree` | No git → issues and tickets still work as plain files; history does not |
| Remote on GitHub? | `git remote -v` | Only GitHub remotes make GitHub Issues a real option |
| `gh` available? | `gh --version` | Version only. Not logged-in → treat as unavailable |
| `docs/` | list it | Existing docs are respected, never regenerated |
| `docs/agents/` | list it | Existing config is updated in place, not duplicated |
| `AGENTS.md` / `CLAUDE.md` | existence, and whether the markers are already there | Decides Q4, and whether this is a re-run |

State it plainly: "git yes, remote is GitLab, `gh` not installed, `docs/` exists with four files, `AGENTS.md` exists without the markers." Then ask Q1.

## 4) Four questions — one at a time, each with a recommendation

One question per turn, the recommendation first, the reason in one clause. Never a menu of five.

**Q1 — Where do issues live?**
Recommended: **local markdown files in the repo** — works offline, diffs in review, no account needed. `--issue-tracker local` puts them in `docs/issues/`, kept separate from the tracer-bullet tickets in `docs/tickets/` (an issue is an incoming report; a ticket is our own planned slice of work).
Alternatives: GitHub Issues (*only* when the remote is GitHub **and** `gh` answered); anything else → `--issue-tracker other`, and the script hands back the question it cannot answer — take the user's description verbatim into `issue-tracker.md`.

**Q2 — Define the label vocabulary now?**
Recommended: **yes, the five default roles** below. Skipping is allowed: no `triage-labels.md` is written and every skill falls back to the default role names.

**Q3 — Domain docs layout?**
Recommended: **single-context** — one `GLOSSARY.md` at the root plus `docs/adr/`. Pick **multi-context** only when the repo really holds several deployable parts, each with its own vocabulary.

**Q4 — Add the `## Project docs` pointer block?**
Recommended: **yes**.
- Exactly one of `AGENTS.md` / `CLAUDE.md` exists → offer that one.
- Both exist → ask which one, and say why: two copies drift, and the agent reads one of them at random. **Never write both.**
- Neither exists → this skill creates nothing; point to `init-docs.js --agents-md` and continue.

**All answers "whatever you think"** → take every recommendation, list each one in the closing `Skipped:` line as an assumption, and say they can be changed later by re-running this skill.

## 5) What gets written

Three small files, each under ten lines. Files not chosen by Q2/Q4 are simply absent — never a stub.

### Run the writer

```bash
node skills/stop-wishing/scripts/setup.js --dir . [--issue-tracker local|github|other] [--labels default|none] [--layout single|multi] [--agents-md] [--dry-run] [--json]
```

- Exit `0` = success (including "nothing changed") / `1` = bad arguments / `2` = IO error. Paste the raw output.
- `--dry-run` first when the repo already has `docs/agents/` files: it reports created / updated / unchanged without writing.
- `--json` gives `{files, agentsMd, questions}` — `questions` is the script telling you which of your answers it cannot act on; every entry there goes to the user, unanswered by you.
- **The script is the writer.** Do not hand-edit `docs/agents/*` while it exists. If it is missing from the repo, write the three files by hand exactly as below and say so in the report.

### `docs/agents/issue-tracker.md`

```markdown
# Issue tracker

> Managed by stop-wishing-setup. Re-run the skill instead of editing by hand.

- Where: <local markdown: docs/issues/ | GitHub Issues on <owner/repo> | the user's words>
- Create: <file named `NNNN-slug.md`, or `gh issue create -t <title> -b <body>`>
- Read: <read the file at the path named by the issue reference, or `gh issue view <n> --json title,body`>
- Status: <todo / doing / blocked / done — and the word each maps to in the real system>
```

### `docs/agents/domain.md`

```markdown
# Domain docs

- Glossary: <GLOSSARY.md at the repo root, or the paths of one glossary per context>
- ADR: <docs/adr/, one file per decision, `NNNN-title.md`>
- Layout: <single-context | multi-context, and the context boundaries in one line>
```

### `docs/agents/triage-labels.md` — only when Q2 said yes

```markdown
# Triage labels

| Role | Label in this repo |
|---|---|
| needs-triage | needs-triage |
| ready | ready |
| blocked | blocked |
| in-progress | in-progress |
| done | done |
```

Left column is the role every skill speaks; right column is what the tracker actually uses. **Existing repo labels win** — map onto them and never rename a repo's labels from here.

### The `## Project docs` block

Four pointers, no prose:

```markdown
<!-- stop-wishing:project-docs:begin -->
## Project docs

- Requirement card: `docs/project.md`
- Issue tracker: `docs/agents/issue-tracker.md`
- Domain and decisions: `docs/agents/domain.md`
- Tickets: `docs/tickets/`
<!-- stop-wishing:project-docs:end -->
```

Paths are written as they exist in this repo. A pointer to a file that is not there is worse than no pointer — omit that line and say so in the report.

## 6) Idempotency

- **Only the bytes between the two markers change.** Everything before `begin` and after `end` is preserved byte for byte.
- Re-running is a **replace**, never an append. The second run must not produce a second block.
- Compute the new block first, compare with the current one: **identical → do not write**, and say "already up to date".
- Markers present but malformed (one without the other, nested, duplicated) → stop and show the user both line numbers; do not guess which to keep.
- An existing pointer section **without** markers (an older `init-docs` wrote it) → do not append a second one: report it and ask the user to merge, or replace it by hand once. Two pointer blocks are worse than one.
- `--labels none` never deletes an existing `triage-labels.md`; say so instead of silently leaving a stale file, and omit the `Status mapping` pointer when the file is not being generated.
- **Two marker pairs, never mixed.** `<!-- stop-wishing-setup:begin -->` … `<!-- stop-wishing-setup:end -->` inside each `docs/agents/*.md`; `<!-- stop-wishing:project-docs:begin -->` … `<!-- stop-wishing:project-docs:end -->` inside `AGENTS.md` / `CLAUDE.md`. A block written under the wrong pair gets duplicated by the next run.
- The three `docs/agents/*.md` files keep their own head and tail: only the marked segment is replaced, so a repo may add notes above or below it and keep them.

## 7) What the other skills read

| Skill | Reads | Uses it for |
|---|---|---|
| `stop-wishing-spec` | `docs/agents/domain.md` | glossary and ADR locations, so terms and constraints point somewhere real. Its own `source:` stays `docs/project.md` |
| `stop-wishing-tickets` | `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md` | ticket location, and the word to use for each status |
| `stop-wishing-review` | `docs/agents/issue-tracker.md`, then `docs/agents/domain.md` | resolving "issue #123" to a real file before falling back to asking the user |
| `stop-wishing-audit` / `stop-wishing-debt` | `docs/agents/domain.md` | naming things the way the repo names them |

**Nothing here is required.** When `docs/agents/` is absent, every skill works on its defaults: card at `docs/project.md`, tickets at `docs/tickets/`, issues resolved by the review order in `stop-wishing-review` §2, glossary optional. Setup removes guesswork; it must not add a new precondition.

## 8) Failure and degradation

| Situation | What to do |
|---|---|
| No git | Continue. Say plainly: no history, no tag-based rollback — back up the files it writes (`*.bak-YYYYMMDD-HHmm`) before writing |
| No `gh` | GitHub Issues leaves the menu; the recommendation becomes local markdown |
| `docs/` already exists | Keep every existing file. Update only `docs/agents/*`; never regenerate the seven |
| `AGENTS.md` **and** `CLAUDE.md` both exist | Ask which one; write one; name the other in the report as untouched |
| Neither `AGENTS.md` nor `CLAUDE.md` | Do not create one. Point to `init-docs.js --agents-md`; skip Q4 |
| User declines all four | Write nothing, report `Skipped: repository not configured — defaults apply`, and finish. Defaults are a supported state |
| Markers malformed | Stop, show the line numbers, wait. Never rewrite a block you cannot delimit |

## 9) Closing

Report, in this order:

1. **Files written** — path + action (`created` / `updated` / `unchanged`), copied from the writer's output, plus every `questions` entry the script handed back.
2. **Skipped** — every question declined, every pointer omitted, every file left untouched.
3. **Next step** — one line: `node skills/stop-wishing/scripts/init-docs.js --lang <zh|en> --dir .` for the seven docs if they are missing, then `stop-wishing` for the requirement card. Setup configures where things live; it never decides what to build.

End with the mandatory sentence from `stop-wishing` §15:

```text
Skipped: <files not written and why>. Unverified: <probes that did not run>. Risk: <main residual risk>.
```
