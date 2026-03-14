OSINT INTELLIGENCE GLOBE — FULL LLM BUILD SPEC
==============================================

PURPOSE
-------
Build a visually impressive, open-source, OSINT-only geospatial intelligence platform that runs in the browser as a 3D globe and shows:

- Satellites in orbit with ground tracks
- Aircraft positions and trails
- Optional ships
- GNSS/GPS anomaly heat zones inferred from public telemetry
- Optional SDR sensor events
- Time playback / historical replay
- A polished “intelligence dashboard” look

This spec is written so another LLM can generate the entire project.

IMPORTANT CONSTRAINTS
---------------------
1. Use only OSINT / public / open data sources.
2. Use open-source software wherever possible.
3. Do NOT claim precise jammer geolocation unless direct sensor triangulation exists.
4. Label inferred jamming/spoofing layers honestly as:
   - “GNSS anomaly”
   - “Possible interference zone”
   - “Public telemetry anomaly cluster”
5. The system must be deployable on a homelab or VPS with Docker.
6. The visual result should feel cinematic, modern, and operationally useful.

TARGET OUTPUT
-------------
Generate a complete repository with:

- Frontend: CesiumJS 3D globe app
- Backend API: FastAPI
- Database: PostgreSQL + PostGIS
- Cache/queue: Redis
- Optional worker: Celery or RQ
- Ingestion services for satellites and aircraft
- Analytics service for anomaly detection
- Docker Compose stack
- Example seed data
- Clean README
- .env.example
- API docs
- Optional n8n integration notes

SYSTEM NAME
-----------
Suggested project name:
OpenSignal Globe
Alternative names:
- OrbitalWatch
- SkyMesh Intel
- OpenRF Globe
- SignalScope Earth
- OSINT Situational Globe

HIGH-LEVEL PRODUCT VISION
-------------------------
A 3D globe where the user can:
- Rotate and zoom around Earth
- View live satellites moving in orbit
- View aircraft moving in near real time
- Toggle multiple intelligence layers
- Replay data over time
- See anomaly clusters and operational alerts
- Click an object for metadata
- Filter by region, time, type, altitude, constellation, airline, etc.

PRIMARY VISUAL EXPERIENCE
-------------------------
The UI should feel like a mix of:
- Google Earth
- FlightRadar-like movement
- Aerospace mission control
- Modern SIGINT dashboard

Use:
- Dark theme by default
- Glowing orbit paths
- Soft bloom / neon accents
- Clean side panel
- Layer toggles
- Time slider
- Bottom status bar
- Right-side detail drawer
- Smooth animation

TECHNICAL STACK
---------------
Frontend
- React
- TypeScript
- Vite
- CesiumJS
- Zustand or Redux Toolkit
- Tailwind CSS
- shadcn/ui optional
- Recharts optional for side charts

Backend
- Python 3.11+
- FastAPI
- Pydantic
- SQLAlchemy or SQLModel
- GeoAlchemy2
- PostgreSQL
- PostGIS
- Redis

Workers / Jobs
- Celery or RQ
- APScheduler optional for simple polling jobs

Geospatial / Analytics
- PostGIS
- Shapely
- GeoPandas optional
- NumPy
- Pandas
- scikit-learn for clustering
- pyproj

Satellite Calculation
- satellite.js in frontend OR
- sgp4 in Python backend

Containerization
- Docker
- Docker Compose

Optional Extensions
- n8n for OSINT orchestration
- MinIO for archive storage
- Map tiles via open providers
- Deck.gl for overlays if needed

CORE DATA SOURCES (OSINT / OPEN)
--------------------------------
1. Satellites
   - CelesTrak GP/TLE feeds
   - Optionally SatNOGS metadata
   - Optionally public NORAD identifiers via open catalogs

2. Aircraft
   - OpenSky Network API
   - Alternative public ADS-B feeds if allowed and legally usable

3. Ships (Optional)
   - Use only if a legitimate public source is available for your deployment context
   - Keep this module optional

4. GNSS anomaly inference
   - Derived from aircraft navigation-quality related telemetry when available
   - If not available from chosen feed, create a pluggable interface and mark as “future-ready”

5. SDR sensor events (Optional local module)
   - User-owned sensors only
   - No illegal interception
   - Only local power/noise/event summaries
   - No restricted decoding

6. Environmental context (Optional)
   - Space weather
   - Solar activity
   - Lightning
   - Weather overlays
   - NOT required for MVP

HONESTY RULES FOR ANALYTICS
---------------------------
The platform must distinguish between:
- Measured object positions
- Derived movement trails
- Inferred anomaly clusters
- User-owned local sensor events

Never label:
- “Jammer location”
unless there is actual validated triangulation.

Instead use:
- “Possible GNSS interference cluster”
- “Navigation integrity anomaly zone”
- “Open telemetry disturbance area”

PRODUCT MODULES
---------------
MODULE 1 — 3D GLOBE UI
Features:
- Cesium globe
- Terrain enabled if practical
- Atmosphere
- Day/night shading
- Stars background
- Camera presets
- Smooth transition to selected object
- Layer toggles
- Search box
- Region filter
- Time slider
- Detail inspector panel

MODULE 2 — SATELLITE TRACKING
Features:
- Poll CelesTrak feed
- Store TLE/GP data
- Propagate orbits
- Render satellites
- Show orbit trails
- Show ground tracks
- Support filters:
  - constellation
  - altitude class
  - country if metadata available
  - active/inactive if metadata available

Display:
- Satellite icon
- Orbit polyline
- Ground footprint optional
- Metadata popup

Popup fields:
- Name
- NORAD ID
- Latitude
- Longitude
- Altitude
- Velocity
- Inclination
- Epoch
- Source timestamp

MODULE 3 — AIRCRAFT LAYER
Features:
- Poll OpenSky states
- Normalize aircraft objects
- Store snapshots
- Render aircraft in near real time
- Draw trails
- Filter by:
  - callsign
  - ICAO24
  - altitude
  - region
  - speed

Popup fields:
- Callsign
- ICAO24
- Latitude
- Longitude
- Altitude
- Velocity
- Heading
- Vertical rate
- On-ground flag
- Timestamp

MODULE 4 — ANOMALY ENGINE
Goal:
Generate geospatial anomaly zones from public telemetry.

Possible anomaly types:
- Sudden regional drops in positional integrity indicators
- Unusual discontinuities in trajectories
- Simultaneous degraded quality among many nearby aircraft
- Unrealistic position jumps
- Dense clusters of missing/reappearing tracks

This is not precise jammer detection.
This is anomaly inference from public telemetry.

Output:
- Heatmap tiles
- Cluster polygons
- Alert objects

Severity levels:
- Low
- Moderate
- High
- Critical

Each anomaly must include:
- type
- confidence
- affected_objects_count
- centroid
- radius_estimate_km
- start_time
- end_time
- narrative summary

MODULE 5 — OPTIONAL LOCAL SDR SENSOR NETWORK
Purpose:
Allow user-owned sensors to push legal, high-level RF event summaries.

Each local sensor may submit:
- sensor_id
- lat/lon
- timestamp
- band_name
- center_frequency_mhz
- bandwidth_mhz
- event_type
- signal_power_db
- confidence
- note

Allowed event examples:
- elevated_noise_floor
- wideband_interference
- gnss_l1_noise_spike
- gps_l2_disturbance
- local_rf_event

Do NOT include:
- illegal intercept workflows
- instructions for intercepting protected communications
- harmful targeting functionality

MODULE 6 — TIME REPLAY
Features:
- Replay last 1h, 6h, 24h, 7d
- Animate aircraft/satellites from stored snapshots
- Show anomaly clusters appearing/disappearing over time
- Time scrubber on UI
- Playback speed controls

MODULE 7 — ALERTS AND EVENT FEED
Provide an event feed with:
- anomaly created
- anomaly escalated
- local sensor event
- major trajectory discontinuity
- high-density activity zone

Display:
- top-right toast alerts
- historical event list
- filter by severity/type

DATA MODEL
----------
Use Postgres + PostGIS.

TABLE: satellites
- id
- norad_id
- name
- source
- tle_line1
- tle_line2
- epoch
- metadata_json
- created_at
- updated_at

TABLE: satellite_positions
- id
- satellite_id
- timestamp
- geom POINTZ
- latitude
- longitude
- altitude_km
- velocity_kms
- source_json

TABLE: aircraft_snapshots
- id
- icao24
- callsign
- timestamp
- geom POINTZ
- latitude
- longitude
- baro_altitude_m
- geo_altitude_m
- velocity_ms
- heading_deg
- vertical_rate_ms
- on_ground
- source_json

TABLE: aircraft_tracks
- id
- icao24
- start_time
- end_time
- geom LINESTRINGZ
- metadata_json

TABLE: anomaly_clusters
- id
- anomaly_type
- severity
- confidence
- start_time
- end_time
- centroid_geom POINT
- area_geom GEOMETRY
- radius_km
- affected_count
- summary
- raw_metrics_json
- created_at

TABLE: sensor_events
- id
- sensor_id
- timestamp
- geom POINT
- band_name
- center_frequency_mhz
- bandwidth_mhz
- event_type
- signal_power_db
- confidence
- metadata_json

TABLE: alerts
- id
- alert_type
- severity
- title
- body
- related_entity_type
- related_entity_id
- created_at
- acknowledged_at

BACKEND API DESIGN
------------------
Base path: /api/v1

Endpoints:

Health
- GET /health

Satellites
- GET /satellites
- GET /satellites/{norad_id}
- GET /satellites/{norad_id}/positions
- GET /satellites/{norad_id}/orbit

Aircraft
- GET /aircraft
- GET /aircraft/{icao24}
- GET /aircraft/{icao24}/track
- GET /aircraft/region?bbox=minLon,minLat,maxLon,maxLat

Anomalies
- GET /anomalies
- GET /anomalies/{id}
- GET /anomalies/tiles/{z}/{x}/{y}.pbf OR geojson equivalent for MVP

Sensors
- POST /sensor-events
- GET /sensor-events

Alerts
- GET /alerts
- POST /alerts/{id}/ack

Replay
- GET /replay/aircraft?start=...&end=...
- GET /replay/satellites?start=...&end=...
- GET /replay/anomalies?start=...&end=...

Layers / Metadata
- GET /layers
- GET /stats/summary

MVP API RESPONSE EXAMPLE
------------------------
GET /api/v1/anomalies

{
  "items": [
    {
      "id": "an_123",
      "anomaly_type": "gnss_integrity_cluster",
      "severity": "high",
      "confidence": 0.74,
      "start_time": "2026-03-10T14:00:00Z",
      "end_time": null,
      "centroid": {
        "lat": 25.31,
        "lon": 51.47
      },
      "radius_km": 42.5,
      "affected_count": 18,
      "summary": "Public telemetry indicates a concentrated navigation-quality anomaly affecting multiple aircraft in the region."
    }
  ]
}

INGESTION PIPELINES
-------------------
PIPELINE A — SATELLITES
1. Poll public orbital element source
2. Normalize fields
3. Upsert satellites table
4. Generate propagated positions for:
   - now
   - +15 min
   - +30 min
   - +60 min
   - optional past snapshots
5. Store positions
6. Expose to API

PIPELINE B — AIRCRAFT
1. Poll OpenSky states
2. Normalize
3. Save raw snapshot
4. Update live table or recent snapshot table
5. Append short-term track history
6. Trigger anomaly checks

PIPELINE C — ANOMALY DETECTION
1. Pull recent aircraft snapshots by region/time window
2. Compute quality/jump/discontinuity metrics
3. Cluster suspicious points
4. Assign confidence/severity
5. Create anomaly cluster
6. Publish alert

PIPELINE D — OPTIONAL SENSOR EVENTS
1. Receive sensor POST payload
2. Validate schema
3. Store
4. Optionally correlate with active anomaly clusters
5. Raise confidence if rules support it

ANOMALY DETECTION LOGIC
-----------------------
IMPORTANT:
This must be described as a heuristic inference engine.

Possible metrics:
1. Position discontinuity score
   - Large jump over too short a time
2. Velocity inconsistency score
   - Velocity incompatible with adjacent fixes
3. Heading instability score
4. Collective anomaly density
   - Many aircraft affected in same region/time window
5. Data dropout / reappearance score
6. Navigation quality degradation score
   - Use only if feed exposes relevant indicators

Example scoring model:
score = (
  0.25 * discontinuity_score +
  0.20 * velocity_inconsistency +
  0.15 * heading_instability +
  0.25 * regional_density_score +
  0.15 * quality_degradation_score
)

Then:
- 0.00–0.29 = low
- 0.30–0.49 = moderate
- 0.50–0.69 = high
- 0.70+ = critical

Clustering:
- Use DBSCAN or HDBSCAN
- Cluster by:
  - lat/lon
  - time bucket
  - anomaly score
- Create centroid + radius
- Persist polygon or buffered circle

SATELLITE VISUALIZATION LOGIC
-----------------------------
Option A:
- Compute positions on backend every N minutes
- Frontend interpolates

Option B:
- Send TLE to frontend
- Frontend uses satellite.js
- Good for rich real-time motion

Preferred MVP:
- Backend stores satellite metadata
- Frontend propagates current position for active render
- Backend provides historical snapshots for replay

Render:
- Billboard or point sprite
- Polyline orbit path
- Ground track polyline
- Optional coverage cone/footprint

AIRCRAFT VISUALIZATION LOGIC
----------------------------
- Use point primitives or billboards for large volumes
- Use 3D aircraft models only for selected/high-zoom items
- Trails should be efficient
- Cull or cluster at low zoom
- Consider screen-space optimization

UI / UX SPEC
------------
LAYOUT
- Fullscreen globe
- Left collapsible control panel
- Right detail drawer
- Top bar with search and quick filters
- Bottom timeline/replay bar
- Floating legend
- Small status widgets

LEFT PANEL CONTENT
- Layer toggles:
  [x] Satellites
  [x] Aircraft
  [ ] Ships
  [x] GNSS anomalies
  [ ] Sensor events
  [ ] Space weather
- Filters
- Region presets
- Time controls
- Theme toggle optional

RIGHT DRAWER CONTENT
Contextual based on selected entity.

Satellite detail:
- ID
- Orbit class
- Live coordinates
- Altitude
- Speed
- Orbit path summary

Aircraft detail:
- Callsign
- ICAO24
- Speed
- Heading
- Altitude
- Trail chart

Anomaly detail:
- Type
- Confidence
- Severity
- Start/end
- Affected count
- Narrative
- Correlated sensor events

VISUAL STYLE GUIDE
------------------
Theme:
- dark graphite / navy background
- cyan / teal / amber / red highlights
- subtle grid lines
- elegant typography
- avoid clutter

Suggested accent colors:
- satellites: cyan
- aircraft: white or pale blue
- anomalies: yellow/orange/red gradient
- sensor events: magenta
- replay timeline: electric blue

Use motion tastefully:
- gentle pulses on anomalies
- orbit flow animations
- alert glow
- smooth camera easing

PERFORMANCE REQUIREMENTS
------------------------
The UI must remain usable with:
- 5,000+ satellites visible
- hundreds to low thousands of aircraft
- many historical points in replay mode

Strategies:
- entity clustering at low zoom
- decimation
- request windowing
- level-of-detail rendering
- tile-based anomaly fetches
- simplified geometry for wide zoom

REPO STRUCTURE
--------------
Generate this structure:

open-signal-globe/
  README.md
  .env.example
  docker-compose.yml
  Makefile
  docs/
    architecture.md
    api.md
    analytics.md
    deployment.md
    ui-notes.md
  backend/
    Dockerfile
    requirements.txt
    alembic.ini
    app/
      main.py
      config.py
      db.py
      models/
        satellite.py
        aircraft.py
        anomaly.py
        sensor_event.py
        alert.py
      schemas/
        satellite.py
        aircraft.py
        anomaly.py
        sensor_event.py
        alert.py
      api/
        routes_health.py
        routes_satellites.py
        routes_aircraft.py
        routes_anomalies.py
        routes_sensor_events.py
        routes_alerts.py
        routes_replay.py
      services/
        satellite_ingest.py
        aircraft_ingest.py
        anomaly_engine.py
        orbit_service.py
        replay_service.py
        alert_service.py
      utils/
        geo.py
        time.py
        logging.py
      workers/
        celery_app.py
        jobs.py
      tests/
        test_health.py
        test_satellites.py
        test_aircraft.py
        test_anomalies.py
  frontend/
    Dockerfile
    package.json
    vite.config.ts
    tsconfig.json
    public/
    src/
      main.tsx
      App.tsx
      styles.css
      lib/
        api.ts
        cesium.ts
        format.ts
      store/
        useAppStore.ts
      components/
        GlobeView.tsx
        LayerPanel.tsx
        DetailDrawer.tsx
        TopBar.tsx
        TimelineBar.tsx
        StatusChips.tsx
        AlertFeed.tsx
      features/
        satellites/
          satelliteLayer.ts
          satelliteHooks.ts
        aircraft/
          aircraftLayer.ts
          aircraftHooks.ts
        anomalies/
          anomalyLayer.ts
          anomalyHooks.ts
        sensors/
          sensorLayer.ts
      types/
        satellite.ts
        aircraft.ts
        anomaly.ts
        sensor.ts
  scripts/
    seed_demo_data.py
    dev_reset.sh
    fetch_sample_tle.py
  sample_data/
    anomalies.geojson
    aircraft_sample.json
    satellites_sample.json

DOCKER COMPOSE SPEC
-------------------
Services:
- frontend
- backend
- postgres
- redis
- worker
- optional pgadmin

Example service intentions:

postgres
- image: postgis/postgis
- volume for persistent storage
- expose 5432 internally

redis
- for queues/cache

backend
- FastAPI app
- depends_on postgres, redis
- mounts code in dev
- serves /api/v1

worker
- runs scheduled ingest/analytics jobs

frontend
- Vite dev in development
- Nginx static in production

ENVIRONMENT VARIABLES
---------------------
Create .env.example with:

POSTGRES_DB=opensignal
POSTGRES_USER=opensignal
POSTGRES_PASSWORD=changeme
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

REDIS_URL=redis://redis:6379/0

BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
API_PREFIX=/api/v1

FRONTEND_PORT=3000
VITE_API_BASE_URL=http://localhost:8000/api/v1

CELESTRAK_SOURCE_URL=
OPENSKY_USERNAME=
OPENSKY_PASSWORD=

ENABLE_SENSOR_MODULE=true
ENABLE_SHIPS_MODULE=false
ENABLE_REPLAY=true

DEFAULT_REGION_BBOX=
LOG_LEVEL=INFO

BACKEND IMPLEMENTATION NOTES
----------------------------
FastAPI requirements:
- Modular routers
- OpenAPI docs
- Pydantic validation
- Structured logging
- CORS support for frontend
- Graceful startup checks

Database:
- Use SQLAlchemy/SQLModel
- Use PostGIS geometry types
- Add indexes on time and geometry
- Add GIST indexes for spatial search

Indexes to create:
- aircraft_snapshots(timestamp)
- aircraft_snapshots(icao24)
- anomaly_clusters(start_time)
- GIST(geom)
- GIST(area_geom)

FRONTEND IMPLEMENTATION NOTES
-----------------------------
Cesium integration:
- Initialize viewer once
- Keep globe state in store
- Sync layer visibility from store
- Use requestAnimationFrame responsibly
- Clean up entities/primitives on unmount

React:
- Use feature-based architecture
- Keep API calls in hooks/lib
- Use typed DTOs
- Avoid large rerenders
- Virtualize long event lists if needed

MAP FEATURES TO IMPLEMENT
-------------------------
1. Home globe view
2. Search by satellite name, NORAD ID, callsign, ICAO24
3. Fly-to selected object
4. Layer legend
5. Time slider
6. Entity detail inspector
7. Current object counts
8. Bounding-box region filter
9. Severity legend for anomaly layer
10. Screenshot export optional

MVP DEVELOPMENT PHASES
----------------------
PHASE 1 — FOUNDATION
- Scaffold repo
- Docker Compose
- FastAPI hello world
- React + Cesium globe
- PostGIS setup
- Health endpoint
- Basic README

PHASE 2 — SATELLITES
- Ingest TLE data
- Display satellites on globe
- Show orbit paths
- Click for details

PHASE 3 — AIRCRAFT
- Poll aircraft states
- Render aircraft
- Show trails
- Add filters

PHASE 4 — ANOMALY ENGINE
- Build heuristics
- Cluster suspicious regions
- Render heatmap/polygons
- Add alerts list

PHASE 5 — TIME REPLAY
- Save snapshots
- Build timeline UI
- Replay movement

PHASE 6 — OPTIONAL SENSOR INPUT
- POST endpoint
- Render local events
- Correlate with anomaly clusters

PHASE 7 — POLISH
- Better animations
- Better cards
- Stats widgets
- Performance tuning
- Docs and screenshots

PROMPTS THE LLM SHOULD FOLLOW WHILE CODING
------------------------------------------
General coding rules:
- Produce complete files, not fragments
- Keep code production-lean and readable
- Include comments where logic is non-obvious
- Use type hints everywhere practical
- Avoid fake data in production paths
- Use honest labeling for inferred analytics
- Do not include proprietary keys
- Do not hardcode secrets

Backend coding rules:
- Use Pydantic schemas
- Keep services separate from routes
- Add tests for each route group
- Return ISO timestamps
- Validate bbox/time parameters
- Handle upstream API failures gracefully

Frontend coding rules:
- Use TypeScript types for all DTOs
- Keep Cesium entity management isolated
- Use a central store for toggles/selection/time
- Make the UI visually polished but uncluttered

ANALYTICS NARRATIVE RULES
-------------------------
Whenever the system generates anomaly text, it must say one of:
- “Public telemetry suggests…”
- “This zone represents an inferred anomaly cluster…”
- “This layer does not identify a precise interference source…”

Never say:
- “This is the jammer”
unless actual triangulation exists.

SAMPLE ALERT TEXTS
------------------
High severity GNSS anomaly:
“Public telemetry suggests a concentrated navigation anomaly affecting multiple aircraft in this region. This does not identify a precise source.”

Sensor correlation alert:
“A local user-owned sensor event overlaps in time and region with an inferred telemetry anomaly cluster, increasing confidence in a disturbance event.”

API PARAMETER EXAMPLES
----------------------
GET /api/v1/aircraft/region?bbox=-10,35,5,45

GET /api/v1/anomalies?severity=high&active=true

GET /api/v1/replay/aircraft?start=2026-03-10T00:00:00Z&end=2026-03-10T06:00:00Z

SAMPLE FRONTEND USER STORIES
----------------------------
1. As a user, I can open the globe and immediately see satellites and aircraft.
2. As a user, I can toggle anomaly zones on and off.
3. As a user, I can click a satellite and inspect its metadata.
4. As a user, I can select a time range and replay movement.
5. As a user, I can search for a callsign or satellite name.
6. As a user, I can view a live event feed of anomalies and alerts.

TESTING REQUIREMENTS
--------------------
Backend tests:
- health endpoint returns ok
- satellites endpoint returns list
- aircraft endpoint validates bbox
- anomalies endpoint filters correctly
- sensor POST validates payload
- replay endpoint validates time range

Frontend tests:
- store toggles layers
- detail panel renders selection
- timeline updates state
- API adapters parse data
- globe layer helpers do not crash on empty payloads

Integration tests:
- backend connects to DB
- ingest job inserts records
- anomaly engine generates cluster from sample data

SEED DATA REQUIREMENTS
----------------------
Include sample data for offline demo:
- 50 sample satellites
- 100 sample aircraft snapshots
- 3 anomaly clusters
- 5 sensor events

Provide a script:
python scripts/seed_demo_data.py

README REQUIREMENTS
-------------------
The README must include:
1. Project overview
2. Features
3. Honest limitations
4. Architecture diagram
5. Local dev setup
6. Docker setup
7. Environment variables
8. Data source notes
9. Analytics disclaimer
10. Screenshots placeholders
11. Future roadmap

README disclaimer example:
“This project fuses public telemetry and open-source geospatial tools to visualize air and space activity. Any anomaly layer shown by the platform represents inference from public data and does not identify a precise interference source without independent sensor confirmation.”

DEPLOYMENT NOTES
----------------
Development:
- docker compose up --build
- frontend on localhost:3000
- backend on localhost:8000
- db internal

Production guidance:
- Put backend behind reverse proxy
- Serve frontend statically
- Use HTTPS
- Rotate logs
- Use persistent Postgres volume
- Add backup strategy

OPTIONAL N8N INTEGRATION
------------------------
If generating optional automation docs, include:
- Cron trigger to call ingest endpoints
- Alerting workflow to Slack/email/Telegram
- Archive anomaly summaries
- Generate daily digest
- Push snapshots to object storage

N8N workflow ideas:
1. Every 5 min fetch aircraft snapshot
2. Every 30 min refresh TLE source
3. Every 5 min run anomaly pipeline
4. If critical anomaly created, send alert
5. End-of-day summary to markdown/email

ADVANCED FUTURE FEATURES
------------------------
Do not build these first, but structure for them:
- AIS ship layer
- Space weather overlays
- Multi-user auth
- Saved views
- Historical archive explorer
- CZML streams
- Vector tiles
- WebSocket live updates
- Mobile-responsive control layer
- ML anomaly scoring
- Correlation dashboard across aircraft + sensors + environment

SECURITY / SAFETY LIMITS
------------------------
Do not generate:
- Harmful targeting workflows
- Illegal interception guides
- Weaponization features
- Claims of precise hostile emitter locations from weak evidence
- Sensitive surveillance enhancements beyond public OSINT visualization

You may generate:
- Legal visualization of public telemetry
- User-owned sensor summary ingestion
- Open geospatial analytics
- Safety disclaimers
- Honest anomaly inference

DELIVERABLES THE CODING LLM MUST PRODUCE
----------------------------------------
The coding LLM must output:
1. Full repository structure
2. All code files
3. Docker Compose
4. .env.example
5. README
6. Sample seed data
7. At least one backend test file per route group
8. Frontend with Cesium globe working
9. Backend ingest services
10. Anomaly engine MVP
11. Clear setup instructions

FINAL BUILD ORDER INSTRUCTION TO THE LLM
----------------------------------------
Build in this order:
1. Repo scaffold
2. Docker Compose
3. FastAPI backend base
4. PostGIS models
5. Cesium frontend base
6. Satellite ingestion + render
7. Aircraft ingestion + render
8. Anomaly engine + render
9. Replay features
10. Sensor events
11. Tests
12. README polish

FINAL QUALITY BAR
-----------------
The result must be:
- runnable
- visually impressive
- honest about inference limits
- modular
- well documented
- suitable for homelab deployment
- easy to extend later

OPTIONAL “MAKE IT LOOK COOL” DIRECTIVE
--------------------------------------
Use tasteful cinematic touches:
- soft glows
- orbit arcs
- subtle pulse on active anomalies
- nice loading states
- polished typography
- dark control panels
- animated legends
but do not sacrifice performance or clarity.

END OF SPEC