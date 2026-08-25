import { useEffect } from 'react';
import type { Query } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { useAppStore } from '../store/useAppStore';
import {
  useSourceHealthStore,
  type SourceHealth,
  type SourceId,
} from '../store/useSourceHealthStore';

const QUERY_SOURCE: Record<string, SourceId> = {
  satellites: 'satellites',
  aircraft: 'aircraft',
  'military-aircraft': 'militaryAircraft',
  ships: 'ships',
  'gps-jamming': 'gpsJamming',
  'traffic-flow': 'streetTraffic',
  'gdelt-events': 'gdelt',
  earthquakes: 'earthquakes',
  fires: 'fires',
  launches: 'launches',
  installations: 'installations',
};

const LAYER_SOURCE: Partial<Record<keyof ReturnType<typeof getLayers>, SourceId>> = {
  satellites: 'satellites',
  aircraft: 'aircraft',
  militaryAircraft: 'militaryAircraft',
  ships: 'ships',
  gpsJamming: 'gpsJamming',
  streetTraffic: 'streetTraffic',
  gdelt: 'gdelt',
  earthquakes: 'earthquakes',
  fires: 'fires',
  launches: 'launches',
  installations: 'installations',
};

function getLayers() {
  return useAppStore.getState().layers;
}

function isSourceEnabled(source: SourceId): boolean {
  if (source === 'map') return true;
  const entry = Object.entries(LAYER_SOURCE).find(([, value]) => value === source);
  if (!entry) return false;
  return getLayers()[entry[0] as keyof ReturnType<typeof getLayers>];
}

function dataIsEmpty(data: unknown): boolean {
  if (Array.isArray(data)) return data.length === 0;
  if (!data || typeof data !== 'object') return false;

  const value = data as Record<string, unknown>;
  for (const key of ['events', 'cells', 'launches', 'samples']) {
    if (Array.isArray(value[key])) return value[key].length === 0;
  }
  return false;
}

function unavailableReason(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const value = data as Record<string, unknown>;
  if (value.available !== false) return null;
  for (const key of ['reason', 'message', 'detail']) {
    if (typeof value[key] === 'string' && value[key].trim()) return value[key];
  }
  return 'Source is not configured or currently unavailable';
}

function dataContainsStaleRecords(data: unknown): boolean {
  const records = Array.isArray(data)
    ? data
    : data && typeof data === 'object'
      ? Object.values(data as Record<string, unknown>).find(Array.isArray)
      : null;

  if (!Array.isArray(records)) return false;
  return records.some(record => {
    if (!record || typeof record !== 'object') return false;
    const row = record as Record<string, unknown>;
    return row.is_stale === true || row.source_is_stale === true;
  });
}

export function healthFromQuery(query: Query): SourceHealth {
  const { status, fetchStatus, data, dataUpdatedAt, error } = query.state;

  if (status === 'error') {
    return {
      status: 'error',
      lastSuccessAt: dataUpdatedAt > 0 ? new Date(dataUpdatedAt).toISOString() : null,
      reason: error instanceof Error ? error.message : 'Source request failed',
    };
  }

  if (status === 'pending' || (fetchStatus === 'fetching' && dataUpdatedAt === 0)) {
    return {
      status: 'connecting',
      lastSuccessAt: null,
      reason: null,
    };
  }

  const lastSuccessAt = dataUpdatedAt > 0 ? new Date(dataUpdatedAt).toISOString() : null;
  if (!lastSuccessAt) {
    return { status: 'connecting', lastSuccessAt: null, reason: null };
  }
  const unavailable = unavailableReason(data);
  if (unavailable) {
    return { status: 'unavailable', lastSuccessAt, reason: unavailable };
  }
  if (dataContainsStaleRecords(data)) {
    return { status: 'stale', lastSuccessAt, reason: 'Source returned stale records' };
  }
  if (dataIsEmpty(data)) {
    return { status: 'empty', lastSuccessAt, reason: null };
  }
  return { status: 'live', lastSuccessAt, reason: null };
}

function syncQuery(query: Query): void {
  const rootKey = String(query.queryKey[0] ?? '');
  const source = QUERY_SOURCE[rootKey];
  if (!source) return;

  const setSourceHealth = useSourceHealthStore.getState().setSourceHealth;
  if (!isSourceEnabled(source)) {
    setSourceHealth(source, { status: 'off', reason: null });
    return;
  }
  setSourceHealth(source, healthFromQuery(query));
}

function syncLayerVisibility(): void {
  const { setSourceHealth, sources } = useSourceHealthStore.getState();
  for (const source of Object.values(LAYER_SOURCE)) {
    if (!source) continue;
    const enabled = isSourceEnabled(source);
    if (!enabled) {
      setSourceHealth(source, { status: 'off', reason: null });
    } else if (sources[source].status === 'off') {
      setSourceHealth(source, {
        status: 'connecting',
        reason: null,
      });
    }
  }

  for (const query of queryClient.getQueryCache().getAll()) {
    syncQuery(query);
  }
}

export function useSourceHealthSync(): void {
  useEffect(() => {
    syncLayerVisibility();

    const unsubscribeQueries = queryClient.getQueryCache().subscribe(event => {
      if (event.type !== 'removed') syncQuery(event.query);
    });
    const unsubscribeLayers = useAppStore.subscribe((state, previous) => {
      if (state.layers !== previous.layers) syncLayerVisibility();
    });

    return () => {
      unsubscribeQueries();
      unsubscribeLayers();
    };
  }, []);
}
