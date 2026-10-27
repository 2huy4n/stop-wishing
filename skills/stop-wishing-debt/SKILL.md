---
name: stop-wishing-debt
description: >-
  Build a debt ledger from `shortcut:` comments (legacy `ponytail:`), listing what was simplified, its ceiling and the trigger that should force an upgrade. Use when planning cleanup or checking how much deferred work a repo carries. 中文触发词：stop-wishing-debt、技术债、债务台账、shortcut 注释、ponytail 注释。
user-invocable: true
---

# stop-wishing-debt — debt ledger

Read-only. **Do not modify code.**

## 1) Scan

Run exactly:

```bash
git grep --no-index --exclude-standard -nE '(#|//|/[*]) ?(shortcut|ponytail):'
```

This covers `#`, `//` and `/*` comments in tracked, non-ignored files. If the repo is not a git repository, run the same regex with `rg` and say so in the output.

**Naming:** if `docs/agents/domain.md` exists, use its glossary terms and module boundaries when describing each item; otherwise fall back to `GLOSSARY.md` / `docs/adr/` when they exist. The file never changes what the grep finds.

**Skip non-deferral notes.** A comment such as "keyboard shortcut: Ctrl+K" is not debt. Only keep markers that describe a simplification, a shortcut taken, or a known limit.

## 2) Parse each marker

A good marker contains:

- **What was simplified** — the cheap version that shipped.
- **Ceiling** — the limit it is safe up to (rows, requests/sec, users, size, time).
- **Upgrade** — the trigger that forces the real implementation.

## 3) Output

One line per marker:

```text
<file>:<line>, <what was simplified>. ceiling: <limit>. upgrade: <trigger>.
```

- If no ceiling is stated, write `ceiling: unknown`.
- If no upgrade path is stated, write `upgrade: no-trigger`.
- Preserve file and line exactly; sort by file, then line.

End with exactly:

```text
<N> markers, <M> with no trigger.
```

## 4) Closing

End with: `Skipped: <what was not scanned>. Unverified: <what was not checked>. Risk: <main residual risk>.`
