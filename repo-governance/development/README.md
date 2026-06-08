# Layer 3 - Development

How we build vacti. See:

- [testing-strategy.md](testing-strategy.md) - 3-tier testing
- [quality-gates.md](quality-gates.md) - what must pass before merge
- [ci-conventions.md](ci-conventions.md) - GitHub Actions + Nx affected
- [nx-targets.md](nx-targets.md) - standard project targets

## Workflow

Trunk-based: short-lived branches off `main`, PR must pass the quality gate. One branch per epic
(`epic/<name>`) when doing ccpm parallel work. Never force-push shared branches.
