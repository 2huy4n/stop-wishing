# Files this skill owns

Read only when writing or inspecting setup output. Two writers on one path is how documents start contradicting each other. The split is absolute, with one shared block: `init-docs.js` creates the `## Project docs` block, and this skill updates that same marked block. The field names and marker shape below are authoritative; `setup.js` generates the localized prose, so treat the examples as shape, not a word-for-word template.

## Ownership

| Path | Owner | This skill |
|---|---|---|
| `docs/project.md`, `content.md`, `structure.md`, `progress.md`, `todo.md`, `discipline.md`, `LICENSES.md` | `init-docs.js` | **Never writes, never edits** |
| `docs/agents/issue-tracker.md`, `domain.md`, `triage-labels.md` | **this skill** | writes |
| `AGENTS.md` / `CLAUDE.md` → the `## Project docs` block | `init-docs.js` creates it; **this skill updates the same marked block** | rewrites the block only |
| Every other part of `AGENTS.md` / `CLAUDE.md` | the user | never touched, byte for byte |

- **This skill never creates `AGENTS.md` or `CLAUDE.md`.** Neither exists → point to `init-docs.js --agents-md` and continue without it.
- `CLAUDE.md` is never created either. If it exists and the user picks it, pass `--agents-md --agents-file CLAUDE`; only that file is touched.
- Three small files, not stubs: files not chosen by Q2/Q4 are absent. Do not create placeholder files.

## `docs/agents/issue-tracker.md`

```markdown
# Issue tracker

<!-- stop-wishing-setup:begin -->
- **Tracker kind:** local (or github / other)
- **Where:** <local issues: `docs/issues/` | GitHub Issues on <owner/repo> | the user's exact tool/field/path>
- **Create:** <how a new issue is opened>
- **Read:** <how an issue is read>
- **Status mapping:** see `docs/agents/triage-labels.md`
- **Ticket status:** todo / doing / done / dropped
- **Managed by:** 由 stop-wishing-setup 管理（重跑会更新本段，段外可自由编辑）
<!-- stop-wishing-setup:end -->
```

Omit the `Status mapping` line when `--labels none`; a pointer to a file that is not there is worse than no pointer.

`Where` is about **incoming issues**, not tickets. Ticket files always live in `docs/tickets/`.

## `docs/agents/domain.md`

```markdown
# Domain docs

<!-- stop-wishing-setup:begin -->
- **Glossary:** `GLOSSARY.md`（首次登记术语时创建；or the path passed with `--glossary`）
- **ADR:** `docs/adr/NNNN-<slug>.md`, one decision per file
- **Layout:** single-context — 源码 / 测试 / 文档；new modules are registered here
<!-- stop-wishing-setup:end -->
```

For `--layout multi`, `Layout:` starts with `multi-context — ` and includes the `--contexts` text.

## `docs/agents/triage-labels.md` — only when Q2 said yes

```markdown
# Triage labels

<!-- stop-wishing-setup:begin -->
| 角色 | 标签 |
|---|---|
| needs-triage | `needs-triage` |
| ready | `ready` |
| blocked | `blocked` |
| in-progress | `in-progress` |
| done | `done` |
<!-- stop-wishing-setup:end -->
```

Left column is the role every skill speaks; right column is what the tracker actually uses. **Existing right-column labels are preserved on a re-run**; never rename a repo's labels from here.

## The `## Project docs` block

Up to four pointers, no prose. The two `docs/agents/` pointers always exist after setup; add the other two only when their targets exist:

```markdown
<!-- stop-wishing:project-docs:begin -->
## Project docs

- `docs/agents/issue-tracker.md` — issue location and read/write path
- `docs/agents/domain.md` — terms, ADR, layout
<!-- stop-wishing:project-docs:end -->
```

Only pointers whose targets exist (or are created by this run) are written. `docs/project.md` and `docs/tickets/` are added only when those paths exist; `omittedPointers` lists the rest, so say so in the report. A pointer to a file that is not there is worse than no pointer.

An existing `init-docs` block may contain seven prose pointers. **Preserve it and append only missing bullets**; never replace the whole block. The same applies to user notes added around the block.

## Marker rules

Only the segment between `<!-- stop-wishing-setup:begin -->` and `<!-- stop-wishing-setup:end -->` inside each `docs/agents/*.md` changes; the `AGENTS.md` / `CLAUDE.md` block uses `<!-- stop-wishing:project-docs:begin/end -->`. See `SAFETY.md` for malformed/duplicate marker handling; never mix the two pairs.
