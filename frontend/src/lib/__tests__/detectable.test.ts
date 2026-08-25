import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Cartesian3 } from 'cesium';
import { clearEntityPositions, setEntityPosition } from '../entityPositions';
import { getDetectableObjects } from '../detectable';

vi.mock('cesium', () => ({
  Cartesian3: {
    clone: (p: { x: number; y: number; z: number }) => ({ ...p }),
  },
}));

const layersOn = { satellites: true, aircraft: true, militaryAircraft: true, ships: true };

describe('getDetectableObjects', () => {
  beforeEach(() => {
    clearEntityPositions();
  });

  it('returns registered contacts on visible layers only', () => {
    setEntityPosition('aircraft', 'abc', { x: 1, y: 2, z: 3 } as unknown as Cartesian3, { label: 'QTR1' });
    setEntityPosition('ship', 'm1', { x: 4, y: 5, z: 6 } as unknown as Cartesian3, { label: 'SHIP' });
    const all = getDetectableObjects(layersOn);
    expect(all.map(d => d.id).sort()).toEqual(['abc', 'm1']);
    const airOnly = getDetectableObjects({ ...layersOn, ships: false });
    expect(airOnly).toHaveLength(1);
    expect(airOnly[0].label).toBe('QTR1');
  });

  it('puts the tracked contact first and caps the list', () => {
    for (let i = 0; i < 5; i++) {
      setEntityPosition('aircraft', `id${i}`, { x: i, y: 0, z: 0 } as unknown as Cartesian3);
    }
    const rows = getDetectableObjects(layersOn, { kind: 'aircraft', id: 'id3' }, 3);
    expect(rows).toHaveLength(3);
    expect(rows[0].id).toBe('id3');
    expect(rows[0].tracked).toBe(true);
  });
});
