import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../useAppStore';

describe('useAppStore — filter and search slices', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAppStore.setState({
      satelliteFilter: { constellation: null, altitudeBand: null },
      aircraftFilter: { altitudeRange: null, boundingBox: null },
      aircraftLastUpdated: null,
      visualPreset: 'normal',
      postProcessUniforms: {
        bloomIntensity: 0.5,
        sharpenAmount: 0.5,
        gainAmount: 1.0,
        scanlineSpacing: 3,
        pixelationLevel: 1,
      },
      cleanUI: false,
    });
  });

  describe('satelliteFilter', () => {
    it('defaults to { constellation: null, altitudeBand: null }', () => {
      const { satelliteFilter } = useAppStore.getState();
      expect(satelliteFilter).toEqual({ constellation: null, altitudeBand: null });
    });

    it('setSatelliteFilter merges partial update — constellation only', () => {
      useAppStore.getState().setSatelliteFilter({ constellation: 'Starlink' });
      const { satelliteFilter } = useAppStore.getState();
      expect(satelliteFilter.constellation).toBe('Starlink');
      expect(satelliteFilter.altitudeBand).toBeNull();
    });

    it('setSatelliteFilter merges partial update — altitudeBand only', () => {
      useAppStore.getState().setSatelliteFilter({ constellation: 'Starlink' });
      useAppStore.getState().setSatelliteFilter({ altitudeBand: [200, 2000] });
      const { satelliteFilter } = useAppStore.getState();
      expect(satelliteFilter.constellation).toBe('Starlink');
      expect(satelliteFilter.altitudeBand).toEqual([200, 2000]);
    });
  });

  describe('aircraftFilter', () => {
    it('defaults to { altitudeRange: null, boundingBox: null }', () => {
      const { aircraftFilter } = useAppStore.getState();
      expect(aircraftFilter).toEqual({ altitudeRange: null, boundingBox: null });
    });

    it('setAircraftFilter merges partial update — altitudeRange only', () => {
      useAppStore.getState().setAircraftFilter({ altitudeRange: [0, 5000] });
      const { aircraftFilter } = useAppStore.getState();
      expect(aircraftFilter.altitudeRange).toEqual([0, 5000]);
      expect(aircraftFilter.boundingBox).toBeNull();
    });

    it('setAircraftFilter merges partial update — boundingBox only', () => {
      useAppStore.getState().setAircraftFilter({ altitudeRange: [0, 5000] });
      useAppStore.getState().setAircraftFilter({
        boundingBox: { minLat: 40, maxLat: 50, minLon: -10, maxLon: 10 },
      });
      const { aircraftFilter } = useAppStore.getState();
      expect(aircraftFilter.altitudeRange).toEqual([0, 5000]);
      expect(aircraftFilter.boundingBox).toEqual({ minLat: 40, maxLat: 50, minLon: -10, maxLon: 10 });
    });
  });

  describe('aircraftLastUpdated', () => {
    it('defaults to null', () => {
      expect(useAppStore.getState().aircraftLastUpdated).toBeNull();
    });

    it('setAircraftLastUpdated replaces with ISO string', () => {
      const ts = '2026-03-11T12:00:00Z';
      useAppStore.getState().setAircraftLastUpdated(ts);
      expect(useAppStore.getState().aircraftLastUpdated).toBe(ts);
    });

    it('setAircraftLastUpdated replaces with null', () => {
      useAppStore.getState().setAircraftLastUpdated('2026-03-11T12:00:00Z');
      useAppStore.getState().setAircraftLastUpdated(null);
      expect(useAppStore.getState().aircraftLastUpdated).toBeNull();
    });
  });

  describe('existing state unchanged', () => {
    it('sidebarOpen still works', () => {
      useAppStore.getState().setSidebarOpen(true);
      expect(useAppStore.getState().sidebarOpen).toBe(true);
    });

    it('layers still works', () => {
      useAppStore.getState().setLayerVisible('satellites', true);
      expect(useAppStore.getState().layers.satellites).toBe(true);
    });
  });
});

describe('useAppStore — replay slice', () => {
  beforeEach(() => {
    useAppStore.setState({
      replayMode: 'live',
      replayTs: Date.now(),
      replaySpeedMultiplier: 60,
      replayWindowStart: null,
      replayWindowEnd: null,
    });
  });

  it('replayMode defaults to "live"', () => {
    expect(useAppStore.getState().replayMode).toBe('live');
  });

  it('setReplayMode("playback") sets replayMode', () => {
    useAppStore.getState().setReplayMode('playback');
    expect(useAppStore.getState().replayMode).toBe('playback');
  });

  it('setReplayMode("live") returns to live', () => {
    useAppStore.getState().setReplayMode('playback');
    useAppStore.getState().setReplayMode('live');
    expect(useAppStore.getState().replayMode).toBe('live');
  });

  it('replayTs is a number', () => {
    expect(typeof useAppStore.getState().replayTs).toBe('number');
  });

  it('setReplayTs(12345) sets replayTs', () => {
    useAppStore.getState().setReplayTs(12345);
    expect(useAppStore.getState().replayTs).toBe(12345);
  });

  it('replaySpeedMultiplier defaults to 60', () => {
    expect(useAppStore.getState().replaySpeedMultiplier).toBe(60);
  });

  it('setReplaySpeedMultiplier(3600) sets to 3600', () => {
    useAppStore.getState().setReplaySpeedMultiplier(3600);
    expect(useAppStore.getState().replaySpeedMultiplier).toBe(3600);
  });

  it('replayWindowStart defaults to null', () => {
    expect(useAppStore.getState().replayWindowStart).toBeNull();
  });

  it('replayWindowEnd defaults to null', () => {
    expect(useAppStore.getState().replayWindowEnd).toBeNull();
  });

  it('setReplayWindow(1000, 2000) sets both window bounds', () => {
    useAppStore.getState().setReplayWindow(1000, 2000);
    expect(useAppStore.getState().replayWindowStart).toBe(1000);
    expect(useAppStore.getState().replayWindowEnd).toBe(2000);
  });
});

// ---------------------------------------------------------------------------
// Phase 12 slices — RED tests
// These tests FAIL because activeCategories, toggleCategory, areaOfInterest
// do not yet exist in useAppStore.ts.
// ---------------------------------------------------------------------------
describe('useAppStore — Phase 12 OSINT event correlation slices (RED)', () => {
  beforeEach(() => {
    // Only reset known existing state; Phase 12 fields do not exist yet
    useAppStore.setState({
      replayMode: 'live',
    });
  });

  describe('activeCategories', () => {
    it('defaults to []', () => {
      const state = useAppStore.getState() as Record<string, unknown>;
      expect(state['activeCategories']).toEqual([]);
    });

    it('toggleCategory("KINETIC") adds KINETIC to activeCategories', () => {
      const state = useAppStore.getState() as Record<string, unknown>;
      (state['toggleCategory'] as (c: string) => void)('KINETIC');
      const updated = useAppStore.getState() as Record<string, unknown>;
      expect(updated['activeCategories']).toContain('KINETIC');
    });

    it('toggleCategory("KINETIC") again removes KINETIC (toggle off)', () => {
      const state = useAppStore.getState() as Record<string, unknown>;
      (state['toggleCategory'] as (c: string) => void)('KINETIC');
      (state['toggleCategory'] as (c: string) => void)('KINETIC');
      const updated = useAppStore.getState() as Record<string, unknown>;
      expect((updated['activeCategories'] as string[]).includes('KINETIC')).toBe(false);
    });
  });

  describe('areaOfInterest', () => {
    it('defaults to null', () => {
      const state = useAppStore.getState() as Record<string, unknown>;
      expect(state['areaOfInterest']).toBeNull();
    });
  });
});

describe('useAppStore — visual engine and clean UI slices', () => {
  beforeEach(() => {
    useAppStore.setState({
      visualPreset: 'normal',
      postProcessUniforms: {
        bloomIntensity: 0.5,
        sharpenAmount: 0.5,
        gainAmount: 1.0,
        scanlineSpacing: 3,
        pixelationLevel: 1,
      },
      cleanUI: false,
    });
  });

  describe('visualPreset', () => {
    it('defaults to "normal"', () => {
      expect(useAppStore.getState().visualPreset).toBe('normal');
    });

    it('setVisualPreset sets preset to "nvg"', () => {
      useAppStore.getState().setVisualPreset('nvg');
      expect(useAppStore.getState().visualPreset).toBe('nvg');
    });
  });

  describe('postProcessUniforms', () => {
    it('bloomIntensity defaults to 0.5', () => {
      expect(useAppStore.getState().postProcessUniforms.bloomIntensity).toBe(0.5);
    });

    it('setPostProcessUniforms merges — gainAmount remains unchanged when only bloomIntensity updated', () => {
      useAppStore.getState().setPostProcessUniforms({ bloomIntensity: 1.2 });
      const uniforms = useAppStore.getState().postProcessUniforms;
      expect(uniforms.bloomIntensity).toBe(1.2);
      expect(uniforms.gainAmount).toBe(1.0);
    });
  });

  describe('cleanUI', () => {
    it('defaults to false', () => {
      expect(useAppStore.getState().cleanUI).toBe(false);
    });

    it('setCleanUI(true) sets cleanUI to true', () => {
      useAppStore.getState().setCleanUI(true);
      expect(useAppStore.getState().cleanUI).toBe(true);
    });

    it('setCleanUI(false) sets cleanUI back to false', () => {
      useAppStore.getState().setCleanUI(true);
      useAppStore.getState().setCleanUI(false);
      expect(useAppStore.getState().cleanUI).toBe(false);
    });
  });
});
