import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

// --- Mocks (must be top-level; Vitest hoists vi.mock calls) ---

vi.mock('../../store/useAppStore', () => {
  // factory must be self-contained — no refs to outer vars (Vitest hoisting)
  const storeState = {
    selectedAircraftId: null as string | null,
    setSelectedAircraftId: vi.fn(),
  };
  const useAppStore = Object.assign(
    vi.fn((selector: (s: typeof storeState) => unknown) => selector(storeState)),
    { getState: () => storeState, _state: storeState },
  );
  return { useAppStore };
});

// Override useQuery to return fixture data directly — bypasses network
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

// --- Imports after mocks ---

import { useAppStore } from '../../store/useAppStore';
import { useQuery } from '@tanstack/react-query';
import { AircraftDetailPanel } from '../AircraftDetailPanel';

// Typed access to self-contained mock state
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const storeState = (useAppStore as any)._state as {
  selectedAircraftId: string | null;
  setSelectedAircraftId: ReturnType<typeof vi.fn>;
};

const mockedUseQuery = useQuery as ReturnType<typeof vi.fn>;

// --- Fixtures ---

const fixtureAircraftFull = {
  icao24: 'abc123',
  callsign: 'BAW123',
  origin_country: 'United Kingdom',
  latitude: 51.5,
  longitude: -0.1,
  baro_altitude: 10000,
  velocity: 250,
  true_track: 90,
  trail: [],
  emergency: 'general',
  nav_modes: ['autopilot', 'vnav'],
  ias: 280.5,
  tas: 310.2,
  mach: 0.82,
  registration: 'G-EUUU',
  type_code: 'A320',
};

const fixtureAircraftNullTelemetry = {
  icao24: 'def456',
  callsign: 'EZY456',
  origin_country: 'Ireland',
  latitude: 53.3,
  longitude: -6.3,
  baro_altitude: 8000,
  velocity: 200,
  true_track: 180,
  trail: [],
  emergency: null,
  nav_modes: null,
  ias: null,
  tas: null,
  mach: null,
  registration: null,
  type_code: null,
};

// Route data fixture (second useQuery call for route endpoint)
const fixtureRoute = { origin: null, destination: null };

describe('AircraftDetailPanel — UI-01/02/03 telemetry rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.selectedAircraftId = null;
    // Default: return full fixture for aircraft query, empty route for route query
    mockedUseQuery.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === 'aircraft') {
        return { data: fixtureAircraftFull, isLoading: false, isError: false };
      }
      return { data: fixtureRoute, isLoading: false, isError: false };
    });
  });

  // Test 1: renders nothing when no selection
  it('renders nothing when selectedAircraftId is null', () => {
    storeState.selectedAircraftId = null;
    const { container } = render(<AircraftDetailPanel />);
    expect(container.firstChild).toBeNull();
  });

  // Test 2: renders panel when selection is set
  it('renders panel when selectedAircraftId is set', () => {
    storeState.selectedAircraftId = 'abc123';
    render(<AircraftDetailPanel />);
    expect(screen.getByText('AIRCRAFT')).toBeTruthy();
  });

  // Test 3: shows emergency badge when emergency is "general"
  it('shows emergency badge when emergency is "general"', () => {
    storeState.selectedAircraftId = 'abc123';
    render(<AircraftDetailPanel />);
    const badge = screen.getByTestId('emergency-badge');
    expect(badge).toBeTruthy();
  });

  // Test 4: badge text is uppercased
  it('badge text is uppercased ("GENERAL")', () => {
    storeState.selectedAircraftId = 'abc123';
    render(<AircraftDetailPanel />);
    expect(screen.getByText(/GENERAL/)).toBeTruthy();
  });

  // Test 5: no badge when emergency is "none"
  it('no badge when emergency is "none"', () => {
    storeState.selectedAircraftId = 'abc123';
    mockedUseQuery.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === 'aircraft') {
        return { data: { ...fixtureAircraftFull, emergency: 'none' }, isLoading: false, isError: false };
      }
      return { data: fixtureRoute, isLoading: false, isError: false };
    });
    render(<AircraftDetailPanel />);
    expect(screen.queryByTestId('emergency-badge')).toBeNull();
  });

  // Test 6: no badge when emergency is null
  it('no badge when emergency is null', () => {
    storeState.selectedAircraftId = 'def456';
    mockedUseQuery.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === 'aircraft') {
        return { data: fixtureAircraftNullTelemetry, isLoading: false, isError: false };
      }
      return { data: fixtureRoute, isLoading: false, isError: false };
    });
    render(<AircraftDetailPanel />);
    expect(screen.queryByTestId('emergency-badge')).toBeNull();
  });

  // Test 7: shows nav mode chips when nav_modes has entries
  it('shows nav mode chips when nav_modes has entries', () => {
    storeState.selectedAircraftId = 'abc123';
    render(<AircraftDetailPanel />);
    expect(screen.getByTestId('nav-modes-section')).toBeTruthy();
  });

  // Test 8: chip texts are uppercased
  it('chip texts are uppercased ("AUTOPILOT", "VNAV")', () => {
    storeState.selectedAircraftId = 'abc123';
    render(<AircraftDetailPanel />);
    expect(screen.getByText('AUTOPILOT')).toBeTruthy();
    expect(screen.getByText('VNAV')).toBeTruthy();
  });

  // Test 9: no chips section when nav_modes is null
  it('no chips section when nav_modes is null', () => {
    storeState.selectedAircraftId = 'def456';
    mockedUseQuery.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === 'aircraft') {
        return { data: fixtureAircraftNullTelemetry, isLoading: false, isError: false };
      }
      return { data: fixtureRoute, isLoading: false, isError: false };
    });
    render(<AircraftDetailPanel />);
    expect(screen.queryByTestId('nav-modes-section')).toBeNull();
  });

  // Test 10: no chips section when nav_modes is []
  it('no chips section when nav_modes is []', () => {
    storeState.selectedAircraftId = 'abc123';
    mockedUseQuery.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === 'aircraft') {
        return { data: { ...fixtureAircraftFull, nav_modes: [] }, isLoading: false, isError: false };
      }
      return { data: fixtureRoute, isLoading: false, isError: false };
    });
    render(<AircraftDetailPanel />);
    expect(screen.queryByTestId('nav-modes-section')).toBeNull();
  });

  // Test 11: shows IAS row when ias is non-null
  it('shows IAS row when ias is non-null', () => {
    storeState.selectedAircraftId = 'abc123';
    render(<AircraftDetailPanel />);
    expect(screen.getByTestId('ias-row')).toBeTruthy();
  });

  // Test 12: shows TAS and Mach rows when values are non-null
  it('shows TAS and Mach rows when values are non-null', () => {
    storeState.selectedAircraftId = 'abc123';
    render(<AircraftDetailPanel />);
    expect(screen.getByTestId('tas-row')).toBeTruthy();
    expect(screen.getByTestId('mach-row')).toBeTruthy();
  });

  // Test 13: IAS/TAS/Mach rows absent when values are null
  it('IAS/TAS/Mach rows absent when values are null', () => {
    storeState.selectedAircraftId = 'def456';
    mockedUseQuery.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === 'aircraft') {
        return { data: fixtureAircraftNullTelemetry, isLoading: false, isError: false };
      }
      return { data: fixtureRoute, isLoading: false, isError: false };
    });
    render(<AircraftDetailPanel />);
    expect(screen.queryByTestId('ias-row')).toBeNull();
    expect(screen.queryByTestId('tas-row')).toBeNull();
    expect(screen.queryByTestId('mach-row')).toBeNull();
  });
});
