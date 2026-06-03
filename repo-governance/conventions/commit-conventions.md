# Commit Conventions

vacti uses **Conventional Commits**, enforced by commitlint (commit-msg hook).

```
<type>(<scope>): <subject>
```

- **types:** feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
- **scopes (suggested):** platform, recon, threat-intel, reports, api, integrations, ui, db, auth,
  queue, ci, governance, deps, planning.
- Inside an epic's implementation, reference the issue: `feat(recon): add httpx adapter (#42)`.
- Imperative mood, no trailing period, subject ≤ ~72 chars.

Examples:

```
feat(threat-intel): add unified risk-score engine
fix(queue): kill child process group on scan cancel
docs(planning): add platform-foundation epic
```
