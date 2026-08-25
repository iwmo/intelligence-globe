import { useState, useEffect } from 'react';
import type { Viewer } from 'cesium';
import { Math as CesiumMath } from 'cesium';
import { forward } from 'mgrs';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAircraft } from '../hooks/useAircraft';
import { useMilitaryAircraft } from '../hooks/useMilitaryAircraft';
import { useShips } from '../hooks/useShips';
import { resolveHudContact } from '../lib/hudContact';

export function getCameraGridRef(lonLat: [number, number]): string {
  const [, lat] = lonLat;
  if (lat > 84 || lat < -80) return 'UPS';
  try { return forward(lonLat, 4); } catch { return '---'; }
}

interface CinematicHUDProps { viewer: Viewer | null; }

export function CinematicHUD({ viewer }: CinematicHUDProps) {
  const cleanUI = useAppStore(s => s.cleanUI);
  const setCleanUI = useAppStore(s => s.setCleanUI);
  const hudVisible = useAppStore(s => s.hudVisible);
  const replayMode = useAppStore(s => s.replayMode);
  const trackedEntity = useAppStore(s => s.trackedEntity);
  const selectedAircraftId = useAppStore(s => s.selectedAircraftId);
  const selectedMilitaryId = useAppStore(s => s.selectedMilitaryId);
  const selectedShipId = useAppStore(s => s.selectedShipId);
  const selectedSatelliteId = useAppStore(s => s.selectedSatelliteId);
  const showBanner = useSettingsStore(s => s.showClassificationBanner);

  const aircraft = useAircraft();
  const military = useMilitaryAircraft();
  const ships = useShips();

  const { data: satDetail } = useQuery<{
    norad_cat_id: number;
    object_name: string;
    altitude_km: number;
    velocity_km_s: number;
  }>({
    queryKey: ['satellite', selectedSatelliteId],
    queryFn: async () => {
      const res = await fetch(`/api/satellites/${selectedSatelliteId}`);
      if (!res.ok) throw new Error('Satellite not found');
      return res.json();
    },
    enabled: selectedSatelliteId !== null,
    staleTime: 60_000,
  });

  const contact = resolveHudContact(
    trackedEntity,
    {
      aircraftId: selectedAircraftId,
      militaryId: selectedMilitaryId,
      shipId: selectedShipId,
      satelliteId: selectedSatelliteId,
    },
    {
      aircraft: aircraft.data,
      military: military.data,
      ships: ships.data,
      satellite: satDetail
        ? {
            norad: satDetail.norad_cat_id,
            name: satDetail.object_name,
            altitudeKm: satDetail.altitude_km,
            velocityKmS: satDetail.velocity_km_s,
          }
        : selectedSatelliteId != null
          ? { norad: selectedSatelliteId }
          : null,
    },
  );

  const [mgrsStr, setMgrsStr] = useState('...');
  const [altKm, setAltKm] = useState(0);
  const [latLon, setLatLon] = useState<[string, string]>(['0.0000', '0.0000']);

  useEffect(() => {
    if (!viewer) return undefined;
    const handler = () => {
      const cart = viewer.camera.positionCartographic;
      const lon = CesiumMath.toDegrees(cart.longitude);
      const lat = CesiumMath.toDegrees(cart.latitude);
      setMgrsStr(getCameraGridRef([lon, lat]));
      setAltKm(Math.round(cart.height / 1000));
      setLatLon([lat.toFixed(4), lon.toFixed(4)]);
    };
    viewer.camera.moveEnd.addEventListener(handler);
    return () => { viewer.camera.moveEnd.removeEventListener(handler); };
  }, [viewer]);

  const mgrsTop = (showBanner ? 26 : 0) + (replayMode === 'playback' ? 70 : 44);

  if (!hudVisible) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 80, pointerEvents: 'none' }}>
        <style>{`
          @keyframes hud-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, pointerEvents: 'none', fontFamily: 'monospace' }}>
      <style>{`
        @keyframes hud-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      {showBanner && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: 26,
          background: 'rgba(20, 20, 20, 0.7)', color: '#9ca3af',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontFamily: 'monospace',
          letterSpacing: '0.15em', textTransform: 'uppercase', userSelect: 'none',
        }}>
          OSINT · UNCLASSIFIED
        </div>
      )}

      <div style={{
        position: 'absolute', top: mgrsTop, right: 48,
        color: '#00ff00', fontSize: '12px', lineHeight: '1.6',
        textAlign: 'right', userSelect: 'none',
      }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.1em' }}>{mgrsStr}</div>
        <div>ALT: {altKm} km</div>
        <div>{latLon[0]}° N / {latLon[1]}° E</div>
      </div>

      <div style={{
        position: 'absolute', bottom: 68, right: 48,
        color: '#00ff00', fontSize: '11px', lineHeight: '1.8',
        textAlign: 'right', userSelect: 'none',
      }}>
        {contact ? (
          <>
            <div style={{ marginBottom: 4, letterSpacing: '0.08em', fontWeight: 700 }}>
              {contact.title}
            </div>
            <div style={{ opacity: 0.7 }}>{contact.idLabel}</div>
            <div>ALT {contact.altitude}</div>
            <div>SPD {contact.speed}</div>
            <div>HDG {contact.heading}</div>
            <div>{contact.source} · {contact.freshness}</div>
          </>
        ) : (
          <div style={{ opacity: 0.7 }}>NO CONTACT</div>
        )}
      </div>

      <button
        onClick={() => setCleanUI(!cleanUI)}
        style={{
          position: 'absolute',
          bottom: 68,
          left: cleanUI ? 8 : 48,
          pointerEvents: 'auto',
          background: 'rgba(0, 0, 0, 0.6)',
          border: '1px solid rgba(0, 255, 0, 0.5)',
          color: '#00ff00', fontFamily: 'monospace',
          fontSize: '11px', padding: '4px 10px',
          cursor: 'pointer', letterSpacing: '0.1em', userSelect: 'none',
        }}
      >
        {cleanUI ? '[FULL UI]' : '[CLEAN UI]'}
      </button>
    </div>
  );
}
