import type { AircraftRecord } from '../hooks/useAircraft';
import type { MilitaryAircraftRecord } from '../hooks/useMilitaryAircraft';
import type { ShipRecord } from '../hooks/useShips';
import type { TrackableKind, TrackedEntity } from '../store/useAppStore';

export interface HudContact {
  kind: TrackableKind;
  title: string;
  idLabel: string;
  altitude: string;
  speed: string;
  heading: string;
  source: string;
  freshness: string;
}

export function metersToFeet(m: number): number {
  return m * 3.28084;
}

export function msToKnots(ms: number): number {
  return ms * 1.94384;
}

function headingLabel(deg: number | null | undefined): string {
  return deg != null && !Number.isNaN(deg) ? `${Math.round(deg)}°` : '--';
}

function staleLabel(isStale: boolean | undefined): string {
  return isStale ? 'STALE' : 'LIVE';
}

export function buildAircraftHud(ac: AircraftRecord): HudContact {
  const alt = ac.baro_altitude != null ? `${Math.round(metersToFeet(ac.baro_altitude))} ft` : '--';
  const spd = ac.velocity != null ? `${Math.round(msToKnots(ac.velocity))} kts` : '--';
  return {
    kind: 'aircraft',
    title: (ac.callsign?.trim() || ac.icao24).toUpperCase(),
    idLabel: `ICAO24 ${ac.icao24}`,
    altitude: alt,
    speed: spd,
    heading: headingLabel(ac.true_track),
    source: 'ADS-B',
    freshness: staleLabel(ac.is_stale),
  };
}

export function buildMilitaryHud(ac: MilitaryAircraftRecord): HudContact {
  const alt = ac.alt_baro != null ? `${Math.round(ac.alt_baro)} ft` : '--';
  const spd = ac.gs != null ? `${Math.round(ac.gs)} kts` : '--';
  return {
    kind: 'military',
    title: (ac.flight?.trim() || ac.hex).toUpperCase(),
    idLabel: `HEX ${ac.hex}`,
    altitude: alt,
    speed: spd,
    heading: headingLabel(ac.track),
    source: 'ADS-B MIL',
    freshness: staleLabel(ac.is_stale),
  };
}

export function buildShipHud(ship: ShipRecord): HudContact {
  const heading = ship.heading != null && ship.heading !== 511 ? ship.heading : ship.cog;
  return {
    kind: 'ship',
    title: (ship.vessel_name?.trim() || ship.mmsi).toUpperCase(),
    idLabel: `MMSI ${ship.mmsi}`,
    altitude: 'SEA',
    speed: ship.sog != null ? `${ship.sog.toFixed(1)} kts` : '--',
    heading: headingLabel(heading),
    source: 'AIS',
    freshness: staleLabel(ship.is_stale),
  };
}

export function buildSatelliteHud(opts: {
  norad: number;
  name?: string | null;
  altitudeKm?: number | null;
  velocityKmS?: number | null;
}): HudContact {
  return {
    kind: 'satellite',
    title: (opts.name?.trim() || `NORAD ${opts.norad}`).toUpperCase(),
    idLabel: `NORAD ${opts.norad}`,
    altitude: opts.altitudeKm != null ? `${opts.altitudeKm.toFixed(0)} km` : '--',
    speed: opts.velocityKmS != null ? `${opts.velocityKmS.toFixed(2)} km/s` : '--',
    heading: '--',
    source: 'TLE',
    freshness: 'LIVE',
  };
}

export function resolveHudContact(
  tracked: TrackedEntity | null,
  selected: {
    aircraftId: string | null;
    militaryId: string | null;
    shipId: string | null;
    satelliteId: number | null;
  },
  data: {
    aircraft?: AircraftRecord[];
    military?: MilitaryAircraftRecord[];
    ships?: ShipRecord[];
    satellite?: { norad: number; name?: string | null; altitudeKm?: number | null; velocityKmS?: number | null } | null;
  },
): HudContact | null {
  const kind = tracked?.kind
    ?? (selected.aircraftId ? 'aircraft'
      : selected.militaryId ? 'military'
        : selected.shipId ? 'ship'
          : selected.satelliteId != null ? 'satellite' : null);
  if (!kind) return null;

  if (kind === 'aircraft') {
    const id = String(tracked?.id ?? selected.aircraftId);
    const ac = data.aircraft?.find(a => a.icao24 === id);
    return ac ? buildAircraftHud(ac) : null;
  }
  if (kind === 'military') {
    const id = String(tracked?.id ?? selected.militaryId);
    const ac = data.military?.find(a => a.hex === id);
    return ac ? buildMilitaryHud(ac) : null;
  }
  if (kind === 'ship') {
    const id = String(tracked?.id ?? selected.shipId);
    const ship = data.ships?.find(s => s.mmsi === id);
    return ship ? buildShipHud(ship) : null;
  }
  if (data.satellite && data.satellite.norad === Number(tracked?.id ?? selected.satelliteId)) {
    return buildSatelliteHud(data.satellite);
  }
  if (selected.satelliteId != null) {
    return buildSatelliteHud({ norad: selected.satelliteId });
  }
  return null;
}
