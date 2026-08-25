import { flyToLandmark, flyToPosition, resetGlobe } from './viewerRegistry';
import { useAppStore, type MapType, type VisualPreset } from '../store/useAppStore';
import type { AircraftRecord } from '../hooks/useAircraft';

export async function runVoiceTool(name: string, args: Record<string, unknown>): Promise<string> {
  const store = useAppStore.getState();

  switch (name) {
    case 'fly_to': {
      const lon = Number(args.lon);
      const lat = Number(args.lat);
      const alt = Number(args.alt ?? 80_000);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return 'Need lon and lat';
      flyToPosition(lon, lat, alt);
      return `Flying to ${lat.toFixed(2)}, ${lon.toFixed(2)}`;
    }
    case 'zoom_to_globe':
      resetGlobe();
      return 'Reset globe';
    case 'set_layer_visibility': {
      const layer = String(args.layer) as keyof typeof store.layers;
      if (!(layer in store.layers)) return `Unknown layer ${layer}`;
      store.setLayerVisible(layer, Boolean(args.visible));
      return `${layer} ${args.visible ? 'on' : 'off'}`;
    }
    case 'set_visual_preset': {
      const preset = String(args.preset) as VisualPreset;
      store.setVisualPreset(preset);
      return `Preset ${preset}`;
    }
    case 'set_map_type': {
      store.setMapType(String(args.mapType) as MapType);
      return `Map ${args.mapType}`;
    }
    case 'track_contact': {
      const kind = String(args.kind);
      const id = args.id as string | number;
      if (kind === 'aircraft' || kind === 'military' || kind === 'ship' || kind === 'satellite') {
        store.selectContact(kind, id);
        return `Tracking ${kind} ${id}`;
      }
      return 'Unknown contact kind';
    }
    case 'select_nearest': {
      const bbox = store.viewportBbox;
      let list = (args.aircraft as AircraftRecord[] | undefined) ?? [];
      if (list.length === 0) {
        const params = new URLSearchParams();
        if (bbox) {
          params.set('min_lat', String(bbox.minLat));
          params.set('max_lat', String(bbox.maxLat));
          params.set('min_lon', String(bbox.minLon));
          params.set('max_lon', String(bbox.maxLon));
        }
        try {
          const res = await fetch(`/api/aircraft/?${params}`);
          if (res.ok) list = await res.json() as AircraftRecord[];
        } catch {
          return 'Could not load aircraft';
        }
      }
      if (list.length === 0) return 'No aircraft in view';
      const midLat = bbox ? (bbox.minLat + bbox.maxLat) / 2 : list[0].latitude;
      const midLon = bbox ? (bbox.minLon + bbox.maxLon) / 2 : list[0].longitude;
      let best = list[0];
      let bestD = Infinity;
      for (const ac of list) {
        const d = Math.hypot(ac.latitude - midLat, ac.longitude - midLon);
        if (d < bestD) { best = ac; bestD = d; }
      }
      store.selectContact('aircraft', best.icao24);
      flyToLandmark({ lon: best.longitude, lat: best.latitude, altMeters: (best.baro_altitude ?? 10_000) + 8_000 });
      return `Tracking ${best.callsign?.trim() || best.icao24}`;
    }
    case 'what_is_selected': {
      if (store.selectedAircraftId) return `Aircraft ${store.selectedAircraftId}`;
      if (store.selectedMilitaryId) return `Military ${store.selectedMilitaryId}`;
      if (store.selectedShipId) return `Ship ${store.selectedShipId}`;
      if (store.selectedSatelliteId != null) return `Satellite ${store.selectedSatelliteId}`;
      return 'Nothing selected';
    }
    case 'clear_selection':
      store.clearSelection();
      return 'Cleared';
    case 'enter_cockpit':
      return 'Cockpit is not available in v1';
    default:
      return `Unknown tool ${name}`;
  }
}
