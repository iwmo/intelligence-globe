import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import { applyGlobePick } from '../applyGlobePick';

describe('applyGlobePick', () => {
  beforeEach(() => {
    useAppStore.getState().clearSelection();
  });

  it('selects and tracks an aircraft from a bare icao24', () => {
    applyGlobePick('abc123');
    const s = useAppStore.getState();
    expect(s.selectedAircraftId).toBe('abc123');
    expect(s.trackedEntity).toEqual({ kind: 'aircraft', id: 'abc123' });
  });

  it('selects and tracks a ship from mmsi: prefix', () => {
    applyGlobePick('mmsi:123456789');
    const s = useAppStore.getState();
    expect(s.selectedShipId).toBe('123456789');
    expect(s.trackedEntity).toEqual({ kind: 'ship', id: '123456789' });
  });

  it('selects a GDELT event without tracking', () => {
    applyGlobePick('gdelt:evt-1');
    const s = useAppStore.getState();
    expect(s.selectedGdeltEventId).toBe('evt-1');
    expect(s.trackedEntity).toBeNull();
  });

  it('clears selection on empty-globe pick', () => {
    applyGlobePick('abc123');
    applyGlobePick(null);
    const s = useAppStore.getState();
    expect(s.selectedAircraftId).toBeNull();
    expect(s.trackedEntity).toBeNull();
  });
});
