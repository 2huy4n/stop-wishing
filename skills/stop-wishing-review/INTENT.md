# Intent axis

Read this before forming Intent findings. The spec is the source of truth; never invent requirements.

## Find the spec, in this order

1. `docs/specs/*.md` — a spec written by `stop-wishing-spec` for this change. Match its slug or `title` against the branch name, the commit subjects and the files touched. If several match, take the newest and say which. Read its `status` and `card_sha256`.
2. `docs/project.md` — the requirement card (goal, scope, acceptance). The normal source when no spec exists.
3. Issue references in commit messages (`#123`, `Closes #45`, `!67`). If `docs/agents/issue-tracker.md` exists, use its `Where` / `Read` fields to resolve each reference before treating it as a path. Otherwise try `docs/issues/<n>.md` or a matching file under `docs/issues/`; if that is absent too, ask rather than guess.
4. A spec file or path the user names (`docs/`, `specs/`, `.scratch/`).
5. Ask the user. If they say there is no spec, **skip this axis** and write `Intent: no spec available — not reviewed`. Never invent requirements.

## Spec drift check

Recompute the card hash exactly as `stop-wishing-spec` defines it — read `docs/project.md` as UTF-8, drop every line matching `^>\s*最后更新：`, join the rest with `\n`, SHA-256 over the UTF-8 bytes, lowercase hex — and compare it with the spec's `card_sha256`. If they differ, write `Spec drift: card changed since the spec was written` and mark Intent findings **provisional**: the spec may describe an older requirement. A spec whose `status` is `draft` is provisional for the same reason. Report the fact; never silently pick one side, and never re-interview the user.

## Then check exactly three things

- **Missing or partial** — the spec asked for it, the diff does not deliver it (or only half). Quote the spec line.
- **Scope creep** — the diff adds behaviour, options or files nobody asked for. Name what and why it is extra.
- **Looks done, is wrong** — the feature exists but behaves differently from what the spec says (wrong default, wrong order, wrong recipient, wrong permission).

Every Intent finding must quote the spec line it is judged against. No spec line, no finding.
