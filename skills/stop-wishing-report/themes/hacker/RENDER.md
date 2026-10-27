# hacker theme

Presentation-first, same facts. This theme exists for demos and for users who
enjoy the terminal look; it is never selected unless `report.conf` has
`hacker_mode = true`.

## Layout

1. Top status line: payload id, created time, active theme.
2. Static ASCII masthead (decorative only, no claims).
3. Title, subtitle and optional project/commit/test metadata.
4. Status cards from `stats`.
5. Executive readout from `summary`.
6. Payload sections as numbered nodes.
7. Evidence matrix, risks, limits and next operations.
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
