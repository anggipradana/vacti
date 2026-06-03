# Repository Governance Architecture

vacti governance follows a **six-layer hierarchy** (adapted from ose-primer), giving full
traceability from purpose to executable workflow. Each layer is governed by the one(s) above it.

```
Layer 0  Vision        WHY WE EXIST        repo-governance/vision/
Layer 1  Principles    WHY — values        repo-governance/principles/
Layer 2  Conventions   WHAT — doc/style    repo-governance/conventions/
Layer 3  Development   HOW — practices     repo-governance/development/
Layer 4  Agents        WHO — executors     repo-governance/agents/ + .claude/
Layer 5  Workflows     WHEN — processes    repo-governance/workflows/
```

## Layer responsibilities

| Layer         | Question                   | Owns                                                    |
| ------------- | -------------------------- | ------------------------------------------------------- |
| 0 Vision      | Why does vacti exist?      | Product purpose & north star                            |
| 1 Principles  | Why do we value X?         | Engineering values (simplicity, type-safety, lightness) |
| 2 Conventions | What rules for docs/style? | Naming, formatting, Diátaxis, commits                   |
| 3 Development | How do we build?           | Testing strategy, quality gates, CI, Nx targets         |
| 4 Agents      | Who executes?              | AI agent + PM (ccpm) definitions in `.claude/`          |
| 5 Workflows   | When/in what order?        | Plan→Epic→Task→Implement→Review flow                    |

## Traceability

- **Top-down:** Vision → Principles → Conventions/Development → Agents → Workflows.
- **Bottom-up:** every workflow/practice traces back to a principle and ultimately the vision.

Planning artifacts (PRD, epics, tasks) live under `.claude/` per the **ccpm** methodology; this
governance layer defines the _rules_ those artifacts and the code must obey.
