import { useAppStore } from '../store/useAppStore';

/** Resolve a Cesium pick id and update selection + track. Null / empty globe clears. */
export function applyGlobePick(resolvedId: string | number | null): void {
  const store = useAppStore.getState();
  if (resolvedId === null) {
    store.clearSelection();
    return;
  }
  if (typeof resolvedId === 'string') {
    if (resolvedId.startsWith('gdelt:')) {
      store.selectContact('gdelt', resolvedId.slice(6));
      return;
    }
    if (resolvedId.startsWith('mmsi:')) {
      store.selectContact('ship', resolvedId.slice(5));
      return;
    }
    if (resolvedId.startsWith('mil:')) {
      store.selectContact('military', resolvedId.slice(4));
      return;
    }
    store.selectContact('aircraft', resolvedId);
    return;
  }
  if (typeof resolvedId === 'number' && resolvedId > 1000) {
    store.selectContact('satellite', resolvedId);
    return;
  }
  store.clearSelection();
}
