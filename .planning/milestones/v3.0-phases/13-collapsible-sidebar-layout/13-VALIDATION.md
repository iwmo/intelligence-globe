---
phase: 13
slug: collapsible-sidebar-layout
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (configured in vite.config.ts, test.environment = jsdom) |
| **Config file** | `frontend/vite.config.ts` (inline `test:` block) |
| **Quick run command** | `cd frontend && npx vitest run src/store/__tests__/useAppStore.test.ts` |
| **Full suite command** | `cd frontend && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run src/store/__tests__/useAppStore.test.ts`
- **After every plan wave:** Run `cd frontend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | LAYOUT-01 | unit | `cd frontend && npx vitest run src/store/__tests__/useAppStore.test.ts` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | LAYOUT-01 | unit | `cd frontend && npx vitest run src/store/__tests__/useAppStore.test.ts` | ❌ W0 | ⬜ pending |
| 13-01-03 | 01 | 1 | LAYOUT-02 | unit | `cd frontend && npx vitest run src/components/__tests__/CollapsibleSection.test.tsx` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 1 | LAYOUT-03 | unit | `cd frontend && npx vitest run src/components/__tests__/CollapsibleSection.test.tsx` | ❌ W0 | ⬜ pending |
| 13-02-02 | 02 | 1 | LAYOUT-02 | manual | See manual verifications below | N/A | ⬜ pending |
| 13-03-01 | 03 | 2 | LAYOUT-01 | manual | See manual verifications below | N/A | ⬜ pending |
| 13-03-02 | 03 | 2 | LAYOUT-01 | manual | See manual verifications below | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/store/__tests__/useAppStore.test.ts` — add `sidebarSections` describe block: test `toggleSidebarSection('layers')` flips only `layers` boolean; test toggling one section does not affect others
- [ ] `frontend/src/components/__tests__/CollapsibleSection.test.tsx` — new file: test renders `title` prop as text; test children visible when `open=true`; test children hidden (grid collapses) when `open=false`

*Wave 0 creates test stubs before any implementation — tests run red until implementation completes.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Collapse animation has no jump or reflow at 60 FPS | LAYOUT-01 | CSS `grid-template-rows` transition smoothness cannot be asserted in jsdom (no layout engine) | Open sidebar, click each section header, watch animation in Chrome DevTools Performance tab — no layout shift events, no FPS drop below 55 |
| Visual preset sliders and aircraft filter panels no longer overlap | LAYOUT-02 | Overlap is a visual/positional concern; jsdom does not compute layout | Open app, scroll sidebar to bottom — `PostProcessPanel` sliders should be inside sidebar, not floating over it; no duplicate VISUAL PRESET buttons |
| Sidebar section open/closed state survives sidebar close/reopen cycle | LAYOUT-01 | Requires browser render cycle and sidebar toggle interaction | Collapse FILTERS, close sidebar (click X), reopen sidebar — FILTERS should still be collapsed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
