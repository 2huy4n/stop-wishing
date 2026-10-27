# Setup workflow

Read only when the skill routes you here. This file holds the probe table, the four questions, the writer invocation, and the closing report.

## Detect first — report, then ask

Read-only. No network, no `gh auth`, no `git fetch`. Print the findings as a table **before** the first question; the answers depend on them.

| Probe | How | Why it matters |
|---|---|---|
| Git present? | `git rev-parse --is-inside-work-tree` | No git → issues and tickets still work as plain files; history does not |
| Remote on GitHub? | `git remote -v` | Only GitHub remotes make GitHub Issues a real option |
| `gh` available? | `gh --version` | Version only. Not logged-in → treat as unavailable |
| `docs/` | list it | Existing docs are respected, never regenerated |
| `docs/agents/` | list it | Existing config is updated in place, not duplicated |
| `AGENTS.md` / `CLAUDE.md` | existence, and whether the markers are already there | Decides Q4, and whether this is a re-run |

State it plainly: "git yes, remote is GitLab, `gh` not installed, `docs/` exists with four files, `AGENTS.md` exists without the markers." Then ask Q1.

## Four questions — one at a time, each with a recommendation

One question per turn, the recommendation first, the reason in one clause. Never a menu of five.

**Q1 — Where do issues live?**
Recommended: **local markdown files in the repo** — works offline, diffs in review, no account needed. `--issue-tracker local` puts them in `docs/issues/`, kept separate from the tracer-bullet tickets in `docs/tickets/` (an issue is an incoming report; a ticket is our own planned slice of work).

Alternatives: GitHub Issues (*only* when the remote is GitHub **and** `gh` answered); anything else → `--issue-tracker other`, and the script hands back the question it cannot answer — take the user's description verbatim into `issue-tracker.md`.

**Q2 — Define the label vocabulary now?**
Recommended: **yes, the five default roles** in `FILES.md`. Skipping is allowed: no `triage-labels.md` is written and every skill falls back to the default role names.

**Q3 — Domain docs layout?**
Recommended: **single-context** — one `GLOSSARY.md` at the root plus `docs/adr/`. Pick **multi-context** only when the repo really holds several deployable parts, each with its own vocabulary.

**Q4 — Add the `## Project docs` pointer block?**
Recommended: **yes**.
- Exactly one of `AGENTS.md` / `CLAUDE.md` exists → offer that one.
- Both exist → ask which one, and say why: two copies drift, and the agent reads one of them at random. **Never write both.**
- Neither exists → this skill creates nothing; point to `init-docs.js --agents-md` and continue.

**All answers "whatever you think"** → take every recommendation, list each one in the closing `Skipped:` line as an assumption, and say they can be changed later by re-running this skill.

## Run the writer

```bash
node skills/stop-wishing/scripts/setup.js --dir . [--issue-tracker local|github|other] [--labels default|none] [--layout single|multi] [--agents-md] [--dry-run] [--json]
```

- Exit `0` = success (including "nothing changed") / `1` = bad arguments / `2` = IO error. Paste the raw output.
- `--dry-run` first when the repo already has `docs/agents/` files: it reports created / updated / unchanged without writing.
- `--json` gives `{files, agentsMd, questions}` — `questions` is the script telling you which of your answers it cannot act on; every entry there goes to the user, unanswered by you.
- **The script is the writer.** Do not hand-edit `docs/agents/*` while it exists. If it is missing from the repo, write the files exactly as `FILES.md` shows and say so in the report.

## Closing

Report, in this order:

1. **Files written** — path + action (`created` / `updated` / `unchanged`), copied from the writer's output, plus every `questions` entry the script handed back.
2. **Skipped** — every question declined, every pointer omitted, every file left untouched.
3. **Next step** — one line: `node skills/stop-wishing/scripts/init-docs.js --lang <zh|en> --dir .` for the seven docs if they are missing, then `stop-wishing` for the requirement card. Setup configures where things live; it never decides what to build.

End with the mandatory sentence from `stop-wishing` §15:

```text
Skipped: <files not written and why>. Unverified: <probes that did not run>. Risk: <main residual risk>.
```
