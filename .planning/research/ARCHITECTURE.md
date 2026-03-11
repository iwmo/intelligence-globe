# Architecture Research: Browser-Based 3D Globe Platforms with Real-Time Tracking

**Project:** OpenSignal Globe (OSINT Geospatial Intelligence Platform)
**Researched:** 2026-03-11
**Confidence:** HIGH

## Executive Summary

Browser-based 3D globe platforms with satellite and aircraft tracking follow a multi-tier architecture that separates rendering, data ingestion, storage, and analytics. The dominant pattern in 2026 is a **client-heavy visualization layer** (WebGL-based 3D rendering) backed by a **stateless API layer**, **time-series geospatial storage**, and **asynchronous background workers** for data ingestion and processing.

Key architectural insight: Successful platforms balance client-side orbit propagation (for smooth real-time motion) with server-side historical storage (for time replay and analytics). Performance at scale (5,000+ satellites, thousands of aircraft) requires entity batching, LOD rendering, spatial indexing, and aggressive caching.

## System Components

### 1. Frontend Rendering Layer

**Purpose:** Real-time 3D visualization, user interaction, entity management

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| **3D Globe Engine** | CesiumJS 1.138+ | WebGL-based globe rendering with terrain, atmosphere, day/night shading, stars. Industry standard for geospatial visualization. |
| **UI Framework** | React 18/19 + TypeScript | Component-based UI, state management, lifecycle control |
| **State Management** | Zustand or Redux Toolkit | Global state for layer toggles, selected entities, time slider, filters |
| **Orbit Propagation** | satellite.js (SGP4/SDP4) | Client-side real-time satellite position calculation from TLEs. Enables smooth motion without constant API calls. |
| **Data Fetching** | React hooks + fetch/axios | Polling or periodic refresh for aircraft positions, anomaly updates |
| **UI Components** | Tailwind CSS + shadcn/ui | Dark-themed panels, controls, detail drawers, alerts |

**Data Flow:**
- Load TLE/GP data from API → Propagate positions client-side using satellite.js
- Fetch aircraft snapshots every 10-30 seconds → Update entity positions
- Fetch anomaly clusters → Render as heatmaps/polygons
- User interactions (click, search, filter) → Update state → Re-render affected entities

**Performance Patterns:**
- **Entity API vs Primitives API:** Use CesiumJS Entity API for data-driven objects with metadata. For static or high-volume elements (5,000+ satellites), use Primitives API directly to bypass entity overhead.
- **Dirty Flag Pattern:** Only update entities that have changed. Track modified objects to avoid full scene traversal.
- **LOD (Level of Detail):** At low zoom, render satellites as simple points. At high zoom, show orbit paths, ground tracks, and metadata.
- **Frustum Culling:** CesiumJS automatically culls off-screen entities, but explicitly disable updates for entities outside view.
- **Batching:** Group similar entities (e.g., constellation of satellites) into a single CustomDataSource to reduce tracking overhead.
- **Animation Frame Management:** Use `requestAnimationFrame` for smooth updates. Avoid re-rendering on every WebSocket message; batch updates instead.

**WebGL Optimization (2026 Best Practices):**
- Minimize draw calls through instancing
- Pre-allocate memory for entity arrays
- Use object pooling to reduce garbage collection
- Avoid CPU-intensive operations in animation loops
- Consider WebGPU for future-proofing (architectural shift from single-threaded WebGL to multi-threaded compute)

### 2. Backend API Layer

**Purpose:** Stateless HTTP API for data retrieval, ingestion orchestration, authentication

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| **API Framework** | FastAPI (Python 3.11+) | RESTful JSON API with OpenAPI docs, Pydantic validation, async support |
| **API Routing** | Modular routers | Separation of concerns: `/satellites`, `/aircraft`, `/anomalies`, `/replay`, `/alerts` |
| **Authentication** | OAuth2 (optional for MVP) | API key or token-based auth for protected endpoints |
| **CORS Handling** | FastAPI CORS middleware | Allow frontend origin for browser-based requests |
| **Rate Limiting** | slowapi or custom middleware | Protect backend from abuse, respect upstream API limits |
| **Input Validation** | Pydantic schemas | Type-safe request/response models |
| **Error Handling** | Structured JSON responses | Consistent error format with status codes |

**Layered Architecture (Best Practice):**
```
API Layer (routes_*.py)
    ↓
Services Layer (business logic)
    ↓
Repositories Layer (data access)
    ↓
Database
```

**Key Endpoints:**
- `GET /api/v1/satellites` - List satellites with filters (constellation, altitude, region)
- `GET /api/v1/satellites/{norad_id}` - Single satellite metadata + TLE
- `GET /api/v1/aircraft?bbox=minLon,minLat,maxLon,maxLat` - Aircraft in bounding box
- `GET /api/v1/aircraft/{icao24}/track` - Historical trail for aircraft
- `GET /api/v1/anomalies?severity=high&active=true` - Anomaly clusters
- `GET /api/v1/replay/aircraft?start=...&end=...` - Time-bounded snapshots for replay
- `POST /api/v1/sensor-events` - Ingest user-owned SDR events (optional)

**Performance Patterns:**
- Return only necessary fields (avoid over-fetching)
- Use pagination for large result sets
- Compress responses with gzip
- Set appropriate cache headers (Cache-Control)
- Use connection pooling for database access

### 3. Data Storage Layer

**Purpose:** Persistent storage for satellite metadata, aircraft snapshots, anomalies, alerts

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| **Primary Database** | PostgreSQL 16+ with PostGIS | Relational data + geospatial types (POINT, LINESTRING, POLYGON) |
| **Time-Series Extension** | TimescaleDB (optional, recommended) | Hypertable partitioning for time-series aircraft snapshots. 90-95% compression, continuous aggregates |
| **Spatial Indexing** | PostGIS GIST indexes | Fast spatial queries (ST_Within, ST_DWithin, ST_Intersects) |
| **Time Indexing** | B-tree indexes on timestamp | Fast time-bounded queries for replay |
| **Connection Pooling** | SQLAlchemy + psycopg2/asyncpg | Async database access, connection reuse |

**Schema Design:**

```
satellites
- id, norad_id (unique), name, tle_line1, tle_line2, epoch, metadata_json, created_at, updated_at

satellite_positions (optional, if server-side propagation)
- id, satellite_id (FK), timestamp, geom (POINTZ), latitude, longitude, altitude_km, velocity_kms

aircraft_snapshots
- id, icao24, callsign, timestamp, geom (POINTZ), latitude, longitude, baro_altitude_m, velocity_ms, heading_deg, vertical_rate_ms, on_ground, source_json

aircraft_tracks (pre-computed trails)
- id, icao24, start_time, end_time, geom (LINESTRINGZ), metadata_json

anomaly_clusters
- id, anomaly_type, severity, confidence, start_time, end_time, centroid_geom (POINT), area_geom (GEOMETRY), radius_km, affected_count, summary, raw_metrics_json, created_at

sensor_events (optional)
- id, sensor_id, timestamp, geom (POINT), band_name, center_frequency_mhz, event_type, signal_power_db, confidence, metadata_json

alerts
- id, alert_type, severity, title, body, related_entity_type, related_entity_id, created_at, acknowledged_at
```

**Indexes (Critical for Performance):**
```sql
-- Spatial indexes (GIST)
CREATE INDEX idx_aircraft_geom ON aircraft_snapshots USING GIST(geom);
CREATE INDEX idx_anomaly_centroid ON anomaly_clusters USING GIST(centroid_geom);
CREATE INDEX idx_anomaly_area ON anomaly_clusters USING GIST(area_geom);

-- Time indexes (B-tree)
CREATE INDEX idx_aircraft_timestamp ON aircraft_snapshots(timestamp);
CREATE INDEX idx_anomaly_time ON anomaly_clusters(start_time, end_time);

-- Composite indexes for common queries
CREATE INDEX idx_aircraft_icao_time ON aircraft_snapshots(icao24, timestamp);
CREATE INDEX idx_aircraft_time_ground ON aircraft_snapshots(timestamp, on_ground);
```

**TimescaleDB Optimization (Recommended):**
- Convert `aircraft_snapshots` to hypertable partitioned by time
- Enable automatic compression after 1 day (configurable)
- Use continuous aggregates for pre-computed metrics (e.g., average altitude by region)
- Set data retention policies (e.g., keep raw snapshots for 7 days, aggregates for 30 days)

### 4. Caching Layer

**Purpose:** Reduce database load, improve API response times, cache expensive computations

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| **Cache Store** | Redis 7.2+ | In-memory key-value store with TTL support |
| **Query Result Cache** | Cache-aside pattern | Hash query parameters → cache key. Check Redis first, DB on miss, store with TTL. |
| **Geospatial Cache** | Redis geospatial commands | GEOADD, GEORADIUS for location-aware caching. Store recent aircraft positions for fast radius queries. |
| **Session/State Cache** | Redis strings/hashes | Store user sessions, API rate limit counters, processing locks |

**Caching Patterns:**

1. **Cache-Aside (Lazy Loading):**
   - Application checks Redis first
   - On miss, fetch from DB, store in Redis with TTL
   - Best for read-heavy, infrequently changing data (satellite metadata, constellation lists)

2. **Write-Through:**
   - Write to DB and Redis simultaneously
   - Ensures cache consistency
   - Use for frequently accessed, frequently updated data (active aircraft positions)

3. **Geospatial Result Caching:**
   ```python
   # Cache nearby aircraft results
   redis.geosearchstore(
       dest='cached_aircraft_bbox',
       name='aircraft_positions',
       latitude=center_lat,
       longitude=center_lon,
       radius=50,
       unit='km'
   )
   redis.expire('cached_aircraft_bbox', 30)  # 30 second TTL
   ```

4. **Negative Caching:**
   - Cache "not found" results to prevent repeated DB queries for non-existent entities
   - Short TTL (60 seconds) to avoid stale negative results

**TTL Recommendations (2026 Best Practices):**
- Satellite TLEs: 6-12 hours (updated daily from CelesTrak)
- Aircraft positions: 10-30 seconds (OpenSky updates ~10s)
- Anomaly clusters: 1-5 minutes (recomputed periodically)
- Master data (constellations, filters): 1 hour
- User sessions: 15 minutes
- Add ±10% jitter to prevent cache stampede (simultaneous expirations)

**Redis as Message Broker:**
- Also serves as message queue for Celery background workers
- Lightweight, fast, suitable for small-to-medium message payloads

### 5. Background Workers Layer

**Purpose:** Asynchronous data ingestion, anomaly detection, scheduled jobs

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| **Task Queue** | Celery 5.6+ | Distributed task queue for background jobs |
| **Message Broker** | Redis (or RabbitMQ for production scale) | Task delivery to workers |
| **Result Backend** | Redis | Store task results, status tracking |
| **Scheduler** | Celery Beat | Cron-like periodic task scheduling |
| **Worker Process** | Celery workers (multi-process/multi-threaded) | Execute queued tasks |

**Background Job Types:**

1. **Satellite Ingestion Pipeline (Periodic)**
   - Triggered: Every 6-12 hours by Celery Beat
   - Fetch TLE/GP data from CelesTrak
   - Parse and normalize
   - Upsert `satellites` table (update existing, insert new)
   - Optional: Pre-compute future positions for next 1 hour
   - Error handling: Retry on network failure, alert on invalid TLE data

2. **Aircraft Ingestion Pipeline (Real-Time)**
   - Triggered: Every 10-30 seconds by Celery Beat
   - Fetch state vectors from OpenSky Network API
   - Respect rate limits (400 credits/day anonymous, 4000 authenticated, 8000 active contributor)
   - Normalize fields (ICAO24, callsign, position, altitude, velocity, heading)
   - Insert snapshot into `aircraft_snapshots` table
   - Update or append to `aircraft_tracks` (trails)
   - Trigger anomaly detection on new data

3. **Anomaly Detection Pipeline (Triggered or Periodic)**
   - Triggered: After aircraft ingestion (if new data available)
   - OR: Every 5 minutes by Celery Beat
   - Query recent aircraft snapshots by time window (last 10-30 minutes)
   - Compute anomaly metrics per aircraft:
     - Position discontinuity score (sudden jumps)
     - Velocity inconsistency score (impossible speed changes)
     - Heading instability score (erratic direction changes)
     - Navigation quality degradation (if available in data)
   - Cluster suspicious points using DBSCAN or HDBSCAN
   - Parameters: epsilon (spatial distance threshold), minPoints (minimum cluster size)
   - Create `anomaly_clusters` with centroid, polygon, confidence, severity
   - Generate alerts for high/critical severity anomalies

4. **Sensor Event Processing (Optional, Real-Time)**
   - Triggered: On POST to `/sensor-events` endpoint
   - Validate sensor payload
   - Store in `sensor_events` table
   - Correlate with active anomaly clusters (spatial + temporal overlap)
   - Increase anomaly confidence if correlation exists

5. **Data Retention / Cleanup (Scheduled)**
   - Triggered: Daily at 3 AM by Celery Beat
   - Delete old aircraft snapshots beyond retention period (e.g., 7 days)
   - Archive or delete resolved anomaly clusters (older than 30 days)
   - Compress TimescaleDB chunks
   - Vacuum PostgreSQL tables

**Production Best Practices:**
- Use supervisord, systemd, or Docker to manage worker processes
- Run multiple worker instances for load balancing
- Set `time_limit` on all tasks to prevent runaway jobs
- Use task routing (named queues) for priority jobs
- Monitor queues with Flower (Celery monitoring tool)
- Use Redis Sentinel or Amazon ElastiCache for highly available Redis

### 6. External Integrations

**Purpose:** Fetch data from public OSINT sources

| Service | Data Type | Refresh Rate | Rate Limits | Notes |
|---------|-----------|--------------|-------------|-------|
| **CelesTrak** | Satellite TLE/GP data | Daily | None documented (be respectful) | Primary source for orbital elements. Mirror locally to reduce requests. |
| **OpenSky Network** | Aircraft state vectors | 10 seconds | 400 calls/day (anon), 4000 (auth), 8000 (contributor) | OAuth2 client credentials (Basic auth deprecated March 2026). Returns ICAO24, position, altitude, velocity, heading. |
| **SatNOGS (Optional)** | Satellite metadata | As needed | None (open API) | Enrichment data for satellite details, frequencies, transmitters. |
| **Public AIS (Optional)** | Ship positions | Variable | Depends on provider | Only if clean public source available. Keep module optional. |

**API Client Patterns:**
- **Retry with exponential backoff** on transient failures (5xx, network errors)
- **Circuit breaker** pattern: Stop calling failing API after threshold, retry after cooldown
- **Rate limit tracking:** Monitor `X-Rate-Limit-Remaining` headers, throttle requests before hitting limit
- **Local mirroring:** Cache full TLE dataset locally, only fetch delta updates
- **Graceful degradation:** If external API unavailable, serve stale cached data with warning

## Data Flow

### 1. Satellite Visualization Flow
```
CelesTrak TLE Source
    ↓
[Background Worker: Satellite Ingestion]
    ↓
PostgreSQL (satellites table)
    ↓
FastAPI (GET /satellites)
    ↓ (with Redis cache)
Frontend (React)
    ↓
satellite.js (SGP4 propagation)
    ↓
CesiumJS (render orbits, ground tracks)
```

**Key Points:**
- TLEs updated daily, but client-side propagation allows real-time motion without constant API calls
- Backend stores TLE metadata and epoch, frontend computes current position
- Historical positions (for replay) stored in `satellite_positions` table OR re-propagated from TLE

### 2. Aircraft Tracking Flow
```
OpenSky Network API
    ↓ (every 10-30s)
[Background Worker: Aircraft Ingestion]
    ↓
PostgreSQL (aircraft_snapshots table)
    ↓
Redis (geospatial cache)
    ↓
FastAPI (GET /aircraft?bbox=...)
    ↓
Frontend (React)
    ↓
CesiumJS (render aircraft + trails)
```

**Key Points:**
- Real-time polling from OpenSky (within rate limits)
- Bounding box query for visible region (reduces payload)
- Frontend updates aircraft positions every 10-30 seconds
- Trails pre-computed in backend or generated client-side from recent snapshots

### 3. Anomaly Detection Flow
```
Aircraft Snapshots (PostgreSQL)
    ↓ (triggered by new data)
[Background Worker: Anomaly Engine]
    ↓ (query recent data by time window + region)
Compute Metrics (discontinuity, velocity, heading, density)
    ↓
DBSCAN Clustering (group suspicious points)
    ↓
Generate Anomaly Cluster (centroid, polygon, severity)
    ↓
PostgreSQL (anomaly_clusters table)
    ↓
FastAPI (GET /anomalies)
    ↓
Frontend (React)
    ↓
CesiumJS (render heatmap/polygons)
    ↓
Alert Feed (UI notification)
```

**Key Points:**
- Anomaly detection runs in background, triggered by new aircraft data or periodic schedule
- Clustering identifies spatial patterns (multiple aircraft affected in same region)
- Results cached briefly (1-5 minutes) to reduce recomputation
- Alerts generated for high/critical severity anomalies

### 4. Time Replay Flow
```
User selects time range (start, end)
    ↓
Frontend (React) → FastAPI (GET /replay/aircraft?start=...&end=...)
    ↓
PostgreSQL (aircraft_snapshots WHERE timestamp BETWEEN start AND end)
    ↓ (paginated chunks)
Frontend buffers snapshots
    ↓
CesiumJS Clock API (set currentTime, play/pause controls)
    ↓
Animate positions as time progresses
```

**Key Points:**
- Replay requires storing historical snapshots (TimescaleDB compression recommended)
- Return data in chunks (e.g., 10-minute segments) to avoid overwhelming client
- Use CZML format OR custom JSON with timestamps
- Frontend interpolates between snapshots for smooth animation

## Component Dependencies

```
                    ┌──────────────────┐
                    │   Frontend       │
                    │   (React +       │
                    │   CesiumJS)      │
                    └────────┬─────────┘
                             │ HTTP/REST
                             ↓
                    ┌──────────────────┐
                    │   FastAPI        │
                    │   (API Layer)    │
                    └────┬────────┬────┘
                         │        │
           ┌─────────────┘        └──────────────┐
           ↓                                     ↓
  ┌────────────────┐                    ┌───────────────┐
  │  PostgreSQL    │←───────────────────│  Background   │
  │  + PostGIS     │                    │  Workers      │
  │  (Storage)     │                    │  (Celery)     │
  └────────────────┘                    └───────┬───────┘
           ↑                                     │
           │                                     │
           └──────────┬───────────┐             │
                      ↓           ↓             ↓
              ┌───────────┐  ┌─────────┐  ┌──────────┐
              │   Redis   │  │  Redis  │  │ External │
              │  (Cache)  │  │ (Queue) │  │   APIs   │
              └───────────┘  └─────────┘  └──────────┘
                                           (CelesTrak,
                                            OpenSky)
```

### Dependency Summary:

1. **Frontend depends on:**
   - FastAPI for data (satellites, aircraft, anomalies)
   - satellite.js for orbit propagation
   - CesiumJS for rendering

2. **FastAPI depends on:**
   - PostgreSQL for persistent storage
   - Redis for caching
   - Celery for triggering background jobs (optional)

3. **Background Workers depend on:**
   - Redis for task queue
   - PostgreSQL for data storage
   - External APIs for data ingestion

4. **PostgreSQL depends on:**
   - PostGIS extension for geospatial types
   - TimescaleDB extension (optional) for time-series optimization

## Suggested Build Order

### Phase 1: Foundation (Week 1)
**Goal:** Basic infrastructure, health checks, empty globe

1. **Docker Compose setup**
   - Services: postgres, redis, backend, frontend
   - Networking, volumes, environment variables

2. **PostgreSQL + PostGIS**
   - Database initialization
   - Basic schema (satellites, aircraft_snapshots tables)
   - Spatial indexes

3. **FastAPI skeleton**
   - Project structure (routers, services, models, schemas)
   - Health endpoint (`GET /health`)
   - Database connection pooling
   - CORS configuration

4. **React + CesiumJS globe**
   - Initialize viewer
   - Render terrain, atmosphere, stars
   - Basic camera controls
   - Dark theme UI shell

**Why first:** Establishes infrastructure and proves all services can communicate. Provides visual feedback (empty globe) for developers.

### Phase 2: Satellite Visualization (Week 2)
**Goal:** Display satellites with orbit paths, click for details

5. **Satellite data model**
   - Database table with TLE storage
   - Pydantic schemas for API

6. **Satellite ingestion worker**
   - Celery task to fetch from CelesTrak
   - Parse TLE format
   - Upsert satellites table

7. **Satellite API endpoints**
   - `GET /satellites` (list with filters)
   - `GET /satellites/{norad_id}` (single)

8. **Frontend satellite layer**
   - Fetch TLEs from API
   - Propagate positions using satellite.js
   - Render as billboards/points
   - Draw orbit paths (polylines)
   - Click handler for detail panel

**Why second:** Satellites update slowly (daily), so less complexity than real-time aircraft. Proves client-side propagation works. Provides first visual content.

**Depends on:** Phase 1 (infrastructure, API framework, globe renderer)

### Phase 3: Aircraft Tracking (Week 3-4)
**Goal:** Real-time aircraft with trails, bounding box queries

9. **Aircraft data model**
   - `aircraft_snapshots` table with geospatial point
   - `aircraft_tracks` table for trails
   - Spatial + time indexes

10. **Aircraft ingestion worker**
    - Celery Beat schedule (every 10-30s)
    - Fetch from OpenSky API
    - Handle rate limits, retries
    - Insert snapshots

11. **Aircraft API endpoints**
    - `GET /aircraft?bbox=...` (spatial query)
    - `GET /aircraft/{icao24}/track` (historical trail)
    - Redis caching with geospatial commands

12. **Frontend aircraft layer**
    - Fetch aircraft in viewport bounding box
    - Update positions every 10-30s
    - Render with billboards/models
    - Draw trails (polylines from track endpoint)
    - Click handler for detail panel

**Why third:** Builds on satellite foundation, adds complexity of real-time updates and spatial queries. Most visually engaging feature.

**Depends on:** Phase 2 (data ingestion patterns established, frontend entity management patterns)

### Phase 4: Anomaly Detection (Week 5)
**Goal:** Identify and visualize anomaly clusters

13. **Anomaly data model**
    - `anomaly_clusters` table with spatial polygon
    - Severity, confidence, affected count fields

14. **Anomaly detection worker**
    - Celery task triggered by new aircraft data
    - Query recent snapshots
    - Compute discontinuity/velocity/heading scores
    - DBSCAN clustering (scikit-learn)
    - Generate clusters with centroids and polygons

15. **Anomaly API endpoints**
    - `GET /anomalies?severity=...&active=...`
    - `GET /anomalies/{id}` (detail)

16. **Frontend anomaly layer**
    - Fetch active anomalies
    - Render as heatmap or colored polygons
    - Severity-based color gradient (yellow → red)
    - Click handler for anomaly detail
    - Alert feed for new high-severity anomalies

**Why fourth:** Depends on aircraft snapshots existing. Adds analytics value. Can be skipped for MVP if time-constrained.

**Depends on:** Phase 3 (aircraft data must exist to detect anomalies)

### Phase 5: Time Replay (Week 6, Optional for MVP)
**Goal:** Playback historical aircraft/satellite movement

17. **Replay API endpoints**
    - `GET /replay/aircraft?start=...&end=...`
    - `GET /replay/satellites?start=...&end=...`
    - Paginated time-bounded queries

18. **Data retention strategy**
    - TimescaleDB compression for old snapshots
    - Retention policies (e.g., keep 7 days raw, 30 days compressed)

19. **Frontend timeline UI**
    - Time slider component
    - Play/pause/speed controls
    - CesiumJS Clock API integration
    - Buffer and animate historical positions

**Why fifth:** Requires historical data storage (Phase 3-4 must run for days). Nice-to-have, not critical for initial launch.

**Depends on:** Phase 3 (aircraft snapshots), Phase 2 (satellite TLEs for historical propagation)

### Phase 6: Sensor Events (Week 7, Optional)
**Goal:** Ingest user-owned SDR sensor events

20. **Sensor event data model**
    - `sensor_events` table with spatial point

21. **Sensor event API**
    - `POST /sensor-events` (ingest)
    - `GET /sensor-events` (query)
    - Validation for event types, frequencies

22. **Sensor correlation logic**
    - Celery task to correlate with anomalies
    - Spatial + temporal overlap detection
    - Update anomaly confidence

23. **Frontend sensor layer**
    - Render sensor events as icons
    - Color by event type
    - Show correlation in anomaly detail panel

**Why sixth:** Optional feature, depends on user having SDR hardware. Adds value if user has sensors, otherwise can be disabled.

**Depends on:** Phase 4 (anomaly clusters to correlate with)

### Phase 7: Polish & Optimization (Week 8)
**Goal:** Production-ready performance and UX

24. **Performance tuning**
    - Entity batching (combine satellites by constellation)
    - LOD rendering (simplify at low zoom)
    - Optimize database queries (EXPLAIN ANALYZE)
    - Redis cache warming
    - Frontend bundle size optimization

25. **UI/UX refinement**
    - Smooth animations (orbit flows, pulses on anomalies)
    - Improved detail panels with charts
    - Search by satellite name, callsign, ICAO24
    - Region presets (e.g., "North America", "Europe")
    - Legend and help tooltips

26. **Monitoring & logging**
    - Structured logging (JSON format)
    - Error tracking (Sentry or similar)
    - Celery task monitoring (Flower)
    - Database slow query log

27. **Documentation**
    - README with setup instructions
    - API documentation (OpenAPI/Swagger)
    - Architecture diagram
    - Deployment guide
    - Screenshots/demo GIF

**Why seventh:** Polish after core features work. Production readiness.

**Depends on:** All previous phases (nothing works well until this phase)

## Scaling Considerations

### At 100 concurrent users:

| Concern | Approach |
|---------|----------|
| **Database connections** | Connection pooling (10-20 connections per backend instance). Single PostgreSQL instance sufficient. |
| **API response time** | Redis caching for frequently accessed data (satellite lists, active aircraft). Target < 200ms p95. |
| **Frontend rendering** | Entity API sufficient for < 10,000 total objects. No need for primitives optimization yet. |
| **Worker capacity** | Single Celery worker instance. Background jobs complete within schedule intervals. |
| **Redis capacity** | Single Redis instance (6 GB RAM). Store hot data only (recent snapshots, active caches). |

### At 10,000 concurrent users:

| Concern | Approach |
|---------|----------|
| **Database connections** | Increase pool size (50-100 connections per backend). Consider read replicas for query load. |
| **API response time** | Aggressive Redis caching (short TTLs but high hit rate). Consider CDN for static assets. Use FastAPI async endpoints. |
| **Frontend rendering** | Switch to Primitives API for high-volume entities (satellites). Implement entity clustering at low zoom. |
| **Worker capacity** | Horizontal scaling: 3-5 Celery worker instances. Use task routing (separate queues for ingestion vs analytics). |
| **Redis capacity** | Redis cluster or Sentinel for HA. 16-32 GB RAM. Consider separate Redis instances for cache vs queue. |
| **Load balancing** | Multiple FastAPI instances behind Nginx or Traefik reverse proxy. |

### At 1M concurrent users:

| Concern | Approach |
|---------|----------|
| **Database connections** | Multi-node PostgreSQL with Citus sharding. Separate OLTP (writes) from OLAP (analytics) workloads. |
| **API response time** | Multi-region deployment. Edge caching (Cloudflare, Fastly). Consider GraphQL for flexible client queries. |
| **Frontend rendering** | Full primitives optimization. Vector tiles for anomaly polygons. WebGL 2.0 or WebGPU. Separate "lite" mode for mobile. |
| **Worker capacity** | 10-20+ Celery worker instances. Kubernetes for auto-scaling. Separate worker pools by job type (ingestion, analytics, alerts). |
| **Redis capacity** | Redis cluster with 100+ GB RAM. Consider DragonflyDB as Redis alternative (better multi-threading). |
| **Cost optimization** | Serve static frontend from CDN. Use TimescaleDB compression (90-95% reduction). Archive old data to S3/MinIO. |
| **Data ingestion** | Batch aircraft updates (ingest 1000s per job vs individual snapshots). Use COPY for bulk inserts. |

## Architecture Patterns & Anti-Patterns

### Patterns to Follow

**1. Client-Side Orbit Propagation**
- **Pattern:** Send TLE to frontend, propagate using satellite.js in browser
- **Benefit:** Smooth real-time motion without constant API calls. Reduced backend load.
- **When:** Satellites with predictable orbits (TLE-based)

**2. Bounding Box Queries**
- **Pattern:** Frontend sends viewport bounding box, backend returns only visible entities
- **Benefit:** Reduces payload size by 10-100x for zoomed-in views
- **When:** User zoomed to specific region (not global view)

**3. Layered Architecture (API → Services → Repositories)**
- **Pattern:** Separate HTTP handling, business logic, and data access into distinct layers
- **Benefit:** Testability, maintainability, independent scaling
- **When:** Always for FastAPI services

**4. Cache-Aside with TTL**
- **Pattern:** Check cache first, DB on miss, store result with expiration
- **Benefit:** Reduces DB load, improves response time
- **When:** Read-heavy, infrequently changing data (satellite metadata, constellations)

**5. Medallion Architecture for Data Ingestion**
- **Pattern:** Bronze (raw) → Silver (normalized) → Gold (analytics-ready)
- **Benefit:** Clean separation of ingestion, transformation, serving
- **When:** Complex data pipelines with multiple sources (future-proofing)

**6. Dirty Flag for Entity Updates**
- **Pattern:** Mark entities as "dirty" when changed, only update those in render loop
- **Benefit:** Avoids full scene traversal, reduces CPU overhead
- **When:** High entity counts (1000+) with partial updates

### Anti-Patterns to Avoid

**1. Updating Every Entity on Every Frame**
- **Problem:** Causes "render storm", UI lag, high CPU usage
- **Solution:** Batch updates, use dirty flags, render on animation frames (not every data arrival)

**2. Storing Large Payloads in Redis**
- **Problem:** Redis is in-memory, expensive for large data
- **Solution:** Store only hot data (recent snapshots, cache keys). Archive to PostgreSQL or S3.

**3. Synchronous External API Calls in Request Path**
- **Problem:** Blocks FastAPI endpoint, slow response times, upstream failures cascade
- **Solution:** Background workers (Celery) fetch data asynchronously. API serves cached/stored data.

**4. No Rate Limit Handling for External APIs**
- **Problem:** Hit OpenSky rate limit, all requests fail, no data ingestion for 24 hours
- **Solution:** Track API credits, throttle requests before limit, use authenticated access, implement backoff

**5. Client-Side Propagation for Non-Predictable Objects**
- **Problem:** Aircraft don't follow predictable orbits, can't propagate from initial state
- **Solution:** Server-side snapshots, periodic fetch. Only satellites use client-side propagation.

**6. Global Queries Without Spatial Indexing**
- **Problem:** `SELECT * FROM aircraft_snapshots` on 10M rows = 10+ second query
- **Solution:** Always use spatial indexes (GIST), bounding box WHERE clauses, time-bounded queries

**7. Entity API for 10,000+ Objects**
- **Problem:** Entity tracking overhead, slow rendering
- **Solution:** Switch to Primitives API, use instancing, implement LOD culling

**8. No TTL on Caches**
- **Problem:** Stale data served indefinitely, cache grows unbounded
- **Solution:** Always set TTL. Default: 5-60 minutes depending on data freshness requirements.

## Key Architectural Decisions

| Decision | Rationale | Trade-Off |
|----------|-----------|-----------|
| **CesiumJS over Three.js/Deck.gl** | Industry standard for 3D globes, built-in support for orbits, terrain, CZML. Mature ecosystem. | Larger bundle size (~2 MB), requires Cesium Ion token for some assets (can use free tier). |
| **Client-side orbit propagation (satellite.js)** | Smooth real-time motion, reduced API calls (1 fetch/day vs 1 fetch/second). | Limited to TLE-based propagation, can't handle maneuvers or solar radiation pressure. Good enough for OSINT visualization. |
| **Server-side aircraft snapshots** | Aircraft don't follow predictable paths, require real-time external data. | Requires periodic polling (10-30s), rate limits from OpenSky. |
| **PostgreSQL + PostGIS over MongoDB** | Mature geospatial support, ACID compliance, spatial indexes (GIST), joins for complex queries. | Relational schema requires migrations for schema changes (vs schemaless MongoDB). PostGIS worth it for spatial queries. |
| **TimescaleDB for time-series** | 90-95% compression, continuous aggregates, native PostgreSQL extension (no separate DB). | Adds complexity, requires chunk tuning. Optional for MVP, critical for production (data growth). |
| **Celery + Redis over RQ** | More features (Canvas workflows, Beat scheduler, multiple brokers), larger ecosystem, better monitoring (Flower). | Heavier than RQ. Redis sufficient for this project, RabbitMQ for future scale. |
| **FastAPI over Flask/Django** | Async support, Pydantic validation, OpenAPI docs, performance (ASGI vs WSGI). Modern Python (3.11+ type hints). | Smaller ecosystem than Django. FastAPI is right tool for data APIs. |
| **React over Vue/Svelte** | Largest ecosystem, CesiumJS examples use React, easy to hire developers. | Boilerplate compared to Svelte. React's maturity wins for this project. |
| **CZML optional, custom JSON primary** | CZML adds complexity, overkill for MVP. Custom JSON easier to debug, sufficient for entity updates. | CZML more efficient for massive time-series animations. Defer to Phase 5 (replay). |
| **Background workers over WebSockets** | External APIs (OpenSky, CelesTrak) rate-limited, require polling. Workers decouple ingestion from API layer. | WebSockets useful for push notifications (alerts), but not for data ingestion. Use both: workers ingest, WebSockets notify. |

## Technology Versions (2026)

| Component | Version | Notes |
|-----------|---------|-------|
| CesiumJS | 1.138+ | Panorama support, voxel memory improvements, Intel Arc GPU fixes |
| React | 18 or 19 | RSC (React Server Components) optional for static shell |
| TypeScript | 5.x | Type-safe DTOs, strict mode |
| FastAPI | 0.115+ | Python 3.11+ support, async endpoints |
| PostgreSQL | 16+ | Improved performance, parallel queries |
| PostGIS | 3.5+ | Spatial functions, geospatial indexing |
| TimescaleDB | 2.16+ | Multi-node deprecated (Timescale Cloud), single-node sufficient |
| Redis | 7.2+ | Geospatial commands, TTL support |
| Celery | 5.6+ (Recovery) | Memory leak fixes, Python 3.13 support |
| satellite.js | 5.x | SGP4/SDP4 propagation, performance optimizations |
| Python | 3.11 or 3.12 | Type hints, performance improvements |
| Node.js | 20 LTS or 22 LTS | Vite build, frontend tooling |

## Sources

### High Confidence (Official Docs, Context7-Verified)
- [CesiumJS Official](https://cesium.com/platform/cesiumjs/)
- [CesiumJS Entity API Performance](https://cesium.com/blog/2018/06/21/entity-api-performance/)
- [CesiumJS Releases March 2026](https://cesium.com/blog/2026/03/03/cesium-releases-in-march-2026/)
- [Flightradar24 How It Works](https://www.flightradar24.com/how-it-works)
- [OpenSky Network REST API](https://openskynetwork.github.io/opensky-api/rest.html)
- [satellite.js GitHub](https://github.com/shashwatak/satellite-js)
- [PostGIS Official](https://postgis.net/)
- [TimescaleDB Official](https://www.timescale.com/)
- [Redis Geospatial](https://redis.io/docs/latest/develop/data-types/geospatial/)
- [Celery 2026 Guide](https://devtoolbox.dedyn.io/blog/celery-complete-guide)

### Medium Confidence (Technical Blogs, Research Papers)
- [Janea Systems: Cesium Architecture](https://www.janeasystems.com/blog/cesium-architecture-3d-geospatial-platform)
- [BrightCoding: CesiumJS 2025 Overview](https://www.blog.brightcoding.dev/2025/07/14/cesiumjs-the-open-source-engine-powering-next-generation-3d-globes-and-maps/)
- [WebGL vs WebGPU 2026](https://gjgalante.medium.com/webgl-vs-webgpu-the-performance-gap-fbd121fb221a)
- [Streaming Architecture 2026: Beyond WebSockets](https://jetbi.com/blog/streaming-architecture-2026-beyond-websockets)
- [TimescaleDB + PostGIS Optimization](https://medium.com/@marcoscedenillabonet/optimizing-geospatial-and-time-series-queries-with-timescaledb-and-postgis-4978ea2ef8af)
- [DBSCAN Real-Time Anomaly Detection](https://www.researchgate.net/publication/384998930_Real-Time_Anomaly_Detection_Using_DBSCAN_Clustering_in_Cloud_Network_Infrastructures)
- [FastAPI Microservices Architecture](https://medium.com/@azizmarzouki/build-scalable-microservices-with-fastapi-architecture-logging-and-config-made-simple-92e35552a707)
- [Redis Caching Strategies 2026](https://www.youngju.dev/blog/database/2026-03-03-redis-caching-strategies.en)
- [CZML Streaming Example GitHub](https://github.com/mfpierre/cesium-stream-example)
- [FastAPI + Celery Guide 2026](https://blog.greeden.me/en/2026/01/27/the-complete-guide-to-background-processing-with-fastapi-x-celery-redishow-to-separate-heavy-work-from-your-api-to-keep-services-stable/)

### Low Confidence (Community Forums, Unverified)
- [CesiumJS CZML Real-Time Data Discussion](https://community.cesium.com/t/cesiumjs-czml-for-real-time-data/45431)
- [CesiumJS Performance with 10k+ Entities](https://community.cesium.com/t/performance-with-10s-of-thousands-of-entities/3722)
- [DBSCAN for Flight Anomaly Detection](https://arc.aiaa.org/doi/10.2514/6.2020-1851)

---

**Confidence Assessment:**
- **System Components:** HIGH (verified with official docs, 2026 updates)
- **Data Flow:** HIGH (standard patterns, verified architectures)
- **Build Order:** MEDIUM (based on logical dependencies, may vary by team)
- **Scaling Recommendations:** MEDIUM (general best practices, specific numbers depend on implementation)

**Overall Research Confidence:** HIGH
