import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../useAppStore';

describe('useAppStore — filter and search slices', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAppStore.setState({
      satelliteFilter: { constellation: null, altitudeBand: null },
      aircraftFilter: { altitudeRange: null, boundingBox: null },
      aircraftLastUpdated: null,
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
