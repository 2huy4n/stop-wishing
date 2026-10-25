# Changelog

All notable changes to the stop-wishing skill family.
Version numbers follow `MAJOR.MINOR.PATCH`: breaking workflow change / new skill or capability / fix.

## 0.5.0 — 2026-10-25

- **Bilingual glossary**: `glossary/vibe-coding-glossary.html` — 147 terms, 9 categories, 10 confusion pairs, 5 pitfalls, search-by-situation (change a page / install dependencies / deploy / something broke), must-know and advanced marks, and Chinese plus English for every definition and analogy. `glossary/en.json` is the translation source of truth.
- **CI**: GitHub Actions runs the test suite and a fresh `install --verify` on Node 18/20/22 × Ubuntu/Windows; badge in both READMEs. Root and main-skill `package.json` declare `"type": "module"`, because Node 18 does not sniff ESM the way 20+ does.
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
