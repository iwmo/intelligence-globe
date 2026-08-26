# Railway Production Deployment

The production topology uses one Railway project and one `production` environment:

- `frontend`: public nginx/React service, root directory `/frontend`
- `backend`: private FastAPI service, root directory `/backend`
- `worker`: private singleton RQ scheduler/worker, root directory `/backend`
- `ais-worker`: private singleton AIS ingestion process, root directory `/backend`
- `Postgres`: PostGIS-capable PostgreSQL with persistent storage
- `Redis`: managed Redis

Only `frontend` receives a public domain. Browser API traffic remains same-origin through nginx.

## Service configuration

`backend` and `frontend` use their checked-in `railway.json` files. Configure the worker services from the same backend image, then override inherited deploy commands:

```sh
railway environment edit --service-config worker deploy.preDeployCommand ""
railway environment edit --service-config worker deploy.startCommand "python -m app.worker"
railway environment edit --service-config ais-worker deploy.preDeployCommand ""
railway environment edit --service-config ais-worker deploy.startCommand "python -m app.workers.ingest_ais"
```

Keep both workers at one replica. The RQ worker owns a scheduler and the AIS worker owns a persistent upstream WebSocket.

Recommended fixed service ports:

- `backend`: `PORT=8000`
- `frontend`: `PORT=8080`
- `frontend`: `BACKEND_URL=http://${{backend.RAILWAY_PRIVATE_DOMAIN}}:8000`
- `frontend`: `NGINX_RESOLVER=[fd12::10]` so nginx re-resolves the backend after deployments

Set `FRONTEND_ORIGIN` on the backend to the final `https://` frontend domain.

## Environment variables

Use Railway variable references for infrastructure:

- `DATABASE_URL=${{Postgres.DATABASE_URL}}` on backend and both workers
- `REDIS_URL=${{Redis.REDIS_URL}}` on backend and both workers

Required application variables:

- `API_KEY` on backend
- `VITE_API_KEY` on frontend; it must match `API_KEY`
- `VITE_CESIUM_ION_TOKEN` on frontend
- `AISSTREAM_API_KEY` on `ais-worker`

Provider variables:

- `FIRMS_MAP_KEY` on backend and worker for fires
- `LL2_API_TOKEN` on backend and worker for launches
- `ADSBIO_BASE_URL` on backend and worker when overriding ADSB.lol
- `OPENAI_API_KEY` on backend for voice
- `GOOGLE_MAPS_API_KEY` on backend for places
- `TOMTOM_API_KEY` and `TOMTOM_DAILY_SAMPLE_BUDGET` on backend for traffic

Never paste values into source-controlled files. Variables beginning with `VITE_` are compiled into the browser bundle and are not secrets.

## Deployment order

1. Provision PostGIS-capable PostgreSQL and verify the `postgis` extension.
2. Provision Redis.
3. Deploy backend and observe a successful Alembic pre-deploy.
4. Verify private `GET /api/ready` reports database and Redis ready.
5. Deploy the singleton worker and AIS worker.
6. Create the frontend public domain, set `FRONTEND_ORIGIN`, and deploy frontend.
7. Verify public `GET /api/ready` through nginx.

Do not treat a queued deployment as successful. Each Railway deployment must reach terminal `SUCCESS`.

## Production verification

Run the unmocked Playwright suite against the public URL:

```sh
PLAYWRIGHT_BASE_URL=https://your-domain.example E2E_LIVE=1 npm run test:e2e
```

The suite checks live aircraft and satellite API data, Cesium primitive counts, source-health details, and fire availability. Also inspect bounded logs for backend, worker, and AIS worker after the run.
