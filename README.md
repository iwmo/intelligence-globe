# OpenSignal Globe

A unified real-time intelligence picture — live satellites, aircraft, maritime vessels, GPS jamming events, and OSINT correlations rendered on an interactive 3D globe. Built as a homelab/personal tool for situational awareness.

## Features

- **Live aircraft tracking** via OpenSky Network — real-time positions, altitude, speed, and ICAO callsigns
- **Maritime AIS data** via AISStream.io — vessel positions, vessel type, MMSI, and route history
- **Military aircraft identification** — flag known military ICAO hex codes with distinctive icons
- **Satellite orbits** via CesiumJS — live orbital paths for tracked satellites
- **GPS jamming heatmap** — visualise reported jamming events overlaid on the globe
- **OSINT event correlation** — surface related open-source intelligence events alongside sensor data
- **Time-travel replay engine** — scrub through historical snapshots of the intelligence picture

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Compose v2) **or** Docker Engine + the Compose v2 plugin
- **No local Node.js or Python required** — everything runs inside containers

> Compose v2 is required. Use `docker compose` (space, not hyphen). Compose v1 (`docker-compose`) is not supported.

## Quick Start

1. **Clone the repository**

   ```bash
   git clone https://github.com/<your-username>/opensignal-globe.git
   cd opensignal-globe
   ```

2. **Create your environment file**

   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` — fill in the five required values** (see [API Keys](#api-keys) below).

   `POSTGRES_PASSWORD` is pre-set to `changeme` in `.env.example` and works for local use — do not delete it.

4. **Start the full stack**

   ```bash
   docker compose up
   ```

5. **Open the application**

   ```
   http://localhost
   ```

> **Note:** `VITE_CESIUM_ION_TOKEN` is required — the build fails without it. Cesium Ion has a free tier; registration takes under a minute.

## API Keys

All four key types are required. The stack will not start if `VITE_CESIUM_ION_TOKEN` or `POSTGRES_PASSWORD` is missing.

| Variable(s) | Service | Free Tier | Where to Register |
|-------------|---------|-----------|-------------------|
| `OPENSKY_CLIENT_ID` + `OPENSKY_CLIENT_SECRET` | OpenSky Network (live aircraft positions) | Yes | https://opensky-network.org/ |
| `AISSTREAM_API_KEY` | AISStream.io (maritime AIS data) | Yes | https://aisstream.io/ |
| `VITE_CESIUM_ION_TOKEN` | Cesium Ion (3D globe rendering) | Yes | https://ion.cesium.com/tokens |
| `API_KEY` | Internal write-endpoint authentication | N/A — set any secret string | — |

## Architecture

```
Browser → http://localhost:80
              ↓
        nginx (frontend container)
              ↓  /api/* proxy
        FastAPI backend :8000 (internal)
              ↓
        PostgreSQL/PostGIS + Redis
              ↓
        worker + ais-worker (background ingestors)
```

Services started by `docker compose up`:

| Service | Description |
|---------|-------------|
| `postgres` | PostGIS 16-3.5 — spatial database |
| `redis` | Redis 7 alpine — message broker and cache |
| `backend` | FastAPI (uvicorn), internal port 8000 |
| `worker` | Background data processor |
| `ais-worker` | AIS maritime data ingestor |
| `frontend` | nginx serving the production React/CesiumJS build + reverse proxy |

## CI

GitHub Actions runs four checks on every push and pull request — `pytest` (backend unit tests), `vitest` + `tsc` (frontend tests and type-checking), `gitleaks` (secret scanning across full git history), and a Docker build verification for both images. All four jobs must pass before a branch can be merged.

## Security Note

If you fork this repository or plan to make it public, **rotate the following credentials before doing so** — earlier versions of the project may have contained real values in git history:

- OpenSky OAuth2 client secret (`OPENSKY_CLIENT_SECRET`)
- AISStream API key (`AISSTREAM_API_KEY`)

Use [`git filter-repo`](https://github.com/newren/git-filter-repo) to purge the history, or reset the repository entirely.

## License

MIT — see [LICENSE](LICENSE)
