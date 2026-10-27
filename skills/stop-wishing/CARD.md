# Card, tiers and assumptions

Read this before writing the requirement card, announcing a tier, or offering the next step.

## Ambiguity tiers

Judged by **ambiguity, not change size**: one CSS line can be heavy; a 20-file rename can be light.

| Tier | Test | Handling |
|---|---|---|
| **Light** | Goal / boundary / acceptance: one sentence each | Verbal card, start |
| **Medium** | Exactly **1** missing | Ask it (≤3 questions), confirm; `docs/project.md` if it exists |
| **Heavy** | **2+** missing, or a wishful phrase | Card into `docs/project.md`; start after confirmation |

Opening: "Let me align first: this is **medium** — goal and acceptance are clear, but **boundary** is not. That decides whether I touch other files, so one question first…" Announce tier changes; never change silently.

## The seven card fields

1. **Goal** — whose problem, what it becomes.
2. **Users and scenario** — who, when, how often.
3. **Input/output** — in/out, format, example.
4. **Scope and boundaries** — included **and explicitly not done**.
5. **Acceptance** — command, screenshot, comparison or sign-off.
6. **Constraints** — stack, untouchables, budget/time, compliance.
7. **Delivery form** — **prototype** (rough OK) or **production** (maintainable, tested, documented).

Plus:

- **Assumptions** — value + reason + cost if wrong.
- **Open questions** — not blocking; when each must be decided.

Light: verbal. **Medium/heavy: `docs/project.md`; confirm before starting.**

## AGENTS.md — ask before writing

When `docs/` is created or first used in a repo, add one opening question:

> "Do you want a repo-root `AGENTS.md` pointing to these docs, so any agent working here reads them automatically?"

- **Only write after an explicit yes** — run `init-docs.js --agents-md`. Silence, "maybe" or a changed subject is **no**.
- **Never overwrite** an existing `AGENTS.md` or `CLAUDE.md`: it is the user's steering file. Offer to append a short `## Project docs` block instead; if they decline, skip.
- Keep it to **pointers only** (5–10 lines). Never paste the documents into it: it sits in every future conversation and costs tokens.

## Next steps — offer once

After the card is confirmed, offer the next step **once**, in plain language — one offer, not a menu:

- **Card confirmed:** "The card is confirmed. Want me to turn it into a spec? I'll only assemble what you already told me — no new questions."
- **Spec saved:** "Spec saved to `docs/specs/<id>.md`. Want me to split it into tickets? Each ticket gets its dependency order and a verify command."

Details: `stop-wishing-spec` writes the spec, `stop-wishing-tickets` splits it. Offer each **once**; if the user skips, declines or changes the subject, record it in the closing `Skipped:` line and **do not ask again**. A spec or a ticket set is never a precondition for work the user already approved.
