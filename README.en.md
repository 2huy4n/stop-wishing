# stop-wishing

[中文](README.md) | **English**

[![test](https://github.com/2huy4n/stop-wishing/actions/workflows/test.yml/badge.svg)](https://github.com/2huy4n/stop-wishing/actions/workflows/test.yml)

A skill family against **wishing-driven programming**: the user gives one vague sentence, the AI invents the goal, the boundary and the acceptance criteria, ships code that "looks right", and the first real question forces a rewrite.

The rule is simple: **align first, explain before writing, back up before changing, then make the smallest complete change.**

The repo ships **eight side-by-side skills**: one main skill for taking a request from vague to delivered, and seven satellites for reviewing one change, auditing a whole repo, keeping a debt ledger, writing a spec, splitting it into ordered tickets, configuring a repo, and rendering a report.

| Skill | What it does | When to use it |
|---|---|---|
| [`stop-wishing`](skills/stop-wishing/SKILL.md) | Main skill: clarification, requirement card, license gate, backup, minimal diff, evidence-based report | A vague request, someone else's repo, adding a dependency/font/icon/API |
| [`stop-wishing-review`](skills/stop-wishing-review/SKILL.md) | Review one change (diff / branch / PR) on two axes: **Intent** (did it build the right thing) and **Engineering** (will it break — six dimensions plus 12 code smells) | Before merging, before shipping, "look at this diff" |
| [`stop-wishing-audit`](skills/stop-wishing-audit/SKILL.md) | Audit a whole repo: architecture, flows, risk — at most 20 findings | Taking over an unfamiliar project, a health check |
| [`stop-wishing-debt`](skills/stop-wishing-debt/SKILL.md) | Build a debt ledger from `shortcut:` comments | Planning cleanup, estimating how much was deferred |
| [`stop-wishing-spec`](skills/stop-wishing-spec/SKILL.md) | Turn a confirmed requirement card into a spec with acceptance criteria, and keep `card_sha256` in sync with `docs/project.md` | The requirements are settled and need to become a document |
| [`stop-wishing-tickets`](skills/stop-wishing-tickets/SKILL.md) | Split a spec into tracer-bullet tickets with `blocked_by` edges (a DAG) and status | The spec is bigger than one session and needs ordering |
| [`stop-wishing-setup`](skills/stop-wishing-setup/SKILL.md) | Configure a repo: where issues live (local/GitHub/other), domain terms and ADRs, the five triage labels; optionally maintain the `## Project docs` block in `AGENTS.md` | A new repo, or the conventions changed |
| [`stop-wishing-report`](skills/stop-wishing-report/SKILL.md) | Render one verified `report.json` into standalone HTML; `hacker_mode` in the project's `report.conf` selects the compact developer report or the hacker theme | Delivery hand-off, prototype confirmation, a printable page or a six-screen demo |

Skill bodies are in English; `description` is bilingual so Chinese trigger words still work. The original Chinese body survives only as a local backup and is **not committed** (`*.bak-*` is ignored); see commit `e428327` if you need it.

## Install

The installer copies **all eight skills** into a target skills root:

```bash
# See what would be copied (writes nothing)
node install.js --dry-run

# Install into the user-level skills directory:
# ~/.agents/skills/{stop-wishing,stop-wishing-review,stop-wishing-audit,stop-wishing-debt,stop-wishing-spec,stop-wishing-tickets,stop-wishing-setup,stop-wishing-report}
node install.js --tool dsh --verify

# Also install for Claude Code: ~/.claude/skills/<eight skills>
node install.js --tool claude --verify

# Custom skills root
node install.js --dest /path/to/skills --verify

# Add --force only when the target exists and you really want to overwrite it
node install.js --force
```

`--verify` checks every skill: `SKILL.md` exists, front-matter `name` matches the directory, and the file hash matches the source; the main skill additionally checks the seven scripts, five reference files, both template sets (8 each: seven docs plus `AGENTS.md.tpl`) and `LICENSE`.

`--force` upgrades also prune files listed by the previous install manifest (`.install-manifest.json`) that the new version no longer ships (for example the old `scripts/build-portable.js`); files outside that manifest are left untouched.

Editor-specific notes live in [`adapters/`](adapters/): `claude-code/README.md`, `codex/AGENTS.md`, `trae/README.md`.

## Project docs and AGENTS.md (optional)

`init-docs.js` writes seven project docs into `<project>/docs/` by default. With `--agents-md` it **also** writes a repo-root `AGENTS.md` containing only 5–10 lines of pointers, so any agent working in the repo reads the docs first:

```bash
node skills/stop-wishing/scripts/init-docs.js --lang en --dir <project> --agents-md
```

Rules:

- **Off by default**: add the flag only after the user explicitly agrees;
- **Never overwrites** an existing `AGENTS.md` or `CLAUDE.md`; it reports "not generated" instead;
- Pointers only — never paste the documents in. It sits in every future conversation, and bulk costs tokens.

The skill also asks once during its opening questions: "Do you want an `AGENTS.md` pointing at these docs?" Anything short of an explicit yes means no.

## Multi-tool metadata and versioning

- Every skill ships `agents/openai.yaml` (`display_name` / `short_description`); `stop-wishing-setup` also sets `allow_implicit_invocation: false`, because it should only run when the user asks for it.
- Versions live in `VERSION` and `CHANGELOG.md`. The number is deliberately not duplicated inside `SKILL.md`, so editing docs never means syncing a version in several places.
- Re-installing over an existing target no longer just says "already exists": it lists which files are **missing** or **outdated**, and says so when everything already matches.

## For AI agents: install it when the user cannot

If the user does not know how to install a skill, follow these steps:

1. **Preflight**: `node --version` must be **≥ 18**. Confirm you can write to the target directory; if not, go to step 6 and hand the user a command instead of forcing it.
2. **Get the files**: `git clone <this repo>`, or extract the archive into a temp directory, then `cd` into it (you should see `skills/`).
3. **Pick the target** (ask the user which tool they use):

   | Tool | Skills root |
   |---|---|
   | DSH / Codex / TRAE | `~/.agents/skills/` |
   | Claude Code | `~/.claude/skills/` |
   | **Unknown** | **Ask the user "which tool do you use?"** — do not guess |

   If you cannot ask (unattended run), infer from the environment (DSH → `~/.agents/skills`) and state "**I assumed you use X**" in your final report. When still unsure, prefer `~/.agents/skills` (shared by DSH/Codex/TRAE).

4. **Install** (`--verify` runs a per-skill self-check and prints PASS/WARN/FAIL):

   ```bash
   node install.js --tool dsh    --verify   # DSH / Codex / TRAE
   node install.js --tool claude --verify   # Claude Code
   ```

   Flags: `--tool` / `--dest` / `--verify` / `--dry-run` / `--force` / `--target`.

   - `--dest <skills root>`: used directly as the skills root; seven skill directories are created inside it.
   - `--target <base>`: legacy-compatible; installs the eight skills under `<base>/stop-wishing{,-review,-audit,-debt,-spec,-tickets,-setup,-report}`.

   Exit codes: 0 success or dry-run / 1 bad arguments or overwrite conflict / 2 missing source files / 3 missing or mismatched files / 4 outdated files (add `--force`).

5. **Verify**: the skills root must contain `stop-wishing/`, `stop-wishing-review/`, `stop-wishing-audit/`, `stop-wishing-debt/`, `stop-wishing-spec/`, `stop-wishing-tickets/` and `stop-wishing-setup/`, each with a `SKILL.md`; the main skill also has `scripts/` (7), five reference files, `templates/zh` and `templates/en` (8 each: seven docs plus `AGENTS.md.tpl`), `assets/vibe-coding-glossary.html`, `assets/en.json` and `LICENSE`. Only a fully PASSing `--verify` counts as installed.

   **Term questions work right after install**: when the user asks what "MVP" means, look in `<skills root>/stop-wishing/assets/vibe-coding-glossary.html` for `zh:'<term>'` or `en:'<term>'`, explain with that entry's `d`/`de`, give the analogy from `a`/`ae`, and add the `#term-<slug>` deep link (slug = English name lowercased, non-alphanumerics turned into `-`). Only search the web when the local glossary has no entry. Do not open a browser window automatically, and never paste the whole glossary.
6. **If writing is denied** (sandbox or permissions): do not retry in a loop. Tell the user it needs one manual command and give a copy-paste one:

   ```bash
   # macOS / Linux
   mkdir -p ~/.agents/skills
   cp -R skills/stop-wishing         ~/.agents/skills/stop-wishing
   cp -R skills/stop-wishing-review  ~/.agents/skills/stop-wishing-review
   cp -R skills/stop-wishing-audit   ~/.agents/skills/stop-wishing-audit
   cp -R skills/stop-wishing-debt    ~/.agents/skills/stop-wishing-debt
   cp -R skills/stop-wishing-spec    ~/.agents/skills/stop-wishing-spec
   cp -R skills/stop-wishing-tickets ~/.agents/skills/stop-wishing-tickets
   cp -R skills/stop-wishing-setup   ~/.agents/skills/stop-wishing-setup

   # Windows PowerShell
   New-Item -ItemType Directory -Force "$env:USERPROFILE\.agents\skills" | Out-Null
   Copy-Item skills\stop-wishing* "$env:USERPROFILE\.agents\skills\" -Recurse
   ```

7. **Tell the user how to trigger it**: `/stop-wishing`, or "use the stop-wishing workflow". Review / audit / debt / spec / tickets / setup are `/stop-wishing-review`, `/stop-wishing-audit`, `/stop-wishing-debt`, `/stop-wishing-spec`, `/stop-wishing-tickets`, `/stop-wishing-setup`.

## Scripts (zero third-party dependencies)

| Script | Purpose | Exit codes |
|---|---|---|
| `skills/stop-wishing/scripts/check-env.js` | Probe git/bash/node and whether this is a git repo; print JSON plus backup advice | 0 ready / 1 missing something critical |
| `skills/stop-wishing/scripts/init-docs.js` | Generate seven project docs from `templates/<lang>/` (including `LICENSES.md` and a progress snapshot) | 0 ok / 1 bad arguments or already exists / 2 missing template |
| `skills/stop-wishing/scripts/check-hardcode.js` | Scan for absolute paths, secrets, URLs, ports, magic numbers (honours `.hardcodeignore`) | 0 clean or fully suppressed / 2 unsuppressed hits or invalid ignore file |
| `skills/stop-wishing/scripts/check-licenses.js` | Scan `package-lock.json` (`lockfileVersion` ≥ 2, transitive and nested packages included) plus `node_modules` (fills in licence fields), parse SPDX (`OR`/`AND`/`WITH`) and apply the use matrix in `LICENSE.md`; flags `--use self\|free-closed\|open-source\|commercial`, `--prod-only`, `--strict`, `--json`, `--rows` | 0 no forbidden licences (`warn`/`unknown` warnings allowed) / 1 a forbidden licence or `unknown` under `--strict` / 2 bad arguments or IO |
| `skills/stop-wishing/scripts/check-tickets.js` | Validate `docs/tickets/*.md` against `docs/specs/` and `docs/project.md`: errors E1–E13, warnings W1–W5 | 0 no errors (warnings allowed) / 1 errors / 2 usage or IO |
| `skills/stop-wishing/scripts/setup.js` | Create/update `docs/agents/{issue-tracker,domain,triage-labels}.md` (marked blocks only, idempotent; `--issue-tracker local` points at `docs/issues/`, separate from the work-breakdown directory `docs/tickets/`); optionally maintain the `## Project docs` block of an existing `AGENTS.md`/`CLAUDE.md` (**never creates them**) | 0 ok (including unchanged) / 1 bad arguments / 2 IO |
| `skills/stop-wishing/scripts/preflight.js` | Run environment, hardcoding and dependency-licence checks in one pass (licence scan is marked skipped when there is no lockfile/node_modules) | 0 clean / 1 blocking / 2 bad arguments or IO |

`check-tickets.js` checks: E1 unparsable front-matter, E2 missing required fields (id/title/spec/status/acceptance/verify), E3 file name, E4 id vs file-name prefix, E5 duplicate id, E6 status, E7 spec does not exist, E8 `blocked_by` points at a non-existent ticket, E9 self-dependency, E10 cycle, E11 empty acceptance, E12 empty verify or fewer verifies than acceptances, E13 a done/dropped ticket is still a dependency. Warnings: W1 missing estimate, W2 more than five acceptance items, W3 every verify is non-executable, W4 `card_sha256` disagrees with `docs/project.md`, W5 a spec is referenced by no ticket.

```bash
node skills/stop-wishing/scripts/check-tickets.js --dir <project> [--json]
# 0 = no errors (warnings do not change the exit code); 1 = errors; 2 = usage or IO

node skills/stop-wishing/scripts/setup.js --dir <project> \
  [--issue-tracker local|github|other] [--labels default|none] [--layout single|multi] \
  [--agents-md] [--dry-run] [--json]
# 0 = ok (including unchanged); 1 = bad arguments; 2 = IO
```

## Bonus: Vibe Coding glossary

[`skills/stop-wishing/assets/vibe-coding-glossary.html`](skills/stop-wishing/assets/vibe-coding-glossary.html) is a **147-term** glossary written for non-programmers: 9 categories, 10 commonly confused pairs, 5 pitfalls, a "search by situation" entry (change a page / install dependencies / deploy / something broke), and every term marked **must-know** or **advanced**. Each entry pairs the Chinese explanation with its **English translation**, for both the definition and the analogy. Search works over Chinese, English and error codes.

It **ships with the skill** at `<skills root>/stop-wishing/assets/`, so it works offline and always matches the installed version; you can also open it straight from the repo. After install, the AI checks this local glossary first when a term comes up (see step 5 above).

## License

This repository is released under **AGPL-3.0-or-later**; the full text is in [`LICENSE`](LICENSE).

- You may use, modify and redistribute it under the AGPL terms;
- A modified distribution must keep the same license and copyright notices; if you offer it to others as a network service, AGPL section 13 requires you to offer the corresponding source;
- The main skill additionally **requires the user to pass a license gate before introducing anything external** (code dependencies, fonts, icons/images, third-party API terms, template snippets) and to record the conclusion in `docs/LICENSES.md`.
- When the repo already has `node_modules/` or `package-lock.json`, run `node skills/stop-wishing/scripts/check-licenses.js --use <self|free-closed|open-source|commercial>`: it reads `package-lock.json` first (transitive and nested dependencies included), applies the §7 use matrix, and exits 0 when nothing is forbidden, 1 for a forbidden licence or `unknown` under `--strict`, 2 on bad arguments or IO. `forbidden` blocks the change, `warn` is recorded and confirmed by a human, `unknown` goes into `docs/LICENSES.md` marked unverified; the scanner reads package metadata only, so custom and commercial terms still need a human.

## Credits

Parts of `stop-wishing` are adapted from **ponytail** (MIT, Copyright (c) 2026 DietrichGebert). The full MIT text and attribution are in [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).
