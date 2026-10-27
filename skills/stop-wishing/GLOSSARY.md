# Terms and the bundled glossary

Read this when the user asks what a term means, or when a plain-language explanation is needed.

## Term table (translate on first use)

| Term | Plain meaning / impact |
|---|---|
| API | Rules programs talk; keys, fees |
| Dependency | Others' part; size, vulns, license |
| Refactor | Internals only; regression risk |
| Deploy | Others can reach it; domain, cost, on-call |
| Idempotent | Ten runs = one; retries double-charge |
| Git | Snapshots; undo safety |
| Env variable | Config outside code; machine moves |
| Rollback | Last good state; recovery time |
| Viral license | Forces open; GPL/AGPL never commercial-closed |
| Dynamic linking | Runtime library; LGPL still refused commercial-closed |
| Derivative work | Legally a "child"; open-source scope |
| Regression test | Old tests rerun; merge safety |

## Looking up a term

When the user asks what a term means ("what is MVP?", "MCP 是什么?"):

- **Local first.** The glossary ships at `assets/vibe-coding-glossary.html`, next to this file. Search that file for `zh:'<term>'` or `en:'<term>'` and read only the matching object — never load the whole file into context.
- **Answer from the entry.** Use `d` / `de` for the explanation and `a` / `ae` for the analogy. Quote or lightly adapt; do not invent a second definition.
- **Hand over the deep link.** Entries have stable anchors:
  `assets/vibe-coding-glossary.html#term-<slug>`, where the slug is the English name lowercased with every run of non-alphanumerics turned into `-` (`MVP` → `#term-mvp`, `Context Window` → `#term-context-window`; duplicates get `-2`). Give it as a `file://` link; do not open a browser window yourself.
- **If the term is absent**, say the bundled glossary has no entry, then use web search if available; otherwise answer from general knowledge and mark it unverified. Never pretend the glossary covered it.
- **Never dump the glossary.** It has 147 entries; the user asked about one.
