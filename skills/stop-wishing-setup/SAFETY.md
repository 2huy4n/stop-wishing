# Safety, reruns and failure

Read only on a re-run, when markers look wrong, or when a probe fails.

## Idempotency

- **Only the bytes between the two markers change.** Everything before `begin` and after `end` is preserved byte for byte.
- Re-running is a **replace**, never an append. The second run must not produce a second block.
- Compute the new block first, compare with the current one: **identical → do not write**, and say "already up to date".
- Markers present but malformed (one without the other, nested, duplicated) → stop and show the user both line numbers; do not guess which to keep.
- An existing pointer section **without** markers (an older `init-docs` wrote it) → do not append a second one: report it and ask the user to merge, or replace it by hand once. Two pointer blocks are worse than one.
- `--labels none` never deletes an existing `triage-labels.md`; say so instead of silently leaving a stale file, and omit the `Status mapping` pointer when the file is not being generated.
- **Two marker pairs, never mixed.** `<!-- stop-wishing-setup:begin -->` … `<!-- stop-wishing-setup:end -->` inside each `docs/agents/*.md`; `<!-- stop-wishing:project-docs:begin -->` … `<!-- stop-wishing:project-docs:end -->` inside `AGENTS.md` / `CLAUDE.md`. A block written under the wrong pair gets duplicated by the next run.
- The three `docs/agents/*.md` files keep their own head and tail: only the marked segment is replaced, so a repo may add notes above or below it and keep them.

## Failure and degradation

| Situation | What to do |
|---|---|
| No git | Continue. Say plainly: no history, no tag-based rollback — back up the files it writes (`*.bak-YYYYMMDD-HHmm`) before writing |
| No `gh` | GitHub Issues leaves the menu; the recommendation becomes local markdown |
| `docs/` already exists | Keep every existing file. Update only `docs/agents/*`; never regenerate the seven |
| `AGENTS.md` **and** `CLAUDE.md` both exist | Ask which one; write one; name the other in the report as untouched |
| Neither `AGENTS.md` nor `CLAUDE.md` | Do not create one. Point to `init-docs.js --agents-md`; skip Q4 |
| User declines all four | Write nothing, report `Skipped: repository not configured — defaults apply`, and finish. Defaults are a supported state |
| Markers malformed | Stop, show the line numbers, wait. Never rewrite a block you cannot delimit |
