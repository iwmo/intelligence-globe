import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// --- Mocks ---

const mockSetSelectedGdeltEventId = vi.fn();
let mockSelectedGdeltEventId: number | null = null;

vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) => selector({
    selectedGdeltEventId: mockSelectedGdeltEventId,
    gdeltOsintPrefill: null,
    setGdeltOsintPrefill: vi.fn(),
    setSelectedGdeltEventId: mockSetSelectedGdeltEventId,
  })),
}));

vi.mock('../DraggablePanel', () => ({
  DraggablePanel: ({ children, title }: { children: React.ReactNode; title: string }) =>
    React.createElement('div', { 'data-testid': 'draggable-panel', 'data-title': title }, children),
}));

// --- Fixture ---

import type { GdeltEvent } from '../../hooks/useGdeltEvents';

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

// Lazy import so mocks are in place before module load
import { GdeltDetailPanel } from '../GdeltDetailPanel';

describe('GdeltDetailPanel — GDELT-08 render', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when selectedGdeltEventId is null', () => {
    mockSelectedGdeltEventId = null;
    const { container } = render(<GdeltDetailPanel events={[fixtureEvent]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders panel content when selectedGdeltEventId is set', () => {
    mockSelectedGdeltEventId = 42;
    render(<GdeltDetailPanel events={[fixtureEvent]} />);
    expect(screen.getByTestId('draggable-panel')).toBeTruthy();
  });

  it('shows source_url, actor1_name, actor2_name, goldstein_scale, avg_tone', () => {
    mockSelectedGdeltEventId = 42;
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
    mockSelectedGdeltEventId = 42;
    render(<GdeltDetailPanel events={[fixtureEvent]} />);
    expect(screen.getByText(/Data extracted automatically by the GDELT Project/i)).toBeTruthy();
  });

  it('shows N/A for null actor names', () => {
    mockSelectedGdeltEventId = 42;
    const nullActorEvent: GdeltEvent = { ...fixtureEvent, actor1_name: null, actor2_name: null };
    render(<GdeltDetailPanel events={[nullActorEvent]} />);
    const naItems = screen.getAllByText('N/A');
    expect(naItems.length).toBeGreaterThanOrEqual(2);
  });

  it('shows N/A for null goldstein_scale and avg_tone', () => {
    mockSelectedGdeltEventId = 42;
    const nullNumericEvent: GdeltEvent = { ...fixtureEvent, goldstein_scale: null, avg_tone: null };
    render(<GdeltDetailPanel events={[nullNumericEvent]} />);
    const naItems = screen.getAllByText('N/A');
    expect(naItems.length).toBeGreaterThanOrEqual(2);
  });

  it('close button calls setSelectedGdeltEventId(null)', () => {
    mockSelectedGdeltEventId = 42;
    render(<GdeltDetailPanel events={[fixtureEvent]} />);
    const closeBtn = screen.getByTitle('Close');
    fireEvent.click(closeBtn);
    expect(mockSetSelectedGdeltEventId).toHaveBeenCalledWith(null);
  });
});

describe('GdeltDetailPanel — GDELT-09 OSINT bridge', () => {
  it.todo('"Log as OSINT Event" button calls setGdeltOsintPrefill with event lat/lon/ts/sourceUrl');
});
