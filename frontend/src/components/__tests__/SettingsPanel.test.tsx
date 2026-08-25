import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';

// Mock cesium to avoid ESM issues in jsdom
vi.mock('cesium', () => ({}));

// Mock DraggablePanel to render children directly (no drag/resize in tests)
vi.mock('../DraggablePanel', () => ({
  DraggablePanel: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="draggable-panel" aria-label={title}>
      <span>{title}</span>
      {children}
    </div>
  ),
}));

// Mock viewerRegistry
vi.mock('../../lib/viewerRegistry', () => ({
  getViewer: vi.fn(),
}));

// Mock useSettingsStore
const mockSetDefaultLayers = vi.fn();
const mockSetDefaultPreset = vi.fn();
const mockSetDefaultMapType = vi.fn();
const mockSetDefaultCamera = vi.fn();
const mockSetDefaultMode = vi.fn();

const defaultStoreState = {
  defaultLayers: {
    satellites: true,
    aircraft: true,
    militaryAircraft: false,
    ships: false,
    gpsJamming: false,
    streetTraffic: false,
  },
  defaultPreset: 'normal' as const,
  defaultMapType: 'google_3d' as const,
  defaultCamera: null as null | { lon: number; lat: number; altMeters: number; pitch: number },
  defaultMode: 'live' as 'live' | 'playback',
  showSatelliteLabels: false,
  showAircraftLabels: false,
  showMilitaryLabels: false,
  showShipLabels: false,
  showClassificationBanner: false,
  setDefaultLayers: mockSetDefaultLayers,
  setDefaultPreset: mockSetDefaultPreset,
  setDefaultMapType: mockSetDefaultMapType,
  setDefaultCamera: mockSetDefaultCamera,
  setDefaultMode: mockSetDefaultMode,
  setShowSatelliteLabels: vi.fn(),
  setShowAircraftLabels: vi.fn(),
  setShowMilitaryLabels: vi.fn(),
  setShowShipLabels: vi.fn(),
  setShowClassificationBanner: vi.fn(),
};

let storeState = { ...defaultStoreState };

vi.mock('../../store/useSettingsStore', () => ({
  useSettingsStore: () => storeState,
}));

import { getViewer } from '../../lib/viewerRegistry';
import { SettingsPanel } from '../SettingsPanel';

beforeEach(() => {
  vi.clearAllMocks();
  storeState = { ...defaultStoreState };
});

describe('SettingsPanel', () => {
  it('Test 1: renders default-layer and map-type controls', () => {
    render(<SettingsPanel />);
    expect(screen.getByText('Default Layers')).toBeTruthy();
    expect(screen.getByText(/Photoreal 3D uses Cesium ion/)).toBeTruthy();
  });

  it('Test 2: all 6 layer checkboxes are present; satellites is checked by default', () => {
    render(<SettingsPanel />);
    const satellitesCheckbox = screen.getByRole('checkbox', { name: 'Satellites' });
    const aircraftCheckbox = screen.getByRole('checkbox', { name: 'Aircraft' });
    const militaryCheckbox = screen.getByRole('checkbox', { name: 'Military Aircraft' });
    const shipsCheckbox = screen.getByRole('checkbox', { name: 'Ships' });
    const jammingCheckbox = screen.getByRole('checkbox', { name: 'GPS Jamming' });
    const trafficCheckbox = screen.getByRole('checkbox', { name: 'Street Traffic' });

    expect(satellitesCheckbox).toBeTruthy();
    expect(aircraftCheckbox).toBeTruthy();
    expect(militaryCheckbox).toBeTruthy();
    expect(shipsCheckbox).toBeTruthy();
    expect(jammingCheckbox).toBeTruthy();
    expect(trafficCheckbox).toBeTruthy();

    expect((satellitesCheckbox as HTMLInputElement).checked).toBe(true);
    expect((shipsCheckbox as HTMLInputElement).checked).toBe(false);
  });

  it('Test 3: toggling a layer checkbox calls setDefaultLayers with the updated layers object', () => {
    render(<SettingsPanel />);
    const shipsCheckbox = screen.getByRole('checkbox', { name: 'Ships' });
    fireEvent.click(shipsCheckbox);
    expect(mockSetDefaultLayers).toHaveBeenCalledOnce();
    const calledWith = mockSetDefaultLayers.mock.calls[0][0];
    expect(calledWith.ships).toBe(true);
    expect(calledWith.satellites).toBe(true); // unchanged
  });

  it('Test 4: preset selector shows all 5 options; selecting one calls setDefaultPreset', () => {
    render(<SettingsPanel />);
    const select = screen.getByLabelText('Default preset') as HTMLSelectElement;
    expect(select).toBeTruthy();
    const options = Array.from(select.options).map(o => o.value);
    expect(options).toContain('normal');
    expect(options).toContain('nvg');
    expect(options).toContain('crt');
    expect(options).toContain('flir');
    expect(options).toContain('noir');

    fireEvent.change(select, { target: { value: 'nvg' } });
    expect(mockSetDefaultPreset).toHaveBeenCalledWith('nvg');
  });

  it('Test 5: "Save current view" button calls setDefaultCamera with snapshot from getViewer()', () => {
    const fakeViewer = {
      isDestroyed: () => false,
      camera: {
        positionCartographic: { longitude: 0.174533, latitude: 0.872665, height: 5_000_000 },
        pitch: -0.785398,
      },
    };
    vi.mocked(getViewer).mockReturnValue(fakeViewer as any);

    render(<SettingsPanel />);
    const saveBtn = screen.getByRole('button', { name: /save current view/i });
    fireEvent.click(saveBtn);

    expect(mockSetDefaultCamera).toHaveBeenCalledOnce();
    const snapshot = mockSetDefaultCamera.mock.calls[0][0];
    expect(typeof snapshot.lon).toBe('number');
    expect(typeof snapshot.lat).toBe('number');
    expect(typeof snapshot.altMeters).toBe('number');
    expect(typeof snapshot.pitch).toBe('number');
  });

  it('Test 6: start-mode toggle shows LIVE and PLAYBACK options; clicking PLAYBACK calls setDefaultMode', () => {
    render(<SettingsPanel />);
    const liveBtn = screen.getByRole('button', { name: /^live$/i });
    const playbackBtn = screen.getByRole('button', { name: /^playback$/i });
    expect(liveBtn).toBeTruthy();
    expect(playbackBtn).toBeTruthy();
    fireEvent.click(playbackBtn);
    expect(mockSetDefaultMode).toHaveBeenCalledWith('playback');
  });

  it('Test 7: getViewer() returning null means "Save current view" does nothing', () => {
    vi.mocked(getViewer).mockReturnValue(null);
    render(<SettingsPanel />);
    const saveBtn = screen.getByRole('button', { name: /save current view/i });
    expect(() => fireEvent.click(saveBtn)).not.toThrow();
    expect(mockSetDefaultCamera).not.toHaveBeenCalled();
  });
});
