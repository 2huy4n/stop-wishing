---
name: stop-wishing-setup
description: >-
  Configure one repository for this skill family: probe what is already there, settle where issues, labels, domain docs and the AGENTS.md pointer block live, then write only the files this skill owns. Use on a repo's first run, or when the repo conventions change. 中文触发词：stop-wishing-setup、初始化仓库、配置项目、仓库约定、setup。
user-invocable: true
---

# stop-wishing-setup — configure the repo once
Read-only until the user answers. Writes three small files and one marked block, nothing else.

## When to use

- A repository is using this skill family for the first time.
- Repo conventions changed: issues moved, labels renamed, glossary relocated, a second package appeared.

Do not use it for requirements (`stop-wishing`), code review/audit (`stop-wishing-review` / `stop-wishing-audit`), the debt ledger (`stop-wishing-debt`), or the seven project docs (`init-docs.js`).

## Hard rules

- **One writer per file**: `init-docs.js` owns the seven docs; this skill owns `docs/agents/*` and the marked `AGENTS.md` block; never edit outside the markers.
- **Never create `AGENTS.md` or `CLAUDE.md`.** Neither exists → point to `init-docs.js --agents-md` and skip Q4.
- **The script is the writer.** Do not hand-edit `docs/agents/*` while `setup.js` exists.
- Only the marked bytes change; re-running replaces, never appends.
- `--labels none` writes no triage file and never deletes an existing one.

## Workflow

1. Probe and report: read `SETUP.md` for the probe table, then ask Q1–Q4 one at a time.
2. Run the writer; paste its raw output, including every `questions` entry.
3. Read `FILES.md` for ownership, exact file shapes and the pointer block.
4. Read `SAFETY.md` before a re-run, when markers look wrong, or when a probe fails.
5. Close in the order in `SETUP.md`: files written, skipped, next step.

## Questions at a glance

| Q | Default |
|---|---|
| Q1 where issues live | local markdown in `docs/issues/` |
| Q2 define labels | yes, five default roles |
| Q3 domain layout | single-context |
| Q4 pointer block | yes, if `AGENTS.md` or `CLAUDE.md` exists |

If the user says "whatever you think", take these defaults and list each as an assumption in `Skipped:`.

## Command

```bash
node skills/stop-wishing/scripts/setup.js --dir . [--issue-tracker local|github|other] [--labels default|none] [--layout single|multi] [--agents-md] [--dry-run] [--json]
```

Exit 0 success / 1 bad arguments / 2 IO error.

## Read on demand

| File | Read when |
|---|---|
| `SETUP.md` | probes, the four questions, writer invocation, closing report |
| `FILES.md` | ownership, file templates, pointer block |
| `SAFETY.md` | reruns, malformed markers, degraded environments |
| `CONSUMERS.md` | explaining which skill reads which config |
