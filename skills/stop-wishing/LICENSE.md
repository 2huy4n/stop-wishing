# Licence gate

Read this before adding a dependency, font, icon, image, API, template or snippet — or when `preflight.js` reports a licence finding.

## Ask use first

Ask the user to pick one; **No or vague answer → commercial closed-source**, recorded.

- **A** — not sure
- **B** — self-use only
- **C** — free closed distribution
- **D** — open source under the same licence
- **E** — commercial (paid or internal)

Each column below answers differently; a different use is a new question, not the same one.

## Matrix

| License | Self-use | Free closed distribution | Open source (same license) | Commercial closed |
|---|---|---|---|---|
| MIT / Apache-2.0 / BSD / ISC / 0BSD / Unlicense / CC0 | ✅ | ✅ | ✅ | ✅ (keep notices) |
| MPL-2.0 / EPL-2.0 / EUPL-1.2 | ✅ | ⚠️ file-level copyleft — modified files stay open | ✅ | ⚠️ compliance check, not a blanket refusal |
| GPL / AGPL | ✅ | ❌ | ✅ (whole derivative same license) | ❌ viral, always refused |
| GPL-2.0 WITH Classpath-exception-2.0 / GCC / OpenSSL-style linking exceptions | ✅ | ⚠️ link commercially if the exception covers your use | ✅ | ⚠️ human confirmation — never a plain GPL refusal |
| LGPL | ✅ | ⚠️ dynamic link + replaceable only | ✅ | ❌ always refused (see note) |
| SSPL-1.0 / BUSL-1.1 | ✅ | ❌ | ❌ | ❌ service/business-use restrictions |
| CC-BY-NC-* | ✅ | ❌ non-commercial only | ❌ | ❌ |
| No LICENSE | ⚠️ self-use only, risk recorded | ❌ | ❌ | ❌ (a missing metadata field is reported as `unknown`, not assumed unlicensed) |
| UNLICENSED (proprietary) | ✅ only with the owner's permission | ❌ | ❌ | ❌ |
| Custom/commercial | Read clauses; unclear → refuse as commercial closed | Same | Same | Same |

**LGPL strict:** "dynamic link + replaceable" leaves legal room for commercial closed-source, but needs a case-by-case argument, notices and a truly replaceable library. This skill treats LGPL like GPL/AGPL for **commercial closed-source: always refused**. A build carrying an explicit linking exception belongs to the exception row above; the refusal is for plain LGPL.

**Script parity:** `check-licenses.js` implements this same matrix. Changing a row here means changing the script and `test/check-licenses.test.mjs` in the same change — a documented matrix and a coded matrix that disagree is not a licence gate.

## Scope

Scope: code dependencies, **fonts**, **icons/images**, **third-party API terms**, **template/sample snippets** — all pass the gate. The scanner only reads npm metadata; fonts, icons, APIs and snippets still need the table and a human.

## Own-code exception

"I wrote it" is not enough. Record in Assumptions:

1. **source** (repo / path)
2. **author statement** (exact words)
3. **date** (ISO 8601 + offset)

Missing one → third-party. Only that source skips; the exception **does not spread**.

## Deliverable

`docs/LICENSES.md`, one line each: **Name | Version | License | Commercial usability | Source URL**; never blank.

## Scanner

Run when the repo has `node_modules/` or `package-lock.json`:

```bash
node skills/stop-wishing/scripts/check-licenses.js --use <self|free-closed|open-source|commercial>
```

- Prefers `package-lock.json` (`lockfileVersion` ≥ 2) for the whole dependency set — transitive and nested packages included; `node_modules` only fills missing licence fields.
- Parses SPDX (`OR` / `AND` / `WITH`); common linking exceptions become `warn`.
- `forbidden` blocks the change; `warn` is recorded and confirmed by a human; `unknown` goes into `LICENSES.md` marked unverified. `--strict` makes `unknown` fail too.
- Exit 1 = forbidden (or unknown under `--strict`); exit 2 = bad arguments or no input. `--rows` prints the five `docs/LICENSES.md` columns.
- Reads package metadata, never licence clauses: custom/commercial terms and a missing `LICENSE` still need a human.
