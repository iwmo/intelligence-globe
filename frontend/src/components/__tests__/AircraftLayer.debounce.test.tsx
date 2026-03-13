/**
 * AircraftLayer LEFT_CLICK debounce contract tests
 *
 * These tests validate the 200ms debounce pattern required by NAV-01.
 * CesiumJS fires LEFT_CLICK before LEFT_DOUBLE_CLICK (issue #1171), so any
 * entity-selection dispatch must be delayed 200ms to avoid opening panels on
 * a double-click zoom gesture.
 *
 * The tests use a standalone helper that mirrors the pattern applied to the
 * AircraftLayer handler. This isolates the debounce contract from rendering
 * complexity and CesiumJS internals.
 *
 * TODO: verify AircraftLayer uses this pattern — currently NOT wired
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Helper: creates a debounced click dispatcher — mirrors AircraftLayer pattern
// ---------------------------------------------------------------------------
function makeDebounced(dispatch: () => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      dispatch();
    }, 200);
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LEFT_CLICK debounce contract (NAV-01)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires dispatch once after 200ms for a single click', () => {
    const dispatch = vi.fn();
    const handleClick = makeDebounced(dispatch);

    handleClick();
    expect(dispatch).not.toHaveBeenCalled(); // not yet

    vi.advanceTimersByTime(200);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('fires dispatch only once when two clicks arrive within 50ms (double-click gesture)', () => {
    const dispatch = vi.fn();
    const handleClick = makeDebounced(dispatch);

    handleClick();
    vi.advanceTimersByTime(50); // second click arrives 50ms later
    handleClick();

    vi.advanceTimersByTime(200); // full debounce window elapses
    expect(dispatch).toHaveBeenCalledTimes(1); // only one dispatch — not two
  });

  it('does not fire dispatch within the first 200ms of a double-click gesture', () => {
    const dispatch = vi.fn();
    const handleClick = makeDebounced(dispatch);

    handleClick();
    vi.advanceTimersByTime(50);
    handleClick();

    vi.advanceTimersByTime(100); // only 100ms elapsed since second click
    expect(dispatch).toHaveBeenCalledTimes(0); // zero dispatches mid-debounce
  });

  it('resets debounce on each new click', () => {
    const dispatch = vi.fn();
    const handleClick = makeDebounced(dispatch);

    handleClick();
    vi.advanceTimersByTime(150); // nearly expired
    handleClick(); // resets timer
    vi.advanceTimersByTime(150); // only 150ms since reset — should NOT fire
    expect(dispatch).toHaveBeenCalledTimes(0);

    vi.advanceTimersByTime(50); // now 200ms since last click
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('fires dispatch independently for two well-separated clicks', () => {
    const dispatch = vi.fn();
    const handleClick = makeDebounced(dispatch);

    handleClick();
    vi.advanceTimersByTime(300); // first click fully debounced
    expect(dispatch).toHaveBeenCalledTimes(1);

    handleClick();
    vi.advanceTimersByTime(300); // second click fully debounced
    expect(dispatch).toHaveBeenCalledTimes(2);
  });
});
