# Operational Earth Foundation Migration

## Scope delivered

- Activated the existing Geist/Tailwind/shadcn foundation.
- Added semantic operational colors, type, motion, focus, target-size, and z-index tokens.
- Added explicit per-source health: `OFF`, `CONNECTING`, `LIVE`, `STALE`, `EMPTY`, `ERROR`, and `UNAVAILABLE`.
- Added aggregate `CONNECTING`, `LIVE`, and `DEGRADED` system status.
- Replaced competing top overlays with one responsive `CommandStrip`.
- Kept the replay scrubber as a replay-only temporal row.

## Removed duplicate controls

- `StyleChip` → View Mode in `CommandStrip`
- `DisplayChips` → View Mode and Focus Mode in `CommandStrip`
- `GlobeToolbar` → reset, share, attribution, and settings in `CommandStrip`
- HUD `[CLEAN UI]` → one Focus Mode control
- Command dock sensor presets → View Mode in `CommandStrip`
- PlaybackBar live/replay switch → `CommandStrip`

Keyboard shortcuts remain unchanged.

## Deferred to the next UI branch

- Shared responsive side-drawer primitive
- Layer Drawer redesign
- Context Inspector redesign
- Universal command/location search
- Bottom timeline drawer
- Contact-card hierarchy refresh
- Phone bottom sheets
- Removal of remaining unmounted legacy panels
