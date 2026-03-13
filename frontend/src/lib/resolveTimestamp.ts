/**
 * resolveTimestamp
 *
 * Returns the timestamp (ms) to use for satellite propagation, or null to skip dispatch.
 *
 * Rules:
 *   replayMode === 'playback' && isPlaying === false  → return null  (pause guard: skip dispatch)
 *   replayMode === 'playback' && isPlaying === true   → return replayTs
 *   replayMode === 'live'                             → return Date.now()
 */
export function resolveTimestamp(
  replayMode: 'live' | 'playback',
  isPlaying: boolean,
  replayTs: number,
): number | null {
  if (replayMode === 'playback') {
    if (!isPlaying) return null;
    return replayTs;
  }
  // live mode: always return wall clock, regardless of isPlaying
  return Date.now();
}
