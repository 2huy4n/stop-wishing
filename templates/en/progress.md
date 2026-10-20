# Progress and environment snapshot (progress)

> Last updated: YYYY-MM-DDTHH:mm±HH:MM (ISO 8601 with the local UTC offset)
> Rule: timestamps live only in this file and in file-header change blocks; they must carry the machine's own offset (e.g. `2026-10-20T18:50+08:00`), never a hardcoded `+08:00`.

## File-header change block (sample — copy it to the top of a source file)

```text
// 2026-10-20T18:50+08:00 · change: timeout 30s -> 10s; why: endpoint P99 is 800ms; rollback: git checkout pre-timeout-20261020-1850
```

> All three parts are required: time (ISO 8601 + local offset) · what changed and why · how to roll back. Keep only the newest block per file; older ones go to the timeline below.

## Environment snapshot

> Written by `scripts/init-docs.js` right after the H1 (update it by hand when the machine or runtime changes).

- node:
- git:
- bash:
- platform:
- Suggested backup: git-tag or `.bak-YYYYMMDD-HHmm`

## Timeline (newest at the bottom)

### YYYY-MM-DDTHH:mm±HH:MM · <one line: what this round did>

- Changed:
- Why:
- Evidence (commands + raw output summary):
- Backup point (tag / .bak file):
- Next:

## Search log

| Time | Keywords | Where | Conclusion | License |
|---|---|---|---|---|
|  |  |  |  |  |

## Traps (do not repeat)

- (symptom → cause → how to avoid next time)
