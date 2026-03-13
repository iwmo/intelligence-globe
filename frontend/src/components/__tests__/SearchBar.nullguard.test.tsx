import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SearchBar } from '../SearchBar';

// Mock dependencies
vi.mock('../../hooks/useSatellites', () => ({
  useSatellites: () => ({
    data: [{ norad_cat_id: 25544, omm: { OBJECT_NAME: 'ISS (ZARYA)' } }],
  }),
}));
vi.mock('../../hooks/useAircraft', () => ({
  useAircraft: () => ({ data: [] }),
}));
vi.mock('../../store/useAppStore', () => {
  const setSelectedSatelliteId = vi.fn();
  const setSelectedAircraftId = vi.fn();
  const mockStore = {
    useAppStore: (selector: (s: any) => any) =>
      selector({ setSelectedSatelliteId, setSelectedAircraftId }),
  };
  (mockStore.useAppStore as any).getState = () => ({
    replayMode: 'live' as const,
    replayTs: 0,
  });
  return mockStore;
});
vi.mock('../../lib/viewerRegistry', () => ({ flyToPosition: vi.fn() }));

describe('SearchBar — null worker guard', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('shows loading status when workerRef is null and satellite found', async () => {
    const workerRef = { current: null } as React.RefObject<Worker | null>;
    render(<SearchBar workerRef={workerRef} />);
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: '25544' } });
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(screen.getByText(/loading position/i)).toBeTruthy();
  });

  it('calls postMessage when workerRef has a worker', async () => {
    const mockWorker = { postMessage: vi.fn() } as unknown as Worker;
    const workerRef = { current: mockWorker } as React.RefObject<Worker | null>;
    render(<SearchBar workerRef={workerRef} />);
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: '25544' } });
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: 'GET_POSITION',
      payload: { norad: 25544, timestamp: expect.any(Number) },
    });
  });
});
