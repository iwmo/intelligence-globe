import { Cartesian3 } from 'cesium';
import type { TrackableKind } from '../store/useAppStore';

export interface EntityPose {
  kind: TrackableKind;
  id: string | number;
  position: Cartesian3;
  headingDeg: number | null;
  label: string | null;
}

export interface EntityPoseExtras {
  headingDeg?: number | null;
  label?: string | null;
}

const positions = new Map<string, Cartesian3>();
const extras = new Map<string, { headingDeg: number | null; label: string | null }>();

export function entityPositionKey(kind: TrackableKind, id: string | number): string {
  return `${kind}:${id}`;
}

export function setEntityPosition(
  kind: TrackableKind,
  id: string | number,
  pos: Cartesian3,
  extra?: EntityPoseExtras,
): void {
  const key = entityPositionKey(kind, id);
  positions.set(key, Cartesian3.clone(pos));
  if (extra) {
    const prev = extras.get(key) ?? { headingDeg: null, label: null };
    extras.set(key, {
      headingDeg: extra.headingDeg !== undefined ? extra.headingDeg : prev.headingDeg,
      label: extra.label !== undefined ? extra.label : prev.label,
    });
  }
}

export function getEntityPosition(kind: TrackableKind, id: string | number): Cartesian3 | null {
  return positions.get(entityPositionKey(kind, id)) ?? null;
}

export function getEntityPose(kind: TrackableKind, id: string | number): EntityPose | null {
  const key = entityPositionKey(kind, id);
  const position = positions.get(key);
  if (!position) return null;
  const extra = extras.get(key);
  return {
    kind,
    id,
    position,
    headingDeg: extra?.headingDeg ?? null,
    label: extra?.label ?? null,
  };
}

export function listEntityPositions(): EntityPose[] {
  const out: EntityPose[] = [];
  for (const [key, position] of positions) {
    const sep = key.indexOf(':');
    const kind = key.slice(0, sep) as TrackableKind;
    const rawId = key.slice(sep + 1);
    const extra = extras.get(key);
    out.push({
      kind,
      id: kind === 'satellite' ? Number(rawId) : rawId,
      position,
      headingDeg: extra?.headingDeg ?? null,
      label: extra?.label ?? null,
    });
  }
  return out;
}

export function clearEntityPositions(): void {
  positions.clear();
  extras.clear();
}
