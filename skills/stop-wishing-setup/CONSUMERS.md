# What other skills read

Read only when explaining why a value matters. Nothing here is required.

| Skill | Reads | Uses it for |
|---|---|---|
| `stop-wishing-spec` | `docs/agents/domain.md` | glossary and ADR locations, so terms and constraints point somewhere real. Its own `source:` stays `docs/project.md` |
| `stop-wishing-tickets` | `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md` | ticket location, and the word to use for each status |
| `stop-wishing-review` | `docs/agents/issue-tracker.md`, then `docs/agents/domain.md` | resolving "issue #123" to a real file before falling back to asking the user |
| `stop-wishing-audit` / `stop-wishing-debt` | `docs/agents/domain.md` | naming things the way the repo names them |

When `docs/agents/` is absent, every skill works on its defaults: card at `docs/project.md`, tickets at `docs/tickets/`, issues resolved by the review order in `stop-wishing-review` §2, glossary optional. Setup removes guesswork; it must not add a new precondition.
