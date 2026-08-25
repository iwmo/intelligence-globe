import { Activity, RefreshCw } from 'lucide-react';
import { queryClient } from '../../lib/queryClient';
import { swapMapType } from '../../lib/viewerRegistry';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  deriveAggregateHealth,
  useSourceHealthStore,
  type SourceHealthStatus,
  type SourceId,
} from '../../store/useSourceHealthStore';

const SOURCE_LABELS: Record<SourceId, string> = {
  map: 'Map surface',
  satellites: 'Satellites',
  aircraft: 'Aircraft',
  militaryAircraft: 'Military',
  ships: 'Ships',
  gpsJamming: 'GPS jamming',
  streetTraffic: 'Traffic',
  gdelt: 'GDELT',
  earthquakes: 'Earthquakes',
  fires: 'Fires',
  launches: 'Launches',
  installations: 'Installations',
};

const STATUS_LABELS: Record<SourceHealthStatus, string> = {
  off: 'OFF',
  connecting: 'CONNECTING',
  live: 'LIVE',
  stale: 'STALE',
  empty: 'EMPTY',
  error: 'ERROR',
  unavailable: 'UNAVAILABLE',
};

const SOURCE_QUERY_KEYS: Partial<Record<SourceId, string>> = {
  satellites: 'satellites',
  aircraft: 'aircraft',
  militaryAircraft: 'military-aircraft',
  ships: 'ships',
  gpsJamming: 'gps-jamming',
  streetTraffic: 'traffic-flow',
  gdelt: 'gdelt-events',
  earthquakes: 'earthquakes',
  fires: 'fires',
  launches: 'launches',
  installations: 'installations',
};

function formatLastSuccess(value: string | null): string {
  if (!value) return 'No successful response yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Last success unavailable';
  return `Last success ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })}`;
}

export function SystemHealthBadge() {
  const sources = useSourceHealthStore(s => s.sources);
  const aggregate = deriveAggregateHealth(sources);
  const visibleSources = (Object.entries(sources) as Array<[SourceId, (typeof sources)[SourceId]]>)
    .filter(([, health]) => health.status !== 'off');

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className={`command-strip__health command-strip__health--${aggregate}`}
            aria-label={`System status: ${aggregate}`}
          />
        }
      >
        <Activity aria-hidden="true" />
        <span className="command-strip__health-label" aria-live="polite">{aggregate.toUpperCase()}</span>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="system-health-popover">
        <div className="system-health-popover__header">
          <span>System health</span>
          <span>{aggregate.toUpperCase()}</span>
        </div>
        <div className="system-health-popover__sources">
          {visibleSources.map(([source, health]) => (
            <div className="system-health-popover__source" key={source}>
              <div>
                <strong>{SOURCE_LABELS[source]}</strong>
                {health.reason && <span>{health.reason}</span>}
                <span className="system-health-popover__timestamp">
                  {formatLastSuccess(health.lastSuccessAt)}
                </span>
              </div>
              <div className="system-health-popover__status">
                <div className={`source-state source-state--${health.status}`}>
                  {STATUS_LABELS[health.status]}
                </div>
                {(health.status === 'error' || health.status === 'stale' || health.status === 'unavailable') && (
                  <button
                    type="button"
                    className="system-health-popover__retry"
                    onClick={() => void retrySource(source)}
                    aria-label={`Retry ${SOURCE_LABELS[source]}`}
                  >
                    <RefreshCw aria-hidden="true" />
                    Retry
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

async function retrySource(source: SourceId): Promise<void> {
  useSourceHealthStore.getState().setSourceHealth(source, {
    status: 'connecting',
    reason: null,
  });
  if (source === 'map') {
    await swapMapType(useAppStore.getState().mapType);
    return;
  }
  const key = SOURCE_QUERY_KEYS[source];
  if (key) {
    await queryClient.invalidateQueries({ queryKey: [key] });
  }
}
