import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const mockUseGdeltEvents = vi.hoisted(() => vi.fn(() => ({ data: [] as unknown[] })));

vi.mock('../../store/useAppStore', () => {
  const storeState = {
    selectedGdeltEventId: null as string | null,
    setSelectedGdeltEventId: vi.fn(),
    setGdeltOsintPrefill: vi.fn(),
    gdeltOsintPrefill: null,
  };
  const useAppStore = Object.assign(
    vi.fn((selector: (s: typeof storeState) => unknown) => selector(storeState)),
    { getState: () => storeState, _state: storeState },
  );
  return { useAppStore };
});

vi.mock('../../hooks/useGdeltEvents', () => ({
  useGdeltEvents: mockUseGdeltEvents,
}));

import { useAppStore } from '../../store/useAppStore';
import type { GdeltEvent } from '../../hooks/useGdeltEvents';
import { GdeltDetailPanel } from '../GdeltDetailPanel';

const storeState = (useAppStore as unknown as { _state: {
  selectedGdeltEventId: string | null;
  setSelectedGdeltEventId: ReturnType<typeof vi.fn>;
  setGdeltOsintPrefill: ReturnType<typeof vi.fn>;
  gdeltOsintPrefill: null;
} })._state;

const fixtureEvent: GdeltEvent = {
  global_event_id: '42',
  occurred_at: '2024-06-01T12:00:00Z',
  discovered_at: '2024-06-01T12:15:00Z',
  latitude: 48.8566,
  longitude: 2.3522,
  quad_class: 3,
  goldstein_scale: -5.0,
  event_code: '190',
  actor1_name: 'FRANCE',
  actor2_name: 'GERMANY',
  source_url: 'https://example.com/article',
  avg_tone: -3.5,
  num_mentions: 10,
  source_is_stale: false,
};

function renderPanel(events: GdeltEvent[] = [fixtureEvent]) {
  mockUseGdeltEvents.mockReturnValue({ data: events });
  return render(<GdeltDetailPanel />);
}

describe('GdeltDetailPanel — GDELT-08 render', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.selectedGdeltEventId = null;
    mockUseGdeltEvents.mockReturnValue({ data: [fixtureEvent] });
  });

  it('renders nothing when selectedGdeltEventId is null', () => {
    storeState.selectedGdeltEventId = null;
    const { container } = renderPanel();
    expect(container.firstChild).toBeNull();
  });

  it('renders panel content when selectedGdeltEventId is set', () => {
    storeState.selectedGdeltEventId = '42';
    renderPanel();
    expect(screen.getByText('FRANCE')).toBeTruthy();
    expect(screen.getByText('LOG AS OSINT EVENT')).toBeTruthy();
  });

  it('shows source_url, actor1_name, actor2_name, goldstein_scale, avg_tone', () => {
    storeState.selectedGdeltEventId = '42';
    renderPanel();
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('https://example.com/article');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(screen.getByText('FRANCE')).toBeTruthy();
    expect(screen.getByText('GERMANY')).toBeTruthy();
    expect(screen.getByText('-5.0')).toBeTruthy();
    expect(screen.getByText('-3.5')).toBeTruthy();
  });

  it('shows automated-extraction disclaimer', () => {
    storeState.selectedGdeltEventId = '42';
    renderPanel();
    expect(screen.getByText(/Data extracted automatically by the GDELT Project/i)).toBeTruthy();
  });

  it('shows N/A for null actor names', () => {
    storeState.selectedGdeltEventId = '42';
    renderPanel([{ ...fixtureEvent, actor1_name: null, actor2_name: null }]);
    expect(screen.getAllByText('N/A').length).toBeGreaterThanOrEqual(2);
  });

  it('shows N/A for null goldstein_scale and avg_tone', () => {
    storeState.selectedGdeltEventId = '42';
    renderPanel([{ ...fixtureEvent, goldstein_scale: null, avg_tone: null }]);
    expect(screen.getAllByText('N/A').length).toBeGreaterThanOrEqual(2);
  });
});

describe('GdeltDetailPanel — GDELT-09 OSINT bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.selectedGdeltEventId = null;
    mockUseGdeltEvents.mockReturnValue({ data: [fixtureEvent] });
  });

  it('"Log as OSINT Event" button calls setGdeltOsintPrefill with event lat/lon/ts/sourceUrl', () => {
    storeState.selectedGdeltEventId = '42';
    renderPanel();
    fireEvent.click(screen.getByText('LOG AS OSINT EVENT'));
    expect(storeState.setGdeltOsintPrefill).toHaveBeenCalledWith({
      lat: fixtureEvent.latitude,
      lon: fixtureEvent.longitude,
      ts: fixtureEvent.occurred_at,
      sourceUrl: fixtureEvent.source_url,
    });
  });
});
