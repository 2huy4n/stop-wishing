# Changelog

All notable changes to the stop-wishing skill family.
Version numbers follow `MAJOR.MINOR.PATCH`: breaking workflow change / new skill or capability / fix.

## 0.8.0 — 2026-10-27

- **Main skill rewritten as a 55-line router**: judgement stays inline (licence use question, hard rules, evidence, failure limit); details move to `CARD.md`, `EVIDENCE.md`, `LICENSE.md`, `DECISIONS.md` and `GLOSSARY.md`, with an explicit "read only when needed" routing table. The line cap is enforced by a test.
- **New `preflight.js`**: environment + hardcoding + dependency licence in one pass; exit 0 clear / 1 blocking / 2 bad input or IO. A repo with no `package-lock.json` or `node_modules` reports the licence scan as skipped, not as a failure.
- **No single-file portable build**: `portable/stop-wishing.md`, `build-portable.js` and its tests are removed (Matt-style sibling references; the owner chose this over a generated bundle). Installers copy the whole skill directory, now including the five reference files.
- **Install verification** checks the five references; the script count stays seven (`preflight` replaces `build-portable`).
- **Tests**: line cap (≤60), reference existence and key content, preflight exit semantics; 152 tests on Node 18 and 24.

- **Known debt — mechanical scope fence**: prose forbids scope creep, but nothing checks the diff mechanically. The deferred upgrade is `check-scope.js`: take `--allow <paths>` (recorded on the card as `Touched:`), run `git diff --name-only`, and exit 1 on out-of-scope files, new files or a new dependency. Trigger: two changes where unrelated files slipped into the diff. Deferred by the owner on 2026-10-26; do not build it before the trigger.

## 0.7.0 — 2026-10-26

- **License scanner**: `skills/stop-wishing/scripts/check-licenses.js` reads `package-lock.json` (`lockfileVersion` ≥ 2) for the complete dependency set — transitive and nested packages included — and uses `node_modules` only to fill in missing licence fields. It parses SPDX expressions (`OR`, `AND`, `WITH`) and applies the §7 use matrix; flags are `--use` (defaults to `commercial`), `--dir`, `--prod-only`, `--strict`, `--json`, `--rows` (the five `docs/LICENSES.md` columns). Exit 0 = nothing forbidden, 1 = a forbidden licence or `unknown` under `--strict`, 2 = bad arguments or no input. In `open-source` mode a dependency stricter than the project's own licence is a `warn` (`dependency-stronger-than-project`) rather than a silent pass.
- **The matrix grew rows**: `MPL-2.0 / EPL-2.0 / EUPL-1.2` (file-level copyleft: ⚠️ for free closed distribution and commercial, never a blanket refusal), `SSPL-1.0 / BUSL-1.1`, `CC-BY-NC-*` and `UNLICENSED` (self-use only), and GPL linking exceptions such as `GPL-2.0 WITH Classpath-exception-2.0` (commercially linkable, confirmed by a human instead of refused as plain GPL). `SKILL.md`, the scanner and `test/check-licenses.test.mjs` are kept in parity, and the note under the table says changing one means changing all three.
- **`SKILL.md` §7** now says when to run the scanner (a repo with `node_modules` or a lockfile), that `--use` must match the use recorded in Assumptions, how `forbidden` / `warn` / `unknown` are handled, that dev dependencies count by default and `--prod-only` is for preparing a distribution, and that the scanner reads metadata — never licence clauses — so custom and commercial terms still need a human.
- **README / README.en**: a `check-licenses.js` row in the script table plus one usage line in the licence section.
- **Installer**: `--verify` now counts seven scripts (including `check-licenses.js`) and both template sets as eight files each, so a missing scanner or `AGENTS.md.tpl` fails instead of shipping silently.
- **Tests and CI**: `test/check-licenses.test.mjs` covers the MIT pass, GPL/AGPL refusal under `commercial`, the `self` allowance, `OR` pass, `AND` refusal, a missing licence as `unknown`, `--strict`, the `package-lock.json` path and exit 2 on missing input; the existing `node --test` workflow runs it on Node 18/20/22 without a new job.

## 0.6.1 — 2026-10-25

- **Install check counted the wrong number of templates**: `templates/zh` and `templates/en` each hold eight files (seven docs plus `AGENTS.md.tpl`), but `--verify` and the README said seven. Both now check and document all eight, so a missing or stale `AGENTS.md.tpl` is caught instead of silently shipped.

## 0.6.0 — 2026-10-25

- **Bundled glossary**: `assets/vibe-coding-glossary.html` and `assets/en.json` now live inside `stop-wishing`, so `install.js` copies them and `--verify` checks their hashes. New `SKILL.md` §18 tells the agent to look up `zh:'<term>'` / `en:'<term>'` locally, answer from that entry, hand over the `#term-<slug>` deep link, and fall back to web search only when the entry is missing.
- **README**: the install steps and the bonus section now describe the glossary as installed (not downloaded), and explain the local-first lookup.

## 0.5.1 — 2026-10-25

- **Glossary links and printing**: every term now has a stable `#term-<slug>` anchor (147 unique, shareable), and a print stylesheet drops the search bar, scene chips and anchor marks, switches to one column and keeps cards from breaking across pages.
- **Installer shows its version**: `node install.js --verify` prints `版本: <VERSION>` on both the success and the failure path, so a self-check result names the release it applies to.

## 0.5.0 — 2026-10-25

- **Bilingual glossary**: `glossary/vibe-coding-glossary.html` — 147 terms, 9 categories, 10 confusion pairs, 5 pitfalls, search-by-situation (change a page / install dependencies / deploy / something broke), must-know and advanced marks, and Chinese plus English for every definition and analogy. `glossary/en.json` is the translation source of truth.
- **CI**: GitHub Actions runs the test suite and a fresh `install --verify` on Node 18/20/22 × Ubuntu/Windows, plus a macOS runner on Node 22; badge in both READMEs. Root and main-skill `package.json` declare `"type": "module"`, because Node 18 does not sniff ESM the way 20+ does.
- **Review reads specs**: the Intent axis now looks in `docs/specs/*.md` first and checks `card_sha256` drift, marking its findings provisional when the card changed or the spec is still `draft`.
- **Docs**: English README (`README.en.md`), the directory tree removed from the Chinese README, and a `## Credits` section.
- **Polish**: the API entry carries the must-know mark, English lines declare `lang="en"` for screen readers, setup names `stop-wishing-debt` in full, and `init-docs` validates every template before writing anything.

## 0.4.0 — 2026-10-23

- **New skill `stop-wishing-setup`**: one-time repo configuration. Probes git, remote, `gh`, `docs/`, `AGENTS.md`/`CLAUDE.md`; asks four questions with recommendations; writes only `docs/agents/{issue-tracker,domain,triage-labels}.md` and the marked `## Project docs` block in an existing `AGENTS.md`/`CLAUDE.md`. Never creates those files, never touches the seven project docs, never deletes an existing `triage-labels.md`.
- **New skill `stop-wishing-spec`**: turns the confirmed requirement card plus the conversation into `docs/specs/<date>-<slug>.md`, with `card_sha256` so a stale spec is detectable. No new interview.
- **New skill `stop-wishing-tickets`**: splits a spec into tracer-bullet tickets with `blocked_by` edges, 4-digit ids and a DAG rule; `check-tickets.js` validates 13 error classes and 5 warnings.
- **`stop-wishing-review` is now two-axis**: Intent (did it build what the spec asked) and Engineering (six dimensions plus a 12-item code-smell baseline). Two sub-agents in parallel, sequential fallback; findings are never reranked across axes.
- **`init-docs.js --agents-md`**: opt-in repo-root `AGENTS.md` pointer file, only after the user agrees; never overwrites an existing `AGENTS.md`/`CLAUDE.md`.
- Installer: installs seven skills, six scripts, per-skill licence and third-party notices; `--verify` also checks `agents/openai.yaml`; an existing target now reports which files are missing or outdated instead of a bare refusal.

## 0.3.0 — 2026-10-23

- Split the single skill into four: `stop-wishing`, `stop-wishing-review`, `stop-wishing-audit`, `stop-wishing-debt`.
- English bodies with bilingual descriptions; original Chinese text kept only in local backup.
- Absorbed ponytail's strictness levels, closing line and never-cut list (MIT, see `THIRD-PARTY-NOTICES.md`).

## 0.2.0 — 2026-10-21

- Portable build (`portable/stop-wishing.md`), hardcoding scanner, environment probe and doc scaffolding.

## 0.1.0 — 2026-10-20

- First release: requirement card, ambiguity tiers, license gate, nine-step work loop, hard constraints.
