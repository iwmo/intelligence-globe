import { describe, it, expect } from 'vitest';

// findAdjacentSnapshots is a pure function exported from useReplaySnapshots
// It will be a named export: export function findAdjacentSnapshots(...)
// Import is deferred to produce a ModuleNotFoundError as RED signal
const { findAdjacentSnapshots } = await import('../useReplaySnapshots');

interface Snap { ts: number; entity_id: string; latitude: number; longitude: number; altitude: null; heading: null; speed: null; }
const snap1: Snap = { ts: 1000, entity_id: 'e1', latitude: 1, longitude: 1, altitude: null, heading: null, speed: null };
const snap2: Snap = { ts: 2000, entity_id: 'e1', latitude: 2, longitude: 2, altitude: null, heading: null, speed: null };

describe('findAdjacentSnapshots', () => {
  it('returns bracket around mid-range ts', () => {
    const [before, after] = findAdjacentSnapshots([snap1, snap2], 1500);
    expect(before?.ts).toBe(1000);
    expect(after?.ts).toBe(2000);
  });

  it('returns [null, first] when ts is before first snapshot', () => {
    const [before, after] = findAdjacentSnapshots([snap1], 500);
    expect(before).toBeNull();
    expect(after?.ts).toBe(1000);
  });

  it('returns [last, null] when ts is after last snapshot', () => {
    const [before, after] = findAdjacentSnapshots([snap1], 1500);
    expect(before?.ts).toBe(1000);
    expect(after).toBeNull();
  });

  it('returns [null, null] for empty array', () => {
    const [before, after] = findAdjacentSnapshots([], 1000);
    expect(before).toBeNull();
    expect(after).toBeNull();
  });
});
