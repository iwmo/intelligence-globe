import { useState, useEffect, useRef, useCallback } from 'react';
import { Viewer, Math as CesiumMath } from 'cesium';
import { useAppStore } from '../store/useAppStore';

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
const DEBOUNCE_MS = 3_000;

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

export function useStreetTraffic(viewer: Viewer | null, layerVisible: boolean): StreetTrafficState {
  const [roads, setRoads] = useState<RoadSegment[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const replayMode    = useAppStore(s => s.replayMode);
  const replayModeRef = useRef(replayMode);
  replayModeRef.current = replayMode;

  const layerVisibleRef = useRef(layerVisible);
  layerVisibleRef.current = layerVisible;

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleMoveEnd = useCallback(() => {
    if (!viewer || viewer.isDestroyed()) return;
    if (!layerVisibleRef.current) return; // don't fetch when layer is off
    if (replayModeRef.current === 'playback') return;  // LAYR-04: no road fetch during playback

    const altM = viewer.camera.positionCartographic.height;
    if (altM > SHOW_THRESHOLD) {
      setRoads(null);
      return;
    }
    if (altM > FETCH_THRESHOLD) return; // between 100–500 km: keep existing roads

    // Cancel pending debounce and schedule a new one
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      debounceTimerRef.current = null;
      if (!viewer || viewer.isDestroyed() || !layerVisibleRef.current) return;

      const rect = viewer.camera.computeViewRectangle();
      if (!rect) return;

      const west = CesiumMath.toDegrees(rect.west);
      const south = CesiumMath.toDegrees(rect.south);
      const east = CesiumMath.toDegrees(rect.east);
      const north = CesiumMath.toDegrees(rect.north);

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
    }, DEBOUNCE_MS);
  }, [viewer]);

  // Clear roads when layer is hidden
  useEffect(() => {
    if (!layerVisible) {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setRoads(null);
    }
  }, [layerVisible]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const moveEndEvent = viewer.camera.moveEnd;
    moveEndEvent.addEventListener(handleMoveEnd);

    return () => {
      moveEndEvent.removeEventListener(handleMoveEnd);
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [viewer, handleMoveEnd]);

  return { roads, isLoading, error };
}
