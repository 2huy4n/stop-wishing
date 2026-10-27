# Files this skill owns

Read only when writing or inspecting setup output. Two writers on one path is how documents start contradicting each other. The split is absolute, with one shared block: `init-docs.js` creates the `## Project docs` block, and this skill updates that same marked block.

## Ownership

| Path | Owner | This skill |
|---|---|---|
| `docs/project.md`, `content.md`, `structure.md`, `progress.md`, `todo.md`, `discipline.md`, `LICENSES.md` | `init-docs.js` | **Never writes, never edits** |
| `docs/agents/issue-tracker.md`, `domain.md`, `triage-labels.md` | **this skill** | writes |
| `AGENTS.md` / `CLAUDE.md` → the `## Project docs` block | `init-docs.js` creates it; **this skill updates the same marked block** | rewrites the block only |
| Every other part of `AGENTS.md` / `CLAUDE.md` | the user | never touched, byte for byte |

- **This skill never creates `AGENTS.md` or `CLAUDE.md`.** Neither exists → point to `init-docs.js --agents-md` and continue without it.
- `CLAUDE.md` is never created either. If it exists and the user picks it, pass `--agents-file CLAUDE`; only that file is touched.
- Three small files, not stubs: files not chosen by Q2/Q4 are absent. Do not create placeholder files.

## `docs/agents/issue-tracker.md`

```markdown
# Issue tracker

<!-- stop-wishing-setup:begin -->
- **Where:** <local issues: `docs/issues/` | GitHub Issues on <owner/repo> | the user's exact tool/field/path>
- **Create:** <how a new issue is opened>
- **Read:** <how an issue is read>
- **Status mapping:** see `docs/agents/triage-labels.md` (omit when labels = none)
- **Ticket status:** todo / doing / blocked / done
- **Managed by:** stop-wishing-setup; re-run instead of editing by hand
<!-- stop-wishing-setup:end -->
```

`Where` is about **incoming issues**, not tickets. Ticket files always live in `docs/tickets/`.

## `docs/agents/domain.md`

```markdown
# Domain docs

<!-- stop-wishing-setup:begin -->
- **Glossary:** `GLOSSARY.md` (or the path passed with `--glossary`)
- **ADR:** `docs/adr/NNNN-<slug>.md`, one decision per file
- **Layout:** single-context — source / tests / docs; new modules are registered here
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

Up to four pointers, no prose:

```markdown
<!-- stop-wishing:project-docs:begin -->
## Project docs

- `docs/project.md` — requirement card and boundary
- `docs/agents/issue-tracker.md` — issue location and read/write path
- `docs/agents/domain.md` — terms, ADR, layout
- `docs/tickets/` — tickets and dependency order
<!-- stop-wishing:project-docs:end -->
```

Only pointers whose targets exist (or are created by this run) are written. `omittedPointers` lists the rest; say so in the report. A pointer to a file that is not there is worse than no pointer.

An existing `init-docs` block may contain seven prose pointers. **Preserve it and append only missing bullets**; never replace the whole block. The same applies to user notes added around the block.

## Marker rules

Only the segment between `<!-- stop-wishing-setup:begin -->` and `<!-- stop-wishing-setup:end -->` inside each `docs/agents/*.md` changes; the `AGENTS.md` / `CLAUDE.md` block uses `<!-- stop-wishing:project-docs:begin/end -->`. See `SAFETY.md` for malformed/duplicate marker handling; never mix the two pairs.
