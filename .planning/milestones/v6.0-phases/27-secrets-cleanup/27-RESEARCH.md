# Phase 27: Secrets Cleanup - Research

**Researched:** 2026-03-14
**Domain:** Docker Compose environment variable security, .dockerignore, .env.example conventions
**Confidence:** HIGH

## Summary

Phase 27 is a surgical file-editing phase with no new library dependencies. The codebase already has `.env.example` (partial) and `.gitignore` (excluding `.env`), but it is missing `.dockerignore` files for both `backend/` and `frontend/`, and `docker-compose.yml` contains four hardcoded credential fallbacks that need to become bare `${VAR}` references.

The scope is precisely bounded: edit three files, create two files. The only complexity is knowing which `:-default` fallbacks are safe to keep (non-sensitive infrastructure like `POSTGRES_DB`, `FRONTEND_ORIGIN`, `VERSION`) versus which must become bare (any credential or API key). The `docker compose config` command with no `.env` is the canonical verification tool: after the fix, unset credential variables will produce visible `variable is not set` warnings instead of silently substituting live secrets.

**Primary recommendation:** Strip `:-default` from the four credential variables in `docker-compose.yml`, create both `.dockerignore` files, and expand `.env.example` to include all required credential variables with descriptive placeholder values.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEC-01 | `docker-compose.yml` contains no hardcoded credential fallback values — only bare `${VAR}` references, no `:-default` for secrets | Exact lines identified: OPENSKY_CLIENT_SECRET (×2), OPENSKY_CLIENT_ID is non-secret but pairs with secret so include, AISSTREAM_API_KEY (×1). Bare `${VAR}` syntax is standard Docker Compose. |
| SEC-02 | `backend/.dockerignore` and `frontend/.dockerignore` exist and exclude `.env`, `*.env`, and credential files from `COPY . .` | Both Dockerfiles use `COPY . .` with no existing `.dockerignore`. Files must be created from scratch. |
| SEC-03 | Root `.env.example` includes all required variables with placeholder values (`OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`, `AISSTREAM_API_KEY`, `VITE_CESIUM_ION_TOKEN`) | Current `.env.example` is missing all four credential variables. It only covers Postgres, `FRONTEND_ORIGIN`, `VERSION`, and `VITE_CESIUM_ION_TOKEN` (without the API vars). |
</phase_requirements>

## Audit: Current State vs. Required State

### docker-compose.yml — Credential Fallbacks to Remove

| Line(s) | Variable | Current Value | Required |
|---------|----------|---------------|----------|
| 42, 60 | `OPENSKY_CLIENT_ID` | `:-REDACTED_OPENSKY_CLIENT_ID` | `${OPENSKY_CLIENT_ID}` |
| 43, 61 | `OPENSKY_CLIENT_SECRET` | `:-REDACTED_OPENSKY_SECRET` | `${OPENSKY_CLIENT_SECRET}` |
| 76 | `AISSTREAM_API_KEY` | `:-f7580cbd850ebc8fb86094df59f9a0f5e96aef4d` | `${AISSTREAM_API_KEY}` |

Note: `VITE_CESIUM_ION_TOKEN: ${VITE_CESIUM_ION_TOKEN:-}` uses an empty-string default — this is already not a real credential but still should become `${VITE_CESIUM_ION_TOKEN}` bare to be consistent with the requirement.

### Fallbacks That Are SAFE to Keep (non-credentials)

These variables use `:-default` but contain only infrastructure defaults, not secrets. SEC-01 requirement specifically targets "credential variables" so these may be retained:

- `POSTGRES_DB:-opensignal` — database name, not a secret
- `POSTGRES_USER:-postgres` — username, not sensitive for homelab
- `POSTGRES_PASSWORD:-postgres` — technically a credential; decision needed (see Open Questions)
- `FRONTEND_ORIGIN:-http://localhost:3000` — safe
- `VERSION:-0.1.0` — safe
- `DATABASE_URL` (composed from Postgres vars) — follows Postgres var decisions

The healthcheck on line 14 also uses `${POSTGRES_USER:-postgres}` and `${POSTGRES_DB:-opensignal}` — these must stay consistent with whatever the Postgres service env block uses.

### .env.example — Variables to Add

Current `.env.example` has: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `FRONTEND_ORIGIN`, `VERSION`, `VITE_CESIUM_ION_TOKEN`, `VITE_API_BASE_URL`

Missing and required by SEC-03:

| Variable | Placeholder Value | Source |
|----------|------------------|--------|
| `OPENSKY_CLIENT_ID` | `your-opensky-client-id` | OpenSky OAuth2 |
| `OPENSKY_CLIENT_SECRET` | `your-opensky-client-secret` | OpenSky OAuth2 |
| `AISSTREAM_API_KEY` | `your-aisstream-api-key` | AISStream.io |
| `API_KEY` | `your-api-key` | Phase 28 (add now per success criteria) |

Note: `API_KEY` appears in the phase success criteria description and in STATE.md key decisions ("Phase 27 runs before Phase 28 so API_KEY is guaranteed present in .env.example"). Include it now.

### .dockerignore Files — To Create

Both `backend/.dockerignore` and `frontend/.dockerignore` are missing.

**Why they matter:** Both Dockerfiles use `COPY . .` in their production stages. Without `.dockerignore`, a `.env` file sitting in the build context is copied into the image layer and becomes readable by anyone with access to the image.

**Standard content for both:**
```
.env
*.env
.env.*
.env.local
.env.*.local
```

Frontend may additionally benefit from excluding `node_modules/` and `dist/` to keep build context small (though these are likely already in the build context volume, this is best practice).

## Standard Patterns

### Docker Compose Bare Variable Syntax

Docker Compose (v2+) supports two forms:
- `${VAR:-default}` — substitutes default if VAR is unset or empty
- `${VAR}` — bare reference; if VAR is unset, Docker Compose warns and substitutes empty string (Compose v2) OR fails with error depending on `--env-file` and compose version

**Verification behavior:** Running `docker compose config` without a `.env` will show which variables are unset. With bare `${VAR}` for credential variables, the output will show the variable name but not a leaked value. Docker Compose does NOT hard-error on unset bare variables by default — it substitutes empty string and may warn. To get a hard error, the compose spec supports `${VAR:?error message}` syntax.

**SEC-01 success criterion #4 says:** "produces a visible unset-variable error rather than silently substituting a credential." This implies using `${VAR:?error message}` OR accepting the Docker Compose warning output as "visible error." The requirement language says "visible unset-variable error" which `${VAR:?}` produces reliably.

**Recommendation:** Use `${VAR:?Set OPENSKY_CLIENT_SECRET in .env}` for the three credential variables to guarantee a hard error with a helpful message. This exceeds the minimum requirement and prevents silent misconfiguration. This is a planner decision — both bare `${VAR}` and `${VAR:?msg}` satisfy the letter of SEC-01; `${VAR:?msg}` also satisfies criterion #4.

### .dockerignore Pattern

Docker `.dockerignore` uses the same syntax as `.gitignore`. Standard patterns:

```
# Secrets — never copy into image
.env
*.env
.env.*
.env.local
.env.*.local

# Build artifacts (reduce context size)
node_modules/
dist/
__pycache__/
*.pyc
.pytest_cache/
```

Source: Docker official documentation (HIGH confidence — standard pattern).

### .env.example Convention

The `.env.example` file serves as operator documentation. Standard convention:
- Real variable names
- Placeholder values (never real secrets)
- Comments explaining where to obtain values
- All variables the application requires, in logical groupings

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting unset vars at runtime | Custom Python check at startup | `${VAR:?message}` in compose | Docker Compose handles this at `docker compose up` time, before containers start |
| Preventing `.env` from entering images | Manual Dockerfile exclusion | `.dockerignore` | `.dockerignore` is the purpose-built mechanism; Dockerfile `COPY` exclusions are error-prone |
| Secret scanning | Manual grep | gitleaks (Phase 30, CI-03) | Phase 30 will add CI secret scanning; this phase just removes the existing hardcoded values |

## Common Pitfalls

### Pitfall 1: Removing Fallbacks From DATABASE_URL Composite String
**What goes wrong:** `DATABASE_URL` is constructed inline: `postgresql+asyncpg://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@postgres:5432/${POSTGRES_DB:-opensignal}`. Removing the fallbacks from individual vars but not the composite string leaves the secret still embedded.
**Why it happens:** The variable appears twice — once in the Postgres service `environment` block and once inline in `DATABASE_URL`.
**How to avoid:** Touch ALL occurrences of each credential variable across all services. `OPENSKY_CLIENT_ID` and `OPENSKY_CLIENT_SECRET` appear in both `backend` and `worker` services.

### Pitfall 2: .dockerignore Not in Build Context Root
**What goes wrong:** `.dockerignore` must be in the same directory as the `Dockerfile` (the `context:` directory in docker-compose.yml). Placing it at the project root instead of `backend/` or `frontend/` has no effect.
**Why it happens:** Developers assume `.dockerignore` works like `.gitignore` (hierarchical). It does not — it must be co-located with the Dockerfile.
**How to avoid:** Create `backend/.dockerignore` (alongside `backend/Dockerfile`) and `frontend/.dockerignore` (alongside `frontend/Dockerfile`).

### Pitfall 3: .env.example With Empty VITE_CESIUM_ION_TOKEN
**What goes wrong:** Current `.env.example` has `VITE_CESIUM_ION_TOKEN=` (empty). This looks like the variable is set but with no value — operators may not realize they need to fill it in.
**How to avoid:** Use a descriptive placeholder: `VITE_CESIUM_ION_TOKEN=your-cesium-ion-token-from-ion.cesium.com`

### Pitfall 4: docker compose config Still Shows Secret Values
**What goes wrong:** After stripping `:-defaults`, if the user has a `.env` file with real values, `docker compose config` will still print them. The verification test must be run without the `.env` file present.
**How to avoid:** The verification step must temporarily rename or remove `.env` to confirm unset behavior. Document this in the plan's verification steps.

### Pitfall 5: Postgres Password Classification
**What goes wrong:** `POSTGRES_PASSWORD:-postgres` is technically a credential but uses a trivial default. SEC-01 says "no hardcoded credential fallback values." If the planner includes Postgres password in the cleanup, the `DATABASE_URL` composite string must also be updated across all three services using it.
**Recommendation for planner:** Apply the same treatment to `POSTGRES_PASSWORD` as to the API credentials (strip `:-postgres` default). Keep `POSTGRES_DB:-opensignal` and `POSTGRES_USER:-postgres` as-is since they are not secrets. Update `.env.example` to confirm `POSTGRES_PASSWORD=changeme` (already present).

## Code Examples

### Bare Variable Reference (without error)
```yaml
# Source: Docker Compose specification
environment:
  OPENSKY_CLIENT_SECRET: ${OPENSKY_CLIENT_SECRET}
```

### Variable With Mandatory Error (recommended for credentials)
```yaml
# Source: Docker Compose specification — ${VAR:?error} syntax
environment:
  OPENSKY_CLIENT_SECRET: ${OPENSKY_CLIENT_SECRET:?Set OPENSKY_CLIENT_SECRET in .env}
  OPENSKY_CLIENT_ID: ${OPENSKY_CLIENT_ID:?Set OPENSKY_CLIENT_ID in .env}
  AISSTREAM_API_KEY: ${AISSTREAM_API_KEY:?Set AISSTREAM_API_KEY in .env}
```

When `OPENSKY_CLIENT_SECRET` is unset, `docker compose up` (and `docker compose config`) prints:
```
invalid interpolation format for services.backend.environment.OPENSKY_CLIENT_SECRET:
  "required variable OPENSKY_CLIENT_SECRET is missing a value: Set OPENSKY_CLIENT_SECRET in .env"
```

### .dockerignore (both backend and frontend)
```
# Secrets
.env
*.env
.env.*
.env.local

# Build artifacts (reduce context size)
__pycache__/
*.pyc
*.pyo
.pytest_cache/
.coverage
```

### frontend/.dockerignore (additional exclusions)
```
# Secrets
.env
*.env
.env.*
.env.local

# Build artifacts
node_modules/
dist/
.vite/
```

### Complete .env.example
```bash
# PostgreSQL
POSTGRES_DB=opensignal
POSTGRES_USER=postgres
POSTGRES_PASSWORD=changeme

# Backend
FRONTEND_ORIGIN=http://localhost:3000
VERSION=0.1.0

# API Authentication (Phase 28)
API_KEY=your-secret-api-key

# OpenSky Network OAuth2 — https://opensky-network.org/
OPENSKY_CLIENT_ID=your-opensky-client-id
OPENSKY_CLIENT_SECRET=your-opensky-client-secret

# AISStream.io — https://aisstream.io/
AISSTREAM_API_KEY=your-aisstream-api-key

# Cesium Ion — https://ion.cesium.com/tokens
VITE_CESIUM_ION_TOKEN=your-cesium-ion-token

# Frontend
VITE_API_BASE_URL=http://localhost:8000
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `${VAR:-secret}` fallbacks | `${VAR:?error}` bare refs | Eliminates silent secret substitution |
| No `.dockerignore` | `.dockerignore` per service | `.env` excluded from image layers |
| Partial `.env.example` | Complete `.env.example` | Operators can onboard from a single copy-paste |

## Open Questions

1. **Should `POSTGRES_PASSWORD` lose its `:-postgres` default?**
   - What we know: SEC-01 says "no hardcoded credential fallback values." Postgres password is a credential.
   - What's unclear: "postgres" is a trivially insecure default, not a real secret like the API keys. The success criteria only explicitly name the API-layer credentials.
   - Recommendation for planner: Apply consistent treatment — strip `:-postgres` from `POSTGRES_PASSWORD` everywhere (service env + DATABASE_URL composite). This is a minor extra edit that prevents a future audit question.

2. **Bare `${VAR}` vs. `${VAR:?message}` for credentials**
   - What we know: The success criterion says "produces a visible unset-variable error." Bare `${VAR}` in modern Docker Compose produces a warning but not an error exit code. `${VAR:?msg}` produces a hard error.
   - Recommendation: Use `${VAR:?msg}` for the three credential variables to definitively satisfy criterion #4.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend), vitest (frontend) |
| Config file | `backend/pytest.ini` |
| Quick run command | `cd backend && pytest tests/ -x -q` |
| Full suite command | `cd backend && pytest tests/ && cd ../frontend && npm run test:run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | `docker compose config` with no `.env` shows unset-variable error for credential vars | smoke | `cp .env .env.bak && rm .env && docker compose config 2>&1 \| grep -E "(missing\|required\|unset)" && mv .env.bak .env` | ❌ Wave 0 (shell script or manual step) |
| SEC-02 | `.dockerignore` files exist and exclude `.env` | manual verification | `ls backend/.dockerignore frontend/.dockerignore` | ❌ Wave 0 |
| SEC-03 | `.env.example` contains all required variables | smoke | `grep -E "OPENSKY_CLIENT_ID\|OPENSKY_CLIENT_SECRET\|AISSTREAM_API_KEY\|VITE_CESIUM_ION_TOKEN\|API_KEY" .env.example` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `ls backend/.dockerignore frontend/.dockerignore && grep OPENSKY_CLIENT_SECRET .env.example`
- **Per wave merge:** Full verification script (SEC-01 smoke + SEC-02 + SEC-03)
- **Phase gate:** All three checks pass before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] No automated test for SEC-01 — verification is a shell command sequence; document in VERIFICATION.md
- [ ] No automated test for SEC-02/SEC-03 — file existence checks; simple grep/ls suffice

*(These are file-existence and configuration checks, not code under test — automated test files are not required. Verification steps in VERIFICATION.md cover all three.)*

## Security Note (Non-Blocking)

STATE.md documents that real keys are in git history via old `docker-compose.yml` hardcoded fallbacks. Phase 27 removes the fallbacks from the working tree but does NOT purge git history. Before making the repository public:
- Rotate `OPENSKY_CLIENT_SECRET` (currently `REDACTED_OPENSKY_SECRET`)
- Rotate `AISSTREAM_API_KEY` (currently `f7580cbd850ebc8fb86094df59f9a0f5e96aef4d`)
- Use `git filter-repo` or reset the GitHub repository to purge history

This is a user action item documented in STATE.md, not a Phase 27 code task.

## Sources

### Primary (HIGH confidence)
- Docker Compose specification — variable substitution syntax (`${VAR}`, `${VAR:-default}`, `${VAR:?error}`)
- Docker documentation — `.dockerignore` file behavior and placement rules
- Direct audit of project files: `docker-compose.yml`, `.env.example`, `backend/Dockerfile`, `frontend/Dockerfile`

### Secondary (MEDIUM confidence)
- Docker `.dockerignore` must be co-located with build context `context:` directory — confirmed by Docker Build documentation

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; pure file editing
- Architecture: HIGH — exact lines identified, no ambiguity about what changes
- Pitfalls: HIGH — all pitfalls derived from direct code inspection, not speculation

**Research date:** 2026-03-14
**Valid until:** Stable — Docker Compose variable substitution syntax is unchanged since Compose v2 (2021). Safe for 180+ days.
