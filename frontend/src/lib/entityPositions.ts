import { Cartesian3 } from 'cesium';
import type { TrackableKind } from '../store/useAppStore';

const positions = new Map<string, Cartesian3>();

export function entityPositionKey(kind: TrackableKind, id: string | number): string {
  return `${kind}:${id}`;
}

export function setEntityPosition(kind: TrackableKind, id: string | number, pos: Cartesian3): void {
  positions.set(entityPositionKey(kind, id), Cartesian3.clone(pos));
}

export function getEntityPosition(kind: TrackableKind, id: string | number): Cartesian3 | null {
  return positions.get(entityPositionKey(kind, id)) ?? null;
}

export function clearEntityPositions(): void {
  positions.clear();
}
