export const TRACKED_MODEL_MAX_ALT_M = 150_000;

export function shouldShowTrackedModel(altMeters: number, kind: string | undefined): boolean {
  return altMeters <= TRACKED_MODEL_MAX_ALT_M && (kind === 'aircraft' || kind === 'military');
}
