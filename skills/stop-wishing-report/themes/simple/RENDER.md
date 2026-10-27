# simple theme

Compact, printable, evidence-first. This is the default report and the only
theme most developers should see.

## Layout

1. Masthead: report type, id, title, subtitle, metadata chips.
2. Verdict block: one-sentence conclusion plus optional key numbers.
3. Body sections in payload order (`text`, `list`, `table`, `steps`).
4. Evidence table: claim, proof, source.
5. Risks and limits.
6. Next steps.

## Rules

- Target two A4 pages at default zoom; do not add decorative sections.
- No external fonts, icons, images, scripts or network calls.
- Every value comes from `report.json`; do not add metrics or claims.
- Missing optional arrays render as empty, not as invented placeholders.
- Print stylesheet: A4, 11mm margins, no shadows.

## Output

`reports/<id>-simple.html` plus `reports/<id>-simple.md`.
