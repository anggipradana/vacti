# Layer 4 - Agents

WHO executes governed work. vacti uses **ccpm** (Claude Code PM) for spec-driven project management
and Claude Code agents for implementation.

- Planning artifacts live in `.claude/prds/` (PRDs) and `.claude/epics/<name>/` (epics + numbered
  tasks), per ccpm conventions.
- Agents must obey Layers 1-3: principles, conventions, and development practices.
- `CLAUDE.md` / `AGENTS.md` at the repo root are the entry points read by AI harnesses.

Agent rules of engagement:

- Make the smallest change that satisfies the task.
- Never commit secrets; never bypass quality gates.
- Reference the issue in commits inside an epic (`<type>(<scope>): ... (#N)`).
