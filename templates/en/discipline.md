# Discipline and handover checklist (discipline)

> Last updated: YYYY-MM-DDTHH:mm±HH:MM (ISO 8601 with the local UTC offset)
> This file mirrors §9 of `SKILL.md`; if they disagree, `SKILL.md` wins.

## 1. Hard rules

1. **No hardcoding**: absolute paths, secrets, magic numbers (thresholds/timeouts/ports), URLs, ports, model names → config/env/named constants; script defaults must be overridable.
2. **Timestamps**: `YYYY-MM-DDTHH:mm±HH:MM`, only in file-header change blocks and `docs/progress.md`.
3. **No full rewrites**: a single-file diff over 50% or 300 lines needs a written justification and approval first.
4. **Search is recorded**: keywords, conclusions, licenses go into `progress.md`.
5. **Irreversible actions need a human**: deleting files/dirs, DB changes, `git reset --hard`, overwriting unbacked config, installing into system dirs, restarting services.
6. **No scope creep**: no unrequested refactors, reformatting or dependency upgrades.

## 2. Before editing

- [ ] Ambiguity tier stated (light/medium/heavy) with reasons?
- [ ] Seven-field brief (including "explicitly out of scope") confirmed?
- [ ] Existing solutions searched? License gate passed (code, fonts, icons, APIs, snippets)?
- [ ] Explained what/impact/risk/rollback and waited for confirmation?
- [ ] Backup taken (tag or `.bak-YYYYMMDD-HHmm`)?
- [ ] Change is the minimum diff?

## 3. Before delivering

- [ ] Verification commands run, raw output attached (assertion | evidence | source)?
- [ ] `project.md` / `progress.md` / `todo.md` updated?
- [ ] Unverified items written as "unverified / unknown"?
- [ ] No secrets or machine paths committed?

## 4. Handover checklist (day one)

1. Read `docs/project.md` and `docs/structure.md`;
2. Read this file and the timeline in `docs/progress.md`;
3. Run `node scripts/check-env.js`;
4. Run `node scripts/check-hardcode.js`;
5. Take the first item from `docs/todo.md` and run the checklist in §2.

## 5. Failure handling

- Max 3 attempts on the same problem; then stop and escalate (what you tried, raw errors, 3 hypotheses, what decision is needed);
- Never guess secrets, disable validation, skip tests, or delete evidence.

## 6. Extra glossary (the four most confusing terms)

| Term | Plain words | Why it matters |
|---|---|---|
| Copyleft license | Using it can force your code to adopt its license | Commercial closed source: GPL/AGPL never; this skill refuses LGPL too |
| Dynamic linking | Calling someone's library at runtime instead of copying its code into yours | The LGPL gray area (legally arguable; this skill stays strict and refuses it) |
| Derivative work | What you build from someone's code is legally its "child" | Scope of the open-source obligation |
| Regression test | Re-running old tests after a change to prove nothing broke | Whether the change may merge (see §3) |
