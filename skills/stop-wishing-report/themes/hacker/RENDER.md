# hacker theme

Presentation-first, same facts. This theme exists for demos and for users who
enjoy the terminal look; it is never selected unless `report.conf` has
`hacker_mode = true`.

## Layout

1. Top status line: payload id, created time, active theme.
2. Signal bars and a section/evidence/risk/next rail.
3. Static ASCII masthead (decorative only, no claims).
4. Title, subtitle and optional project/commit/test metadata.
5. Status cards from `stats`.
6. Executive readout from `summary`.
7. Render log terminal plus a node index.
8. Payload sections as numbered nodes, each with a status strip and telemetry bars.
9. Evidence stream terminal and evidence matrix.
10. Risk log terminal, risks, limits and next operations.
8. Footer with generation time.

## Rules

- Decoration is allowed; invented data is not. Every number, file, test result
  and claim must already exist in `report.json`.
- No external fonts, icons, images, scripts or network calls.
- Keep the page around six desktop screens at 1120px width.
- No Markdown output; HTML only.
- The simple theme must never be imported from this module.

## Output

`reports/<id>-hacker.html`.
