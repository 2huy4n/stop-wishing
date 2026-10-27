# What other skills read

Read only when explaining why a value matters. Nothing here is required.

| Skill | Reads | Uses it for |
|---|---|---|
| `stop-wishing-spec` | `docs/agents/domain.md` | glossary and ADR locations, so terms and constraints point somewhere real. Its own `source:` stays `docs/project.md` |
| `stop-wishing-tickets` | `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md` | resolving inbound issue references and status words. **Issues are not tickets**: ticket files always stay in `docs/tickets/` |
| `stop-wishing-review` | `docs/agents/issue-tracker.md` | resolving "issue #123" to a real issue before treating commit references as paths |
| `stop-wishing-audit` | `docs/agents/domain.md` | naming things the way the repo names them |
| `stop-wishing-debt` | `docs/agents/domain.md` | the same naming, applied to debt entries |

When `docs/agents/` is absent, every skill works on its defaults: card at `docs/project.md`, tickets at `docs/tickets/`, issue refs resolved by the review order in `stop-wishing-review`, glossary optional. Setup removes guesswork; it must not add a new precondition.
