import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';

export interface Locality {
  label: string;
  provider: string;
}

export function useLocality() {
  const bbox = useAppStore(s => s.viewportBbox);
  const lat = bbox ? (bbox.minLat + bbox.maxLat) / 2 : null;
  const lon = bbox ? (bbox.minLon + bbox.maxLon) / 2 : null;
  const span = bbox ? Math.max(bbox.maxLat - bbox.minLat, bbox.maxLon - bbox.minLon) : Infinity;
  const closeEnough = span < 2;

  return useQuery<Locality>({
    queryKey: ['locality', lat?.toFixed(2), lon?.toFixed(2)],
    queryFn: async () => {
      const res = await fetch(`/api/places/reverse?lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error('reverse geocode');
      return res.json() as Promise<Locality>;
    },
    enabled: closeEnough && lat != null && lon != null,
    staleTime: 180_000,
  });
}
