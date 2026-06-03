# Standard Nx Targets

Every project should define the relevant subset:

| Target | Meaning |
| ------ | ------- |
| `build` | Produce `dist/` (depends on `^build`) |
| `dev` | Run in watch/dev mode |
| `typecheck` | `tsc --noEmit` |
| `lint` | ESLint |
| `test:quick` / `test:unit` | Vitest unit tests (cached) |
| `test:integration` | Vitest integration (Postgres, not cached) |
| `test:e2e` | Playwright (not cached) |
| `seed` | (db only) seed database |

Tag projects: `lang:ts` plus a scope tag (`scope:web`, `scope:worker`, `scope:lib`).
