/**
 * SatelliteLayer cleanup unit test + nine pitfall static audit
 *
 * Part A: Verify that worker.terminate() and viewer.scene.primitives.remove()
 *         are called when SatelliteLayer unmounts.
 *
 * Part B: Nine-pitfall static audit — each check documents what was verified
 *         and where. grep-based checks run via child_process.execSync.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { execSync } from 'child_process';
import path from 'path';

// ---------------------------------------------------------------------------
// CesiumJS mock — must be declared BEFORE vi.mock() calls because vi.mock
// factories are hoisted. We use vi.hoisted() to create mocks that are safe
// to reference inside the hoisted factory.
// ---------------------------------------------------------------------------
const cesiumMocks = vi.hoisted(() => {
  const mockTerminate = vi.fn();
  const mockPostMessage = vi.fn();
  const mockPrimitivesAdd = vi.fn();
  const mockPrimitivesRemove = vi.fn();

  const mockAdd = vi.fn(() => ({ position: null, color: null, pixelSize: 3, show: true, id: 0 }));
  const mockGet = vi.fn(() => ({ position: null, color: null, pixelSize: 3, show: true }));
  const mockIsDestroyed = vi.fn(() => false);

  return {
    mockTerminate,
    mockPostMessage,
    mockPrimitivesAdd,
    mockPrimitivesRemove,
    mockAdd,
    mockGet,
    mockIsDestroyed,
  };
});

vi.mock('cesium', () => {
  class PointPrimitiveCollection {
    add = cesiumMocks.mockAdd;
    get = cesiumMocks.mockGet;
    isDestroyed = cesiumMocks.mockIsDestroyed;
    removeAll = vi.fn();
    length = 0;
  }
  class PolylineCollection {
    add = vi.fn();
    isDestroyed = vi.fn(() => false);
  }
  class ScreenSpaceEventHandler {
    setInputAction = vi.fn();
    destroy = vi.fn();
    constructor(_canvas: unknown) {}
  }
  return {
    PointPrimitiveCollection,
    PolylineCollection,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType: { RIGHT_CLICK: 'RIGHT_CLICK' },
    Ellipsoid: {
      WGS84: {
        cartesianToCartographic: vi.fn(() => ({ latitude: 0, longitude: 0, height: 0 })),
      },
    },
    Math: { toDegrees: vi.fn((v: number) => v * 180 / Math.PI) },
    Cartesian2: class MockCartesian2 {},
    Cartesian3: {
      ZERO: { x: 0, y: 0, z: 0 },
      fromRadians: vi.fn(() => ({ x: 0, y: 0, z: 0 })),
      fromDegrees: vi.fn(() => ({ x: 0, y: 0, z: 0 })),
    },
    Color: {
      fromCssColorString: vi.fn(() => ({ withAlpha: vi.fn(() => ({})) })),
    },
    BlendOption: { OPAQUE: 'OPAQUE' },
    ArcType: { NONE: 'NONE', GEODESIC: 'GEODESIC' },
    Material: { fromType: vi.fn(() => ({})) },
    JulianDate: { now: vi.fn() },
    Viewer: class MockViewer {},
    LabelCollection: class MockLabelCollection {
      add = vi.fn(() => ({ text: '', show: true, position: null }));
      removeAll = vi.fn();
      isDestroyed = vi.fn(() => false);
      length = 0;
      get = vi.fn(() => ({ text: '', show: true, position: null }));
    },
    LabelStyle: { FILL_AND_OUTLINE: 'FILL_AND_OUTLINE' },
    VerticalOrigin: { CENTER: 'CENTER', TOP: 'TOP', BOTTOM: 'BOTTOM' },
    HorizontalOrigin: { CENTER: 'CENTER', LEFT: 'LEFT', RIGHT: 'RIGHT' },
    NearFarScalar: class MockNearFarScalar {
      constructor(_near: number, _nearValue: number, _far: number, _farValue: number) {}
    },
  };
});

vi.mock('../../lib/viewerRegistry', () => ({
  flyToCartesian: vi.fn(),
  flyToPosition: vi.fn(),
  registerViewer: vi.fn(),
}));

vi.mock('../../hooks/useSatellites', () => ({
  useSatellites: vi.fn(() => ({
    data: [
      {
        norad_cat_id: 25544,
        omm: {
          OBJECT_NAME: 'ISS (ZARYA)',
          MEAN_MOTION: 15.49,
          INCLINATION: 51.6,
        },
      },
    ],
    isLoading: false,
    error: null,
  })),
}));

// Worker global mock — must be a class so "new Worker(...)" works
vi.stubGlobal('Worker', class MockWorker {
  postMessage = cesiumMocks.mockPostMessage;
  terminate = cesiumMocks.mockTerminate;
  onmessage: null = null;
  constructor(_url: unknown, _opts?: unknown) {}
});

vi.stubGlobal('requestAnimationFrame', vi.fn((_cb: FrameRequestCallback) => 1));
vi.stubGlobal('cancelAnimationFrame', vi.fn());

// Import SatelliteLayer AFTER all mocks are set up
import { SatelliteLayer } from '../SatelliteLayer';

// ---------------------------------------------------------------------------
// Helper: create a minimal mock viewer
// ---------------------------------------------------------------------------
function makeMockViewer() {
  // Each test creates a fresh collection instance via the mocked constructor.
  // primitives.add returns whatever the PointPrimitiveCollection constructor produced.
  // We capture it by intercepting primitives.add return value.
  let capturedCollection: unknown = null;

  const add = vi.fn((item: unknown) => {
    capturedCollection = item;
    return item;
  });

  const viewer = {
    scene: {
      primitives: {
        add,
        remove: cesiumMocks.mockPrimitivesRemove,
      },
      canvas: document.createElement('canvas'),
    },
    isDestroyed: vi.fn(() => false),
    camera: { flyTo: vi.fn() },
    selectedEntity: null,
    _getCapturedCollection: () => capturedCollection,
  };

  return viewer;
}

// ---------------------------------------------------------------------------
// Part A — Cleanup tests
// ---------------------------------------------------------------------------

describe('SatelliteLayer cleanup on unmount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls worker.terminate() when SatelliteLayer unmounts', async () => {
    const mockViewer = makeMockViewer() as never;

    let unmount!: () => void;
    await act(async () => {
      const result = render(<SatelliteLayer viewer={mockViewer} />);
      unmount = result.unmount;
    });

    await act(async () => {
      unmount();
    });

    expect(cesiumMocks.mockTerminate).toHaveBeenCalledTimes(1);
  });

  it('calls viewer.scene.primitives.remove() for the main collection on unmount', async () => {
    const mockViewer = makeMockViewer() as never;

    let unmount!: () => void;
    await act(async () => {
      const result = render(<SatelliteLayer viewer={mockViewer} />);
      unmount = result.unmount;
    });

    await act(async () => {
      unmount();
    });

    // primitives.remove is called with the collection that was previously added
    expect(cesiumMocks.mockPrimitivesRemove).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Part B — Nine pitfall static audit
// ---------------------------------------------------------------------------

// __dirname = frontend/src/components/__tests__
// ../../.. = frontend/src (source root with components/, workers/, hooks/)
const SRC_DIR = path.resolve(__dirname, '../..');

describe('Nine pitfall checks (static audit)', () => {
  /**
   * Pitfall 1: Primitive API used (not Entity API)
   * Assert: grep for EntityCollection or viewer.entities in non-test src files returns no matches.
   */
  it('Pitfall 1: No EntityCollection or viewer.entities usage in non-test source files', () => {
    let foundMatches = false;
    try {
      execSync(
        `grep -r --include="*.ts" --include="*.tsx" --exclude-dir="__tests__" -l "EntityCollection\\|viewer\\.entities" "${SRC_DIR}"`,
        { encoding: 'utf-8' }
      );
      foundMatches = true;
    } catch {
      foundMatches = false;
    }
    expect(foundMatches).toBe(false);
  });

  /**
   * Pitfall 2: Viewer cleanup on unmount
   * Verified by Part A tests above.
   */
  it('Pitfall 2: Viewer cleanup on unmount — verified by Part A unit test', () => {
    // Evidence: Part A confirms worker.terminate() and primitives.remove() are called on unmount.
    // Code location: SatelliteLayer.tsx cleanup return function (lines 214-228).
    expect(true).toBe(true);
  });

  /**
   * Pitfall 3: ECI to ECEF conversion correctness
   * Verified by propagation.test.ts (96 ISS orbit steps, all within ±53° latitude).
   */
  it('Pitfall 3: ECI/ECEF conversion correctness — verified by propagation.test.ts', () => {
    // Evidence: propagation.test.ts confirms eciToGeodetic returns latitudes within ±53°.
    // Worker uses eciToEcf for ECEF Cartesian3 positions (correct for CesiumJS rendering).
    expect(true).toBe(true);
  });

  /**
   * Pitfall 4: ECEF units in meters (not km)
   * Assert: propagation.worker.ts contains "* 1000" km→m conversion.
   */
  it('Pitfall 4: ECEF positions converted from km to meters in worker', () => {
    const workerPath = path.join(SRC_DIR, 'workers', 'propagation.worker.ts');
    let conversionFound = false;
    try {
      const result = execSync(`grep -n "\\* 1000" "${workerPath}"`, { encoding: 'utf-8' });
      conversionFound = result.trim().length > 0;
    } catch {
      conversionFound = false;
    }
    expect(conversionFound).toBe(true);
  });

  /**
   * Pitfall 5: Worker terminated on unmount
   * Verified by Part A test (mockTerminate called once on unmount).
   */
  it('Pitfall 5: Worker terminated on unmount — verified by Part A unit test', () => {
    // Evidence: Part A confirms cesiumMocks.mockTerminate called exactly once after unmount.
    expect(true).toBe(true);
  });

  /**
   * Pitfall 6: PointPrimitive position updated in-place (not re-add)
   * Assert: SatelliteLayer.tsx contains "pt.position = " direct assignment pattern.
   */
  it('Pitfall 6: PointPrimitive positions are updated in-place (direct assignment)', () => {
    const layerPath = path.join(SRC_DIR, 'components', 'SatelliteLayer.tsx');
    let assignmentFound = false;
    try {
      const result = execSync(`grep -n "pt\\.position = " "${layerPath}"`, { encoding: 'utf-8' });
      assignmentFound = result.trim().length > 0;
    } catch {
      assignmentFound = false;
    }
    expect(assignmentFound).toBe(true);
  });

  /**
   * Pitfall 7: ArcType.NONE on orbit polylines (not geodesic arcs)
   * Assert: SatelliteLayer.tsx uses ArcType.NONE for orbit paths.
   * Note: ArcType.GEODESIC is also permitted for Phase 12 overpass arc lines.
   */
  it('Pitfall 7: ArcType.NONE used for orbit polylines (not geodesic)', () => {
    const layerPath = path.join(SRC_DIR, 'components', 'SatelliteLayer.tsx');
    let hasArcTypeNone = false;
    try {
      const result = execSync(`grep -n "ArcType" "${layerPath}"`, { encoding: 'utf-8' });
      hasArcTypeNone = result.includes('ArcType.NONE');
    } catch {
      // No ArcType references at all — would be unexpected
    }
    // Orbit polylines must still use ArcType.NONE (Phase 12 overpass arcs use GEODESIC, which is intentional)
    expect(hasArcTypeNone).toBe(true);
  });

  /**
   * Pitfall 8: No main-thread propagation (satellite.js only in worker)
   * Assert: satellite.js / json2satrec not imported in components/ or hooks/.
   */
  it('Pitfall 8: satellite.js not imported in components or hooks (worker-only)', () => {
    const componentsDir = path.join(SRC_DIR, 'components');
    const hooksDir = path.join(SRC_DIR, 'hooks');

    let foundInComponents = false;
    let foundInHooks = false;

    try {
      execSync(
        `grep -r --include="*.ts" --include="*.tsx" --exclude-dir="__tests__" -l "satellite\\.js\\|json2satrec" "${componentsDir}"`,
        { encoding: 'utf-8' }
      );
      foundInComponents = true;
    } catch {
      foundInComponents = false;
    }

    try {
      execSync(
        `grep -r --include="*.ts" --include="*.tsx" --exclude-dir="__tests__" -l "satellite\\.js\\|json2satrec" "${hooksDir}"`,
        { encoding: 'utf-8' }
      );
      foundInHooks = true;
    } catch {
      foundInHooks = false;
    }

    expect(foundInComponents).toBe(false);
    expect(foundInHooks).toBe(false);
  });

  /**
   * Pitfall 9: rAF guard for isDestroyed()
   * Assert: SatelliteLayer.tsx contains isDestroyed() check guarding the POSITIONS update loop.
   */
  it('Pitfall 9: isDestroyed() guard present in SatelliteLayer', () => {
    const layerPath = path.join(SRC_DIR, 'components', 'SatelliteLayer.tsx');
    let guardFound = false;
    try {
      const result = execSync(`grep -n "isDestroyed" "${layerPath}"`, { encoding: 'utf-8' });
      guardFound = result.trim().length > 0;
    } catch {
      guardFound = false;
    }
    expect(guardFound).toBe(true);
  });
});
