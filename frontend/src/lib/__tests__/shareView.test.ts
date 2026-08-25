import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('cesium', () => ({
  Math: {
    toDegrees: (r: number) => (r * 180) / Math.PI,
    toRadians: (d: number) => (d * Math.PI) / 180,
  },
}));

vi.mock('../viewerRegistry', () => ({
  getViewer: vi.fn(),
  flyToLandmark: vi.fn(),
}));

import { parseShareHash, applyShareView } from '../shareView';
import { useAppStore } from '../../store/useAppStore';
import { flyToLandmark } from '../viewerRegistry';

describe('shareView', () => {
  beforeEach(() => {
    useAppStore.getState().clearSelection();
    useAppStore.getState().setMapType('google_3d');
  });

  it('parses a camera and layer hash', () => {
    const view = parseShareHash('#lon=51.5&lat=25.3&alt=80000&h=0&p=-45&map=satellite&preset=nvg&layers=aircraft,satellites&sel=ac:abc123');
    expect(view?.lon).toBe(51.5);
    expect(view?.mapType).toBe('satellite');
    expect(view?.preset).toBe('nvg');
    expect(view?.sel).toBe('ac:abc123');
  });

  it('applies selection and flies the camera', () => {
    const view = parseShareHash('#lon=10&lat=20&alt=1000&map=satellite&preset=normal&layers=aircraft&sel=ac:abc123')!;
    applyShareView(view);
    expect(useAppStore.getState().selectedAircraftId).toBe('abc123');
    expect(useAppStore.getState().mapType).toBe('satellite');
    expect(flyToLandmark).toHaveBeenCalled();
  });
});
