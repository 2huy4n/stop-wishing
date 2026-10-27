---
name: stop-wishing-report
description: >-
  Render one verified stop-wishing report payload into a standalone HTML report.
  A project-level `report.conf` selects the presentation: `hacker_mode = false`
  gives a compact, printable developer report; `hacker_mode = true` gives a
  six-screen hacker-themed demo. The payload is the only source of facts; the
  theme never invents data. Chinese triggers: stop-wishing-report、生成报告、交付报告、原型报告、黑客版报告、炫酷版报告。
user-invocable: true
---

# stop-wishing-report
One payload in, one self-contained report out. Facts live in `report.json`;
the selected theme only changes how those facts are shown.

## When to use

- A delivery is verified and the user wants a report to hand over.
- A prototype is ready to show and needs a one-page confirmation artifact.
- The user explicitly asks for the hacker/炫酷 version.
## Inputs

- `report.json` — the only source of facts. Shape: `schema.json`.
- `report.conf` — project root. The only mode switch:

```ini
# false = compact developer report (default)
# true  = hacker-themed report
hacker_mode = false
```

Missing file → create it with `false` and warn. Invalid value → use `false` and
warn; never guess `true`.
## Steps

1. Build or read `report.json`; every claim must already be verified.
2. Read `report.conf`; `false` → simple, `true` → hacker.
3. Read `themes/<theme>/RENDER.md` before rendering. Do not read the other theme.
4. Run the renderer from the project root.
5. Report the output path and which theme was used.
## Commands

```bash
# create report.conf (never overwrites)
node render.js --init

# render; type comes from report.json
node render.js --data reports/2026-10-27-licence/report.json
```

Outputs: `reports/<id>-simple.html` + `.md`, or `reports/<id>-hacker.html`.
Exit 0 success, 2 bad input/config/render failure.

## Rules

- One payload, two renderers. Never load or import the unselected theme.
- The theme may add decoration, never a number, date, file, test result or claim.
- Simple output must stay printable and short; hacker output is for showing off.
- No build step, no dependencies, no network.
- Do not edit the user's `report.conf` unless the user asked to switch modes.
