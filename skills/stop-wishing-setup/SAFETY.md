# Safety, reruns and failure

Read only when there is no git, the user may decline everything, this is a re-run, or markers look wrong.

## Idempotency and markers

- **Only the bytes between the two markers change.** Everything before `begin` and after `end` is preserved byte for byte.
- Re-running is a **replace**, never an append. The second run must not produce a second block.
- Compute the new block first, compare with the current one: **identical → do not write**, and say "already up to date".
- Markers present but malformed (one without the other, nested, duplicated) → stop and show both line numbers; do not guess.
- An existing pointer section **without** markers (an older `init-docs` wrote it) → do not append a second one: report it and ask the user to merge, or replace it once by hand. Two pointer blocks are worse than one.
- An existing marker block with richer content (for example `init-docs`'s seven-doc prose) is **preserved and merged**, not replaced. Add only missing pointers, then report the preserved line count and any `omittedPointers`.
- The three `docs/agents/*.md` files keep their own head and tail: only the marked segment is replaced, so a repo may add notes above or below it and keep them.

## Do not write when

- **The user declines all four questions** → write nothing, report `Skipped: repository not configured — defaults apply`, and finish. Do not run the writer.
- **Neither `AGENTS.md` nor `CLAUDE.md` exists** and Q4 is the only remaining question → skip Q4; do not create either file.
- **Both exist and the user has not chosen** → stop and ask; do not let the script default to `AGENTS.md`.
- **No git** → before writing, back up every existing file the run can touch as `*.bak-YYYYMMDD-HHmm`; the script itself does not create backups. Report the backup paths.
- **Markers malformed** → stop, show line numbers, wait; never rewrite a block you cannot delimit.

## Failure and degradation

| Situation | What to do |
|---|---|
| No git | Continue after the backups above; say plainly that history and tag-based rollback are unavailable |
| No `gh` | GitHub Issues leaves the menu; the recommendation becomes local markdown |
| `docs/` already exists | Keep every existing file. Update only `docs/agents/*`; never regenerate the seven |
| `AGENTS.md` **and** `CLAUDE.md` both exist | Ask which one; pass `--agents-file`; name the other in the report as untouched |
| Neither `AGENTS.md` nor `CLAUDE.md` | Do not create one. Point to `init-docs.js --agents-md`; skip Q4 |
| `--issue-tracker other` without detail | Run with `--issue-tracker-detail` or take the script's question to the user; never hand-edit the file |
| `--layout multi` without contexts | Ask for package names, entry directories and boundaries; pass `--contexts` |
| `--labels none` | No triage file is written; an existing one is kept and named in `notes` |
| User declines all four | Write nothing; report `Skipped: repository not configured — defaults apply` |
| Markers malformed | Stop, show line numbers, wait. Never rewrite a block you cannot delimit |

Exit codes: `0` success (including unchanged) / `1` bad arguments or marker conflict / `2` IO error.
