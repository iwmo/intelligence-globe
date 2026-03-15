# Deferred Items — Phase 14

## Pre-existing TypeScript errors (out of scope for 14-01)

Found during 14-01 build verification. These errors existed before phase 14 began and are unrelated to canvas icon changes.

### 1. propagation.worker.ts — postMessage overload mismatch
- **File:** `frontend/src/workers/propagation.worker.ts` line 87
- **Error:** `TS2769: No overload matches this call` — `ArrayBuffer[]` passed as `transfer` argument in wrong position
- **Impact:** Does not affect layer files or billboard rendering

### 2. propagation.test.ts — null assertion
- **File:** `frontend/src/workers/__tests__/propagation.test.ts` lines 144, 146
- **Error:** `TS18047: 'pv' is possibly 'null'`
- **Impact:** Test-only, does not affect production code

### 3. vite.config.ts — unknown `test` property
- **File:** `frontend/vite.config.ts` line 42
- **Error:** `TS2769: Object literal may only specify known properties, and 'test' does not exist in type 'UserConfigExport'`
- **Impact:** Vitest config issue, does not affect production build output
