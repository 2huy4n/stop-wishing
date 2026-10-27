---
name: stop-wishing-setup
description: >-
  Configure one repository for this skill family: probe what is already there, settle where issues, labels, domain docs and the AGENTS.md pointer block live, then write only the files this skill owns. Use on a repo's first run, or when the repo conventions change. 中文触发词：stop-wishing-setup、初始化仓库、配置项目、仓库约定、setup。
user-invocable: true
---

# stop-wishing-setup — configure the repo once
Read-only until the user answers. Writes three small files and updates one marked block, nothing else.

## When to use

- A repository is using this skill family for the first time.
- Repo conventions changed: issues moved, labels renamed, glossary relocated, a second package appeared.

Do not use it for requirements (`stop-wishing`), writing/reviewing/auditing code, the debt ledger (`stop-wishing-debt`), or the seven project docs (`init-docs.js`).

## Hard rules

- **Ownership**: `init-docs.js` creates the seven docs and the initial `## Project docs` block; this skill owns the three `docs/agents/*.md` files and updates that same block. Never write the seven docs or edit outside the markers.
- **Never create `AGENTS.md` or `CLAUDE.md`.** Neither exists → point to `init-docs.js --agents-md` and skip Q4; both exist → ask, then pass `--agents-file`.
- **The script is the writer.** If it is unavailable, follow `FILES.md` exactly and say you did so.
- Only marked bytes change; re-running updates in place, never appends a second block. Preserve an existing richer pointer block and report any omitted pointers.
- `--labels none` writes no triage file and never deletes an existing one.

## Workflow

1. Read `SETUP.md`; if there is no git or the user may decline everything, read `SAFETY.md` before any write.
2. Probe, report, then ask Q1–Q4 one at a time.
3. Run the writer; paste its raw output, including every `questions` and `notes` entry.
4. Read `FILES.md` for ownership, exact file shapes and marker rules.
5. Close as `SETUP.md` says: files written, skipped, next step, then `Skipped / Unverified / Risk`.

## Questions at a glance

| Q | Default |
|---|---|
| Q1 where issues live | local markdown in `docs/issues/` |
| Q2 define labels | yes, five default roles; keep existing right column |
| Q3 domain layout | single-context; use `--layout multi --contexts` when real |
| Q4 pointer block | yes; if both files exist, choose one with `--agents-md --agents-file AGENTS|CLAUDE` |

## Command

```bash
node "<skill-base>/../stop-wishing/scripts/setup.js" --dir . [--issue-tracker local|github|other] [--issue-tracker-detail <text>] [--labels default|none] [--layout single|multi] [--glossary <path>] [--contexts <text>] [--agents-md] [--agents-file AGENTS|CLAUDE] [--dry-run] [--json]
```

`<skill-base>` is the directory containing this `SKILL.md`; resolve it first, never against the target repo. Init-docs uses the same base. Exit 0 success / 1 bad arguments or marker conflict / 2 IO error.

## Read on demand

| File | Read when |
|---|---|
| `SETUP.md` | probes, Q1–Q4, writer invocation, closing report |
| `FILES.md` | ownership, file templates, marker rules |
| `SAFETY.md` | no git, decline-all, reruns, malformed markers |
| `CONSUMERS.md` | which skill reads which config |
