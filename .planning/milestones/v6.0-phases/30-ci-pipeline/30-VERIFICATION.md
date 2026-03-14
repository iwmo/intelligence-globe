---
phase: 30-ci-pipeline
verified: 2026-03-14T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
human_verification:
  - test: "Push a commit to any branch and observe GitHub Actions"
    expected: "All 4 jobs (pytest, frontend, secret-scan, docker-build) appear in the PR checks panel and turn green"
    why_human: "Cannot invoke GitHub Actions runner locally; requires remote push and live Actions execution"
  - test: "Introduce a deliberate TypeScript error in a .tsx file, push, observe frontend job"
    expected: "frontend job fails with tsc type-check error; merge blocked"
    why_human: "Requires a real GitHub Actions run to confirm the failure signal propagates to the PR check"
  - test: "Observe secret-scan job output after push"
    expected: "Gitleaks scans full history (fetch-depth:0), allowlisted SHAs pass silently, no false-positive failure"
    why_human: "Gitleaks-action runs in GH Actions runner; cannot verify allowlist effectiveness without an actual run"
  - test: "Observe docker-build job completing without a push"
    expected: "Both backend and frontend images build to the production target; no registry credentials required; cache hit logged for type=gha"
    why_human: "Docker Buildx with type=gha cache only works inside a GitHub Actions runner environment"
---

# Phase 30: CI Pipeline Verification Report

**Phase Goal:** Establish automated CI pipeline that validates every push/PR — running tests, type checks, and secret scanning — so integration issues are caught before they reach production.
**Verified:** 2026-03-14
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Every push and PR triggers 4 parallel CI jobs (pytest, frontend, secret-scan, docker-build) | VERIFIED | `ci.yml` `on:` block has `push: branches: ["**"]` and `pull_request: branches: ["**"]`; 4 jobs confirmed by regex parse: `pytest`, `frontend`, `secret-scan`, `docker-build` |
| 2 | pytest job runs against a live postgis/postgis:16-3.5 service container and reports pass/fail | VERIFIED | `services.postgres.image: postgis/postgis:16-3.5` present; health check options present; `DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost:5432/opensignal` and `API_KEY: ci-test-key` set at job env level; `alembic upgrade head` step precedes `pytest` step; `working-directory: backend` on all `run:` steps |
| 3 | frontend job runs `tsc -p tsconfig.app.json --noEmit` and `vitest run`; a TypeScript error causes failure | VERIFIED | Step `npx tsc -p tsconfig.app.json --noEmit` present (not bare `tsc --noEmit`); step `npx vitest run` present; `working-directory: frontend` on all `run:` steps; `frontend/tsconfig.app.json` confirmed to exist; `frontend/package-lock.json` confirmed to exist |
| 4 | secret-scan job runs gitleaks on full history without permanently blocking due to known pre-Phase-27 credential commits | VERIFIED | `gitleaks/gitleaks-action@v2` step present; `fetch-depth: 0` on checkout confirmed; `.gitleaks.toml` at repo root contains `[allowlist]` with exactly the 7 SHAs that touched `docker-compose.yml` before Phase 27 (`da33b9c`, `24494f5`, `a75c7f8`, `3a27f35`, `60c65a9`, `c7abba0`, `cc4715f`) — verified against `git log -- docker-compose.yml` output |
| 5 | docker-build job builds both backend and frontend images with `--target production` without pushing | VERIFIED | Two `docker/build-push-action@v6` steps; both have `push: false`; backend `target: production` — `backend/Dockerfile` confirmed to have `AS production` stage; frontend `target: production` — `frontend/Dockerfile` confirmed to have `AS production` stage; `VITE_CESIUM_ION_TOKEN=ci-placeholder` build-arg matches `ARG VITE_CESIUM_ION_TOKEN` in frontend Dockerfile; `type=gha` cache configured on both |

**Score:** 5/5 truths verified (automated)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.gitleaks.toml` | Gitleaks allowlist for 7 historical credential commits | VERIFIED | Exists at repo root; contains `[allowlist]`; `commits = [...]` with all 7 SHAs matching git log output for docker-compose.yml pre-Phase-27 |
| `.github/workflows/ci.yml` | Consolidated CI workflow with 4 parallel jobs | VERIFIED | Exists; 97 lines; valid YAML structure confirmed; all 4 job keys present; `on.push` and `on.pull_request` triggers present |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ci.yml` pytest job | `postgis/postgis:16-3.5` service container | `services:` block with health check + `DATABASE_URL` env var | WIRED | `services.postgres.image`, health check options, and `DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost:5432/opensignal` all present in job env |
| `ci.yml` frontend job | `frontend/tsconfig.app.json` | `npx tsc -p tsconfig.app.json --noEmit` | WIRED | Step uses explicit `-p tsconfig.app.json` flag; file confirmed to exist at `frontend/tsconfig.app.json` |
| `.gitleaks.toml` allowlist | Historical docker-compose.yml commits | `commits = [...]` SHA list | WIRED | `commits = [` present; 7 SHAs listed exactly match the pre-Phase-27 `git log -- docker-compose.yml` output (excluding `0b2755f` cleanup commit and `784d77c` Phase 29 update) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| CI-01 | 30-01 | GitHub Actions workflow runs `pytest` on every push and PR | SATISFIED | `pytest` job in `ci.yml` with postgres service container, alembic migrations, and `pytest` step; triggers on push + PR |
| CI-02 | 30-01 | GitHub Actions workflow runs `vitest run` and `tsc --noEmit` on every push and PR | SATISFIED | `frontend` job runs `npx tsc -p tsconfig.app.json --noEmit` then `npx vitest run`; triggers on push + PR |
| CI-03 | 30-01 | GitHub Actions workflow runs secret scanning (gitleaks) to block credentials from being merged | SATISFIED | `secret-scan` job uses `gitleaks/gitleaks-action@v2` with `fetch-depth:0`; `.gitleaks.toml` allowlist prevents permanent block from known historical commits |
| CI-04 | 30-01 | GitHub Actions workflow verifies both Docker images build successfully (`docker build --target production`) | SATISFIED | `docker-build` job builds both images with `target: production` and `push: false`; both Dockerfiles have `production` stage confirmed |

No orphaned requirements. REQUIREMENTS.md assigns CI-01 through CI-04 exclusively to Phase 30; all four are claimed by plan 30-01.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.github/workflows/ci.yml` | 94 | `VITE_CESIUM_ION_TOKEN=ci-placeholder` | Info | Intentional — build-time ARG requires a value; placeholder is correct for build verification per plan spec; Vite inlines at compile time and a real token is not required to confirm the Dockerfile is valid |

No blockers or warnings found. The `ci-placeholder` value is the documented and expected approach.

---

### Commit Verification

Both commits cited in SUMMARY.md are confirmed in git history:

| Commit | Description | Files |
|--------|-------------|-------|
| `44ded4c` | chore(30-01): add gitleaks allowlist for historical credential commits | `.gitleaks.toml` |
| `c985b1c` | feat(30-01): add consolidated GitHub Actions CI workflow with 4 parallel jobs | `.github/workflows/ci.yml` |

---

### Human Verification Required

All automated checks pass. The following items cannot be verified without a live GitHub Actions run:

#### 1. Four jobs turn green on push/PR

**Test:** Push the current branch to GitHub (or open a PR) and navigate to the Actions tab.
**Expected:** All 4 check names appear — `pytest`, `frontend`, `secret-scan`, `docker-build` — and all complete with green status.
**Why human:** GitHub Actions runner environment cannot be invoked locally; the workflow file is syntactically correct and structurally complete, but actual job execution requires the GH runner.

#### 2. TypeScript failure propagates correctly

**Test:** Temporarily introduce a type error in a `.tsx` file (e.g., assign a string to a number variable), push to a branch.
**Expected:** The `frontend` job fails at the `tsc -p tsconfig.app.json --noEmit` step; the PR check is marked failed; merge is blocked.
**Why human:** Requires a real GitHub Actions run to confirm the exit code from `tsc` correctly fails the job and surfaces in the PR checks panel.

#### 3. Gitleaks allowlist prevents false-positive block

**Test:** After pushing, observe the `secret-scan` job log output.
**Expected:** Gitleaks scans the full commit history (`fetch-depth:0`), the 7 allowlisted SHAs produce no failure, and the job completes green. No new credential detections are present.
**Why human:** Gitleaks-action behaviour under the allowlist can only be confirmed against an actual run with full history scanned in the Actions runner.

#### 4. Docker build completes with GHA cache

**Test:** Observe the `docker-build` job logs on the second run (first run populates cache).
**Expected:** Both backend and frontend images build successfully to `--target production` without pushing to any registry; second run shows cache hit for `type=gha`.
**Why human:** `type=gha` cache backend only operates inside the GitHub Actions runner environment; cannot be tested locally.

---

### Gaps Summary

No gaps — all automated verifications pass. Phase goal is structurally achieved. The four human verification items are standard "does it work in the actual runner" checks that are inherent to any CI pipeline delivery and cannot be automated without a live GitHub environment.

---

_Verified: 2026-03-14_
_Verifier: Claude (gsd-verifier)_
