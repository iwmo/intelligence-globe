---
phase: 31
slug: documentation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — file existence checks only |
| **Config file** | none |
| **Quick run command** | `test -f README.md && test -f LICENSE && echo "OK"` |
| **Full suite command** | `test -f README.md && test -f LICENSE && echo "OK"` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run `test -f README.md && test -f LICENSE && echo "OK"`
- **After every plan wave:** Run `test -f README.md && test -f LICENSE && echo "OK"`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 1 second

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 31-01-01 | 01 | 1 | DOC-01 | file check | `test -f README.md && echo "OK"` | ❌ W0 | ⬜ pending |
| 31-01-02 | 01 | 1 | DOC-02 | file check | `test -f LICENSE && echo "OK"` | ❌ W0 | ⬜ pending |
| 31-01-03 | 01 | 1 | DOC-01 | content check | `grep -q "docker compose up" README.md && echo "OK"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `README.md` — created in Wave 1 (no pre-stub needed)
- [ ] `LICENSE` — created in Wave 1 (no pre-stub needed)

*Existing infrastructure covers all phase requirements — no test framework installation needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| README is readable and accurate end-to-end | DOC-01 | Human judgment required for clarity/completeness | Read README top-to-bottom; verify all commands work |
| LICENSE copyright line filled correctly | DOC-02 | Author name is a placeholder | Check that `[Your Name]` placeholder is replaced |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 1s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
