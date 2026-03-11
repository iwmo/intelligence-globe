import { describe, it, expect } from 'vitest';
import landmarksData from '../../data/landmarks.json';

describe('landmarks.json — schema validation', () => {
  it('has exactly 5 landmarks', () => {
    expect(landmarksData.landmarks).toHaveLength(5);
  });

  it('each landmark has required fields: id, name, shortcut, lat, lon, altMeters', () => {
    for (const lm of landmarksData.landmarks) {
      expect(lm).toHaveProperty('id');
      expect(lm).toHaveProperty('name');
      expect(lm).toHaveProperty('shortcut');
      expect(lm).toHaveProperty('lat');
      expect(lm).toHaveProperty('lon');
      expect(lm).toHaveProperty('altMeters');
    }
  });

  it('Q/W/E/R/T shortcuts each appear exactly once', () => {
    const required = ['Q', 'W', 'E', 'R', 'T'];
    const shortcuts = landmarksData.landmarks.map(lm => lm.shortcut);
    for (const key of required) {
      expect(shortcuts.filter(s => s === key)).toHaveLength(1);
    }
  });

  it('all altMeters values are below 200,000 (city-scale, not global)', () => {
    for (const lm of landmarksData.landmarks) {
      expect(lm.altMeters).toBeLessThan(200_000);
    }
  });
});
