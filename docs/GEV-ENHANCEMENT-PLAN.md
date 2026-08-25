# Intelligence Globe Enhancement Plan

Plan to close the look-and-feel gap with [God's Eye View](https://github.com/bilawalsidhu/gods-eye-view) (GEV), add voice, and take the integrations that are worth the cost. Reimplement in our React / FastAPI / PostGIS stack. Do not fork GEV or port `src/ui.js`.

**Sources:** GEV README, `index.html`, `DATA_SOURCES.md`, `.env.example`, `docs/CURRENT-STATE.md` (2026-08-24); Google Maps Platform pricing (checked 2026-08-25); Cesium ion pricing (checked 2026-08-25); OpenAI Realtime pricing (checked 2026-08-25); Intelligence Globe `App.tsx`, sidebars, HUD, detail panels, PlaybackBar (2026-08-25).

**License reminder:** GEV source is MIT. Bundled models, TeleGeography cables, and live Google / OpenSky / TomTom data are not. Reimplement. Attribute. Do not copy `public/models/` without reading their model README.

---

## 1. Goal

Make Intelligence Globe *feel* like a live instrument, not a dashboard glued to a globe — without throwing away replay, PostGIS, GDELT, GPS jamming, or OSINT.

Success is not matching GEV shot-for-shot. Success is:

1. The first 30 seconds feel like a place, not a UI chrome problem.
2. Clicking a contact locks the camera and the HUD actually reads.
3. Voice can fly, track, and toggle layers without exposing keys to the browser.
4. New feeds are free or nearly free, ingested through our backend, and replay-aware where it matters.
5. Personal / homelab monthly cost stays near zero unless voice is left on.

---

## 2. Why GEV feels better

Their data is not that much better than ours. The *camera, ground, and chrome* are.

| What you notice | What they do | What we do today |
|---|---|---|
| Earth looks real | Photoreal 3D tiles are the default scene | Google 3D is an optional map type; globe is a flat ellipsoid |
| Contacts feel alive | Click locks camera; trail; 3D model when close; ride into cockpit | Click selects; trail is static; no follow; icons are billboards |
| Motion is smooth | Render one poll behind live; dead-reckon ~12 Hz | Lerp toward the newest 90 s ADS-B fix (jumpy when a poll lands) |
| Icons stay honest | World-space heading at every camera angle | Screen-space rotation — icons spin when you orbit |
| HUD is an instrument | Locality, tracked readout, freshness, sensor mode | Banner + MGRS; `ORB / PASS / GSD / SUN EL` are still `--` |
| Chrome gets out of the way | First-run missions, collapsed rails, clean view, keyboard `1`–`7` | Dense cyan rails (40 px each) + 26 px banner + 28 px status bar |
| Sensors feel designed | Presets + scope mask + detection boxes over post-FX | NVG / CRT / FLIR / Noir exist, but no lock-on or boxes |

We already have more of their stack than it feels like: Cesium, ADS-B, military hexes, AIS, satellites, traffic, post-process presets, lerp, selection trails, optional Google 3D tiles (ion asset `2275207`).

The work is **presence**, then **voice**, then **feeds**. Feeds will not fix the feel if the camera is still a map.

### Chrome that currently fights the globe

- Left and right 40 px rails plus a classification banner steal the frame GEV gives to Earth.
- `frontend/src/styles/globe.css` hides `.cesium-viewer-bottom`. That is fine on a personal ellipsoid globe. It is **not** fine once Google 3D or Bing ion imagery is the default — provider ToS requires on-screen credit.
- HUD green + cyan rails + "TOP SECRET" reads as costume. GEV's HUD reads as an instrument because the numbers are real.

---

## 2.1 GUI — this is a large part of "pleasant"

First pass covered camera and terrain. Their **interface** is also why it feels better. I read GEV `index.html` (the real shell: title, DISPLAY rail, command dock, DATA LAYERS, CONTEXT, first-run, cockpit HUD) against our `App.tsx` chrome.

### How their GUI is put together

The globe is the product. Chrome is a thin instrument that **collapses**.

| Surface | What it is | Default |
|---|---|---|
| Title | Small top-left wordmark + tagline | Stays, does not steal the frame |
| Top-center actions | Clear layers · Share · Reset globe | Always there, three icons |
| Style chip | `ACTIVE STYLE · NORMAL` | Always visible, so you know the sensor |
| Left stack | DATA LAYERS accordion (full names + live/key/unavailable) | Collapsed |
| Right rail | CONTEXT: Contacts roster or Space Missions — not settings | Collapsed |
| DISPLAY (top-right) | HUD on/off + Tactical/Operator/Minimal · DETECT · 3D · Scope · Clean UI · bloom | Collapsed on first run |
| Bottom command dock | Location tray + Visual presets as **pin-able trays** | Collapsed to a one-line status (`Style: NORMAL`, `Location: --`) |
| First-run card | Live Contacts / Space / Environmental / Explore | Once per session until dismissed |
| `#intel-hud` | Separate overlay, three layouts, can be off | Off until you hit `H` |
| Loading screen | Branded boot, then globe | One beat, then gone |

Fonts: **JetBrains Mono + Inter**. Icons: one Material set. Preset buttons show the key (`1`–`7`) on the chip. Collapsed trays still show a mini-status so you never open a panel just to see state. A tracked contact is a **tactical card** (big callsign, kts/ft, TRACK / COCKPIT), not a form.

### How ours is put together

The globe sits inside a **permanent dashboard frame**.

```
[ TOP SECRET banner 26px, always on ]
[ PlaybackBar — LIVE/PLAYBACK + UTC          ]
[ 40px left icon rail |          | 40px right icon rail ]
[                     |  GLOBE   | entity form OR camera ]
[ LandmarkNav cyan chips                                 ]
[ BottomStatusBar 28px: api · TLE · ACF                  ]
[ HUD green MGRS + ORB/--  overlaid on all of this       ]
```

Even with every panel closed we keep ~94 px of chrome plus two always-visible rails. Clean UI hides the sidebars and landmark nav but **leaves the fake classification banner and the PlaybackBar**.

| Our control | Where it lives | Problem |
|---|---|---|
| Layers | Left rail → tab | Cryptic `SAT / AIR / MIL` — no source, no LIVE/STALE |
| Sensors | Left rail → Visual Engine | Buried. No on-screen "you are in NVG". No keycaps |
| Search / landmarks | Left search tab + bottom LandmarkNav | Two places. Cyan chip row competes with the globe |
| Map type | Right rail → Map | Buried; 3D is just another radio item |
| Camera / settings | Right rail | **Blocked while an entity is selected** (`if (hasEntity) return`) |
| Entity detail | Right sliding form | `Flight: / ICAO24: / Speed: 214.3 m/s` — a database row, not a contact |
| HUD | Always-on green overlay | Costume banner; telemetry is `--`; only talks about satellites |
| Share / reset globe | Missing | You cannot hand someone a view or "go home" in one click |
| First run | Missing | Cold start = full UI, no mission |
| Voice affordance | Missing | No dock slot for a mic |

We already have Geist as a dependency and then ignore it: HUD and panels hard-code `fontFamily: 'monospace'`. Almost every panel is inline styles and `#00D4FF`. There is no token layer, so restyling means touching twenty files.

### What to copy from their GUI (and what not to)

**Copy the layout contract, not the skin.**

| Change | Why it is pleasant | Effort | Wave |
|---|---|---|---|
| Rails that vanish | Globe gets the frame back. Hover/click a 8 px hit edge to open | 2–3 days | 1 |
| Kill or default-off the TOP SECRET banner | It is the single cheapest-looking thing on screen. Our data is public OSINT | 1 hour | 1 |
| Bottom command dock | Landmarks + sensor chips with `1`–`5` keycaps, collapsed to one strip. Pin optional | 3–4 days | 1 |
| Always-on style chip | `NVG` / `FLIR` in the corner without opening Visual Engine | 2 hours | 1 |
| Reset globe (and later share) top-center | Their most-used chrome. We have no "go home" | 2 hours | 1 |
| Contact card, not a form | Hero callsign, alt in ft, speed in kts, **TRACK** button. Keep the extra fields under a disclosure | 1–2 days | 1 |
| Layer rows with honesty | `AIRCRAFT · LIVE` / `STALE` / `OFF` instead of `AIR` | 1 day | 1 |
| HUD as optional overlay | `H` toggles it. Show selected contact, not `NO SAT SELECTED`. Three densities later | 1 day | 1 |
| Units people recognize | ft + kts on aircraft (meters stay in the disclosure) | 2 hours | 1 |
| Unlock right rail | Settings/camera must work while a contact is selected | 2 hours | 1 |
| First-run card | Live contacts / Intel picture (GDELT+jamming) / Explore | 2–3 days | 2 |
| Contacts roster | 250 km nearest list + next/prev. This *is* their right rail | 1 week | 2 |
| DISPLAY chip row | HUD · DETECT · CLEAN as compact toggles, not a left-tab | 1–2 days | 2 |
| Boot splash | One branded beat, then globe. Cheap, sets the tone | 0.5 day | 2 |
| Scope mask | Circular keyhole. High cinema, not required for pleasant | 3–5 days | 4 |

**Do not copy**

- "NO PLACE LEFT BEHIND" / forbidden-cockpit copy
- Split-flap status chips
- Radio tuner chrome
- CCTV calibration panel
- Cockpit visor (pitch rails, speed rims) until Wave 5
- Anime / Snow styles
- Emoji in buttons
- Title-bar glow for its own sake

**Keep (we are ahead here)**

- PlaybackBar + OSINT category chips — they have no general timeline
- GDELT / jamming as first-class left-layer items
- Typed detail data (registration, IAS/TAS/Mach, emergency). Promote it; do not delete it

### GUI design rules for our rewrite

1. **Collapsed is the default.** A closed control shows its state in one line. Opening is extra.
2. **One place per job.** Sensors live in the dock. Layers live on the left. A contact lives in one card. Search is not also a landmark row.
3. **The globe is never framed by two 40 px slabs.** Rails are overlays, not columns.
4. **Actions on the card.** TRACK (Wave 1), later COCKPIT. Selecting is not the end of the interaction.
5. **Honesty on every row.** LIVE / STALE / UNAVAILABLE. No silent empty layers.
6. **Tokens, not cyan soup.** One typeface (Geist or JetBrains Mono), one accent, one HUD green used only on the HUD. Stop `#00D4FF` on every border.
7. **Clean UI means clean.** Banner, rails, dock, and playback extras go. Playback LIVE clock can stay as a 16 px chip. Credits stay if 3D is on.

---

## 3. Google 3D cost — cheaper than it looks for a homelab

Two different bills get confused. We are already on the cheaper path.

### Path A — what we already use (keep this)

`GlobeView` / `viewerRegistry.swapMapType('google_3d')` loads **Cesium ion asset 2275207** with `VITE_CESIUM_ION_TOKEN`. No Google Cloud project. No Map Tiles API key.

Cesium ion Community (free, personal / non-commercial), as of 2026-08-25:

| Quota | Community (free) |
|---|---|
| Google Photorealistic 3D Tiles | **1,000 root tiles / month** |
| Global 2D imagery (Bing / Google) | 1,000 sessions / month |
| Streaming | 15 GB / month |
| Commercial use | Not allowed (need Commercial at $149 / mo individual) |

A **root tile = one session**: one page load, then up to ~3 hours of flying around. Refreshing the tab starts a new session. Subsequent tile downloads inside the session are not extra root tiles.

**Personal homelab math**

| Habit | Sessions / month | Fits Community? |
|---|---|---|
| 5–10 focused sessions / week | 20–50 | Yes, comfortably |
| Daily use, 1–2 reloads / day | 30–60 | Yes |
| Heavy hacking, 20 reloads / day | ~600 | Still under 1,000 |
| Public URL, many users | 1,000+ | No — upgrade or restrict |

Cesium treats the 1,000 as a **soft quota** (they contact you; they do not auto-charge Google prices). Still set a personal habit: do not leave `google_3d` as the default on a public deploy.

### Path B — what GEV uses (only if we need Google Places)

GEV bills **Google Map Tiles API: Photorealistic 3D Tiles** directly.

| Volume (root tiles / month) | Price (USD / 1,000) |
|---|---|
| First 1,000 | Free |
| Next 99,000 | $6.00 |
| 100k–500k | $5.10 |

Plus, if voice uses Places / Geocoding / Nearby Search, those SKUs are **separate and much more expensive** (Nearby Search Pro is $32 / 1,000 after a 5,000 free cap).

The old "$200 / month Google credit" **ended 2025-02-28**. Do not plan around it.

### Recommendation

- **Stay on Cesium ion for 3D.** For a personal tool, photoreal Earth is effectively free if you do not refresh constantly and do not publish the token.
- **Do not add a Google Maps API key** unless we later want Places-backed voice ("what building is this?"). Voice v1 can geocode with Nominatim and query our own APIs.
- **Default map type to `google_3d`** behind a setting, with a 2D satellite fallback if the tileset fails.
- **Restore Cesium credits** when 3D or ion imagery is on. Hide them only on the ellipsoid / OSM path if we still want that.
- **If this ever becomes a public or commercial product:** Community ion is the wrong license. Either Cesium Commercial ($149 / mo, 5,000 3D roots) or Google Map Tiles with a hard budget alert.

### Cost of *not* using Google 3D

Re:Earth / Mapterhorn terrain (GEV's keyless fallback) + Bing / OSM is $0 and still looks much better than our flat ellipsoid. If ion 3D quota ever becomes a problem, terrain-plus-satellite is the graceful degrade — not "turn the globe off."

---

## 4. Voice — yes, but start smaller than GEV

GEV's voice is OpenAI Realtime over WebRTC, 28 tools, scene screenshot grounding, and a whiteboard. The key never reaches the browser; the client gets a short-lived session token. They default to `gpt-realtime-2`, with a Mini toggle (`gpt-realtime-2.1-mini`), a live session estimate, a $2 warning, and a **$5 in-app session cap**.

### What it should do for us (v1)

Enough to make the globe feel directed:

| Tool | Maps to our code |
|---|---|
| `fly_to` | `flyToPosition` / `flyToLandmark` |
| `zoom_to_globe` | Existing camera reset |
| `set_layer_visibility` | `useAppStore.setLayerVisible` |
| `set_visual_preset` | `setVisualPreset` (`1`–`5` keys too) |
| `set_map_type` | `setMapType` |
| `track_contact` | New tracked-entity API (Wave 1) |
| `select_nearest` | Viewport query over aircraft / ships / sats |
| `enter_cockpit` | Later; stub as "not available" in v1 |
| `what_is_selected` | Detail-panel fields we already have |
| `clear_selection` | Existing store clears |

Skip in v1: whiteboard polygons, walking routes, radio, CCTV viewsheds, screenshot visual grounding, 28-tool parity.

### Architecture (do not put the key in Vite)

```
Browser mic
  → WebRTC / Realtime client
  → POST /api/voice/session   (FastAPI, API_KEY-protected)
  → OpenAI issues ephemeral token
  → tools call back into /api/* or Zustand actions
```

- `OPENAI_API_KEY` lives in backend `.env` only. Never `VITE_`.
- Default model: **Mini** (`gpt-realtime-2.1-mini` or whatever is current). Full model is an opt-in.
- In-app session cap (copy GEV's idea): warn at $1, hard-stop at $3 for Mini / $5 for full.
- Provider-side usage limit in the OpenAI dashboard is the real backstop.
- App works fully with no OpenAI key. Mic button says "voice unavailable."

### Voice cost (indicative, 2026-08-25)

OpenAI bills tokens, not minutes. Rough conversational equivalents:

| Model | Audio in / 1M tok | Audio out / 1M tok | Typical talk |
|---|---|---|---|
| `gpt-realtime-2` | $32 | $64 | ~$0.30–$0.45 / min |
| Mini tier | ~$10 | ~$20 | ~⅓ of that |

| Personal use | Mini | Full |
|---|---|---|
| 10 min / day | ~$3–5 / month | ~$10–15 / month |
| 30 min / day | ~$10–15 / month | ~$30–40 / month |
| Hour-long session, no cap | Easy to hit $15–25 | Easy to hit $20–40 |

**Google 3D is not the expensive feature. Voice is.** For a homelab, leave Mini on, cap the session, and it stays a coffee-money feature.

GEV also spends Google Places when the agent asks "what city is this?" at street level. We will not. v1 uses camera lon/lat + Nominatim (free, rate-limit 1 req/s) + our existing detail APIs.

---

## 5. Integration inventory

### Already ours (keep and surface better)

| Layer | Source | Notes |
|---|---|---|
| Civilian aircraft | ADSB.lol | 15 s ingest, 90 s frontend poll — tighten the client poll |
| Military aircraft | ADSB.lol mil hexes | Separate layer; GEV reconciles into one amber set |
| Ships | AISStream | Same provider they use |
| Satellites | CelesTrak via our worker | Add class colors / DENSE Starlink later |
| GPS jamming | Our ingest | **They do not have this** |
| GDELT | Our ingest | They only use it as cockpit news fallback |
| OSINT events | Our write API | **They do not have this** |
| Time-travel replay | `position_snapshots` | **They explicitly do not have a general timeline** |
| Street traffic | OSM-based | They add optional TomTom for real jams |
| Map stack | Cesium ion Google / Bing | Same family; make 3D the default |
| Sensor looks | PostProcessEngine | Keep; bind to keys `1`–`5` |

### Worth adding — free or free-key

| Integration | Source | Auth | Why | Effort | Wave |
|---|---|---|---|---|---|
| Photoreal 3D as default | Cesium ion `2275207` | Token we already have | The look | 1–2 days | 1 |
| Real terrain | Cesium World Terrain, or Re:Earth (keyless) | Ion or none | Planes stop floating | 2–4 days | 1 |
| Earthquakes | USGS GeoJSON (24 h) | None | Cheap global pulse | 2–3 days | 3 |
| Active fires | NASA FIRMS VIIRS NRT | Free map key | Same | 3–5 days | 3 |
| Space missions | Launch Library 2 | None (15/h) or free token | Launch list + reconstructed ascent later | 1 week list / 2–3 weeks replay | 3 / 5 |
| Local weather | Open-Meteo | None, CC BY 4.0 | HUD + future cockpit WX | 2–3 days | 3 |
| OSM installations | Overpass, viewport-bounded | None | Context without Google Places | 1 week | 4 |
| Datacenters / dams | OSM extract (ODbL) | None | Static, good at globe scale if LOD-capped | 3–5 days | 4 |

### Worth adding — product, not a feed

| Feature | Why | Effort | Wave |
|---|---|---|---|
| Click-to-track | The demo moment | 3–5 days | 1 |
| Live HUD | Stop showing `--` | 1–2 days | 1 |
| Keyboard presets | `1`–`5` sensors, `H` HUD, `C` cockpit later, `Esc` out | 1 day | 1 |
| World-stable headings | Icons stop spinning | 3–7 days | 2 |
| One-interval-behind lerp | Motion feels live | 3–5 days | 2 |
| Share links | Camera + layers + preset + selected id | 2–4 days | 2 |
| Voice v1 | 8–10 tools, Mini, session cap | 1–2 weeks | 2 |
| Detection overlay | Screen-space boxes after post-FX | 1–2 weeks | 4 |
| Tracked 3D model | One GLB under ~150 km | 1–2 weeks | 4 |
| Cockpit chase cam | After track + terrain | 2–4 weeks | 5 |

### Skip or defer

| Integration | Why not now |
|---|---|
| Google Places / Geocoding | Metered; voice v1 does not need it |
| TomTom traffic | Optional; our layer already works keyless |
| CCTV mesh (Austin / Caltrans / TfL) | Months of pose, legal, and proxy work; city-specific spectacle |
| Radio Browser | Fun, not intelligence |
| Bikeshare (GBFS) | Same |
| TeleGeography cables | CC BY-NC-SA — remove if this is ever commercial |
| Voice whiteboard / walking routes | Needs Places + OSRM + 28-tool agent |
| Screenshot visual grounding | Extra OpenAI image tokens, hallucination risk |
| Weather radar | GEV removed it before OSS; no payoff |
| Full 28-tool voice parity | Scope trap |

---

## 6. Phased plan

Estimates are one focused engineer on this repo. Each wave should leave `main` shippable.

### Wave 1 — Presence (about 1 week)

Make the planet feel real. This is most of the pleasantness.

1. Default `mapType` to `google_3d`; keep 2D satellite as fallback.
2. Replace `EllipsoidTerrainProvider` with Cesium World Terrain (ion) or Re:Earth quantized mesh (keyless). Prefer Re:Earth if we want 3D tiles + terrain without burning extra ion imagery sessions — verify they compose.
3. Click-to-track: `viewer.trackedEntity` (or a custom preRender chase) for aircraft, military, ships, satellites. Esc / empty-globe click clears.
4. Fill HUD from the selected contact: callsign / MMSI / NORAD, alt, speed, heading, source, freshness. Drop or relabel the fake `ORB / PASS / GSD` rows until we can compute them.
5. Keyboard: `1`–`5` presets, `H` toggle HUD, `Esc` stop track. Keep Q/W/E/R/T landmarks.
6. GUI presence (see §2.1): vanish the 40 px rails; default-off the TOP SECRET banner; bottom command dock (presets + landmarks) collapsed to a strip; always-on style chip; reset-globe control; contact card with ft/kts + TRACK; layer rows with LIVE/STALE; unlock settings while a contact is selected.
7. Settings: "Photoreal 3D (uses ion quota)" with a one-line cost note.
8. Restore provider credits when ion / Google 3D is active.

**Done when:** a cold start shows mostly Earth, one click on a plane rides it with a real HUD, and you can change NVG without opening a sidebar.

### Wave 2 — Feel + voice v1 (about 2 weeks)

1. World-stable icon headings (screen-projected course, `alignedAxis = ZERO`).
2. Interpolate one poll behind; drop aircraft client poll from 90 s toward 20–30 s (backend already ingests faster).
3. Share-link hash: camera, map type, preset, layers, selected id.
4. Voice v1 as in §4. Backend `/api/voice/session`. Mini default. Session cap. No Places. Mic sits in the command dock.
5. First-run card: Live contacts / Intel picture (GDELT + jamming) / Explore.
6. Contacts roster (nearest in 250 km, next/prev) as the right CONTEXT panel.
7. DISPLAY chip row: HUD · DETECT (stub until Wave 4) · CLEAN.
8. Short boot splash.

**Done when:** "Take me to LIS and track the nearest airborne aircraft, night vision" works with no Google key.

### Wave 3 — Free live layers (about 1–2 weeks)

Ingest through FastAPI + Postgres like everything else, so replay can see them later.

1. USGS earthquakes (24 h GeoJSON) → table + layer.
2. NASA FIRMS (free `FIRMS_MAP_KEY`) → 24 h heatmap, viewport-clipped.
3. Open-Meteo current conditions on the HUD / selected contact.
4. Launch Library 2 roster (list + pad fly-to). Ascent replay can wait.

**Done when:** three new toggles work, show freshness, and do not stall the globe at full-earth zoom.

### Wave 4 — Cinema (about 2–3 weeks)

1. Detection overlay: `getDetectableObjects()` per layer, canvas boxes after post-FX.
2. One tracked GLB (CC-BY, our own asset, not GEV's pack) below ~150 km.
3. OSM viewport installations (allowlisted tags, 10° max bbox).
4. Optional OSM datacenter / dam extracts with a hard on-screen cap (GEV learned 5,700 static entities kill FPS).

**Done when:** NVG + detection + a tracked airliner at an airport looks like their demo, on our data.

### Wave 5 — Cockpit + voice v2 (optional)

1. Cockpit chase camera (heading-locked, terrain under the nose).
2. Open-Meteo-driven WX (already fetched in Wave 3).
3. Voice: entity Q&A, "how many flights in bbox", cockpit enter/exit.
4. Launch ascent playback (reconstructed, labeled as estimate).
5. Only then consider Places or a Google Maps key.

---

## 7. Keys and monthly cost (personal use)

| Key | Already have? | Needed for | Personal monthly |
|---|---|---|---|
| `VITE_CESIUM_ION_TOKEN` | Yes | Globe, 2D stacks, 3D tiles | $0 on Community if under 1,000 3D sessions |
| `AISSTREAM_API_KEY` | Yes | Ships | $0 (free tier) |
| `API_KEY` / `VITE_API_KEY` | Yes | Our write API | $0 |
| `FIRMS_MAP_KEY` | No | Fires | $0 |
| `LL2_API_TOKEN` | No | Higher launch quota | $0 (anonymous works) |
| `OPENAI_API_KEY` | No | Voice | **The real bill** — see §4 |
| `GOOGLE_MAPS_API_KEY` | No | Only if we copy GEV's Places path | Avoid |
| `TOMTOM_API_KEY` | No | Real traffic color | Avoid until Wave 5 |
| `CESIUM` Commercial | No | Public / commercial deploy | $149 / mo if we outgrow Community |

**Homelab with 3D default + occasional Mini voice: expect $0–15 / month. Almost all of that is OpenAI.**

Set these before Wave 1 ships 3D-as-default:

- Cesium ion dashboard: watch Google Photorealistic 3D Tiles usage.
- If a Google key is ever added: Cloud budget alert at $10 and $25, key restricted to HTTP referrer + Map Tiles API only.
- OpenAI: usage limit (e.g. $20 / month) plus the in-app session cap.

---

## 8. Implementation notes (so we do not paint ourselves in)

- **Replay first.** New live layers should write snapshots or be clearly live-only. Do not block Wave 1 on history for quakes / fires.
- **Viewport cull.** FIRMS and OSM installations must clip. GEV's infra tile was cut because 5,700 globe-scale entities murdered the frame rate.
- **Credits.** Un-hide `.cesium-viewer-bottom` for ion / Google 3D. Add a "Data attribution" popover when we add USGS / FIRMS / LL2 / Open-Meteo.
- **No `VITE_` for spend keys.** OpenAI, FIRMS, future TomTom / Google stay server-side.
- **Do not import GEV modules.** Their motion and heading math is the reference. Ours stays TypeScript, tested, and owned.
- **Classification banner.** Default off. If we keep a strip, it should say `OSINT · UNCLASSIFIED` or nothing. "TOP SECRET // SI // TK // NOFORN" is costume and it is always on.
- **Right rail vs entity.** Settings and camera must remain reachable while a contact is selected. Today they are dead.
- **3D models.** One tracked model. Fleet-wide GLBs are a GPU tax GEV still fights.

---

## 9. Suggested first PR sequence

Use these as execution tickets. Stop after any wave; the app should feel better at each cut.

1. `feat: default photoreal 3D + real terrain + restore credits`
2. `feat: click-to-track contacts + live HUD`
3. `feat: collapsing chrome + command dock + style chip + reset globe`
4. `feat: contact card (ft/kts, TRACK) + honest layer rows`
5. `feat: sensor keybinds + HUD toggle`
6. `feat: world-stable headings + delayed interpolation`
7. `feat: share-link camera and layers`
8. `feat: first-run card + contacts roster`
9. `feat: OpenAI Realtime voice v1 (Mini, session cap)`
10. `feat: USGS earthquakes layer`
11. `feat: NASA FIRMS fires layer`
12. `feat: Open-Meteo HUD weather`
13. `feat: Launch Library 2 roster`
14. `feat: detection overlay`
15. `feat: tracked aircraft glTF`
16. `feat: cockpit chase camera`

---

## 10. Out of scope for this plan

- Replacing React with GEV's vanilla client
- Dropping PostGIS / replay
- Public multi-user hosting on a Community ion token
- CCTV, radio, bikeshare
- Face / person search (GEV also refuses this)
- Copying GEV's TR-3B easter egg, split-flap chips, or 455 KB `ui.js`

---

## 11. Decision log (2026-08-25)

| Decision | Choice | Why |
|---|---|---|
| 3D tiles provider | Stay on Cesium ion `2275207` | Already wired; free for personal quota; no Google billing account |
| Google Maps API key | Server-side only after Wave 5; 3D stays on ion | Places/Geocoding optional; Nearby is metered; never `VITE_` |
| TomTom traffic | Optional live flow under 8 km; OSM sim without a key | GEV pattern; daily sample budget |
| Voice | Yes, Mini, 8–10 tools, session cap | Requested; cost-controlled; tools wrap code we will have after Wave 1 |
| Terrain | Real mesh, not ellipsoid | Required for the look and for any later cockpit |
| New feeds | USGS, FIRMS, Open-Meteo, LL2 first | Free, honest, and they show up on the globe |
| CCTV / radio | Skip | Spectacle, not COP |
| Fork GEV | No | We would lose replay and the typed backend |
| GUI strategy | Collapse-to-nothing chrome + contact cards; keep PlaybackBar | Their pleasantness is layout, not more cyan |
