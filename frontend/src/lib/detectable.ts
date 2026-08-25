import type { TrackableKind } from '../store/useAppStore';
import { listEntityPositions, type EntityPose } from './entityPositions';

export interface DetectableObject {
  id: string;
  kind: TrackableKind;
  label: string;
  position: EntityPose['position'];
  tracked: boolean;
}

export interface DetectableLayers {
  satellites: boolean;
  aircraft: boolean;
  militaryAircraft: boolean;
  ships: boolean;
}

const KIND_LAYER: Record<TrackableKind, keyof DetectableLayers> = {
  aircraft: 'aircraft',
  military: 'militaryAircraft',
  ship: 'ships',
  satellite: 'satellites',
};

const MAX_DETECTABLES = 80;

export function getDetectableObjects(
  layers: DetectableLayers,
  tracked?: { kind: TrackableKind; id: string | number } | null,
  max = MAX_DETECTABLES,
): DetectableObject[] {
  const trackedKey = tracked ? `${tracked.kind}:${tracked.id}` : null;
  const rows: DetectableObject[] = [];
  for (const pose of listEntityPositions()) {
    if (!layers[KIND_LAYER[pose.kind]]) continue;
    const id = String(pose.id);
    rows.push({
      id,
      kind: pose.kind,
      label: (pose.label?.trim() || id).toUpperCase(),
      position: pose.position,
      tracked: trackedKey === `${pose.kind}:${pose.id}`,
    });
  }
  rows.sort((a, b) => Number(b.tracked) - Number(a.tracked));
  return rows.slice(0, max);
}
