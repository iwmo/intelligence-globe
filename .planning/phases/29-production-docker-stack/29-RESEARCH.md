# Phase 29: Production Docker Stack - Research

**Researched:** 2026-03-14
**Domain:** Docker Compose multi-stage builds, nginx reverse proxy, container healthchecks
**Confidence:** HIGH

## Summary

Phase 29 converts the existing development-mode Docker Compose stack into a production-ready
single-entry-point configuration. The work is entirely configuration — no application code
changes. The frontend already has a working `production` build target (`nginx:alpine` stage)
in its multi-stage Dockerfile. The compose file currently uses `target: development` for the
frontend and exposes port 3000 directly. Three services (`backend`, `worker`, `ais-worker`)
have no healthchecks.

The four requirements map to exactly three files that need editing: `docker-compose.yml`
(PROD-01, PROD-03, PROD-04), `frontend/nginx.conf` (PROD-02, new file), and optionally a
small adjustment to `frontend/Dockerfile` to `COPY` the custom nginx config into the
production stage.

The dev workflow is preserved via `docker-compose.override.yml`, which already overrides the
frontend service with the development target and source-volume mounts. No separate prod-only
compose file is needed.

**Primary recommendation:** Add `frontend/nginx.conf` with `/api/` proxy_pass to `http://backend:8000`
and static SPA fallback; switch `docker-compose.yml` frontend `target` to `production` with
only port 80 exposed; add `curl`-based healthchecks to `backend`, `worker`, and `ais-worker`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROD-01 | `docker-compose.yml` frontend service uses the `production` build target (nginx static serving, not Vite dev server) | `frontend/Dockerfile` already has `AS production` stage using `nginx:alpine`; change `target: development` → `target: production` in compose |
| PROD-02 | nginx config routes `/api/*` to the `backend` container (reverse proxy) | New `frontend/nginx.conf` with `location /api/ { proxy_pass http://backend:8000; }` + SPA fallback; `COPY` into Dockerfile production stage |
| PROD-03 | Single public entry point on port 80 via nginx — no exposed Vite port in production | Remove `ports: - "3000:3000"` from frontend service; add `ports: - "80:80"`; backend port 8000 stays internal (or remove its host mapping) |
| PROD-04 | Docker Compose healthchecks for `backend`, `worker`, and `ais-worker` | `backend`: `curl -f http://localhost:8000/api/health`; `worker` and `ais-worker`: `python -c "import redis; redis.Redis.from_url(...).ping()"` or sentinel file pattern |
</phase_requirements>

---

## Standard Stack

### Core
| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| nginx:alpine | 1.27.x (current stable) | Static file serving + reverse proxy in production stage | Minimal image, built-in proxy_pass, official Docker Hub image |
| Docker Compose v2 | 2.x | Orchestration | Already in use; `docker compose` (no hyphen) CLI |
| curl | system in most Python images | Healthcheck HTTP probe | Available in `python:3.12-slim` without extra install |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `redis-cli ping` | Worker healthcheck via Redis liveness | Available in redis:7-alpine; workers depend on Redis being healthy |
| Python one-liner `import redis; r.ping()` | Worker healthcheck without extra tools | Use when `redis-cli` is not in the worker container image |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| nginx:alpine in frontend stage | traefik or caddy as separate service | nginx:alpine is zero-config for this use case; adding a separate container adds complexity for no benefit at homelab scale |
| curl healthcheck | wget | `curl` is more standard; `wget -qO-` works too if curl absent — check `python:3.12-slim` |

**Installation:** No new packages — all tools are already present in base images.

---

## Architecture Patterns

### Recommended Project Structure (additions only)
```
frontend/
└── nginx.conf          # NEW — nginx reverse proxy + SPA config (PROD-02)

docker-compose.yml      # EDIT — frontend target, ports, healthchecks
docker-compose.override.yml  # UNCHANGED — dev overrides remain
```

### Pattern 1: nginx Reverse Proxy with SPA Fallback
**What:** nginx serves `/` from static files; `/api/` requests are proxied upstream; unmatched
paths fall back to `index.html` for client-side routing.
**When to use:** Single-page application with a separate API backend on the same origin.

```nginx
# Source: nginx official docs + community SPA pattern
server {
    listen 80;

    # Serve static files from Vite build output
    root /usr/share/nginx/html;
    index index.html;

    # Reverse-proxy all /api/ calls to the backend container
    location /api/ {
        proxy_pass         http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # SPA fallback: any unknown path returns index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Pattern 2: Multi-Stage Dockerfile — COPY custom nginx.conf
**What:** The `production` stage in `frontend/Dockerfile` must copy the custom `nginx.conf`
into the image to override the default nginx config.
**When to use:** Always when using a custom nginx config with `nginx:alpine`.

```dockerfile
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf   # Override default
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Pattern 3: Docker Compose Healthcheck for HTTP Services
**What:** `backend` already has `/api/health` returning `{"status":"ok"}`. Use `curl -f` to
probe it. `curl` is NOT in `python:3.12-slim` by default — verify or use a Python one-liner.
**When to use:** Any HTTP service that has a health endpoint.

```yaml
# Source: Docker Compose healthcheck docs
healthcheck:
  test: ["CMD-SHELL", "curl -f http://localhost:8000/api/health || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### Pattern 4: Healthcheck for Non-HTTP Workers (Redis ping)
**What:** `worker` and `ais-worker` have no HTTP server. The only meaningful liveness signal
is whether they can reach Redis (their dependency). Use a Python one-liner since Python is
available in the container.
**When to use:** Long-running worker processes without an HTTP interface.

```yaml
healthcheck:
  test: ["CMD-SHELL", "python -c \"import redis, os; redis.Redis.from_url(os.environ['REDIS_URL']).ping()\""]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 20s
```

### Pattern 5: docker-compose.override.yml for Dev/Prod Split
**What:** `docker-compose.override.yml` is automatically merged by `docker compose up` with
NO flags. This makes development the zero-config experience while prod requires
`docker compose -f docker-compose.yml up`.
**Current state of the project:** override already exists and sets dev targets/volumes. The
base `docker-compose.yml` should be the production-ready config. This is already the
architectural intent in STATE.md ("integrated into main docker-compose.yml").

### Anti-Patterns to Avoid
- **Exposing backend port 8000 to the host in production:** The whole point of the nginx
  reverse proxy is that the browser calls `http://localhost/api/...` on port 80. If 8000 is
  also exposed, the security intent is undermined. Remove the `ports: - "8000:8000"` from
  `backend` in the base compose file (the override can add it back for dev debugging).
- **Setting `VITE_API_BASE_URL` in the production frontend container:** In production, the
  frontend is a compiled static bundle — Vite env vars are baked in at build time. The nginx
  proxy eliminates the need for `VITE_API_BASE_URL` at runtime; API calls use relative paths.
- **Using `depends_on: service_started` for healthcheck dependencies:** The compose file
  already uses `condition: service_healthy` for postgres/redis; follow the same pattern
  for backend where frontend `depends_on` is added.
- **Forgetting `start_period`:** Workers take a few seconds to initialize before Redis probes
  should be attempted. Without `start_period`, healthchecks fire during startup and mark the
  service unhealthy prematurely.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API proxying in production | Custom Node.js/Python proxy layer | nginx `proxy_pass` directive | nginx handles connection pooling, header forwarding, error handling out of box |
| Health probing | Custom HTTP poller container | Docker Compose `healthcheck.test` | Native compose feature, no extra container |
| Dev/prod config split | Two separate docker-compose files | `docker-compose.override.yml` pattern | Already in place; Docker Compose merges automatically |

**Key insight:** Everything in this phase is nginx and Docker Compose configuration — no
application code. Resist any urge to add health endpoint code to workers.

---

## Common Pitfalls

### Pitfall 1: curl not installed in python:3.12-slim
**What goes wrong:** `healthcheck test: ["CMD", "curl", "-f", ...]` fails with
`/bin/sh: curl: not found` and the service is permanently marked unhealthy.
**Why it happens:** `python:3.12-slim` is a minimal Debian image; curl is not included.
**How to avoid:** Either (a) use `python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"` which uses stdlib only, or (b) add `RUN apt-get install -y --no-install-recommends curl` to the backend Dockerfile's production stage. Option (a) requires no Dockerfile change.
**Warning signs:** `docker compose ps` shows `health: starting` forever or `unhealthy`.

### Pitfall 2: nginx COPY context mismatch
**What goes wrong:** `COPY nginx.conf /etc/nginx/conf.d/default.conf` in the Dockerfile fails
because the file is not in the build context (`./frontend`).
**Why it happens:** Docker build context is `./frontend`. `nginx.conf` must live at
`frontend/nginx.conf`, not at the project root.
**How to avoid:** Place `nginx.conf` inside `frontend/` — same directory as the `Dockerfile`.
**Warning signs:** `COPY failed: file not found in build context`.

### Pitfall 3: Cesium static assets not served from nginx
**What goes wrong:** Globe loads but Cesium workers and assets 404 (the `/cesiumStatic/` path).
**Why it happens:** Cesium uses `viteStaticCopy` to emit large static assets into `dist/cesiumStatic/`. nginx `try_files $uri $uri/ /index.html` handles this correctly AS LONG AS the nginx root is `/usr/share/nginx/html` and the Vite build writes to `dist/`. The existing `FROM builder COPY /app/dist` copies the full dist tree including cesiumStatic subdirectory.
**How to avoid:** No extra config needed — the try_files pattern and full dist copy handle it.
**Warning signs:** 404s for `/cesiumStatic/Workers/...` in browser network tab.

### Pitfall 4: SPA routing broken — 404 on page refresh
**What goes wrong:** Navigating directly to any non-root path returns nginx 404.
**Why it happens:** nginx default config has no fallback to `index.html` for unknown paths.
**How to avoid:** The `try_files $uri $uri/ /index.html` directive is mandatory. Do not omit it.
**Warning signs:** Hard refresh on any non-root path returns nginx 404 page.

### Pitfall 5: FRONTEND_ORIGIN CORS mismatch in production
**What goes wrong:** Backend returns CORS error for requests coming through nginx on port 80.
**Why it happens:** `backend` container has `FRONTEND_ORIGIN=http://localhost:3000` but in
production the browser origin is `http://localhost` (port 80, implicit). The CORS middleware
rejects the request.
**How to avoid:** Set `FRONTEND_ORIGIN=http://localhost` (or the actual production domain) in
the `backend` service environment in `docker-compose.yml`. The `.env.example` already has this
as a configurable variable.
**Warning signs:** Browser console shows CORS policy errors on API responses.

### Pitfall 6: docker-compose.override.yml merges unexpectedly
**What goes wrong:** Running `docker compose up` on a dev machine still uses development
targets even after editing the base file.
**Why it happens:** `docker-compose.override.yml` is auto-merged. It sets `target: dev` for
backend and the source volume mounts for frontend. In dev this is correct. For production
deployment the override must be excluded: `docker compose -f docker-compose.yml up`.
**How to avoid:** Document the distinction clearly in README (Phase 31). The prod stack is
not broken — it is correct behavior. Dev machines get HMR; prod deployments use only the
base file.

---

## Code Examples

### Full nginx.conf for this project

```nginx
# Source: nginx docs + Vite SPA deployment guide
# frontend/nginx.conf

server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass         http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### backend healthcheck using Python stdlib (no curl dependency)

```yaml
# Source: Docker Compose healthcheck docs — CMD-SHELL form
healthcheck:
  test: ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')\""]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### worker healthcheck using Python redis client

```yaml
# Source: Docker Compose healthcheck docs
healthcheck:
  test: ["CMD-SHELL", "python -c \"import redis, os; redis.Redis.from_url(os.environ.get('REDIS_URL','redis://redis:6379/0')).ping()\""]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 20s
```

### Minimal docker-compose.yml frontend service diff (production)

```yaml
frontend:
  build:
    context: ./frontend
    target: production          # was: development
  depends_on:
    backend:
      condition: service_healthy
  ports:
    - "80:80"                   # was: "3000:3000"
  # VITE_CESIUM_ION_TOKEN removed — baked in at build time, not runtime
  # VITE_API_BASE_URL removed — nginx proxy handles routing; no runtime env needed
```

### VITE_CESIUM_ION_TOKEN at build time

The Cesium token is a Vite build-time variable (prefixed `VITE_`). In the production stage,
the build has already happened in the `builder` stage. The token must be passed as a
`--build-arg` or available via compose `build.args` — it cannot be injected at container
runtime. Current `docker-compose.yml` passes it as a runtime environment variable to the
frontend service, which does nothing when the container runs nginx (not Vite).

```yaml
# Correct: pass at build time
frontend:
  build:
    context: ./frontend
    target: production
    args:
      VITE_CESIUM_ION_TOKEN: ${VITE_CESIUM_ION_TOKEN:?Set VITE_CESIUM_ION_TOKEN in .env}
```

And in `frontend/Dockerfile`:
```dockerfile
FROM base AS builder
ARG VITE_CESIUM_ION_TOKEN
ENV VITE_CESIUM_ION_TOKEN=$VITE_CESIUM_ION_TOKEN
COPY . .
RUN npm run build
```

This is a critical fix: without it, the globe will fail to load in production because
`CESIUM_BASE_URL` and the ion token are undefined in the compiled JS bundle.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Vite dev-server as production server | nginx:alpine serving compiled static assets | Faster static delivery, no Node.js process, proper caching headers |
| Single docker-compose.yml with all env vars at runtime | Build-time ARGs for Vite variables, runtime ENV for backend | Correct — Vite vars must be baked in during `npm run build` |
| Polling healthchecks added to every service | `start_period` + `interval` tuning per service type | Avoids false unhealthy during cold-start initialization |

**Deprecated/outdated:**
- `VITE_API_BASE_URL` as a runtime environment variable for the frontend container: meaningless in production nginx mode. Remove it from the production service definition.
- `FRONTEND_ORIGIN=http://localhost:3000`: incorrect origin when nginx serves on port 80. Must be updated to `http://localhost` (or the deployment domain).

---

## Open Questions

1. **Should backend port 8000 remain published in the base compose file?**
   - What we know: Currently `ports: - "8000:8000"` is in the base file. The override file does not touch it.
   - What's unclear: For pure production intent, 8000 should be internal-only. But removing it from the base file means `docker compose up` (which merges the override) will also lose it for devs who expect to hit the API directly.
   - Recommendation: Remove `ports: - "8000:8000"` from base compose. Add it back in `docker-compose.override.yml` alongside the other dev-only settings. This is the correct production-safe approach.

2. **nginx.conf placement — inline in Dockerfile vs separate file?**
   - What we know: A separate `frontend/nginx.conf` is the standard approach and more readable.
   - What's unclear: Nothing — use a separate file.
   - Recommendation: Use `frontend/nginx.conf` + `COPY nginx.conf /etc/nginx/conf.d/default.conf` in the production stage.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend) + vitest (frontend) |
| Config file | `backend/pytest.ini` |
| Quick run command | `cd backend && pytest tests/test_health.py -x` |
| Full suite command | `cd backend && pytest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROD-01 | `docker compose up` starts nginx serving static build (not Vite) | smoke | `docker compose -f docker-compose.yml build frontend && docker compose -f docker-compose.yml up -d frontend && curl -s http://localhost/ | grep -q '<!doctype html'` | Wave 0 (compose config change) |
| PROD-02 | `GET http://localhost/api/aircraft` proxied to backend returns JSON | smoke | `curl -sf http://localhost/api/aircraft` | Wave 0 (nginx config) |
| PROD-03 | Port 80 published; port 3000 NOT published | smoke | `docker compose -f docker-compose.yml config | grep -c '3000'` should be 0 | Wave 0 (compose edit) |
| PROD-04 | `docker compose ps` shows `healthy` for backend, worker, ais-worker | smoke | `docker compose -f docker-compose.yml ps --format json | python -c "..."` | Wave 0 (healthcheck config) |

All PROD-* tests are infrastructure smoke tests run manually after `docker compose up`, not
automated pytest/vitest unit tests. No Wave 0 test file gaps — these are validated by
running the stack.

### Sampling Rate
- **Per task commit:** Verify affected compose/nginx config parses: `docker compose -f docker-compose.yml config`
- **Per wave merge:** Full smoke test: `docker compose -f docker-compose.yml up -d && docker compose ps`
- **Phase gate:** All 4 services show `healthy`; `/api/aircraft` returns JSON via port 80

### Wave 0 Gaps
- [ ] `frontend/nginx.conf` — new file, covers PROD-02 and SPA routing
- No test framework install needed — all validation is compose + curl smoke tests

---

## Sources

### Primary (HIGH confidence)
- nginx official docs — `proxy_pass`, `try_files`, `location` directive semantics
- Docker Compose official docs — `healthcheck` schema, `build.args`, override file merging behavior
- Project source: `frontend/Dockerfile` — verified `production` stage exists with `nginx:alpine`
- Project source: `docker-compose.yml` — verified current `target: development`, port 3000, no healthchecks on workers
- Project source: `backend/app/api/routes_health.py` — verified `/api/health` endpoint exists and returns 200
- Project source: `backend/app/worker.py` + `app/workers/ingest_ais.py` — confirmed no HTTP server in workers; Redis is the only liveness signal

### Secondary (MEDIUM confidence)
- Vite build-time env vars guide — `VITE_` prefix variables are compile-time only, not runtime injectable
- nginx:alpine default config location: `/etc/nginx/conf.d/default.conf`

### Tertiary (LOW confidence)
- None — all findings verified directly from project source or official tool docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nginx:alpine + Docker Compose healthchecks are well-established, project source verified
- Architecture: HIGH — based on direct inspection of all relevant project files
- Pitfalls: HIGH — CORS mismatch and build-time Vite token verified from actual project config
- Validation: HIGH — healthcheck + smoke test pattern well-established

**Research date:** 2026-03-14
**Valid until:** 2026-06-14 (Docker Compose v2 and nginx patterns are stable)
