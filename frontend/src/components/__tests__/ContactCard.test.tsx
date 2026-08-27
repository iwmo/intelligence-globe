import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const flyToPosition = vi.hoisted(() => vi.fn());

vi.mock('../../lib/viewerRegistry', () => ({ flyToPosition }));

import { useAppStore } from '../../store/useAppStore';
import { ContactCard } from '../ContactCard';

function renderCard() {
  return render(
    <ContactCard
      kind="aircraft"
      id="abc123"
      title="BAW123"
      altitude="32,000 ft"
      speed="440 kts"
      heading="090°"
      accent="#ff8c00"
      source="ADS-B"
      freshness="2026-08-27T04:00:00Z"
      position={{ lat: 51.5, lon: -0.1, altitudeMeters: 10_000 }}
      context={<div>London → Lisbon</div>}
      history={<div>24 recorded positions</div>}
    >
      <div>ICAO24 abc123</div>
    </ContactCard>,
  );
}

describe('ContactCard inspector hierarchy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      trackedEntity: null,
      cockpitMode: false,
      pinnedContacts: [],
    });
  });

  it('renders selection, actions, context, history, and details', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: 'BAW123' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Actions' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Context' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'History' })).toBeTruthy();
    expect(screen.getByText('ICAO24 abc123')).toBeTruthy();
  });

  it('tracks, centers, and pins the selected contact', () => {
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Track' }));
    expect(useAppStore.getState().trackedEntity).toEqual({ kind: 'aircraft', id: 'abc123' });

    fireEvent.click(screen.getByRole('button', { name: 'Center' }));
    expect(flyToPosition).toHaveBeenCalledWith(-0.1, 51.5, 10_000);

    fireEvent.click(screen.getByRole('button', { name: 'Pin' }));
    expect(useAppStore.getState().pinnedContacts).toEqual([{ kind: 'aircraft', id: 'abc123' }]);
    expect(screen.getByRole('button', { name: 'Unpin' })).toBeTruthy();
  });
});
