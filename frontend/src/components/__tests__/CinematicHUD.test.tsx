import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('cesium', () => ({
  Math: { toDegrees: (v: number) => v },
}));
vi.mock('mgrs', () => ({ forward: () => '37U CQ 12345 67890' }));
vi.mock('../../hooks/useAircraft', () => ({ useAircraft: () => ({ data: [] }) }));
vi.mock('../../hooks/useMilitaryAircraft', () => ({ useMilitaryAircraft: () => ({ data: [] }) }));
vi.mock('../../hooks/useShips', () => ({ useShips: () => ({ data: [] }) }));
vi.mock('../../hooks/useWeather', () => ({
  useWeather: () => ({ data: { temperature_c: 21.2, wind_kn: 8 } }),
  weatherQueryPoint: (lat: number | null, lon: number | null) =>
    lat == null || lon == null ? [null, null] : [lat, lon],
}));

const mockState = {
  cleanUI: false,
  setCleanUI: vi.fn(),
  hudVisible: true,
  selectedSatelliteId: null as number | null,
  selectedAircraftId: null as string | null,
  selectedMilitaryId: null as string | null,
  selectedShipId: null as string | null,
  trackedEntity: null,
  replayMode: 'live' as 'live' | 'playback',
  cockpitMode: false,
  replayTs: new Date('2026-01-01T00:00:00Z').getTime(),
};

vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector?: (s: typeof mockState) => unknown) =>
    selector ? selector(mockState) : mockState
  ),
}));

vi.mock('../../store/useSettingsStore', () => ({
  useSettingsStore: vi.fn((selector?: (s: { showClassificationBanner: boolean }) => unknown) =>
    selector ? selector({ showClassificationBanner: false }) : { showClassificationBanner: false }
  ),
}));

import { CinematicHUD } from '../CinematicHUD';

function renderHud() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CinematicHUD viewer={null} />
    </QueryClientProvider>,
  );
}

describe('CinematicHUD', () => {
  it('shows NO CONTACT when nothing is selected', () => {
    mockState.hudVisible = true;
    const { getByText } = renderHud();
    expect(getByText('NO CONTACT')).toBeTruthy();
    expect(getByText(/WX 21°C/)).toBeTruthy();
  });

  it('does not render the costume classification banner by default', () => {
    const { queryByText } = renderHud();
    expect(queryByText(/TOP SECRET/)).toBeNull();
  });

  it('hides telemetry when hudVisible is false', () => {
    mockState.hudVisible = false;
    const { queryByText } = renderHud();
    expect(queryByText('NO CONTACT')).toBeNull();
    mockState.hudVisible = true;
  });
});
