# Files this skill owns

Read only when writing or inspecting setup output. Two writers on one path is how documents start contradicting each other; this split is absolute.

## One writer per file

| Path | Owner | This skill |
|---|---|---|
| `docs/project.md`, `content.md`, `structure.md`, `progress.md`, `todo.md`, `discipline.md`, `LICENSES.md` | `init-docs.js` | **Never writes, never edits** |
| `docs/agents/issue-tracker.md`, `domain.md`, `triage-labels.md` | **this skill** | writes |
| `AGENTS.md` → the `## Project docs` block between the markers | **this skill** | rewrites the block only |
| Every other part of `AGENTS.md` / `CLAUDE.md` | the user | never touched, byte for byte |

- **This skill never creates `AGENTS.md`.** No file → say "run `init-docs.js --agents-md` first, or skip the pointer block", and continue without it.
- `CLAUDE.md` is never created either. If it exists and the user picks it, the same marked block goes there — and only there.
- Three small files, each under ten lines. Files not chosen by Q2/Q4 are simply absent — never a stub.

## `docs/agents/issue-tracker.md`

```markdown
# Issue tracker

> Managed by stop-wishing-setup. Re-run the skill instead of editing by hand.

- **Where:** <local markdown: docs/issues/ | GitHub Issues on <owner/repo> | the user's words>
- **Create:** <file named `NNNN-slug.md`, or `gh issue create -t <title> -b <body>`>
- **Read:** <read the file at the path named by the issue reference, or `gh issue view <n> --json title,body`>
- **Status mapping:** see `docs/agents/triage-labels.md` (only when labels were written)
- **Managed by:** stop-wishing-setup; re-run the skill instead of editing by hand
```

Omit the `Status mapping` line when `--labels none` — a pointer to a file that is not there is worse than no pointer.

## `docs/agents/domain.md`

```markdown
# Domain docs

- **Glossary:** <GLOSSARY.md at the repo root, or the paths of one glossary per context>
- **ADR:** <docs/adr/, one file per decision, `NNNN-title.md`>
- **Layout:** <single-context | multi-context, and the context boundaries in one line>
```

## `docs/agents/triage-labels.md` — only when Q2 said yes

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

## The `## Project docs` block

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

## Two marker pairs, never mixed

`<!-- stop-wishing-setup:begin -->` … `<!-- stop-wishing-setup:end -->` live inside each `docs/agents/*.md`; `<!-- stop-wishing:project-docs:begin -->` … `<!-- stop-wishing:project-docs:end -->` live inside `AGENTS.md` / `CLAUDE.md`. A block written under the wrong pair gets duplicated by the next run.

The three `docs/agents/*.md` files keep their own head and tail: only the marked segment is replaced, so a repo may add notes above or below it and keep them.
