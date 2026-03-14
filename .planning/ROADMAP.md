# Roadmap: OpenSignal Globe

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-03-11) — [Archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 WorldView Parity** — Phases 7-12 (shipped 2026-03-12) — [Archive](milestones/v2.0-ROADMAP.md)
- ✅ **v3.0 UI Refinement** — Phases 13-16 (shipped 2026-03-13) — [Archive](milestones/v3.0-ROADMAP.md)
- ✅ **v4.0 Data Reliability & Freshness** — Phases 17-22 (shipped 2026-03-13) — [Archive](milestones/v4.0-ROADMAP.md)
- ✅ **v5.0 Playback** — Phases 23-26 (shipped 2026-03-14) — [Archive](milestones/v5.0-ROADMAP.md)
- 🚧 **v6.0 Production Ready** — Phases 27-31 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-6) — SHIPPED 2026-03-11</summary>

- [x] Phase 1: Foundation (3/3 plans) — completed 2026-03-11
- [x] Phase 2: Satellite Layer (4/4 plans) — completed 2026-03-11
- [x] Phase 3: Aircraft Layer (3/3 plans) — completed 2026-03-11
- [x] Phase 4: Controls and Polish (3/3 plans) — completed 2026-03-11
- [x] Phase 5: Performance (3/3 plans) — completed 2026-03-11
- [x] Phase 6: Deploy Hardening (1/1 plan) — completed 2026-03-11

</details>

<details>
<summary>✅ v2.0 WorldView Parity (Phases 7-12) — SHIPPED 2026-03-12</summary>

- [x] Phase 7: Visual Engine + Navigation (5/5 plans) — completed 2026-03-12
- [x] Phase 8: New Data Pipelines — Military + Maritime (6/6 plans) — completed 2026-03-12
- [x] Phase 9: GPS Jamming + Street Traffic (5/5 plans) — completed 2026-03-12
- [x] Phase 10: Snapshot Infrastructure (3/3 plans) — completed 2026-03-12
- [x] Phase 11: Replay Engine (4/4 plans) — completed 2026-03-12
- [x] Phase 12: OSINT Event Correlation (5/5 plans) — completed 2026-03-12

</details>

<details>
<summary>✅ v3.0 UI Refinement (Phases 13-16) — SHIPPED 2026-03-13</summary>

- [x] Phase 13: Collapsible Sidebar Layout (3/3 plans) — completed 2026-03-13
- [x] Phase 14: Entity Icons and Altitude Scaling (4/4 plans) — completed 2026-03-12
- [x] Phase 15: Camera Navigation Controls (3/3 plans) — completed 2026-03-13
- [x] Phase 16: Persistent Settings Panel (3/3 plans) — completed 2026-03-13

</details>

<details>
<summary>✅ v4.0 Data Reliability & Freshness (Phases 17-22) — SHIPPED 2026-03-13</summary>

- [x] Phase 17: Schema Migration (1/1 plans) — completed 2026-03-13
- [x] Phase 18: Shared Freshness Helper (1/1 plans) — completed 2026-03-13
- [x] Phase 19: Aircraft Ingest + Route (2/2 plans) — completed 2026-03-13
- [x] Phase 20: Military, Ships, and Jamming Ingest (3/3 plans) — completed 2026-03-13
- [x] Phase 21: API Route Filtering (3/3 plans) — completed 2026-03-13
- [x] Phase 22: Tests (3/3 plans) — completed 2026-03-13

</details>

<details>
<summary>✅ v5.0 Playback (Phases 23-26) — SHIPPED 2026-03-14</summary>

- [x] Phase 23: Store Foundation + Viewer Clock (4/4 plans) — completed 2026-03-13
- [x] Phase 24: Satellite Propagation Fix (2/2 plans) — completed 2026-03-13
- [x] Phase 25: Layer Audit (4/4 plans) — completed 2026-03-13
- [x] Phase 26: End-to-End Verification + Stale Indicators (4/4 plans) — completed 2026-03-13

</details>

### 🚧 v6.0 Production Ready (In Progress)

**Milestone Goal:** Harden the project for public release — scrub secrets, build a production-grade Docker stack with nginx reverse proxy, add a full GitHub Actions CI pipeline, and ship a README + LICENSE.

#### Phases

- [x] **Phase 27: Secrets Cleanup** — Scrub hardcoded credentials from docker-compose.yml, add .dockerignore files, publish .env.example (completed 2026-03-14)
- [x] **Phase 28: API Key Auth** — Backend middleware protecting write endpoints with static API_KEY (completed 2026-03-14)
- [x] **Phase 29: Production Docker Stack** — nginx reverse proxy, single port 80 entry point, Docker healthchecks (completed 2026-03-14)
- [x] **Phase 30: CI Pipeline** — GitHub Actions: pytest, vitest+tsc, gitleaks, docker build (completed 2026-03-14)
- [x] **Phase 31: Documentation** — Root README.md and LICENSE file (completed 2026-03-14)

## Phase Details

### Phase 27: Secrets Cleanup
**Goal**: The repository contains no hardcoded secrets and any operator can onboard by copying .env.example
**Depends on**: Nothing (first phase of v6.0)
**Requirements**: SEC-01, SEC-02, SEC-03
**Success Criteria** (what must be TRUE):
  1. `docker-compose.yml` uses bare `${VAR}` references with no `:-default` fallbacks for any credential variable
  2. `backend/.dockerignore` and `frontend/.dockerignore` exist and exclude `.env` and `*.env` files
  3. `.env.example` lists every required variable (`OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`, `AISSTREAM_API_KEY`, `VITE_CESIUM_ION_TOKEN`, `API_KEY`, and any others) with placeholder values
  4. Running `docker compose config` with no `.env` file produces a visible unset-variable error rather than silently substituting a credential
**Plans**: 1 plan
Plans:
- [x] 27-01-PLAN.md — Strip credential fallbacks, create .dockerignore files, expand .env.example

### Phase 28: API Key Auth
**Goal**: Write endpoints are protected — unauthenticated callers receive 401, not data
**Depends on**: Phase 27
**Requirements**: SEC-04
**Success Criteria** (what must be TRUE):
  1. `POST /api/osint-events` returns HTTP 401 when the `X-API-Key` header is absent
  2. `POST /api/osint-events` returns HTTP 401 when the header value does not match `API_KEY` env var
  3. `POST /api/osint-events` returns HTTP 201 when the correct `API_KEY` value is supplied
  4. All read endpoints (`GET /api/*`) are unaffected and return data without any key
**Plans**: 1 plan
Plans:
- [ ] 28-01-PLAN.md — Add api_key to Settings, create deps.py, protect POST route, add auth tests

### Phase 29: Production Docker Stack
**Goal**: The project runs on a single port 80 via nginx with no dev-server ports exposed and all services health-checked
**Depends on**: Phase 27
**Requirements**: PROD-01, PROD-02, PROD-03, PROD-04
**Success Criteria** (what must be TRUE):
  1. `docker compose up` with no profile flags starts nginx on port 80; Vite dev-server port is not published
  2. Browser requests to `http://localhost/api/aircraft` are proxied to the backend container and return JSON
  3. The frontend is served as a production nginx static build (no Vite HMR socket, no dev overlays)
  4. `docker compose ps` shows `healthy` for `backend`, `worker`, and `ais-worker` after startup
**Plans**: 1 plan
Plans:
- [ ] 29-01-PLAN.md — nginx reverse proxy, production build targets, Docker healthchecks

### Phase 30: CI Pipeline
**Goal**: Every push and PR is automatically verified for test correctness, type safety, secret hygiene, and image buildability
**Depends on**: Phase 27
**Requirements**: CI-01, CI-02, CI-03, CI-04
**Success Criteria** (what must be TRUE):
  1. A GitHub Actions run triggered on push to any branch executes `pytest` and reports pass/fail in the PR checks panel
  2. A GitHub Actions run executes `vitest run` and `tsc --noEmit`; a TypeScript error in any `.tsx` file fails the check
  3. A GitHub Actions run executes gitleaks; committing a real credential causes the workflow to fail and block merge
  4. A GitHub Actions run builds both backend and frontend Docker images with `--target production`; a broken Dockerfile fails the check
**Plans**: 1 plan
Plans:
- [ ] 30-01-PLAN.md — GitHub Actions workflows for pytest, vitest+tsc, gitleaks, docker build

### Phase 31: Documentation
**Goal**: Any developer can clone the repo, read the README, and have the stack running within minutes
**Depends on**: Phase 29, Phase 30
**Requirements**: DOC-01, DOC-02
**Success Criteria** (what must be TRUE):
  1. Root `README.md` exists and includes: project overview, prerequisites (Docker, .env setup), `cp .env.example .env` onboarding step, `docker compose up` command, and API key configuration instructions
  2. `LICENSE` file exists in the repository root
  3. A developer following only the README can start the stack without consulting any other file
**Plans**: 1 plan
Plans:
- [x] 31-01-PLAN.md — Root README.md and LICENSE file

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-03-11 |
| 2. Satellite Layer | v1.0 | 4/4 | Complete | 2026-03-11 |
| 3. Aircraft Layer | v1.0 | 3/3 | Complete | 2026-03-11 |
| 4. Controls and Polish | v1.0 | 3/3 | Complete | 2026-03-11 |
| 5. Performance | v1.0 | 3/3 | Complete | 2026-03-11 |
| 6. Deploy Hardening | v1.0 | 1/1 | Complete | 2026-03-11 |
| 7. Visual Engine + Navigation | v2.0 | 5/5 | Complete | 2026-03-12 |
| 8. Military + Maritime Pipelines | v2.0 | 6/6 | Complete | 2026-03-12 |
| 9. GPS Jamming + Street Traffic | v2.0 | 5/5 | Complete | 2026-03-12 |
| 10. Snapshot Infrastructure | v2.0 | 3/3 | Complete | 2026-03-12 |
| 11. Replay Engine | v2.0 | 4/4 | Complete | 2026-03-12 |
| 12. OSINT Event Correlation | v2.0 | 5/5 | Complete | 2026-03-12 |
| 13. Collapsible Sidebar Layout | v3.0 | 3/3 | Complete | 2026-03-13 |
| 14. Entity Icons and Altitude Scaling | v3.0 | 4/4 | Complete | 2026-03-12 |
| 15. Camera Navigation Controls | v3.0 | 3/3 | Complete | 2026-03-13 |
| 16. Persistent Settings Panel | v3.0 | 3/3 | Complete | 2026-03-13 |
| 17. Schema Migration | v4.0 | 1/1 | Complete | 2026-03-13 |
| 18. Shared Freshness Helper | v4.0 | 1/1 | Complete | 2026-03-13 |
| 19. Aircraft Ingest + Route | v4.0 | 2/2 | Complete | 2026-03-13 |
| 20. Military, Ships, and Jamming Ingest | v4.0 | 3/3 | Complete | 2026-03-13 |
| 21. API Route Filtering | v4.0 | 3/3 | Complete | 2026-03-13 |
| 22. Tests | v4.0 | 3/3 | Complete | 2026-03-13 |
| 23. Store Foundation + Viewer Clock | v5.0 | 4/4 | Complete | 2026-03-13 |
| 24. Satellite Propagation Fix | v5.0 | 2/2 | Complete | 2026-03-13 |
| 25. Layer Audit | v5.0 | 4/4 | Complete | 2026-03-13 |
| 26. End-to-End Verification + Stale Indicators | v5.0 | 4/4 | Complete | 2026-03-13 |
| 27. Secrets Cleanup | v6.0 | 1/1 | Complete | 2026-03-14 |
| 28. API Key Auth | 1/1 | Complete    | 2026-03-14 | - |
| 29. Production Docker Stack | 1/1 | Complete    | 2026-03-14 | - |
| 30. CI Pipeline | 1/1 | Complete    | 2026-03-14 | - |
| 31. Documentation | v6.0 | Complete    | 2026-03-14 | 2026-03-14 |
