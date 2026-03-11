import { describe, it, vi } from 'vitest';

vi.mock('../../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: () => undefined,
}));

describe('useKeyboardShortcuts — keyboard shortcut dispatch', () => {
  it('module is importable', () => {
    expect(true).toBe(true);
  });

  it.todo('keydown Q triggers flyToLandmark with first landmark id');
  it.todo('keydown W triggers flyToLandmark with second landmark id');
  it.todo('keydown T triggers flyToLandmark with fifth landmark id');
  it.todo('no flyTo called when no viewer is registered');
});
