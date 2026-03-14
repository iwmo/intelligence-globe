import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Cesium mock — vi.mock is hoisted, so all references inside factory must be
// inline (no references to variables declared outside the factory block).
// ---------------------------------------------------------------------------

// We track entities.add calls via a module-level spy that the mock wires up.
const mockEntitiesAdd = vi.fn();
const mockEntitiesRemoveAll = vi.fn();

vi.mock('cesium', () => {
  // All class definitions must be inside the factory to avoid hoisting issues.
  class MockCustomDataSource {
    entities = {
      add: mockEntitiesAdd,
      removeAll: mockEntitiesRemoveAll,
    };
    clustering: unknown = null;
    show = true;
    isDestroyed = vi.fn(() => false);
  }

  class MockEntityCluster {
    constructor(_opts?: unknown) {}
  }

  class MockEntity {
    id?: string;
    position?: unknown;
    point?: unknown;
    constructor(opts?: { id?: string; position?: unknown; point?: unknown }) {
      if (opts) {
        this.id = opts.id;
        this.position = opts.position;
        this.point = opts.point;
      }
    }
  }

  class MockPointGraphics {
    color?: unknown;
    pixelSize?: number;
    outlineColor?: unknown;
    outlineWidth?: number;
    show?: boolean;
    constructor(opts?: {
      color?: unknown;
      pixelSize?: number;
      outlineColor?: unknown;
      outlineWidth?: number;
      show?: boolean;
    }) {
      if (opts) {
        this.color = opts.color;
        this.pixelSize = opts.pixelSize;
        this.outlineColor = opts.outlineColor;
        this.outlineWidth = opts.outlineWidth;
        this.show = opts.show;
      }
    }
  }

  return {
    CustomDataSource: MockCustomDataSource,
    EntityCluster: MockEntityCluster,
    Entity: MockEntity,
    PointGraphics: MockPointGraphics,
    Cartesian3: { fromDegrees: vi.fn((_lon: number, _lat: number) => ({ lon: _lon, lat: _lat })) },
    Color: {
      fromCssColorString: vi.fn((s: string) => ({ css: s })),
      BLACK: { withAlpha: vi.fn((a: number) => ({ black: true, alpha: a })) },
      WHITE: { withAlpha: vi.fn((a: number) => ({ white: true, alpha: a })) },
    },
  };
});

// ---------------------------------------------------------------------------
// Store mock — default: layers.gdelt=true, all quad classes active
// ---------------------------------------------------------------------------

let mockGdeltQuadClassFilter = [1, 2, 3, 4];
let mockLayersGdelt = true;

vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      layers: { gdelt: mockLayersGdelt },
      gdeltQuadClassFilter: mockGdeltQuadClassFilter,
      selectedGdeltEventId: null,
      setSelectedGdeltEventId: vi.fn(),
      replayMode: 'live',
      viewportBbox: null,
    })
  ),
}));

// ---------------------------------------------------------------------------
// useGdeltEvents mock — returns 2 events by default
// ---------------------------------------------------------------------------

const twoEvents = [
  {
    global_event_id: 1001,
    occurred_at: '2024-01-01T00:00:00Z',
    discovered_at: null,
    latitude: 10.0,
    longitude: 20.0,
    quad_class: 1,
    goldstein_scale: 3.0,
    event_code: '010',
    actor1_name: 'ActorA',
    actor2_name: null,
    source_url: 'https://example.com',
    avg_tone: 2.5,
    num_mentions: 5,
    source_is_stale: false,
  },
  {
    global_event_id: 1002,
    occurred_at: '2024-01-01T01:00:00Z',
    discovered_at: null,
    latitude: 30.0,
    longitude: 40.0,
    quad_class: 3,
    goldstein_scale: -2.0,
    event_code: '190',
    actor1_name: 'ActorB',
    actor2_name: 'ActorC',
    source_url: null,
    avg_tone: -1.5,
    num_mentions: 3,
    source_is_stale: false,
  },
];

let mockGdeltData: typeof twoEvents | [] = twoEvents;

vi.mock('../../hooks/useGdeltEvents', () => ({
  useGdeltEvents: vi.fn(() => ({ data: mockGdeltData, isLoading: false })),
}));

// ---------------------------------------------------------------------------
// Viewer factory
// ---------------------------------------------------------------------------

function makeViewer() {
  return {
    isDestroyed: vi.fn(() => false),
    dataSources: {
      add: vi.fn(),
      remove: vi.fn(),
    },
  };
}

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------
import { GdeltLayer } from '../GdeltLayer';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockEntitiesAdd.mockReset();
  mockEntitiesRemoveAll.mockReset();
  mockGdeltQuadClassFilter = [1, 2, 3, 4];
  mockLayersGdelt = true;
  mockGdeltData = twoEvents;
});

describe('GdeltLayer — GDELT-05 smoke', () => {
  it('renders null without crash when viewer is null', () => {
    const { container } = render(<GdeltLayer viewer={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders null to the DOM (no DOM nodes) when viewer is provided', () => {
    const viewer = makeViewer();
    const { container } = render(<GdeltLayer viewer={viewer as never} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('GdeltLayer — GDELT-05 entity creation', () => {
  it('adds one entity per event to dataSource.entities', () => {
    const viewer = makeViewer();
    render(<GdeltLayer viewer={viewer as never} />);
    expect(mockEntitiesAdd).toHaveBeenCalledTimes(2);
  });

  it('entity IDs follow the gdelt:{global_event_id} pattern', () => {
    const viewer = makeViewer();
    render(<GdeltLayer viewer={viewer as never} />);
    const ids = mockEntitiesAdd.mock.calls.map(
      (c: [{ id?: string }]) => c[0].id
    );
    expect(ids).toContain('gdelt:1001');
    expect(ids).toContain('gdelt:1002');
  });

  it('calls dataSource.entities.removeAll before adding entities', () => {
    const viewer = makeViewer();
    render(<GdeltLayer viewer={viewer as never} />);
    const removeAllOrder = mockEntitiesRemoveAll.mock.invocationCallOrder[0];
    const firstAddOrder = mockEntitiesAdd.mock.invocationCallOrder[0];
    expect(removeAllOrder).toBeLessThan(firstAddOrder);
  });
});

describe('GdeltLayer — GDELT-07 QuadClass filter', () => {
  it('entity.point.show is false for quad_class not in gdeltQuadClassFilter', () => {
    // quad_class 3 (event 1002) must be hidden when filter is [1, 2]
    mockGdeltQuadClassFilter = [1, 2];
    const viewer = makeViewer();
    render(<GdeltLayer viewer={viewer as never} />);

    const calls = mockEntitiesAdd.mock.calls as [{ id?: string; point?: { show?: boolean } }][];
    const entity1002 = calls.find(c => c[0].id === 'gdelt:1002')?.[0];
    expect(entity1002).toBeDefined();
    expect(entity1002!.point?.show).toBe(false);
  });

  it('entity.point.show is true for quad_class in gdeltQuadClassFilter', () => {
    // quad_class 1 (event 1001) must be visible when filter is [1, 2]
    mockGdeltQuadClassFilter = [1, 2];
    const viewer = makeViewer();
    render(<GdeltLayer viewer={viewer as never} />);

    const calls = mockEntitiesAdd.mock.calls as [{ id?: string; point?: { show?: boolean } }][];
    const entity1001 = calls.find(c => c[0].id === 'gdelt:1001')?.[0];
    expect(entity1001).toBeDefined();
    expect(entity1001!.point?.show).toBe(true);
  });

  it('dataSource.show is false when layers.gdelt is false', () => {
    mockLayersGdelt = false;
    const viewer = makeViewer();

    // Capture the CustomDataSource instance passed to viewer.dataSources.add
    let capturedDs: { show: boolean } | null = null;
    viewer.dataSources.add.mockImplementation((ds: { show: boolean }) => {
      capturedDs = ds;
    });

    render(<GdeltLayer viewer={viewer as never} />);

    expect(capturedDs).not.toBeNull();
    // After Effect 2 sets dataSource.show = false, the captured ref should reflect it
    expect(capturedDs!.show).toBe(false);
  });
});
