import { describe, it, expect, vi } from 'vitest';

vi.mock('cesium', () => ({
  CustomDataSource: class {
    entities = { add: vi.fn(), removeAll: vi.fn() };
    clustering = null;
    show = true;
    isDestroyed = vi.fn(() => false);
  },
  EntityCluster: class {},
  Entity: class {},
  PointGraphics: class {},
  Cartesian3: { fromDegrees: vi.fn(() => ({})) },
  Color: {
    fromCssColorString: vi.fn(() => ({})),
    BLACK: { withAlpha: vi.fn(() => ({})) },
    WHITE: {},
  },
}));

vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) => selector({
    layers: { gdelt: true },
    gdeltQuadClassFilter: [1, 2, 3, 4],
    selectedGdeltEventId: null,
    setSelectedGdeltEventId: vi.fn(),
    replayMode: 'live',
    viewportBbox: null,
  })),
}));

vi.mock('../../hooks/useGdeltEvents', () => ({
  useGdeltEvents: vi.fn(() => ({ data: [], isLoading: false })),
}));

// Wave 0 stub: GdeltLayer.tsx does not exist yet — smoke test is skipped until Plan 35-03
describe.skip('GdeltLayer — GDELT-05 smoke', () => {
  it('renders null without crash when viewer is null', () => {
    expect(true).toBe(true);
  });
});

describe('GdeltLayer — GDELT-07 QuadClass filter', () => {
  it.todo('entities outside gdeltQuadClassFilter are hidden (entity.show = false)');
  it.todo('entities matching gdeltQuadClassFilter are visible (entity.show = true)');
  it.todo('dataSource.show = false when layers.gdelt is false');
});
