---
phase: 40
slug: v10-tech-debt-cleanup
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-15
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (plan 03); filesystem check / grep (plans 01 and 02) |
| **Config file** | `frontend/vite.config.ts` |
| **Quick run command** | `cd frontend && npx vitest run SatelliteLayer.cleanup.test.tsx` |
| **Full suite command** | `cd frontend && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run the targeted verification command for the plan (filesystem check, grep, or vitest — as specified in the per-task map)
- **After every plan wave:** Run full vitest suite for plan 03; grep/filesystem for plans 01 and 02
- **Before `/gsd:verify-work`:** All three plan verifications must pass
- **Max feedback latency:** ~15 seconds (plan 03 vitest); sub-second for plans 01 and 02

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 40-01-01 | 01 | 1 | CLEANUP-01 | filesystem | `test ! -f backend/app/workers/ingest_aircraft.py && echo absent` | N/A (deletion) | ✅ green |
| 40-02-01 | 02 | 1 | CLEANUP-02 | grep | `grep "15_000" frontend/src/hooks/useAircraft.ts` | ✅ | ✅ green |
| 40-03-01 | 03 | 1 | CLEANUP-03 | unit | `cd frontend && npx vitest run SatelliteLayer.cleanup.test.tsx` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

- Plans 01 and 02 have no automated tests — they are filesystem/grep-verifiable with sub-second latency.
- Plan 03 fixes a pre-existing test file (`SatelliteLayer.cleanup.test.tsx`) — the file already existed; no new test scaffold was needed.

No Wave 0 work was required.

---

## Manual-Only Verifications

None. All phase 40 goals are verifiable programmatically:

- File absence is a filesystem check (`test ! -f`).
- Poll interval values are grep-verifiable (`grep "15_000"`).
- Test pass/fail is a deterministic vitest run (11/11 tests).

*(Source: 40-VERIFICATION.md — "None. All phase goals are verifiable programmatically")*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (N/A — no missing references)
- [x] No watch-mode flags
- [x] Feedback latency < 10s for plans 01 and 02 (sub-second); ~15s for plan 03 (vitest)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-03-15
