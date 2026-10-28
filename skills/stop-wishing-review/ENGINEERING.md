# Engineering axis

## Six dimensions

1. **Bug** — wrong behavior, edge cases, off-by-one, null/empty, error paths, race conditions.
2. **Risk** — security (injection, authz, secrets, unsafe deserialization) and data loss (missing transactions, destructive migrations, no backup).
3. **Scale** — behavior at the stated real load: N+1 queries, unbounded memory, missing indexes, quadratic loops, retry storms.
4. **Missing test** — the change has no test for its main promise or its main failure mode.
5. **Speed** — user-visible latency and cost, not micro-optimizations.
6. **Lean** — delete dead code, reuse existing code, use the standard library, apply YAGNI, merge duplicates, split oversized functions.

## Smell baseline (12 checks, judgement calls only)

Use these when the repo documents no standards, and as a second pass when it does. They are heuristics, not violations.

**Naming and duplication**

1. **Mysterious Name** — a name that does not reveal what the value holds or the function does. Fix: rename until it does; if no honest name exists, the design is unclear.
2. **Duplicated Code** — the same logic shape appears twice in the change. Fix: keep one copy, call it from both.
3. **Repeated Switches** — the same type test or if-ladder recurs at several sites. Fix: one table both sites share, or polymorphism.

**Coupling**

4. **Feature Envy** — a function works mostly on another object's data rather than its own. Fix: move it beside the data it uses.
5. **Data Clumps** — the same few values travel together everywhere. Fix: give the group its own type and pass that.
6. **Message Chains** — callers walk a long chain of getters. Fix: ask the first object for the result.

**Abstraction**

7. **Primitive Obsession** — a string or number stands in for a real concept. Fix: give the concept a small type.
8. **Speculative Generality** — parameters, hooks or base classes for a need nobody has. Fix: delete until a real need appears.
9. **Refused Bequest** — a subclass ignores most of what it inherits. Fix: use composition instead of inheritance.
10. **Middle Man** — a layer that only forwards calls. Fix: remove it and call the target directly.

**Shape of change**

11. **Shotgun Surgery** — one logical change scatters edits across many files. Fix: gather what changes together into one module.
12. **Divergent Change** — one file is edited for several unrelated reasons. Fix: split by reason.

## Rules for the baseline

- **The repo overrides.** A documented project standard always wins; suppress any smell it endorses.
- **Always a judgement call.** Write "possible Feature Envy", never "violates".
- **Skip what tooling enforces.** A linter, formatter or type checker already covers it — do not repeat it.
- **No concrete case, no finding.** Name the file, the line and the situation.

## Check before you report

Every finding must be **verified against the code**. Quote the line, name the path, or point to the test that proves it.

- **No concrete trigger scenario → not a finding.** "This might be slow" is noise; "this loops over every order for each user, so 10k users × 1k orders" is a finding.
- A `shortcut:` comment is a **recorded decision, not a problem**. Flag it only if the assumed load has passed the stated ceiling.
- Do not report style preferences as bugs. Do not invent requirements the change never promised.
