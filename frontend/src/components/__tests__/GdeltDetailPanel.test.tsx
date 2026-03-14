import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// --- Mocks ---

vi.mock('../../store/useAppStore', () => {
  // factory must be self-contained — no refs to outer vars (Vitest hoisting)
  const storeState = {
    selectedGdeltEventId: null as number | null,
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

vi.mock('../DraggablePanel', () => ({
  DraggablePanel: ({ children, title }: { children: React.ReactNode; title: string }) =>
    React.createElement('div', { 'data-testid': 'draggable-panel', 'data-title': title }, children),
}));

// --- Imports after mocks ---

import { useAppStore } from '../../store/useAppStore';
import type { GdeltEvent } from '../../hooks/useGdeltEvents';
import { GdeltDetailPanel } from '../GdeltDetailPanel';

// Typed access to the self-contained mock state
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const storeState = (useAppStore as any)._state as {
  selectedGdeltEventId: number | null;
  setSelectedGdeltEventId: ReturnType<typeof vi.fn>;
  setGdeltOsintPrefill: ReturnType<typeof vi.fn>;
  gdeltOsintPrefill: null;
};

// --- Fixture ---

const fixtureEvent: GdeltEvent = {
  global_event_id: 42,
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

describe('GdeltDetailPanel — GDELT-08 render', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.selectedGdeltEventId = null;
  });

  it('renders nothing when selectedGdeltEventId is null', () => {
    storeState.selectedGdeltEventId = null;
    const { container } = render(<GdeltDetailPanel events={[fixtureEvent]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders panel content when selectedGdeltEventId is set', () => {
    storeState.selectedGdeltEventId = 42;
    render(<GdeltDetailPanel events={[fixtureEvent]} />);
    expect(screen.getByTestId('draggable-panel')).toBeTruthy();
  });

  it('shows source_url, actor1_name, actor2_name, goldstein_scale, avg_tone', () => {
    storeState.selectedGdeltEventId = 42;
    render(<GdeltDetailPanel events={[fixtureEvent]} />);
    // source_url as link
    const link = screen.getByRole('link');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('https://example.com/article');
    expect(link.getAttribute('target')).toBe('_blank');
    // actor names
    expect(screen.getByText('FRANCE')).toBeTruthy();
    expect(screen.getByText('GERMANY')).toBeTruthy();
    // goldstein and avg_tone
    expect(screen.getByText('-5.0')).toBeTruthy();
    expect(screen.getByText('-3.5')).toBeTruthy();
  });

  it('shows automated-extraction disclaimer', () => {
    storeState.selectedGdeltEventId = 42;
    render(<GdeltDetailPanel events={[fixtureEvent]} />);
    expect(screen.getByText(/Data extracted automatically by the GDELT Project/i)).toBeTruthy();
  });

  it('shows N/A for null actor names', () => {
    storeState.selectedGdeltEventId = 42;
    const nullActorEvent: GdeltEvent = { ...fixtureEvent, actor1_name: null, actor2_name: null };
    render(<GdeltDetailPanel events={[nullActorEvent]} />);
    const naItems = screen.getAllByText('N/A');
    expect(naItems.length).toBeGreaterThanOrEqual(2);
  });

  it('shows N/A for null goldstein_scale and avg_tone', () => {
    storeState.selectedGdeltEventId = 42;
    const nullNumericEvent: GdeltEvent = { ...fixtureEvent, goldstein_scale: null, avg_tone: null };
    render(<GdeltDetailPanel events={[nullNumericEvent]} />);
    const naItems = screen.getAllByText('N/A');
    expect(naItems.length).toBeGreaterThanOrEqual(2);
  });

  it('close button calls setSelectedGdeltEventId(null)', () => {
    storeState.selectedGdeltEventId = 42;
    render(<GdeltDetailPanel events={[fixtureEvent]} />);
    const closeBtn = screen.getByTitle('Close');
    fireEvent.click(closeBtn);
    expect(storeState.setSelectedGdeltEventId).toHaveBeenCalledWith(null);
  });
});

describe('GdeltDetailPanel — GDELT-09 OSINT bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.selectedGdeltEventId = null;
  });

  it('"Log as OSINT Event" button calls setGdeltOsintPrefill with event lat/lon/ts/sourceUrl', () => {
    storeState.selectedGdeltEventId = 42;
    render(<GdeltDetailPanel events={[fixtureEvent]} />);
    const logBtn = screen.getByText('LOG AS OSINT EVENT');
    fireEvent.click(logBtn);
    expect(storeState.setGdeltOsintPrefill).toHaveBeenCalledWith({
      lat: fixtureEvent.latitude,
      lon: fixtureEvent.longitude,
      ts: fixtureEvent.occurred_at,
      sourceUrl: fixtureEvent.source_url,
    });
  });
});
