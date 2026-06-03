# Layer 5 — Workflows

WHEN we run which steps, in what order. The vacti delivery workflow (ccpm-based):

```
1. PRD          .claude/prds/<name>.md          — capture requirements
2. Epic         .claude/epics/<name>/epic.md    — technical design
3. Decompose    .claude/epics/<name>/00N.md     — numbered tasks (deps + parallel)
4. Sync         GitHub issues (epic + tasks)    — optional, via gh
5. Implement    one branch per epic             — parallel where non-conflicting
6. Quality gate hooks + CI                       — must pass
7. Review + merge to main (trunk-based)
```

Status values: PRD backlog/active/completed; epic backlog/in-progress/completed; task
open/in-progress/closed. Update epic `progress` when tasks close.
