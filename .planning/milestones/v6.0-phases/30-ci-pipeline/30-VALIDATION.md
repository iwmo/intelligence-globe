---
phase: 30
slug: ci-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend), vitest (frontend) |
| **Config file** | `backend/pytest.ini` (or `pyproject.toml [tool.pytest]`), `frontend/vite.config.ts` |
| **Quick run command** | `cd backend && pytest tests/ -x -q` |
| **Full suite command** | `cd backend && pytest tests/ && cd ../frontend && npx vitest run` |
| **Estimated runtime** | ~60 seconds (with service container spin-up) |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && pytest tests/ -x -q`
- **After every plan wave:** Run full suite (backend pytest + frontend vitest + tsc)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 30-01-01 | 01 | 0 | CI-03 | manual | gitleaks scan passes on repo | ❌ W0 | ⬜ pending |
| 30-01-02 | 01 | 1 | CI-01 | integration | `gh run view --repo .` pytest job green | ❌ W0 | ⬜ pending |
| 30-01-03 | 01 | 1 | CI-02 | integration | `gh run view --repo .` frontend job green | ❌ W0 | ⬜ pending |
| 30-01-04 | 01 | 1 | CI-03 | integration | `gh run view --repo .` gitleaks job green | ❌ W0 | ⬜ pending |
| 30-01-05 | 01 | 1 | CI-04 | integration | `gh run view --repo .` docker-build job green | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.gitleaks.toml` — allowlist for historical credential commits (SHA-based) to prevent CI-03 permanent block
- [ ] `.github/workflows/ci.yml` — consolidated workflow file (created in Wave 1 but Wave 0 must unblock CI-03 risk)

*Note: The gitleaks historical credential risk (documented in STATE.md) MUST be resolved before pushing the workflow file. Wave 0 creates the allowlist.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PR checks panel shows pytest pass/fail | CI-01 | Requires real GitHub PR | Open PR, verify "backend-tests" check appears in GitHub UI |
| TypeScript error fails the check | CI-02 | Requires introducing a real TS error | Temporarily break a `.tsx` file, push, verify check fails |
| Credential commit blocks merge | CI-03 | Requires committing test credential | Use `detect-secrets` test pattern — do NOT commit real creds |
| Broken Dockerfile fails check | CI-04 | Requires breaking Dockerfile | Temporarily corrupt Dockerfile syntax, push, verify fails |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
