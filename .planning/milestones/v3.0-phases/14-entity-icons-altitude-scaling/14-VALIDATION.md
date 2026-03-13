---
phase: 14
slug: entity-icons-altitude-scaling
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test infrastructure exists |
| **Config file** | None |
| **Quick run command** | `cd frontend && npm run build` |
| **Full suite command** | `cd frontend && npm run lint && npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npm run build`
- **After every plan wave:** Run `cd frontend && npm run lint && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green + visual zoom test passed
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | ICONS-01, ICONS-02, ICONS-03 | compile | `cd frontend && npm run build` | ✅ | ⬜ pending |
| 14-02-01 | 02 | 2 | ICONS-02, ICONS-03, ICONS-05 | compile + manual | `cd frontend && npm run build` | ✅ | ⬜ pending |
| 14-03-01 | 03 | 2 | ICONS-01, ICONS-05 | compile + manual | `cd frontend && npm run build` | ✅ | ⬜ pending |
| 14-04-01 | 04 | 3 | ICONS-04, ICONS-05 | compile + manual | `cd frontend && npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — TypeScript compile is the mechanically verifiable check for all plans.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Aircraft billboard icon visible as airplane silhouette | ICONS-01 | Visual rendering — no test framework | Open app, zoom to aircraft, confirm airplane shape icon (not dot) |
| Military billboard visually distinct from commercial aircraft | ICONS-02 | Visual rendering — no test framework | Open app, confirm military icon shape differs from commercial aircraft |
| Ship hull icon visible as vessel silhouette | ICONS-03 | Visual rendering — no test framework | Open app, zoom to ship, confirm hull shape icon (not dot) |
| Satellite uses PointPrimitive (not billboard); no GPU crash at 5,000+ | ICONS-04 | GPU stability — requires live runtime | Open app with satellites enabled, zoom full orbit; confirm no TextureAtlas crash |
| All icon types legible from 20,000 km to 500 m altitude | ICONS-05 | Visual + zoom behavior | Zoom continuously from orbital (20,000 km) to street level (500 m); all icon types must remain legible throughout |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
