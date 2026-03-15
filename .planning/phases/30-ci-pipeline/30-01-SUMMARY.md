---
phase: 30-ci-pipeline
plan: "01"
subsystem: ci
tags: [ci, github-actions, gitleaks, pytest, vitest, docker]
dependency_graph:
  requires: [27-secrets-cleanup, 28-api-key-auth, 29-production-docker-stack]
  provides: [ci-pipeline, secret-scanning, build-verification]
  affects: [31-documentation]
tech_stack:
  added:
    - GitHub Actions
    - gitleaks/gitleaks-action@v2
    - postgis/postgis:16-3.5 (service container)
    - docker/build-push-action@v6
  patterns:
    - Parallel CI jobs (4 jobs, single workflow)
    - Commit-SHA allowlisting (gitleaks)
    - Service container with health checks (postgis)
key_files:
  created:
    - .gitleaks.toml
    - .github/workflows/ci.yml
  modified: []
decisions:
  - Commit-SHA allowlisting (not path/regex) — narrowest scope, no future detections silenced
  - postgresql+asyncpg:// prefix — asyncpg driver requirement for SQLAlchemy async
  - SERVICE_HOST=localhost (not 'postgres') — job runs on runner, not in container
  - fetch-depth:0 on secret-scan — gitleaks needs full history to scan all commits
  - tsc -p tsconfig.app.json --noEmit (not bare tsc) — project references require explicit config target
  - alembic upgrade head before pytest — tests query real tables, schema must exist first
  - VITE_CESIUM_ION_TOKEN=ci-placeholder — Vite inlines at compile time; placeholder sufficient for build verification
  - push:false on both docker-build steps — build verification only, no registry credentials needed
metrics:
  duration: "~1 minute"
  completed: "2026-03-14"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 30 Plan 01: CI Pipeline Summary

**One-liner:** GitHub Actions CI with 4 parallel jobs — pytest+postgis, vitest+tsc, gitleaks secret-scan, and docker production build verification.

## What Was Built

A consolidated GitHub Actions CI workflow (`.github/workflows/ci.yml`) with 4 parallel jobs that gate every push and PR:

1. **pytest** — Spins up `postgis/postgis:16-3.5` service container, runs `alembic upgrade head`, then `pytest` against a real DB.
2. **frontend** — Installs npm deps, runs `tsc -p tsconfig.app.json --noEmit` (TypeScript type-check), then `vitest run`.
3. **secret-scan** — Uses `gitleaks/gitleaks-action@v2` with `fetch-depth:0` to scan full git history for credential leaks.
4. **docker-build** — Builds both backend and frontend Docker images with `--target production`, no push. Uses GitHub Actions cache.

A `.gitleaks.toml` allowlist was created to unblock the secret-scan job for 7 pre-Phase-27 commits that contained hardcoded OpenSky credentials before SEC-01 cleaned them up.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create gitleaks allowlist | 44ded4c | .gitleaks.toml |
| 2 | Create consolidated CI workflow | c985b1c | .github/workflows/ci.yml |

## Verification Results

| Check | Result |
|-------|--------|
| .gitleaks.toml contains [allowlist] + commits | PASS (2 matches) |
| CI YAML has 4 jobs (pytest, frontend, secret-scan, docker-build) | PASS |
| Local backend smoke test (pytest tests/test_health.py) | PASS — 3 passed in 0.22s |
| Local frontend type-check (tsc -p tsconfig.app.json --noEmit) | PASS — exit 0 |

Full CI-01 through CI-04 validation (jobs turning green in GitHub Actions) requires pushing to GitHub and observing the Actions run — documented in VALIDATION.md.

## Deviations from Plan

None — plan executed exactly as written.

## Key Decisions Made

- **Commit-SHA allowlisting:** Used 7 specific commit SHAs in `.gitleaks.toml` rather than path-based or regex allowlisting. This is the narrowest possible allowlist — it unblocks CI without silencing future detections.
- **DATABASE_URL prefix `postgresql+asyncpg://`:** Required by SQLAlchemy's async engine; bare `postgresql://` would fail at runtime with asyncpg driver.
- **Service hostname `localhost`:** The pytest job runs directly on the GitHub Actions runner (not in a container), so the Postgres service is reachable at `localhost:5432`, not `postgres:5432`.
- **`alembic upgrade head` before `pytest`:** Tests query real tables populated by migrations; schema must exist before any test runs.
- **`tsc -p tsconfig.app.json --noEmit`:** Bare `tsc --noEmit` ignores project references; the explicit `-p tsconfig.app.json` flag targets the app config correctly.

## Self-Check: PASSED

- `.gitleaks.toml` exists at repo root
- `.github/workflows/ci.yml` exists with 4 jobs
- Commits 44ded4c and c985b1c verified in git log
