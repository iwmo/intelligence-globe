# Intelligence Globe UI/UX Design Review

**Status:** Future implementation brief
**Reviewed:** 2026-08-25
**Scope:** Current React/Cesium interface, live desktop and mobile states, and `GEV-ENHANCEMENT-PLAN.md`

## 1. Executive verdict

Intelligence Globe does not need a full product rewrite. Its Cesium scene, data layers, tracking, replay, OSINT, detection, sensor presets, sharing, voice hooks, and typed detail views are a strong foundation.

It does need a **shell redesign**.

The current app feels blunt because many individually reasonable controls are independently positioned around the same canvas. They have no shared layout system, no strong visual hierarchy, and no single interaction model. The result is a feature-rich product that initially reads as a collection of small tactical widgets.

The target should be:

> **An Earth-first intelligence instrument: quiet at rest, precise during investigation, and cinematic only when the data supports it.**

Do not imitate GEV's skin. Adopt its strongest product principle—the scene is the product—then differentiate through Intelligence Globe's real advantages: replay, OSINT correlation, GPS jamming, data honesty, and multi-domain investigation.

### Recommendation

- Keep the globe engine, stores, data hooks, and layer implementations.
- Replace the top-level interface composition and visual primitives.
- Consolidate duplicate controls before adding features.
- Make degraded and unavailable data impossible to mistake for live data.
- Build responsive and accessible behavior into the new shell from the start.
- Delay additional feeds until the core operational workflow is coherent.

## 2. What was reviewed

- The running application at desktop and phone widths.
- Default, onboarding, Layers, HUD, and live-mode states.
- Keyboard- and pointer-accessible controls.
- Runtime behavior with unavailable backend feeds and a rejected Cesium token.
- `frontend/src/App.tsx` and the major shell components.
- Sidebars, playback, command dock, HUD, first-run card, map controls, contact cards, and settings.
- Global styles, fonts, tokens, and shared UI primitives.
- The existing GEV enhancement plan.

The runtime used for this review did not have healthy backend data and Cesium ion returned authorization errors. That limits judgment of the populated globe, but it revealed important failure-state and trust problems in the interface.

## 3. What is already good

The app is functionally ahead of what its appearance communicates.

- The globe remains full viewport instead of living inside a conventional dashboard card.
- Left and right rails can collapse to narrow edges.
- Layers expose human-readable names and an intended freshness state.
- Contacts have a reusable card with TRACK and COCKPIT actions.
- Replay is a first-class capability rather than a separate screen.
- Sensor presets have keyboard shortcuts.
- Reset, share, attribution, HUD, detection, and focus controls exist.
- Details are typed by domain instead of forced into one generic record view.
- Most icon-only toolbar controls have labels or tooltips.
- Provider credits have an explicit display path.
- The project already includes Geist, Lucide, Tailwind, and shared UI primitives.

These strengths should survive the redesign.

## 4. Critical findings

### 4.1 The top control region is functionally broken

Four separate components claim the top edge:

- `PlaybackBar` spans nearly the full width at `top: 0`.
- `StyleChip` sits at top-left.
- `GlobeToolbar` sits at top-center.
- `DisplayChips` sits at top-right.

They use unrelated z-index values and do not reserve space for each other. In the live browser review:

- The active style overlapped the live timestamp.
- HUD/DETECT/CLEAN overlapped the playback action.
- The CLEAN control intercepted pointer events intended for PLAYBACK, making the visible playback button unclickable.

Relevant files:

- `frontend/src/components/PlaybackBar.tsx`
- `frontend/src/components/StyleChip.tsx`
- `frontend/src/components/GlobeToolbar.tsx`
- `frontend/src/components/DisplayChips.tsx`

**Required change:** Replace these four independently positioned surfaces with one responsive top command strip.

### 4.2 “Clean UI” is duplicated and is not actually clean

Focus state is controlled in two places:

- `DisplayChips` renders `CLEAN`.
- `CinematicHUD` renders `[CLEAN UI]`.

The clean state hides the command dock and sidebars, but leaves several other controls and the playback bar. The same state has two labels, two visual treatments, and two entry points.

**Required change:** Rename this concept to **Focus Mode**, give it one control, and define exactly which surfaces remain:

- Globe
- Required attribution
- A compact exit affordance
- Selected/tracked contact telemetry, only when relevant
- Live/replay state, reduced to one unobtrusive indicator

### 4.3 The interface has no active design system

`frontend/src/index.css` defines Geist and theme variables, but `frontend/src/main.tsx` does not import it. The intended font and token system are therefore not applied globally.

At the same time, most major components use:

- Inline style objects
- Hard-coded `#00D4FF`
- Hard-coded `fontFamily: 'monospace'`
- Slightly different borders, opacities, spacing, radii, and active states

The repository includes shared button primitives, but the operational UI largely bypasses them.

This makes visual improvement slow and encourages drift.

**Required change:** Establish a small operational design system before restyling individual panels.

### 4.4 Data status is visually confident when the system is unhealthy

During review, all API requests failed and Cesium imagery/3D requests were rejected. The interface still displayed active layers as `LIVE`, because `layerHonesty()` defaults a visible layer to `LIVE` when it has no timestamp, stale flag, or explicit `hasData: false`.

The user instead saw:

- A plain blue fallback globe
- `SATELLITES LIVE`
- `AIRCRAFT LIVE`
- `STYLE · NORMAL`
- No clear explanation of degraded map or feed state

This is a trust failure, not merely an error-state issue.

**Required layer states:**

- `OFF`
- `CONNECTING`
- `LIVE`
- `STALE`
- `EMPTY`
- `ERROR`
- `UNAVAILABLE`

Only confirmed successful data should display as `LIVE`.

Also add:

- A compact system-health indicator in the top strip
- A visible map fallback notice
- Per-source last-success time
- Retry and diagnostic disclosure

### 4.5 The visual hierarchy is flat

Nearly every control is:

- Small uppercase monospace text
- A thin border
- A dark translucent rectangle
- A cyan, green, or white state variation

The style does not distinguish:

- Navigation from commands
- Current state from available actions
- Primary actions from metadata
- Safety/status information from decoration
- Investigation context from global settings

The app therefore feels “blunt” even when it is functionally sophisticated.

**Required change:** Use typography, spacing, surface density, and placement before adding color. The primary action should be obvious without making every active control glow.

### 4.6 Responsive behavior is not designed

At a 390 × 844 viewport, the desktop architecture remained active:

- Both side rails remained.
- The top control clusters remained.
- The full layer panel remained.
- The HUD remained fixed to desktop offsets.
- The bottom command strip remained.

There are no meaningful responsive media rules in the active application styles. Side rails depend on hover expansion, which is not a valid touch interaction.

**Required change:** Mobile/tablet must use a different composition, not a compressed desktop layout.

### 4.7 Controls are too small

Many labels render at 8–11 px. Several buttons are 20–38 px high. The collapsed side rail exposes an 8 px edge.

This hurts:

- Readability on high-density screens
- Touch use
- Motor accessibility
- Fast scanning under motion
- Discoverability for new users

**Minimum targets:**

- 12 px for secondary metadata
- 13–14 px for controls
- 36 px desktop pointer targets
- 44 px touch targets
- A visible focus ring on every interactive element

### 4.8 Boot and first-run states are time-based, not readiness-based

`BootSplash` disappears after 900 ms regardless of whether:

- Cesium initialized
- The selected map loaded
- Core feeds responded
- A fallback was activated

The first-run card offers useful mission choices, but it is visually a stack of generic buttons and does not preview what each mode will reveal.

**Required change:**

- Tie boot progression to real initialization stages.
- Never block indefinitely; degrade gracefully after a short threshold.
- Turn first-run choices into three concise mission cards with clear outcomes.
- Remember dismissal across sessions unless the user requests onboarding again.

### 4.9 Interaction debt is hidden by duplicated implementations

Several jobs have parallel implementations that can drift:

- Zoom exists in the right rail, camera widget, and direct globe interaction.
- Visual presets exist in the command dock, visual panel, settings defaults, keyboard shortcuts, and style readout.
- Runtime map selection and default map selection use separate surfaces.
- Left and right sidebars duplicate substantial rail, panel, resizing, and tab-button logic.
- Military and ship colors differ between settings and entity/context surfaces.

There are also unmounted legacy components, including `BottomStatusBar`, `RightDrawer`, `DraggablePanel`, and `LandmarkNav`. Their continued presence makes the intended information architecture harder for a future LLM or developer to infer.

Some asynchronous states are incomplete:

- OSINT event submission can fail without useful user feedback.
- A missing GDELT detail can render an effectively empty panel.
- Loading and error treatments differ across detail panels.
- Dialog/popover focus handling and Escape behavior are inconsistent.

**Required change:** Consolidate behavior before visual migration, introduce shared async-state components, and delete superseded UI after replacement tests pass.

### 4.10 The existing GEV plan is no longer a current-state inventory

Most of the plan's functional waves are already represented in code: photoreal map support, terrain fallback, tracking, cockpit, contact cards, share links, voice hooks, first-run missions, live-earth feeds, detection, and a tracked model.

Treat `GEV-ENHANCEMENT-PLAN.md` as historical product rationale—not as an implementation backlog. The remaining gap is primarily interaction architecture, visual-system discipline, responsive behavior, failure-state honesty, and motion polish.

## 5. Duplication and consolidation map

### Remove or merge

- `StyleChip` + style text inside `CommandDock` → one View Mode control.
- HUD `[CLEAN UI]` + `DisplayChips.CLEAN` → one Focus Mode control.
- `GlobeToolbar` + `DisplayChips` + live row actions → one top command strip.
- Landmark buttons + location search → one universal command/search experience.
- Right rail detail state + right rail tool state → one Context Inspector with stable navigation.
- Layer enabled status + source health → one honest layer-row status model.
- Separate visual-engine discovery paths → View Mode popover plus keyboard shortcuts.
- Rail zoom + camera-widget zoom → one explicit zoom control model plus direct globe gestures.
- Left/right rail shell code → one shared responsive drawer primitive.
- Repeated loading/error/empty markup → one shared panel-state family.
- Unmounted legacy surfaces → delete after confirming no missing behavior.

### Keep distinct

- A layer toggle and a contact roster are different jobs.
- Map appearance and sensor appearance are different concepts.
- Live mode and replay mode should share a shell but keep different controls.
- Global settings and current-contact actions should remain separate sections inside one inspector.

## 6. Proposed design direction

### Working concept: “Operational Earth”

The design should feel closer to an advanced spatial instrument than a military movie prop.

#### At rest

- Earth occupies almost the entire frame.
- One slim top strip communicates product, system health, mode, and search.
- No side panel is open.
- The current visual mode is discoverable but quiet.
- The live/replay state is unambiguous.
- No fake telemetry is shown.

#### During investigation

- Selecting an object opens one Context Inspector.
- The camera action and the object card feel connected.
- TRACK is the primary action.
- Telemetry uses large values with compact labels.
- Related events, source, freshness, and history sit below.
- The timeline expands only when time is relevant.

#### During cinematic/sensor use

- Sensor mode changes the scene and a small mode badge.
- HUD elements appear because they provide real information.
- Detection boxes and cockpit elements are scoped to a tracked target.
- Decorative noise never competes with data.

### Visual language

- **Background:** near-black, not pure black everywhere; preserve contrast between void and surface.
- **Primary text:** warm neutral white.
- **Secondary text:** cool neutral gray with WCAG-compliant contrast.
- **Accent:** one electric blue/cyan used for selection and active navigation.
- **Signal colors:** green only for healthy/live, amber for stale/degraded, red for errors or critical alerts.
- **Entity colors:** reserved for marks on the globe and small identity indicators.
- **Surfaces:** flat translucent layers with one structural border; blur only where it preserves map readability.
- **Glow:** only for tracked targets, active detection, or urgent alerts.
- **Typography:** Geist Sans for navigation and prose; Geist Mono for coordinates, time, identifiers, and telemetry.
- **Shape:** restrained 4–8 px radii; avoid both sharp “military terminal” clichés and soft consumer-dashboard pills.

## 7. Proposed information architecture

### 7.1 Top command strip

One 44–48 px responsive surface.

**Left**

- Intelligence Globe wordmark
- `LIVE`, `REPLAY`, or `DEGRADED`
- System-health dot with source summary

**Center**

- Universal command/search launcher
- Examples: “Lisbon”, “track nearest aircraft”, “show jamming”, “replay last hour”
- Keyboard shortcut displayed but not dominant

**Right**

- View Mode
- Focus Mode
- Share
- Settings
- User/help overflow if needed

Reset globe belongs inside the command launcher and may also have a keyboard shortcut. It does not need permanent prime placement if space is constrained.

### 7.2 Left Layer Drawer

The only place for visibility, source health, and layer legends.

- Search/filter layers
- Group by Air, Maritime, Space, Events, Environment, Infrastructure
- Show enabled count per group
- Each row includes state and last success
- Expand a row for legend, source, update cadence, and opacity
- Provide “solo layer” and “clear group”
- Use a real button on touch; hover edge may remain an optional desktop enhancement

### 7.3 Right Context Inspector

One stable inspector with sections:

- **Selection:** title, type, freshness, primary telemetry
- **Actions:** track, cockpit, center, pin, compare
- **Context:** locality, weather, source, related events
- **History:** recent path and temporal availability
- **Details:** domain-specific fields under disclosure

When nothing is selected, the same inspector can show:

- Nearby contacts
- Saved/pinned contacts
- Launches
- System status

Do not switch between unrelated full panels without preserving the user's place.

### 7.4 Bottom temporal surface

In live mode:

- A compact current-time and ingest-status indicator only.

In replay mode:

- Expand into a timeline drawer.
- Keep play/pause, range, speed, event markers, and category filters together.
- Use full labels for speed, such as `60×`, rather than ambiguous `1m/s`.
- Show unavailable history before entering replay, not after.

### 7.5 Contextual HUD

HUD is not global decoration. It is a presentation layer for:

- Camera/locality when explicitly enabled
- Tracked-contact telemetry
- Cockpit mode
- Detection mode

When no target is selected, omit the `NO CONTACT` block instead of presenting an empty instrument.

## 8. Bold functionality that fits this product

Add these only after shell consolidation.

### 8.1 Spatial Intelligence Lens

Let the user draw or hold a modifier to inspect a region.

Return:

- Contact counts by domain
- New or anomalous events
- GPS jamming severity
- Recent GDELT activity
- Fires and earthquakes
- Data coverage and freshness

This turns the globe from a viewer into an analysis tool and differentiates it from GEV.

### 8.2 Investigation Stack

Allow up to three pinned contacts/events.

- Compare telemetry
- Keep their trails visible
- Jump between them
- Correlate them on the timeline
- Share the investigation as a URL

### 8.3 Mission presets

Replace generic onboarding with named workflows:

- **Air Picture:** civilian + military aircraft, contacts inspector
- **Disruption Monitor:** GPS jamming + GDELT + airspace
- **Live Earth:** fires + earthquakes + weather
- **Space Operations:** satellites + launches + ascent estimates

Each preset should state exactly what it enables.

### 8.4 Command palette

One command system should handle:

- Fly to location
- Select nearest entity
- Toggle layers
- Change sensor mode
- Enter replay
- Track or clear
- Share current scene
- Open settings

Voice should call the same command registry. Do not maintain a separate voice-only behavior layer.

### 8.5 Data confidence

Every important observation should expose:

- Source
- Last successful update
- Age
- Estimated versus observed status
- Degraded coverage

Trust is a stronger futuristic quality than ornamental HUD chrome.

## 9. Responsive model

### Desktop: 1200 px and wider

- Top command strip
- Overlay Layer Drawer, max 360 px
- Overlay Context Inspector, 360–420 px
- Optional simultaneous drawers on very wide screens
- Timeline drawer from bottom

### Compact desktop/tablet: 768–1199 px

- Only one side drawer open at a time
- Inspector overlays the globe
- Top strip collapses lower-priority actions into overflow
- No invisible hover-only rail

### Phone: below 768 px

- Top app bar with mode, command, and menu
- Bottom sheet for Layers or Context
- One prominent track/focus action at a time
- Timeline becomes a draggable sheet
- HUD simplifies to target title plus two primary values
- Honor `env(safe-area-inset-*)`
- All controls use 44 px minimum targets

The globe can remain available on phone, but dense analysis should prioritize tablet and desktop.

## 10. Accessibility requirements

- All functionality must be keyboard reachable.
- Add visible `:focus-visible` styles.
- Do not rely on hover to reveal navigation.
- Respect `prefers-reduced-motion`.
- Use semantic dialogs/drawers with focus management.
- Announce mode, selection, tracking, and feed errors through an appropriate live region.
- Ensure all statuses have text, not color alone.
- Keep text contrast at WCAG AA.
- Provide a non-canvas roster for contacts represented on the globe.
- Avoid single-character icon controls without accessible names.
- Use tooltips for unfamiliar controls, but never as the only label on touch.

## 11. Design-system foundation

Create a small token layer and use it everywhere.

### Token categories

- Background and void
- Surface levels 1–3
- Text primary, secondary, muted
- Structural border and strong border
- Accent and accent-muted
- Healthy, stale, warning, error, unavailable
- Entity-domain colors
- Type scale
- Space scale
- Radius scale
- Motion durations/easing
- Layered z-index roles

### Shared primitives

- `CommandStrip`
- `IconButton`
- `StatusBadge`
- `SegmentedControl`
- `Panel`
- `PanelHeader`
- `Drawer`
- `BottomSheet`
- `TelemetryValue`
- `LayerRow`
- `DisclosureSection`
- `EmptyState`
- `ErrorState`
- `Tooltip`

Inline styles should be removed from shell components. Use CSS modules, a dedicated Tailwind layer, or another single consistent approach. Do not mix three styling systems.

## 12. Recommended implementation sequence

### Phase 0 — Truth and foundations

1. Import the real global stylesheet in `main.tsx`.
2. Activate Geist Sans and Geist Mono intentionally.
3. Add operational color, spacing, type, motion, and z-index tokens.
4. Replace `layerHonesty()` with an explicit source-state model.
5. Add global focus, reduced-motion, and minimum target rules.
6. Add screenshot tests for 390, 768, 1024, and 1440 px widths.

**Done when:** active tokens are visible, no healthy state is inferred without successful data, and the four viewport fixtures have no collisions.

### Phase 1 — Replace the shell

1. Build the single top command strip.
2. Remove `StyleChip` and `DisplayChips` as standalone overlays.
3. Move live/replay mode into the strip.
4. Implement one Focus Mode action.
5. Implement explicit shell layout slots and z-index roles.
6. Add a degraded-system indicator and map-fallback notice.

**Done when:** every top action is clickable at all target widths and no overlay occupies uncoordinated top space.

### Phase 2 — Consolidate navigation

1. Rebuild the left side as the Layer Drawer.
2. Rebuild the right side as the Context Inspector.
3. Move landmarks into universal command/search.
4. Move visual presets into View Mode.
5. Convert settings into consistent sections using shared primitives.
6. Remove superseded controls and styles.

**Done when:** each user job has one discoverable home.

### Phase 3 — Selection and time

1. Redesign contact cards around primary telemetry and action hierarchy.
2. Make tracking visually dominant and clearly reversible.
3. Make HUD contextual.
4. Turn playback into a bottom timeline drawer.
5. Preserve selected/pinned contacts across live/replay transitions where data permits.

**Done when:** select → inspect → track → replay is one continuous workflow.

### Phase 4 — Responsive and accessible behavior

1. Add tablet one-drawer behavior.
2. Add phone bottom sheets.
3. Remove hover-only dependencies.
4. Add focus management and keyboard tests.
5. Add reduced-motion handling.
6. Run contrast and screen-reader checks.

**Done when:** the core workflow works at 390 px without clipped or overlapping controls.

### Phase 5 — Differentiating functionality

1. Spatial Intelligence Lens
2. Investigation Stack
3. Mission presets
4. Shared command registry for keyboard, search, and voice
5. Shareable investigation state

**Done when:** the product is measurably more useful, not merely more cinematic.

## 13. Files likely to change first

- `frontend/src/main.tsx`
- `frontend/src/index.css`
- `frontend/src/App.tsx`
- `frontend/src/components/PlaybackBar.tsx`
- `frontend/src/components/StyleChip.tsx`
- `frontend/src/components/DisplayChips.tsx`
- `frontend/src/components/GlobeToolbar.tsx`
- `frontend/src/components/CommandDock.tsx`
- `frontend/src/components/LeftSidebar.tsx`
- `frontend/src/components/RightSidebar.tsx`
- `frontend/src/components/CinematicHUD.tsx`
- `frontend/src/components/FirstRunCard.tsx`
- `frontend/src/components/ContactCard.tsx`
- `frontend/src/lib/layerFreshness.ts`

Add a dedicated shell/primitives area rather than continuing to enlarge these files.

## 14. Acceptance criteria

### Visual

- No overlap at 390 × 844, 768 × 1024, 1024 × 768, or 1440 × 900.
- The globe occupies at least 90% of the frame when drawers are closed.
- One accent color controls navigation and selection.
- Green, amber, and red are used semantically.
- No empty/fake HUD rows.
- No body/control text below 12 px.

### Functional

- PLAYBACK is clickable in every layout.
- Focus Mode has one control and one definition.
- Search/location has one entry point.
- Visual mode has one entry point.
- A selected contact never blocks settings or map controls.
- The user can clear selection, stop tracking, and exit cockpit with Escape.
- Map and feed failures are visible without opening developer tools.
- A layer cannot show `LIVE` before a successful response.

### Accessibility

- Full keyboard path for command, layers, selection roster, tracking, replay, and exit.
- Visible focus on every control.
- No hover-only controls.
- Touch targets meet 44 px on touch layouts.
- Statuses are announced and never rely on color alone.

### Performance

- Shell interactions remain responsive while Cesium renders.
- Opening a panel does not recreate globe entities.
- Translucency/blur is limited and measured.
- Mobile does not render hidden desktop panels.

## 15. Instructions for the implementing LLM

Use this section as the implementation prompt.

### Goal

Redesign the Intelligence Globe interface into an Earth-first operational canvas. Preserve the existing Cesium scene, data layers, replay engine, stores, hooks, and backend contracts unless a task explicitly requires a change.

### Non-negotiable rules

1. Do not copy GEV markup, CSS, text, or assets.
2. Do not rewrite Cesium/data functionality as part of the shell redesign.
3. Do not add new feeds before completing Phases 0–3.
4. One user job must have one primary UI location.
5. One state must have one control unless a documented shortcut mirrors it.
6. Never infer `LIVE` from visibility.
7. Never hide provider attribution when it is required.
8. Do not introduce decorative telemetry.
9. Avoid hard-coded colors, fonts, spacing, and z-index values in feature components.
10. Use shared primitives and tokens.
11. Preserve keyboard shortcuts or provide a migration note.
12. Add tests before deleting the old shell.

### Work method

For each phase:

1. Inventory current behavior and tests.
2. Add or update visual regression fixtures.
3. Build the replacement behind a temporary feature flag if the phase is large.
4. Migrate one surface at a time.
5. Verify live, degraded, error, empty, selected, tracked, replay, and phone states.
6. Delete superseded components and duplicate controls.
7. Run typecheck, lint, unit tests, and browser tests.
8. Document intentional behavior changes.

### First implementation task

Start with Phase 0 and the top command strip only. Do not restyle every detail panel in the same change.

Expected first deliverables:

- Active global typography and tokens
- Explicit source-health model
- New `CommandStrip`
- Unified live/replay, view, focus, share, and settings controls
- Removal of top-edge collisions
- Desktop and phone browser tests
- A short migration note listing removed duplicate controls

## 16. Final product principle

Futuristic does not mean more chrome.

For Intelligence Globe, futuristic means:

- The interface understands context.
- The data admits uncertainty.
- Time, location, and selection work as one system.
- The scene stays readable.
- Powerful actions are available without permanent clutter.

The product should become **quieter visually and bolder functionally**.
