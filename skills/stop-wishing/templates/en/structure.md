# Structure (structure)

> Last updated: YYYY-MM-DDTHH:mm±HH:MM
> Purpose: a newcomer knows in 60 seconds where things live, what to change, and what not to touch.

## 1. Top level

```
project-root/
├── <dir>/          # one line
├── <file>          # one line
└── docs/           # project/content/structure/progress/todo/discipline/LICENSES
```

## 2. Module boundaries

| Module / dir | Responsibility (one line) | May depend on | Must not depend on |
|---|---|---|---|
|  |  |  |  |

## 3. Entry and exit points

| Kind | Location | Notes |
|---|---|---|
| Program entry |  |  |
| Config entry |  | env vars / config files |
| Public interface |  | HTTP / CLI / exported functions |
| Persistence |  | where, format, how to back up |

## 4. Hands off

- (generated code / vendored third-party / compat shims — say why)

## 5. Safe change order

1. Read this file and the scope section of `docs/project.md`;
2. Back up per `docs/discipline.md` before editing;
3. After editing, update this file and the timeline in `docs/progress.md`.
