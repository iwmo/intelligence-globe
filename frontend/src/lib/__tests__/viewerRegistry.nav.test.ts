import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock cesium before importing the module under test
vi.mock('cesium', () => ({
  Cartesian3: {
    fromDegrees: vi.fn(),
  },
  Cartographic: {},
  Math: {
    toDegrees: (r: number) => (r * 180) / Math.PI,
    toRadians: (d: number) => (d * Math.PI) / 180,
  },
}));

import { registerViewer, zoomStep, setPitchPreset } from '../viewerRegistry';

function makeMockViewer(altitude = 100_000) {
  return {
    isDestroyed: vi.fn().mockReturnValue(false),
    camera: {
      positionCartographic: { height: altitude },
      heading: 0,
      cancelFlight: vi.fn(),
      setView: vi.fn(),
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      flyTo: vi.fn(),
    },
  };
}

describe('zoomStep', () => {
  let mockViewer: ReturnType<typeof makeMockViewer>;

  beforeEach(() => {
    mockViewer = makeMockViewer(100_000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerViewer(mockViewer as any);
  });

  it('calls camera.zoomIn with altitude * 0.3 when direction is "in"', () => {
    zoomStep('in');
    expect(mockViewer.camera.zoomIn).toHaveBeenCalledWith(30_000);
  });

  it('calls camera.zoomOut with altitude * 0.3 when direction is "out"', () => {
    zoomStep('out');
    expect(mockViewer.camera.zoomOut).toHaveBeenCalledWith(30_000);
  });

  it('returns early without throwing when viewer is destroyed', () => {
    const destroyedViewer = makeMockViewer(100_000);
    destroyedViewer.isDestroyed.mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerViewer(destroyedViewer as any);
    expect(() => zoomStep('in')).not.toThrow();
    expect(destroyedViewer.camera.zoomIn).not.toHaveBeenCalled();
  });
});

describe('setPitchPreset', () => {
  let mockViewer: ReturnType<typeof makeMockViewer>;

  beforeEach(() => {
    mockViewer = makeMockViewer(100_000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerViewer(mockViewer as any);
  });

  it('calls cancelFlight then setView with pitch = -PI/2 for -90 degrees', () => {
    setPitchPreset(-90);
    expect(mockViewer.camera.cancelFlight).toHaveBeenCalledTimes(1);
    expect(mockViewer.camera.setView).toHaveBeenCalledWith({
      orientation: {
        heading: 0,
        pitch: expect.closeTo(-Math.PI / 2, 5),
        roll: 0,
      },
    });
  });

  it('calls setView with pitch ≈ -0.785 rad for -45 degrees', () => {
    setPitchPreset(-45);
    expect(mockViewer.camera.setView).toHaveBeenCalledWith({
      orientation: {
        heading: 0,
        pitch: expect.closeTo(-Math.PI / 4, 5),
        roll: 0,
      },
    });
  });

  it('calls setView with pitch ≈ -0.175 rad for -10 degrees', () => {
    setPitchPreset(-10);
    expect(mockViewer.camera.setView).toHaveBeenCalledWith({
      orientation: {
        heading: 0,
        pitch: expect.closeTo((-10 * Math.PI) / 180, 5),
        roll: 0,
      },
    });
  });

  it('returns early without throwing when viewer is destroyed', () => {
    const destroyedViewer = makeMockViewer(100_000);
    destroyedViewer.isDestroyed.mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerViewer(destroyedViewer as any);
    expect(() => setPitchPreset(-90)).not.toThrow();
    expect(destroyedViewer.camera.cancelFlight).not.toHaveBeenCalled();
    expect(destroyedViewer.camera.setView).not.toHaveBeenCalled();
  });
});
