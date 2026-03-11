# Feature Landscape: OSINT Geospatial Intelligence Visualization Platform

**Domain:** 3D Globe Satellite/Aircraft Tracking Intelligence Visualization
**Researched:** 2026-03-11
**Confidence:** HIGH

## Executive Summary

Based on analysis of leading platforms (FlightRadar24, N2YO, Track The Sky, LeoLabs, OpenSky Network), table stakes features for OSINT geospatial visualization platforms center on real-time tracking, intuitive search/filter, and clean visualization. Differentiators include historical replay, anomaly detection, multi-source fusion, and cinematic UI polish. The market expects responsive performance with thousands of objects, accurate metadata, and honest transparency about data sources and inference limitations.

## Table Stakes

Features users expect from any globe/tracking platform. Missing these means the product feels incomplete or broken.

| Feature | Complexity | Why Essential | Notes |
|---------|------------|---------------|-------|
| **3D Interactive Globe** | Medium | Core experience - users expect Earth rotation, zoom, tilt | CesiumJS provides this, includes terrain, atmosphere, day/night shading |
| **Real-Time Satellite Tracking** | Medium | Primary use case - users want to see satellites orbiting now | 5,000+ satellites must be visible, updated every 10-60 seconds |
| **Real-Time Aircraft Tracking** | Medium | Parallel to satellites - aircraft movement is expected | Hundreds to thousands of aircraft simultaneously |
| **Orbit Path Visualization** | Low | Satellites must show trajectory - otherwise users can't predict movement | Polyline showing orbital path, ground track optional but nice |
| **Aircraft Trail Visualization** | Low | Shows recent movement history - critical for understanding flight patterns | 5-15 minute trail is standard |
| **Click-to-Inspect Details** | Low | Users need metadata - what am I looking at? | Popup/panel with ID, position, altitude, speed, etc. |
| **Search by Identifier** | Medium | Users must find specific objects quickly | Satellite: name/NORAD ID. Aircraft: callsign/ICAO24 |
| **Layer Toggle Controls** | Low | Users need to reduce clutter - turn layers on/off | Satellites, aircraft, anomalies, ships as separate toggles |
| **Filter by Region/Altitude** | Medium | Users focus on specific areas/altitude bands | Bounding box (bbox) and altitude range filters |
| **Performance with Scale** | High | Must handle 5,000+ satellites + 1,000+ aircraft smoothly | CesiumJS batching, culling, LOD required |
| **Data Freshness Indicator** | Low | Users need to trust data - when was it last updated? | Timestamp on objects and "Last updated" status |
| **Responsive UI** | Medium | Must work on desktop and tablet (mobile is bonus) | Collapsible panels, touch-friendly controls |
| **Dark Theme** | Low | OSINT/intelligence platforms are expected to be dark | Mission control aesthetic, reduces eye strain |

## Differentiators

Features that set products apart from competitors. Not expected, but highly valued when present.

| Feature | Competitive Value | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Historical Replay / Time Slider** | HIGH - Allows post-event analysis, incident reconstruction | High | FlightRadar24 Gold has 365-day history. Requires snapshot storage + timeline UI |
| **GNSS Anomaly Visualization** | HIGH - Unique intelligence capability, no mainstream platform has this | High | Heatmaps/polygons showing inferred interference zones. Must be labeled honestly as inference |
| **Multi-Source Data Fusion** | MEDIUM - Combines satellites, aircraft, anomalies in one view | Medium | Most platforms are single-domain (only satellites OR only aircraft) |
| **Cinematic UI Polish** | MEDIUM - Makes platform feel premium vs amateur | Medium | Glowing trails, soft bloom effects, smooth animations, mission control theme |
| **Alert/Notification System** | MEDIUM - Proactive intelligence vs passive monitoring | Medium | Real-time alerts for anomaly escalation, region events, threshold crossing |
| **Naked Eye Visibility Prediction** | MEDIUM - Differentiates satellite trackers (Track The Sky has this) | Low | Calculates which satellites are bright enough to see from user's location |
| **3D View / Pilot Perspective** | MEDIUM - FlightRadar24's 3D cockpit view is popular | Medium | Show what pilot sees, with terrain and livery |
| **AR Sky Finder** | LOW - Nice gimmick for mobile (FlightRadar24 has this) | Medium | Point phone at sky to identify aircraft overhead. Out of scope for web-first |
| **Starlink Train Detection** | LOW - Niche but impressive (Track The Sky has this) | Low | Identify recently launched satellite batches visible as chains |
| **Advanced Filtering** | MEDIUM - Power users need granular control | Medium | Filter by constellation, airline, aircraft type, speed, country |
| **Export/Screenshot** | LOW - Users want to share views | Low | Export current view as image or data as CSV/GeoJSON |
| **Weather Layer Overlay** | LOW - Context for aircraft/satellite activity | Medium | FlightRadar24 Gold has weather. Requires external API (OpenWeather) |
| **Space Weather Context** | LOW - Relevant for satellite operations | Medium | Solar activity, geomagnetic storms. Requires NOAA API |
| **Event Feed / Timeline** | MEDIUM - Narrative layer over raw data | Medium | Chronological list of anomalies, alerts, significant movements |
| **Sensor Integration** | HIGH - User-owned RF sensors add validation layer | High | Allows local sensor data to correlate with anomalies. Must be legal/ethical |
| **Coverage Footprint Visualization** | LOW - Satellite communication/sensing coverage cones | Low | Show ground footprint ellipse for selected satellite |
| **Proximity Monitoring** | MEDIUM - Alerts when objects come close (LeoLabs has this) | Medium | Conjunction analysis for satellite collision risk |
| **Pass Predictor** | MEDIUM - When will satellite be visible from my location? | Medium | N2YO and satellite trackers have this. Calculates overhead passes |
| **API Access** | LOW - Power users want programmatic access | Low | REST API for state vectors, historical data (OpenSky provides this) |

## Anti-Features

Features to deliberately NOT build. Either they're out of scope, ethically problematic, or introduce complexity without value.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Real-Time Chat/Collaboration** | Adds complexity, security concerns, not core to intelligence viz | Single-user tool. Focus on data quality over social features |
| **Mobile Native App** | Resource drain, web-first is sufficient | Responsive web UI works on tablets. Mobile app is future consideration |
| **Precise Jammer Geolocation** | Requires sensor triangulation we don't have. False confidence is dangerous | Honest "anomaly cluster" visualization with confidence scores |
| **Multi-User Authentication** | Adds complexity for personal/homelab use case | Personal deployment focus. No auth barrier for self-hosted |
| **Proprietary Data Sources** | Violates OSINT-only constraint, introduces cost/licensing issues | Stick to CelesTrak, OpenSky Network, public AIS (if available) |
| **Real-Time Video Feeds** | Bandwidth intensive, out of scope for MVP | Static satellite images from NASA/ESA if needed |
| **Social Sharing to Public Networks** | Security/privacy concerns for intelligence data | Local export only (screenshot, CSV). No direct social media integration |
| **Automated Target Tracking** | Ethical concerns around surveillance | User selects objects manually. No autonomous "follow this aircraft" |
| **Weaponization Features** | Obvious ethical/legal problems | Visualization and analysis only. No targeting, no hostile intent |
| **Cryptocurrency Integration** | Irrelevant to core mission | No blockchain, NFTs, tokens |
| **AI-Powered Chatbot** | Buzzword feature, doesn't add intelligence value | Focus on visualization quality over conversational gimmicks |
| **Gamification / Achievement System** | Wrong mindset for intelligence tool | Professional dashboard, not entertainment |
| **Built-in Social Network** | Security liability, scope creep | Users share findings externally if needed |

## Feature Dependencies

Critical path relationships between features:

```
3D Globe (CesiumJS)
  ├─> Real-Time Satellite Tracking
  │     ├─> Orbit Path Visualization
  │     └─> Search by NORAD ID
  │
  ├─> Real-Time Aircraft Tracking
  │     ├─> Aircraft Trail Visualization
  │     └─> Search by Callsign/ICAO24
  │
  ├─> Layer Toggle Controls
  │     └─> Performance Optimization (required when multiple layers active)
  │
  ├─> Filter by Region (bbox)
  │     └─> Advanced Filtering (builds on basic bbox)
  │
  └─> Click-to-Inspect Details
        └─> Detail Panel UI Component

Historical Replay
  ├─> Requires: Snapshot Storage (PostgreSQL time-series)
  ├─> Requires: Time Slider UI Component
  └─> Enables: Post-Event Analysis

GNSS Anomaly Visualization
  ├─> Requires: Aircraft Tracking (source of anomaly data)
  ├─> Requires: Anomaly Detection Engine (clustering algorithm)
  ├─> Requires: Geospatial Indexing (PostGIS)
  └─> Enables: Alert System

Alert System
  ├─> Requires: Anomaly Detection OR Proximity Monitoring
  └─> Enables: Event Feed / Timeline

Sensor Integration
  ├─> Requires: Anomaly Visualization (for correlation)
  └─> Requires: API Endpoint (POST /sensor-events)

Performance with Scale
  ├─> Required by: All Visualization Features
  └─> Enables: CesiumJS batching, culling, LOD, requestRenderMode
```

## MVP Recommendation

Prioritize for initial release (Phase 1-2):

1. **3D Globe with Terrain** - Foundation
2. **Real-Time Satellite Tracking** - Core value #1
3. **Orbit Path Visualization** - Makes satellites understandable
4. **Real-Time Aircraft Tracking** - Core value #2
5. **Aircraft Trail Visualization** - Makes aircraft movement clear
6. **Click-to-Inspect Details** - Essential interaction
7. **Search by Identifier** - Users need to find specific objects
8. **Layer Toggle Controls** - Manage visual clutter
9. **Filter by Region** - Focus on areas of interest
10. **Dark Cinematic Theme** - Sets visual tone, differentiates from Google Earth
11. **Performance Optimization** - Must handle 5,000+ satellites smoothly

Defer to Phase 2-3 (Post-MVP):

- **Historical Replay** - Requires snapshot infrastructure
- **GNSS Anomaly Visualization** - Requires anomaly engine (complex)
- **Alert System** - Requires events to alert on
- **Sensor Integration** - Optional module, requires anomaly layer first
- **Pass Predictor** - Nice-to-have, not core to real-time intelligence

Defer to Future (Beyond Initial Roadmap):

- **Weather Layers** - External API dependency, not core intelligence
- **Space Weather** - Niche use case
- **AR Sky Finder** - Mobile feature, web-first strategy
- **API Access** - When external integrations are needed
- **Advanced Export** - When sharing becomes a user request

## Feature Complexity Analysis

### Low Complexity (< 1 week)
- Layer toggles
- Dark theme
- Data freshness indicator
- Click-to-inspect popup
- Orbit path polylines
- Aircraft trails
- Export screenshot
- Coverage footprint visualization
- Starlink train detection

### Medium Complexity (1-2 weeks)
- 3D globe setup (CesiumJS)
- Real-time satellite tracking (integration)
- Real-time aircraft tracking (OpenSky API)
- Search by identifier
- Filter by region/altitude
- Responsive UI layout
- Event feed / timeline
- Advanced filtering UI
- Naked eye visibility calculation
- Pass predictor
- Proximity monitoring
- Weather layer overlay

### High Complexity (2+ weeks, multiple sprints)
- Performance optimization (5,000+ objects)
- Historical replay (storage + UI + backend)
- GNSS anomaly detection engine (clustering, scoring)
- Sensor integration (API + correlation logic)
- 3D pilot perspective (view transformation)
- Multi-source data fusion (architecture)

## Market Context

### What Users Expect Based on Existing Platforms

**From FlightRadar24:**
- Smooth, responsive map
- Historical playback with time slider
- Detailed aircraft metadata (type, airline, age)
- Filter by multiple criteria
- 3D view option
- Premium tiers with extended history

**From N2YO / Track The Sky:**
- 20,000+ satellites tracked
- Footprint and orbit visualization
- Pass predictions
- ISS live video integration
- Visibility calculations

**From LeoLabs:**
- Professional visualization of LEO
- Conjunction search
- Orbital debris tracking
- Launch tracking

**From OSINT Platforms (Echosec, Liferaft):**
- Geospatial filtering (bbox)
- Real-time monitoring
- Alert systems
- Multi-source data correlation
- Professional intelligence dashboard UI

### Unique Position of This Project

**Differentiation:**
1. **Multi-Domain Fusion** - Satellites + Aircraft + Anomalies in ONE view (most platforms are single-domain)
2. **OSINT GNSS Anomaly Layer** - No public platform visualizes RF interference inference from telemetry
3. **Open Source + Self-Hosted** - No SaaS dependency, full data control
4. **Cinematic Intelligence Aesthetic** - Mission control polish vs utilitarian tracker
5. **Honest Analytics** - Clear labeling of inference vs measurement

**Table Stakes We Must Match:**
- Real-time tracking (satellites, aircraft)
- Search and filter
- Interactive 3D globe
- Performance at scale
- Clean metadata display

**Areas We Won't Compete:**
- Mobile apps (FlightRadar24)
- 365-day history (FlightRadar24 Gold tier)
- Professional collision analysis (LeoLabs)
- Social features (none needed)

## Sources

### Satellite Tracking Platforms
- [Perihelion Orbit Tracker](https://perihelion.space/dashboard/orbit-tracker)
- [Satellite Tracker 3D](https://satellitetracker3d.com/)
- [Track The Sky](https://trackthesky.com)
- [N2YO Real-Time Satellite Tracking](https://www.n2yo.com/)
- [LeoLabs Low Earth Orbit Visualization](https://platform.leolabs.space/visualization)
- [OrbTrack](https://www.orbtrack.org/)

### Aircraft Tracking Platforms
- [FlightRadar24](https://www.flightradar24.com/)
- [FlightAware](https://www.flightaware.com/live/)
- [ADS-B Exchange](https://globe.adsbexchange.com/)
- [Flighty vs. Flightradar24 (2026): Flight Tracker Comparison](https://flighty.com/compare/flightradar24)

### OSINT & Geospatial Intelligence
- [OSINT Tools For Security Analysts In 2026](https://liferaftlabs.com/blog/osint-tools-for-security-analysts-in-2026)
- [Flashpoint Geospatial OSINT](https://flashpoint.io/ignite/echosec-by-flashpoint/)
- [Top 15 OSINT Tools for Expert Intelligence Gathering](https://www.recordedfuture.com/threat-intelligence-101/tools-and-technologies/osint-tools)

### CesiumJS & 3D Visualization
- [CesiumJS Platform](https://cesium.com/platform/cesiumjs/)
- [Cesium Releases in March 2026](https://cesium.com/blog/2026/03/03/cesium-releases-in-march-2026/)
- [How I Made Cesium Handle Massive 3D Regions Without Freezing](https://medium.com/@memreatasoy/how-i-made-cesium-handle-massive-3d-regions-without-freezing-f8285e593875)
- [3D Tiles for Performance](https://www.janeasystems.com/blog/streaming-large-3d-scenes-with-3d-tiles)

### OpenSky Network API
- [OpenSky Network API Documentation](https://openskynetwork.github.io/opensky-api/)
- [OpenSky REST API](https://openskynetwork.github.io/opensky-api/rest.html)

### GNSS Anomaly Detection
- [Low-Cost COTS GNSS Interference Monitoring](https://pmc.ncbi.nlm.nih.gov/articles/PMC10098881/)
- [GPSPATRON GNSS Interference Monitoring](https://gpspatron.com/gnss-interference-monitoring-and-classification-for-critical-infrastructure-safety/)
- [Recent Advances on Jamming and Spoofing Detection in GNSS](https://www.mdpi.com/1424-8220/24/13/4210)

### Geospatial Intelligence Dashboards
- [World Monitor - Real-Time Intelligence Dashboard](https://github.com/koala73/worldmonitor)
- [WorldAlerts — Real-Time Geopolitical Intelligence](https://www.worldalerts.io/)
- [Top Admin Dashboard Design Ideas for 2026](https://www.fanruan.com/en/blog/top-admin-dashboard-design-ideas-inspiration)

### Geofencing & Alerts
- [Geofencing & Geospatial Alerts | Vismo](https://www.vismo.com/products/risk-management/geofencing/)
- [ArcGIS Real-Time Data Streaming](https://architecture.arcgis.com/en/framework/system-patterns/real-time-data-streaming-and-analytics/overview.html)

### Geospatial Search & Filtering
- [Spatial Search :: Apache Solr](https://solr.apache.org/guide/solr/latest/query-guide/spatial-search.html)
- [Bounding Box - OpenStreetMap Wiki](https://wiki.openstreetmap.org/wiki/Bounding_Box)
- [Geospatial Search - Globus](https://docs.globus.org/api/search/guides/geo_search/)

### Flight Replay & Time Features
- [FlightAware Flight Replay and Track Visualization](https://blog.flightaware.com/201710-introducing-flight-replay-and-track-visualization)
- [Flightradar24 Playback Feature](https://www.flightradar24.com/blog/inside-flightradar24/playback-is-now-available-in-the-flightradar24-app/)
- [Taking Flight: Real-Time Aircraft Tracking with ArcGIS Velocity](https://www.esri.com/en-us/industries/blog/articles/taking-flight-real-time-aircraft-tracking-with-arcgis-velocity-and-flightaware)

### Satellite-Based Aircraft Tracking
- [ARTES benefits series – Eurialo, Global Real-Time Aircraft Tracking from Space](https://space-economy.esa.int/article/324/artes-benefits-series-eurialo-global-real-time-aircraft-tracking-from-space)
- [ESA - Advanced aircraft tracking from space](https://www.esa.int/Applications/Connectivity_and_Secure_Communications/Advanced_aircraft_tracking_will_come_live_from_space)

---

**Confidence Assessment:** HIGH
All table stakes features verified across multiple platforms. Differentiators based on observed competitive landscape and identified gaps. Anti-features informed by ethical constraints and scope discipline. Feature dependencies mapped from CesiumJS documentation and platform architecture analysis.
