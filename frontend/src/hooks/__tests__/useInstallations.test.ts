import { describe, it, expect } from 'vitest';
import { fetchInstallations, installationsViewportOk } from '../useInstallations';

describe('installations viewport cull', () => {
  it('rejects globe-scale bboxes', () => {
    expect(installationsViewportOk({ minLat: -80, maxLat: 80, minLon: -170, maxLon: 170 })).toBe(false);
    expect(installationsViewportOk({ minLat: 37, maxLat: 38, minLon: -123, maxLon: -121 })).toBe(true);
  });
});

describe('fetchInstallations', () => {
  it('parses Overpass nodes and caps kinds', async () => {
    const fetcher = async () => new Response(JSON.stringify({
      elements: [
        { id: 1, lat: 37.6, lon: -122.3, tags: { aeroway: 'aerodrome', name: 'SFO' } },
        { id: 2, center: { lat: 37.7, lon: -122.2 }, tags: { power: 'plant' } },
      ],
    }), { status: 200 });
    const rows = await fetchInstallations(
      { minLat: 37, maxLat: 38, minLon: -123, maxLon: -121 },
      fetcher as unknown as typeof fetch,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: 'SFO', kind: 'airfield' });
    expect(rows[1].kind).toBe('plant');
  });
});
