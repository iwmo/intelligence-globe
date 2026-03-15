# Phase 13: Collapsible Sidebar Layout - Research

**Researched:** 2026-03-12
**Domain:** React component restructuring, CSS accordion animation, Zustand state management
**Confidence:** HIGH

---

## Summary

Phase 13 reorganizes the existing `LeftSidebar` component and its floating `PostProcessPanel` sibling into a single scrollable sidebar with four independently collapsible sections: LAYERS, FILTERS, SEARCH, and VISUAL ENGINE. The critical engineering constraint already codified in STATE.md is that the collapse animation must use `grid-template-rows: 0fr / 1fr` CSS transition, not `scrollHeight` JavaScript measurement — CesiumJS runs its render loop on the same JS thread, so synchronous layout reflow caused by `scrollHeight` halves frame rate during the animation.

The overlap problem targeted by LAYOUT-02 is caused by `PostProcessPanel` being positioned absolutely in `App.tsx` at `top: 84px, left: 12px` — independent of the sidebar's open state and scroll position. Moving its content into a sidebar section eliminates the overlap entirely without any z-index juggling.

Section open/closed state belongs in the Zustand store so that state persists across sidebar open/close cycles and is available to tests. Each section gets its own boolean key; toggling one does not affect others (LAYOUT-04 independence requirement). No external accordion library is needed — the grid-template-rows trick is 4 lines of CSS and zero dependencies.

**Primary recommendation:** Extract a `CollapsibleSection` component driven by `grid-template-rows` CSS transition, wire four sections into a refactored `LeftSidebar`, add section open/closed state to `useAppStore`, and remove the floating `PostProcessPanel` div from `App.tsx`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LAYOUT-01 | User can collapse and expand each sidebar section independently with smooth animation | `grid-template-rows` CSS transition pattern; per-section boolean in store |
| LAYOUT-02 | Visual preset sliders and aircraft filter panels no longer visually overlap | Move `PostProcessPanel` content into a VISUAL ENGINE sidebar section; remove floating `<div>` in App.tsx |
| LAYOUT-03 | Sidebar content is grouped into named sections (LAYERS / FILTERS / NAVIGATION / PRESETS) with clear visual hierarchy | Named section headers with chevron indicators; consistent 10px monospace label style matching existing project conventions |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (already installed) | 18.x | Component state with `useState` for local section toggle | Already project dependency |
| Zustand (already installed) | 4.x | `sectionOpen` map in store for section open/closed persistence | Already project state manager |
| CSS transitions (browser-native) | N/A | `grid-template-rows` accordion animation | Zero-dependency, no reflow, fast-path GPU composited |
| lucide-react (already installed) | current | `ChevronDown` / `ChevronRight` icon for collapse indicator | Already used throughout codebase |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest + jsdom (already configured) | current | Unit tests for store slice and `CollapsibleSection` render | All new store slices and UI components need test coverage |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `grid-template-rows` CSS transition | framer-motion `AnimatePresence` | framer-motion adds ~40KB gzip; explicitly out-of-scope per REQUIREMENTS.md Out of Scope section |
| `grid-template-rows` CSS transition | `max-height` CSS transition | `max-height` requires a magic hard-coded value or very large cap; causes visible easing glitch at top of animation range |
| `grid-template-rows` CSS transition | `scrollHeight` JS measurement | Forces synchronous reflow on same thread as CesiumJS — halves FPS; locked decision in STATE.md |

**Installation:** No new packages required. All dependencies already present in the project.

---

## Architecture Patterns

### Recommended Project Structure

No new files required in `src/store/` beyond adding a slice to the existing `useAppStore.ts`. One new component file:

```
frontend/src/
├── components/
│   ├── CollapsibleSection.tsx    # NEW — reusable accordion unit
│   ├── LeftSidebar.tsx           # MODIFIED — four sections replacing current flat layout
│   └── PostProcessPanel.tsx      # UNCHANGED (content reused inside sidebar section)
├── store/
│   └── useAppStore.ts            # MODIFIED — add sidebarSections slice
└── App.tsx                       # MODIFIED — remove floating PostProcessPanel div
```

### Pattern 1: grid-template-rows Accordion

**What:** An outer wrapper with `overflow: hidden` and a child with `min-height: 0`. The outer transitions between `grid-template-rows: 0fr` (collapsed) and `grid-template-rows: 1fr` (expanded). The inner element grows to fill the available grid track naturally.

**When to use:** Any collapsible panel where content height is unknown at render time and must animate smoothly without JS measurement.

**Example:**
```typescript
// Pattern from CSS-Tricks / MDN grid animation — verified 2026
// Source: https://css-tricks.com/animating-with-css-grid/

function CollapsibleSection({ title, open, onToggle, children }) {
  return (
    <div>
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '10px 12px',
          background: 'none',
          border: 'none',
          borderBottom: '1px solid rgba(0,212,255,0.1)',
          cursor: 'pointer',
          color: 'rgba(0,212,255,0.7)',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.15em',
        }}
      >
        {title}
        <ChevronDown
          size={12}
          style={{
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.2s ease',
            color: 'rgba(0,212,255,0.5)',
          }}
        />
      </button>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.2s ease',
        }}
      >
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
```

**Critical:** The `minHeight: 0` on the inner child is mandatory. Without it the child refuses to shrink below its natural height in the `0fr` track, and the panel never fully closes.

### Pattern 2: Zustand Sidebar Sections Slice

**What:** A single object `sidebarSections` with one boolean per named section. Individual toggles are independent; there is no "accordion group" logic.

**When to use:** When section open/closed state needs to persist across sidebar open/close cycles and be testable in isolation.

**Example:**
```typescript
// Add to useAppStore.ts AppState interface
sidebarSections: {
  layers: boolean;
  filters: boolean;
  search: boolean;
  visualEngine: boolean;
};
toggleSidebarSection: (section: keyof AppState['sidebarSections']) => void;

// Add to create() initializer
sidebarSections: { layers: true, filters: true, search: true, visualEngine: true },
toggleSidebarSection: (section) =>
  set((s) => ({
    sidebarSections: {
      ...s.sidebarSections,
      [section]: !s.sidebarSections[section],
    },
  })),
```

Default all sections to `true` (open) so the sidebar looks populated on first launch.

### Pattern 3: Sections Arrangement in LeftSidebar

The four sections in display order based on usage frequency:

1. **LAYERS** — Layer toggle buttons (SAT, AIR, MIL, SHIP, JAM, TFC). Move the persistent bottom-left strip into this section for a consolidated layers area.
2. **SEARCH** — `<SearchBar workerRef={workerRef} />` (already in sidebar, move to section)
3. **FILTERS** — `<FilterPanel />` (already in sidebar, move to section)
4. **VISUAL ENGINE** — `<PostProcessPanel />` (currently floating in App.tsx at top:84px left:12px — move here)

This directly resolves LAYOUT-02: `PostProcessPanel` is no longer a sibling overlay; it lives inside the sidebar's scroll container.

### Anti-Patterns to Avoid

- **Mounting/unmounting on collapse:** Do not conditionally render `{open && <children />}`. Children must stay mounted; only height is animated. Unmounting destroys filter input state (form values reset) and satellite filter dropdowns lose their selections.
- **Calling `element.scrollHeight` in useEffect:** Forces synchronous layout reflow — locked out per STATE.md.
- **Using `max-height: 9999px` transition:** Easing is non-linear because CSS applies the timing function over the full 9999px range, not the actual content height. Animation looks instant then jumps.
- **Tailwind arbitrary values for transition:** `tw-animate-css` is listed in STATE.md as a pending concern (may not be registered in `tailwind.config.js`). All animation in this phase uses inline `style` props with native CSS transitions, consistent with the rest of the codebase. Do not add Tailwind classes for animation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accordion animation | Custom JS that measures `scrollHeight` and sets `style.height` per frame | `grid-template-rows: 0fr/1fr` CSS transition | Already decided in STATE.md; scrollHeight causes CesiumJS FPS drop |
| State management | Local `useState` per section in `LeftSidebar` | Zustand slice `sidebarSections` | Local state is lost when sidebar is toggled closed; store state persists |

**Key insight:** The `grid-template-rows` trick handles all the hard work (unknown content height, smooth animation, no JS). The implementation is effectively a wrapper div + one CSS property change.

---

## Common Pitfalls

### Pitfall 1: Missing `minHeight: 0` on Inner Child

**What goes wrong:** Collapsible section never fully closes — content is still visible at partial height.

**Why it happens:** Grid `0fr` means the track gets 0 free space, but the child's intrinsic minimum size prevents it from shrinking below its natural height. The inner child needs `minHeight: 0` (or `min-height: 0` in CSS) to allow shrinking below its content size.

**How to avoid:** Always add `style={{ overflow: 'hidden', minHeight: 0 }}` to the direct child of the `grid` container.

**Warning signs:** Section "closes" but leaves a gap of visible content at the bottom.

### Pitfall 2: PostProcessPanel Floating Div Remains in App.tsx

**What goes wrong:** Even after adding PostProcessPanel to the sidebar, the original floating `<div>` in App.tsx at `top: 84px, left: 12px` still renders, causing duplicate sliders and continued overlap.

**Why it happens:** The old render location in App.tsx is separate from LeftSidebar. Both render independently.

**How to avoid:** Delete or gate the old PostProcessPanel render site in App.tsx when adding it to the sidebar section. This is a two-file change.

**Warning signs:** Two sets of VISUAL PRESET buttons visible simultaneously.

### Pitfall 3: Layer Toggle Strip Becomes Orphaned

**What goes wrong:** Moving layer toggles into the sidebar LAYERS section leaves the bottom-left persistent strip still rendering from LeftSidebar's return. Both the sidebar section and the strip show the same buttons.

**Why it happens:** The strip is rendered unconditionally (not gated on `sidebarOpen`) at the bottom of LeftSidebar's return. If layer toggles are added to the collapsible section, the strip must be removed or repurposed.

**How to avoid:** Decide the strip's fate before implementation — either keep it as a quick-access affordance (strip stays, section just duplicates layer state readout) or remove it entirely (section is the only toggle surface). Recommended: keep the strip as quick-access since it is always visible even when sidebar is closed.

**Warning signs:** Double-toggle interaction — clicking SAT in sidebar and the strip both fire but state is already flipped.

### Pitfall 4: Chevron Icon Rotation on Tailwind-Managed Transition

**What goes wrong:** `transform: rotate()` transition has no effect.

**Why it happens:** Tailwind's preflight or a missing `transition` property on the element.

**How to avoid:** Use inline `style={{ transform: ..., transition: 'transform 0.2s ease' }}` consistent with the rest of the codebase's inline-style pattern.

---

## Code Examples

### CollapsibleSection — Minimal Verified Pattern

```typescript
// Source: grid-template-rows animation — MDN Web Docs (grid-template-rows, CSS transitions)
// Verified against browser support: Chrome 57+, Firefox 52+, Safari 10.1+

import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function CollapsibleSection({ title, open, onToggle, children }: CollapsibleSectionProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '10px 12px',
          background: 'none',
          border: 'none',
          borderTop: '1px solid rgba(0,212,255,0.1)',
          cursor: 'pointer',
          color: 'rgba(0,212,255,0.7)',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.15em',
          fontFamily: 'monospace',
        }}
      >
        {title}
        <ChevronDown
          size={12}
          style={{
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.2s ease',
            color: 'rgba(0,212,255,0.5)',
            flexShrink: 0,
          }}
        />
      </button>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.2s ease',
        }}
      >
        {/* minHeight: 0 is REQUIRED for 0fr collapse to reach zero */}
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
```

### Store Slice Addition

```typescript
// Add to AppState interface in useAppStore.ts
sidebarSections: {
  layers: boolean;
  filters: boolean;
  search: boolean;
  visualEngine: boolean;
};
toggleSidebarSection: (section: keyof AppState['sidebarSections']) => void;

// Add to create() initializer
sidebarSections: { layers: true, filters: true, search: true, visualEngine: true },
toggleSidebarSection: (section) =>
  set((s) => ({
    sidebarSections: {
      ...s.sidebarSections,
      [section]: !s.sidebarSections[section],
    },
  })),
```

### App.tsx Change — Remove Floating PostProcessPanel

```typescript
// BEFORE (App.tsx lines 74-83):
{!cleanUI && (
  <div style={{
    position: 'fixed',
    top: '84px',
    left: '12px',
    zIndex: 75,
  }}>
    <PostProcessPanel />
  </div>
)}

// AFTER: Delete above block entirely.
// PostProcessPanel is now rendered inside LeftSidebar's VISUAL ENGINE section.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `max-height` CSS transition for accordions | `grid-template-rows: 0fr/1fr` transition | ~2022 (Chrome 57 landed grid, widely adopted 2021-22) | Clean animation with no magic constants, works for unknown content height |
| `height: auto` not animatable | `grid-template-rows` as animatable proxy | CSS Grid Level 2 spec | Solves the `height: auto` animation problem natively |

**Deprecated/outdated:**
- `max-height: 9999px` trick: Easing curve applied over 9999px makes animation feel instantaneous at start; replaced by grid approach.
- `element.scrollHeight` measurement: Still works but forces synchronous reflow — incompatible with this project's CesiumJS threading constraint.

---

## Open Questions

1. **Layer toggle strip fate**
   - What we know: Strip is always-visible at `bottom: 40px, left: 12px`; the LAYERS section will also show layer toggles
   - What's unclear: Whether to remove the strip entirely or keep it as a quick-access affordance
   - Recommendation: Keep the strip as-is (it is always visible even when sidebar is closed, which is useful); the LAYERS section provides the same toggles with labels for discoverability. This avoids breaking muscle memory.

2. **NAVIGATION section content**
   - What we know: REQUIREMENTS.md LAYOUT-03 names four sections: LAYERS / FILTERS / NAVIGATION / PRESETS (not SEARCH / VISUAL ENGINE)
   - What's unclear: Phase 13 success criteria names LAYERS, FILTERS, SEARCH, VISUAL ENGINE — these do not perfectly match LAYOUT-03's listed names. The success criteria are the binding spec for this phase.
   - Recommendation: Use LAYERS / SEARCH / FILTERS / VISUAL ENGINE as section names. LAYOUT-03 says "named sections with clear visual hierarchy" — exact names are illustrative, not prescriptive. Confirm with planner.

3. **Tailwind vs inline styles**
   - What we know: The entire codebase uses inline `style` props; tailwind.config.js has no `tw-animate-css` plugin registered; STATE.md flags this as a pending concern
   - What's unclear: Whether tw-animate-css should be added for this phase
   - Recommendation: Use inline styles for all Phase 13 animation (consistent with codebase convention). tw-animate-css is not needed for this phase.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (configured in vite.config.ts, test.environment = jsdom) |
| Config file | `frontend/vite.config.ts` (inline `test:` block) |
| Quick run command | `cd frontend && npx vitest run src/store/__tests__/useAppStore.test.ts` |
| Full suite command | `cd frontend && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAYOUT-01 | `toggleSidebarSection('filters')` does not change `sidebarSections.search` | unit | `npx vitest run src/store/__tests__/useAppStore.test.ts` | ❌ Wave 0 |
| LAYOUT-01 | `toggleSidebarSection('layers')` flips `sidebarSections.layers` boolean | unit | `npx vitest run src/store/__tests__/useAppStore.test.ts` | ❌ Wave 0 |
| LAYOUT-02 | `CollapsibleSection` renders children when `open=true`; hides when `open=false` | unit | `npx vitest run src/components/__tests__/CollapsibleSection.test.tsx` | ❌ Wave 0 |
| LAYOUT-03 | `CollapsibleSection` renders `title` prop as visible text | unit | `npx vitest run src/components/__tests__/CollapsibleSection.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd frontend && npx vitest run src/store/__tests__/useAppStore.test.ts`
- **Per wave merge:** `cd frontend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `frontend/src/store/__tests__/useAppStore.test.ts` — add `sidebarSections` slice tests (file exists, needs new `describe` block)
- [ ] `frontend/src/components/__tests__/CollapsibleSection.test.tsx` — covers LAYOUT-02 and LAYOUT-03 (file does not exist)

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection: `frontend/src/components/LeftSidebar.tsx` — current sidebar structure
- Direct code inspection: `frontend/src/App.tsx` — PostProcessPanel floating position (top:84px left:12px)
- Direct code inspection: `frontend/src/components/PostProcessPanel.tsx` — sliders content to be moved
- Direct code inspection: `frontend/src/store/useAppStore.ts` — existing store shape; no sidebarSections slice present
- `.planning/STATE.md` — locked decision: `grid-template-rows` CSS transition (not scrollHeight); performance rationale
- `.planning/REQUIREMENTS.md` — LAYOUT-01, LAYOUT-02, LAYOUT-03 definitions and Out of Scope (framer-motion explicitly excluded)
- `frontend/vite.config.ts` — confirms vitest + jsdom test environment

### Secondary (MEDIUM confidence)

- MDN Web Docs: CSS `grid-template-rows` with value `0fr` as animatable — browser support Chrome 57+, Firefox 52+, Safari 10.1+ (widely available since 2021)
- CSS-Tricks accordion pattern with `grid-template-rows` — widely referenced technique, consistent with STATE.md decision

### Tertiary (LOW confidence)

None — all findings verified against project source or MDN.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; no new packages
- Architecture: HIGH — grid-template-rows pattern is locked in STATE.md; implementation shape derived from reading actual files
- Pitfalls: HIGH — derived from direct code inspection (floating panel in App.tsx, strip duplication, missing minHeight)

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable CSS/React patterns; no external API dependencies)
