import { create } from 'zustand';

export type SourceHealthStatus =
  | 'off'
  | 'connecting'
  | 'live'
  | 'stale'
  | 'empty'
  | 'error'
  | 'unavailable';

export type SourceId =
  | 'map'
  | 'satellites'
  | 'aircraft'
  | 'militaryAircraft'
  | 'ships'
  | 'gpsJamming'
  | 'streetTraffic'
  | 'gdelt'
  | 'earthquakes'
  | 'fires'
  | 'launches'
  | 'installations';

export interface SourceHealth {
  status: SourceHealthStatus;
  lastSuccessAt: string | null;
  reason: string | null;
}

export type AggregateHealth = 'connecting' | 'live' | 'degraded';

const SOURCE_IDS: SourceId[] = [
  'map',
  'satellites',
  'aircraft',
  'militaryAircraft',
  'ships',
  'gpsJamming',
  'streetTraffic',
  'gdelt',
  'earthquakes',
  'fires',
  'launches',
  'installations',
];

function initialSources(): Record<SourceId, SourceHealth> {
  return Object.fromEntries(
    SOURCE_IDS.map(source => [
      source,
      {
        status: source === 'map' ? 'connecting' : 'off',
        lastSuccessAt: null,
        reason: null,
      },
    ]),
  ) as Record<SourceId, SourceHealth>;
}

export function deriveAggregateHealth(sources: Record<SourceId, SourceHealth>): AggregateHealth {
  const active = SOURCE_IDS
    .map(source => sources[source])
    .filter(health => health.status !== 'off');

  if (active.some(health =>
    health.status === 'error' ||
    health.status === 'stale' ||
    health.status === 'unavailable'
  )) {
    return 'degraded';
  }

  if (active.some(health => health.status === 'connecting')) {
    const hasConfirmedSource = active.some(health =>
      health.status === 'live' || health.status === 'empty'
    );
    return hasConfirmedSource ? 'degraded' : 'connecting';
  }

  return active.length > 0 ? 'live' : 'connecting';
}

interface SourceHealthState {
  sources: Record<SourceId, SourceHealth>;
  setSourceHealth: (source: SourceId, update: Partial<SourceHealth>) => void;
  resetSourceHealth: () => void;
}

export const useSourceHealthStore = create<SourceHealthState>((set) => ({
  sources: initialSources(),
  setSourceHealth: (source, update) => set(state => {
    const current = state.sources[source];
    const next = { ...current, ...update };
    if (
      next.status === current.status &&
      next.lastSuccessAt === current.lastSuccessAt &&
      next.reason === current.reason
    ) {
      return state;
    }
    return {
      sources: {
        ...state.sources,
        [source]: next,
      },
    };
  }),
  resetSourceHealth: () => set({ sources: initialSources() }),
}));
