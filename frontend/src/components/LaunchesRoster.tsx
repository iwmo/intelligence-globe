import { useLaunches } from '../hooks/useLaunches';
import { flyToLandmark } from '../lib/viewerRegistry';
import { useAppStore } from '../store/useAppStore';

export function LaunchesRoster() {
  const { data, isLoading } = useLaunches();
  const setLayerVisible = useAppStore(s => s.setLayerVisible);
  const setAscentEstimate = useAppStore(s => s.setAscentEstimate);
  const clearTrackedEntity = useAppStore(s => s.clearTrackedEntity);

  return (
    <div style={{ padding: 10, fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
      <div style={{ fontSize: 9, letterSpacing: '0.12em', opacity: 0.5, marginBottom: 8 }}>
        LAUNCHES · LL2
      </div>
      {data?.source_is_stale && <div style={{ color: '#facc15', marginBottom: 8 }}>STALE</div>}
      {isLoading && <div style={{ opacity: 0.5 }}>Loading…</div>}
      {(data?.launches ?? []).map((row) => (
        <div key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '7px 0' }}>
          <button
            type="button"
            onClick={() => {
              setLayerVisible('launches', true);
              clearTrackedEntity();
              if (row.lat != null && row.lon != null) {
                flyToLandmark({ lon: row.lon, lat: row.lat, altMeters: 80_000, pitch: -45 });
              }
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: row.lat != null ? 'pointer' : 'default',
              fontFamily: 'inherit',
              fontSize: 11,
              padding: 0,
            }}
          >
            <div>{row.name}</div>
            <div style={{ opacity: 0.5, fontSize: 10 }}>
              {[row.status, row.pad, row.net ? new Date(row.net).toISOString().slice(0, 16) + 'Z' : null]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </button>
          {row.lat != null && row.lon != null && (
            <button
              type="button"
              onClick={() => {
                const lat = row.lat as number;
                const lon = row.lon as number;
                setLayerVisible('launches', true);
                clearTrackedEntity();
                setAscentEstimate({
                  id: row.id,
                  name: row.name,
                  lon,
                  lat,
                  headingDeg: 90,
                });
                flyToLandmark({ lon, lat, altMeters: 140_000, pitch: -35 });
              }}
              style={{
                marginTop: 4,
                padding: '2px 6px',
                background: 'transparent',
                border: '1px solid rgba(56,189,248,0.4)',
                borderRadius: 2,
                color: '#38bdf8',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 9,
                letterSpacing: '0.08em',
              }}
            >
              ASCENT EST.
            </button>
          )}
        </div>
      ))}
      {!isLoading && (data?.launches?.length ?? 0) === 0 && (
        <div style={{ opacity: 0.5 }}>No upcoming launches</div>
      )}
    </div>
  );
}
