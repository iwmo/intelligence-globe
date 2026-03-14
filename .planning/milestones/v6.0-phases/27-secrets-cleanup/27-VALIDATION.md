---
phase: 27
slug: secrets-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Shell commands (file-existence checks + docker compose config smoke test) |
| **Config file** | none — no new test files required |
| **Quick run command** | `ls backend/.dockerignore frontend/.dockerignore && grep -E "OPENSKY_CLIENT_ID|OPENSKY_CLIENT_SECRET|AISSTREAM_API_KEY|API_KEY" .env.example` |
| **Full suite command** | See Per-Task Verification Map below |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `ls backend/.dockerignore frontend/.dockerignore && grep OPENSKY_CLIENT_SECRET .env.example`
- **After every plan wave:** Run full verification sequence (SEC-01 + SEC-02 + SEC-03)
- **Before `/gsd:verify-work`:** All three checks must pass
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 27-01-01 | 01 | 1 | SEC-01 | smoke | `grep -v ":-" docker-compose.yml | grep -E "OPENSKY|AISSTREAM"` | ✅ | ⬜ pending |
| 27-01-02 | 01 | 1 | SEC-02 | smoke | `ls backend/.dockerignore frontend/.dockerignore` | ❌ Wave 0 | ⬜ pending |
| 27-01-03 | 01 | 1 | SEC-03 | smoke | `grep -E "OPENSKY_CLIENT_ID\|OPENSKY_CLIENT_SECRET\|AISSTREAM_API_KEY\|VITE_CESIUM_ION_TOKEN\|API_KEY" .env.example` | ✅ | ⬜ pending |
| 27-01-04 | 01 | 1 | SEC-01 | smoke | `cp .env .env.bak 2>/dev/null; mv .env /tmp/.env.test 2>/dev/null; docker compose config 2>&1 \| grep -iE "(missing\|required\|unset)"; mv /tmp/.env.test .env 2>/dev/null` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/.dockerignore` — created in plan execution (not a test file, a deliverable)
- [ ] `frontend/.dockerignore` — created in plan execution (not a test file, a deliverable)

*No test framework installation required — all verification is shell commands against existing files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `docker compose config` hard-errors on unset credentials | SEC-01 (criterion 4) | Requires temporarily removing `.env` file | 1. Rename `.env` to `.env.bak`; 2. Run `docker compose config`; 3. Confirm error message shows variable name (not leaked value); 4. Restore `.env.bak` |
| `.env` excluded from Docker build context | SEC-02 | Requires running a Docker build and inspecting layers | Run `docker build backend/` with a `.env` present; inspect image with `docker run --rm <img> ls .env` — should show "No such file" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
