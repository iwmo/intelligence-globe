import { useState, useEffect, useRef, useCallback } from 'react';
import { Viewer, Math as CesiumMath } from 'cesium';

export interface RoadSegment {
  coordinates: [number, number][]; // [lon, lat] pairs
}

export interface StreetTrafficState {
  roads: RoadSegment[] | null;
  isLoading: boolean;
  error: string | null;
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const SHOW_THRESHOLD = 500_000; // layer visible below 500 km
const FETCH_THRESHOLD = 100_000; // road fetch only below 100 km
const DEBOUNCE_MS = 2_000;

async function fetchRoadsForViewport(
  south: number,
  west: number,
  north: number,
  east: number
): Promise<RoadSegment[]> {
  const query = `[out:json][timeout:25];\nway["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential)$"](${south},${west},${north},${east});\nout geom;`;

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) {
    throw new Error(`Overpass API error: ${res.status}`);
  }

  const data = await res.json();

  // Inline parser — do NOT import osmtogeojson (installed in Plan 05)
  const roads: RoadSegment[] = [];
  if (Array.isArray(data.elements)) {
    for (const element of data.elements) {
      if (
        element.type === 'way' &&
        Array.isArray(element.geometry) &&
        element.geometry.length >= 2
      ) {
        const coordinates: [number, number][] = element.geometry.map(
          (node: { lat: number; lon: number }) => [node.lon, node.lat] as [number, number]
        );
        roads.push({ coordinates });
      }
    }
  }

  return roads;
}

export function useStreetTraffic(viewer: Viewer | null): StreetTrafficState {
  const [roads, setRoads] = useState<RoadSegment[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const lastFetchTimeRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleMoveEnd = useCallback(async () => {
    if (!viewer || viewer.isDestroyed()) return;

    const altM = viewer.camera.positionCartographic.height;

    if (altM > SHOW_THRESHOLD) {
      // Above 500 km — layer hidden, no roads needed
      setRoads(null);
      return;
    }

    if (altM > FETCH_THRESHOLD) {
      // Between 100 km and 500 km — layer visible gate but no road fetch
      // (avoid Overpass timeout on wide viewports)
      setRoads(null);
      return;
    }

    // Below 100 km — fetch roads for viewport
    const now = Date.now();
    if (now - lastFetchTimeRef.current < DEBOUNCE_MS) {
      return;
    }
    lastFetchTimeRef.current = now;

    const rect = viewer.camera.computeViewRectangle();
    if (!rect) return;

    const west = CesiumMath.toDegrees(rect.west);
    const south = CesiumMath.toDegrees(rect.south);
    const east = CesiumMath.toDegrees(rect.east);
    const north = CesiumMath.toDegrees(rect.north);

    // Cancel any in-flight fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const fetchedRoads = await fetchRoadsForViewport(south, west, north, east);
      setRoads(fetchedRoads);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unknown fetch error');
    } finally {
      setIsLoading(false);
    }
  }, [viewer]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const moveEndEvent = viewer.camera.moveEnd;
    moveEndEvent.addEventListener(handleMoveEnd);

    return () => {
      moveEndEvent.removeEventListener(handleMoveEnd);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [viewer, handleMoveEnd]);

  return { roads, isLoading, error };
}
