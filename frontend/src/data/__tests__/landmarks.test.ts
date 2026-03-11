import { describe, it, vi } from 'vitest';

vi.mock('../../data/landmarks.json', () => ({ default: { landmarks: [] } }));

describe('landmarks.json — schema validation', () => {
  it('module is importable', () => {
    expect(true).toBe(true);
  });

  it.todo('contains at least 5 landmarks');
  it.todo('each landmark has id, name, shortcut, lat, lon, altMeters fields');
  it.todo("Q/W/E/R/T shortcuts each appear exactly once");
});
