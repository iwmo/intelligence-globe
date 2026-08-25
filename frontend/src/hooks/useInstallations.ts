import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';

export interface Installation {
  id: number;
  lat: number;
  lon: number;
  name: string;
  kind: string;
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const MAX_SPAN_DEG = 10;
const MAX_ROWS = 250;

function spanDeg(bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null): number {
  if (!bbox) return Infinity;
  return Math.max(bbox.maxLat - bbox.minLat, bbox.maxLon - bbox.minLon);
}

const QUERY = `
[out:json][timeout:20];
(
  nwr["aeroway"="aerodrome"]({{bbox}});
  nwr["military"="airfield"]({{bbox}});
  nwr["power"="plant"]({{bbox}});
  nwr["waterway"="dam"]({{bbox}});
  nwr["amenity"="prison"]({{bbox}});
  nwr["telecom"="data_center"]({{bbox}});
  nwr["building"="data_center"]({{bbox}});
);
out center tags 250;
`.trim();

function kindOf(tags: Record<string, string> | undefined): string {
  if (!tags) return 'site';
  if (tags.aeroway === 'aerodrome' || tags.military === 'airfield') return 'airfield';
  if (tags.power === 'plant') return 'plant';
  if (tags.waterway === 'dam') return 'dam';
  if (tags.telecom === 'data_center' || tags.building === 'data_center') return 'datacenter';
  if (tags.amenity === 'prison') return 'prison';
  return 'site';
}

export async function fetchInstallations(
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  fetcher: typeof fetch = fetch,
): Promise<Installation[]> {
  const q = QUERY.replaceAll('{{bbox}}', `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`);
  const res = await fetcher(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(q)}`,
  });
  if (!res.ok) throw new Error(`Overpass installations failed: ${res.status}`);
  const data = await res.json() as {
    elements?: Array<{
      id: number;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    }>;
  };
  const rows: Installation[] = [];
  for (const el of data.elements ?? []) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    rows.push({
      id: el.id,
      lat,
      lon,
      name: el.tags?.name || el.tags?.ref || `#${el.id}`,
      kind: kindOf(el.tags),
    });
    if (rows.length >= MAX_ROWS) break;
  }
  return rows;
}

export function useInstallations() {
  const replayMode = useAppStore(s => s.replayMode);
  const bbox = useAppStore(s => s.viewportBbox);
  const visible = useAppStore(s => s.layers.installations);
  const clipped = spanDeg(bbox) <= MAX_SPAN_DEG;
  const effective = replayMode === 'live' && visible && clipped ? bbox : null;

  return useQuery({
    queryKey: ['installations', effective],
    queryFn: async () => {
      if (!effective) return [] as Installation[];
      return fetchInstallations(effective);
    },
    staleTime: 300_000,
    refetchInterval: replayMode === 'live' && visible ? 300_000 : false,
  });
}

export function installationsViewportOk(bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null): boolean {
  return spanDeg(bbox) <= MAX_SPAN_DEG;
}
