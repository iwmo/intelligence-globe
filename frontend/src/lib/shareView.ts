import { flyToLandmark, getViewer } from './viewerRegistry';
import { useAppStore, type MapType, type VisualPreset } from '../store/useAppStore';
import { Math as CesiumMath } from 'cesium';

export interface ShareView {
  lon: number;
  lat: number;
  alt: number;
  heading: number;
  pitch: number;
  mapType: MapType;
  preset: VisualPreset;
  layers: string;
  sel?: string;
}

function selectedToken(): string | undefined {
  const s = useAppStore.getState();
  if (s.selectedAircraftId) return `ac:${s.selectedAircraftId}`;
  if (s.selectedMilitaryId) return `mil:${s.selectedMilitaryId}`;
  if (s.selectedShipId) return `ship:${s.selectedShipId}`;
  if (s.selectedSatelliteId != null) return `sat:${s.selectedSatelliteId}`;
  return undefined;
}

function layerToken(): string {
  const { layers } = useAppStore.getState();
  return Object.entries(layers)
    .filter(([, on]) => on)
    .map(([k]) => k)
    .join(',');
}

export function writeShareHash(): void {
  const viewer = getViewer();
  if (!viewer || viewer.isDestroyed()) return;
  const carto = viewer.camera.positionCartographic;
  const params = new URLSearchParams({
    lon: CesiumMath.toDegrees(carto.longitude).toFixed(5),
    lat: CesiumMath.toDegrees(carto.latitude).toFixed(5),
    alt: String(Math.round(carto.height)),
    h: CesiumMath.toDegrees(viewer.camera.heading).toFixed(1),
    p: CesiumMath.toDegrees(viewer.camera.pitch).toFixed(1),
    map: useAppStore.getState().mapType,
    preset: useAppStore.getState().visualPreset,
    layers: layerToken(),
  });
  const sel = selectedToken();
  if (sel) params.set('sel', sel);
  const next = `#${params.toString()}`;
  if (window.location.hash !== next) {
    history.replaceState(null, '', next);
  }
}

export function parseShareHash(hash = window.location.hash): ShareView | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const lon = Number(params.get('lon'));
  const lat = Number(params.get('lat'));
  const alt = Number(params.get('alt'));
  if (![lon, lat, alt].every(Number.isFinite)) return null;
  return {
    lon,
    lat,
    alt,
    heading: Number(params.get('h') ?? 0),
    pitch: Number(params.get('p') ?? -45),
    mapType: (params.get('map') as MapType) || 'google_3d',
    preset: (params.get('preset') as VisualPreset) || 'normal',
    layers: params.get('layers') ?? '',
    sel: params.get('sel') ?? undefined,
  };
}

export function applyShareView(view: ShareView): void {
  const store = useAppStore.getState();
  store.setMapType(view.mapType);
  store.setVisualPreset(view.preset);
  if (view.layers) {
    const on = new Set(view.layers.split(',').filter(Boolean));
    (Object.keys(store.layers) as Array<keyof typeof store.layers>).forEach((key) => {
      store.setLayerVisible(key, on.has(key));
    });
  }
  if (view.sel?.startsWith('ac:')) store.selectContact('aircraft', view.sel.slice(3));
  else if (view.sel?.startsWith('mil:')) store.selectContact('military', view.sel.slice(4));
  else if (view.sel?.startsWith('ship:')) store.selectContact('ship', view.sel.slice(5));
  else if (view.sel?.startsWith('sat:')) store.selectContact('satellite', Number(view.sel.slice(4)));

  flyToLandmark({
    lon: view.lon,
    lat: view.lat,
    altMeters: view.alt,
    heading: view.heading,
    pitch: view.pitch,
  });
}
