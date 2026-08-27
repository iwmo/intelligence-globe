import { useMemo } from 'react';
import { useAircraft } from '../hooks/useAircraft';
import { useShips } from '../hooks/useShips';
import { useAppStore } from '../store/useAppStore';
import { getViewer } from '../lib/viewerRegistry';
import { Math as CesiumMath } from 'cesium';

const RANGE_KM = 250;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function cameraLatLon(): { lat: number; lon: number } | null {
  const viewer = getViewer();
  if (!viewer || viewer.isDestroyed()) return null;
  const carto = viewer.camera.positionCartographic;
  return {
    lat: CesiumMath.toDegrees(carto.latitude),
    lon: CesiumMath.toDegrees(carto.longitude),
  };
}

export function ContactsRoster() {
  const aircraft = useAircraft();
  const ships = useShips();
  const selectContact = useAppStore(s => s.selectContact);
  const pinnedContacts = useAppStore(s => s.pinnedContacts);
  const cam = cameraLatLon();

  const nearby = useMemo(() => {
    if (!cam) return [];
    const rows: { kind: 'aircraft' | 'ship'; id: string; title: string; km: number }[] = [];
    for (const ac of aircraft.data ?? []) {
      const km = haversineKm(cam.lat, cam.lon, ac.latitude, ac.longitude);
      if (km <= RANGE_KM) rows.push({ kind: 'aircraft', id: ac.icao24, title: ac.callsign?.trim() || ac.icao24, km });
    }
    for (const ship of ships.data ?? []) {
      const km = haversineKm(cam.lat, cam.lon, ship.lat, ship.lon);
      if (km <= RANGE_KM) rows.push({ kind: 'ship', id: ship.mmsi, title: ship.vessel_name || ship.mmsi, km });
    }
    return rows.sort((a, b) => a.km - b.km).slice(0, 40);
  }, [aircraft.data, ships.data, cam]);

  return (
    <div style={{ padding: 10, fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
      {pinnedContacts.length > 0 && (
        <>
          <div style={{ fontSize: 9, letterSpacing: '0.12em', opacity: 0.5, marginBottom: 8 }}>
            PINNED · {pinnedContacts.length}
          </div>
          {pinnedContacts.map(contact => (
            <button
              key={`pinned:${contact.kind}:${contact.id}`}
              type="button"
              onClick={() => selectContact(contact.kind, contact.id)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: '100%',
                background: 'rgba(0,212,255,0.06)',
                border: 'none',
                borderBottom: '1px solid rgba(0,212,255,0.12)',
                color: 'inherit',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 11,
                padding: '7px 6px',
              }}
            >
              <span>{String(contact.id).toUpperCase()}</span>
              <span style={{ opacity: 0.5 }}>{contact.kind.toUpperCase()}</span>
            </button>
          ))}
          <div style={{ height: 14 }} />
        </>
      )}
      <div style={{ fontSize: 9, letterSpacing: '0.12em', opacity: 0.5, marginBottom: 8 }}>
        CONTACTS · 250 KM
      </div>
      {nearby.length === 0 && <div style={{ opacity: 0.5 }}>No contacts in range</div>}
      {nearby.map(row => (
        <button
          key={`${row.kind}:${row.id}`}
          type="button"
          onClick={() => selectContact(row.kind, row.id)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            background: 'none',
            border: 'none',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            color: 'inherit',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 11,
            padding: '6px 0',
          }}
        >
          <span>{row.title.toUpperCase()}</span>
          <span style={{ opacity: 0.5 }}>{row.km.toFixed(0)} km</span>
        </button>
      ))}
    </div>
  );
}
