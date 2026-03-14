# Phase 31: Documentation - Research

**Researched:** 2026-03-14
**Domain:** Project documentation — README.md authoring and open-source LICENSE file
**Confidence:** HIGH

## Summary

Phase 31 delivers two files: a root `README.md` and a `LICENSE` file. Neither requires a new library or architectural decision — the phase is pure content creation against a well-specified checklist. The success criteria in the roadmap are exact: the README must cover project overview, prerequisites (Docker + .env setup), `cp .env.example .env`, `docker compose up`, and API key configuration. A developer following only the README must be able to start the stack.

The project's technical facts are already fixed by completed phases 27–30. The README must accurately reflect what those phases built: a single-port-80 nginx entry point, production Docker Compose with health-checked services, a CI pipeline on GitHub Actions, and a `.env.example` with five categories of variables. There is no ambiguity about what the stack looks like — the research task is to inventory every detail the README must capture and identify common README pitfalls that cause onboarding failures.

The LICENSE file is a one-time administrative task. The project context gives no instruction on which license to choose, so the planner must treat this as Claude's discretion and default to MIT (the most common choice for open-source homelab tools, compatible with all project dependencies).

**Primary recommendation:** Write a root README.md structured top-down through the exact onboarding journey, plus a root `LICENSE` file using MIT text dated 2026.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOC-01 | Root `README.md` covers project overview, prerequisites, setup (`cp .env.example .env`), running with Docker Compose, and API key configuration | Content inventory below maps every required README section to verified project facts |
| DOC-02 | `LICENSE` file added to the repository root | MIT license text and date guidance below |
</phase_requirements>

## Standard Stack

This phase creates text files, not code. No libraries are installed. The "standard stack" is the set of tools and conventions for effective project READMEs.

### README Content Inventory (verified from project files)

Every fact the README must state, sourced from completed phases:

| Fact | Source | Value |
|------|--------|-------|
| Project name | Inference from code | OpenSignal Globe |
| What it does | REQUIREMENTS.md core value | Unified intelligence picture — satellites, aircraft, anomalies on a 3D globe |
| Public entry point | docker-compose.yml port 80 | `http://localhost` after `docker compose up` |
| Prerequisites | docker-compose.yml + Phase 29 | Docker Desktop (includes Compose v2), no local Node/Python needed |
| Env setup command | .env.example exists at root | `cp .env.example .env` then edit values |
| Start command | docker-compose.yml | `docker compose up` (Compose v2 syntax, not `docker-compose`) |
| Required API keys | .env.example lines 11–21 | `API_KEY`, `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`, `AISSTREAM_API_KEY`, `VITE_CESIUM_ION_TOKEN` |
| Where to get Cesium token | .env.example comment | https://ion.cesium.com/tokens |
| Where to get OpenSky creds | .env.example comment | https://opensky-network.org/ |
| Where to get AISStream key | .env.example comment | https://aisstream.io/ |
| CI badges (optional but common) | .github/workflows/ created in Phase 30 | GitHub Actions workflow file |
| Stack tech | backend/, frontend/ | FastAPI + PostgreSQL/PostGIS + Redis + React/Vite + CesiumJS via nginx |
| Postgres non-credential defaults | docker-compose.yml | `POSTGRES_DB=opensignal`, `POSTGRES_USER=postgres`, `POSTGRES_PASSWORD` must be set |
| Credential rotation warning | STATE.md | Real keys may be in git history; user must rotate OpenSky + AISStream keys before making repo public |

### Architecture to Describe in README

```
[Browser] → http://localhost:80
               ↓
         [nginx (frontend container)]
               ↓ /api/* proxy
         [backend FastAPI :8000]
               ↓
         [PostgreSQL/PostGIS + Redis]
               ↓
         [worker + ais-worker background jobs]
```

Services started by `docker compose up`:
- `postgres` — PostGIS 16-3.5
- `redis` — Redis 7 alpine
- `backend` — FastAPI (uvicorn), port 8000 internal only
- `worker` — background job processor
- `ais-worker` — AIS maritime data ingestor
- `frontend` — nginx serving React build + reverse proxy to backend

### .env.example Variable Groups

Planner must ensure README instructions map to these groups:

| Group | Variables | Complexity |
|-------|-----------|-----------|
| PostgreSQL | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Low — defaults work except password |
| Backend meta | `FRONTEND_ORIGIN`, `VERSION` | Low — defaults work |
| API auth | `API_KEY` | Medium — user sets any secret string |
| OpenSky | `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET` | High — requires account registration |
| AISStream | `AISSTREAM_API_KEY` | High — requires account registration |
| Cesium | `VITE_CESIUM_ION_TOKEN` | High — requires free account |

## Architecture Patterns

### Recommended README Structure

```
# OpenSignal Globe

[1-2 sentence description + screenshot or demo gif if available]

## Features

[Bullet list of what it shows]

## Prerequisites

[Docker Desktop / Docker Engine + Compose v2]

## Quick Start

1. Clone
2. cp .env.example .env
3. Edit .env — fill in API keys
4. docker compose up
5. Open http://localhost

## API Keys

[Per-service: what it is, where to get it, which variable]

## Architecture

[Brief diagram or bullet list]

## Development

[Optional: override compose, local dev notes]

## License
```

### Pattern: Stepwise Onboarding

The README must be written as an ordered walkthrough, not a reference document. Each step must be explicit and command-line-ready. A new developer should be able to copy-paste every command without filling in blanks (except the API key values themselves).

**Correct pattern:**
```bash
# Step 1
git clone <repo-url>
cd opensignal-globe

# Step 2
cp .env.example .env

# Step 3
# Edit .env and set the five required values (see "API Keys" section below)

# Step 4
docker compose up
```

**Anti-pattern:**
```bash
# Vague — user does not know what to edit
Edit the .env file then run the stack.
```

### Pattern: Per-Key Documentation

Each external API key should have its own sub-section or table row covering: what service it's for, what it enables in the app, registration URL, which `.env` variable to set. This prevents the common failure where users set `cp .env.example .env` but never learn that `VITE_CESIUM_ION_TOKEN` is a Cesium Ion account token.

### Anti-Patterns to Avoid

- **Instructing `docker-compose up` (v1 syntax):** The project uses Compose v2 (`docker compose`). The README must use the v2 command without hyphen.
- **Mentioning a localhost:3000 or localhost:8000 URL:** Phase 29 routed everything through port 80. The sole URL is `http://localhost`. Using port 3000 or 8000 will confuse users (8000 is only exposed in the dev override).
- **Omitting POSTGRES_PASSWORD:** It uses `:?` syntax in docker-compose.yml — if absent, the stack refuses to start with a visible error. The README must tell users to set it.
- **Describing a dev-only flow:** The README should document `docker compose up` (production build), not the Vite dev server. Dev instructions can be in a secondary section if desired.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| License text | Custom license prose | MIT SPDX text verbatim (see Code Examples below) |
| Architecture diagram | ASCII art from scratch | Simple nginx-proxy description matching actual Phase 29 architecture |

## Common Pitfalls

### Pitfall 1: Wrong Docker Compose Command Syntax

**What goes wrong:** README says `docker-compose up` (Compose v1 / standalone binary). Users on modern Docker Desktop get a "command not found" error or unexpected behavior.
**Why it happens:** Many READMEs were written for Compose v1. The project uses Compose v2 (`docker compose` as a subcommand).
**How to avoid:** Use `docker compose up` (space, not hyphen) everywhere in the README.
**Warning signs:** Any `docker-compose` occurrence in the README.

### Pitfall 2: Undocumented POSTGRES_PASSWORD Requirement

**What goes wrong:** User runs `cp .env.example .env` and `docker compose up` fails with `Set POSTGRES_PASSWORD in .env`.
**Why it happens:** .env.example has `POSTGRES_PASSWORD=changeme` which may look like a placeholder to skip — but it's functional and must remain set.
**How to avoid:** README must note that `POSTGRES_PASSWORD` in `.env.example` is already set to `changeme` and works for local use — user should not delete it.

### Pitfall 3: VITE_CESIUM_ION_TOKEN Treated as Optional

**What goes wrong:** User skips the Cesium token, the build fails at `docker compose up` with `:? Set VITE_CESIUM_ION_TOKEN in .env`.
**Why it happens:** New users don't know what Cesium Ion is and skip "optional-looking" env vars.
**How to avoid:** Mark all five key types as required. Note that Cesium Ion has a free tier.

### Pitfall 4: Credential Rotation Warning Omitted

**What goes wrong:** User makes repo public without rotating keys; old credentials in git history are exposed.
**Why it happens:** README authors don't surface infrastructure concerns.
**How to avoid:** Include a brief security note: if you fork or make this repo public, rotate all API keys because prior versions may have contained credentials in git history.

### Pitfall 5: Missing License Year / Name

**What goes wrong:** LICENSE file has `[year]` or `[author name]` placeholders, which renders the license invalid.
**Why it happens:** Template files are copied and not filled in.
**How to avoid:** Fill in `2026` and the actual author name (or GitHub username) before committing.

## Code Examples

### MIT License Text (fill in year and name)

```
MIT License

Copyright (c) 2026 <Author Name>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Source: https://opensource.org/licenses/MIT (SPDX: MIT)

### Minimal README Quick Start Block

```markdown
## Quick Start

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Compose v2)

```bash
# 1. Clone the repository
git clone https://github.com/<username>/opensignal-globe.git
cd opensignal-globe

# 2. Create your environment file
cp .env.example .env

# 3. Fill in your API keys (see "API Keys" section below)
#    Required: OPENSKY_CLIENT_ID, OPENSKY_CLIENT_SECRET,
#              AISSTREAM_API_KEY, VITE_CESIUM_ION_TOKEN, API_KEY

# 4. Start the stack
docker compose up

# 5. Open in browser
open http://localhost
```
```

### API Keys Table Pattern

```markdown
## API Keys

| Variable | Service | Free Tier | Registration |
|----------|---------|-----------|--------------|
| `OPENSKY_CLIENT_ID` + `OPENSKY_CLIENT_SECRET` | OpenSky Network (live aircraft) | Yes | https://opensky-network.org/ |
| `AISSTREAM_API_KEY` | AISStream.io (maritime AIS) | Yes | https://aisstream.io/ |
| `VITE_CESIUM_ION_TOKEN` | Cesium Ion (3D globe rendering) | Yes | https://ion.cesium.com/tokens |
| `API_KEY` | Internal write-endpoint auth | N/A — set any secret string | — |
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `docker-compose` (standalone v1) | `docker compose` (Compose v2 plugin) | Commands differ; v1 hyphenated, v2 space-separated |
| Separate `docker-compose.prod.yml` | Single `docker-compose.yml` with build targets | Users run the same file in dev and prod; no profile flags needed |
| Backend port 8000 exposed publicly | nginx port 80 is sole public endpoint | README must direct users to `http://localhost`, not `:8000` |

## Open Questions

1. **License author name**
   - What we know: MIT is appropriate; year is 2026
   - What's unclear: The actual author name or GitHub username to put in the copyright line
   - Recommendation: Planner should insert `<Author Name>` as a placeholder in the task — the executing developer fills this in. Alternatively, use the GitHub repo owner name.

2. **Screenshot / Demo GIF**
   - What we know: The project has a polished 3D globe UI
   - What's unclear: Whether a screenshot or GIF is in scope for this phase
   - Recommendation: DOC-01 does not require a screenshot. Planner should not add it as a task — it can be deferred. If the planner wants to note it as optional, that is fine.

3. **Development / Local Dev Instructions**
   - What we know: A `docker-compose.override.yml` exists for dev (exposes port 8000)
   - What's unclear: Whether DOC-01 requires dev instructions or only the Docker Compose production flow
   - Recommendation: DOC-01 specifies the Docker Compose onboarding path. A brief optional "Development" section is acceptable but not required. Keep the focus on `docker compose up` as the primary path.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.x (backend); vitest (frontend) |
| Config file | `backend/pytest.ini` |
| Quick run command | `cd backend && pytest tests/test_health.py -x` |
| Full suite command | `cd backend && pytest` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOC-01 | README.md exists at project root | smoke | `test -f README.md && echo PASS` | ❌ Wave 0 — file to create |
| DOC-01 | README.md contains required sections | smoke/manual | Manual review against checklist | N/A — content check |
| DOC-02 | LICENSE file exists at project root | smoke | `test -f LICENSE && echo PASS` | ❌ Wave 0 — file to create |

**Note:** DOC-01 and DOC-02 are file-existence requirements. Automated tests are shell one-liners, not pytest. The verification gate is the success criteria checklist in the roadmap — human review confirms all required README sections are present.

### Sampling Rate

- **Per task commit:** `test -f README.md && test -f LICENSE && echo "FILES OK"`
- **Per wave merge:** Same, plus manual read-through of README against DOC-01 checklist
- **Phase gate:** Manual review: a developer can complete onboarding following only the README

### Wave 0 Gaps

- [ ] `README.md` — root project README (this phase creates it)
- [ ] `LICENSE` — root LICENSE file (this phase creates it)

*(No test framework changes needed — this phase creates documentation files, not code)*

## Sources

### Primary (HIGH confidence)

- `.env.example` (project root) — exact variable names and comments verified
- `docker-compose.yml` (project root) — service names, ports, build targets, health checks verified
- `REQUIREMENTS.md` (.planning/) — DOC-01, DOC-02 exact requirements verified
- `ROADMAP.md` (.planning/) — success criteria verified verbatim
- `STATE.md` (.planning/) — key decisions from phases 27–30 verified
- https://opensource.org/licenses/MIT — MIT license SPDX text

### Secondary (MEDIUM confidence)

- Docker Compose v2 command format (`docker compose` not `docker-compose`) — verified by Docker documentation convention, consistent with Phase 29 and 30 implementation

### Tertiary (LOW confidence)

- None

## Metadata

**Confidence breakdown:**
- README content inventory: HIGH — all facts sourced from project files
- Architecture description: HIGH — sourced from docker-compose.yml Phase 29 decisions
- License choice (MIT): MEDIUM — no explicit user preference stated; MIT is the ecosystem default for open-source homelab tools
- Pitfalls: HIGH — sourced from actual :? variable syntax in docker-compose.yml and Phase 29 decisions

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (project files are stable; no external libraries in scope)
