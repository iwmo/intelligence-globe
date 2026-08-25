import { useQuery } from '@tanstack/react-query';

export interface WeatherNow {
  temperature_c: number | null;
  wind_kn: number | null;
  wind_dir: number | null;
  weather_code: number | null;
  time: string | null;
}

/** Snap to 0.5° so camera jitter does not spam Open-Meteo. */
export function weatherQueryPoint(
  lat: number | null,
  lon: number | null,
): [number, number] | [null, null] {
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return [null, null];
  }
  return [Math.round(lat * 2) / 2, Math.round(lon * 2) / 2];
}

export function useWeather(lat: number | null, lon: number | null) {
  return useQuery<WeatherNow>({
    queryKey: ['weather', lat, lon],
    queryFn: async () => {
      const res = await fetch(`/api/weather/?lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
      return res.json() as Promise<WeatherNow>;
    },
    enabled: lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon),
    staleTime: 600_000,
  });
}
