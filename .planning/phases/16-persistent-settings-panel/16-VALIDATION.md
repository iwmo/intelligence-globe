---
phase: 16
slug: persistent-settings-panel
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | frontend/vite.config.ts |
| **Quick run command** | `cd frontend && npx vitest run --reporter=verbose 2>&1 | tail -20` |
| **Full suite command** | `cd frontend && npx vitest run 2>&1 | tail -30` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run --reporter=verbose 2>&1 | tail -20`
- **After every plan wave:** Run `cd frontend && npx vitest run 2>&1 | tail -30`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | CONFIG-01 | unit | `cd frontend && npx vitest run src/stores/useSettingsStore.test.ts` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | CONFIG-02 | unit | `cd frontend && npx vitest run src/stores/useSettingsStore.test.ts` | ❌ W0 | ⬜ pending |
| 16-01-03 | 01 | 1 | CONFIG-06 | unit | `cd frontend && npx vitest run src/stores/useSettingsStore.test.ts` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 2 | CONFIG-01 | unit | `cd frontend && npx vitest run src/components/SettingsPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 16-02-02 | 02 | 2 | CONFIG-02 | unit | `cd frontend && npx vitest run src/components/SettingsPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 16-02-03 | 02 | 2 | CONFIG-03 | unit | `cd frontend && npx vitest run src/components/SettingsPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 16-02-04 | 02 | 2 | CONFIG-04 | unit | `cd frontend && npx vitest run src/components/SettingsPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 16-02-05 | 02 | 2 | CONFIG-05 | unit | `cd frontend && npx vitest run src/components/SettingsPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 16-03-01 | 03 | 3 | CONFIG-02 | unit | `cd frontend && npx vitest run src/App.test.tsx` | ✅ | ⬜ pending |
| 16-03-02 | 03 | 3 | CONFIG-03 | unit | `cd frontend && npx vitest run src/App.test.tsx` | ✅ | ⬜ pending |
| 16-03-03 | 03 | 3 | CONFIG-04 | unit | `cd frontend && npx vitest run src/App.test.tsx` | ✅ | ⬜ pending |
| 16-03-04 | 03 | 3 | CONFIG-05 | unit | `cd frontend && npx vitest run src/App.test.tsx` | ✅ | ⬜ pending |
| 16-03-05 | 03 | 3 | CONFIG-06 | manual | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/stores/useSettingsStore.test.ts` — stubs for CONFIG-01, CONFIG-02, CONFIG-06
- [ ] `frontend/src/components/SettingsPanel.test.tsx` — stubs for CONFIG-01 through CONFIG-05

*Existing vitest infrastructure covers App.test.tsx. Wave 0 only needs the two new test files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Settings survive hard reload in real browser | CONFIG-06 | localStorage behavior in jsdom is in-memory only; hard reload requires real browser tab close/reopen | Open app → change settings → close tab → reopen → verify settings restored |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
