// ---------------------------------------------------------------------------
// GDELT QuadClass hex colour palette — canonical source
// Consumed by GdeltLayer (derives CesiumJS Color objects) and
// PlaybackBar (uses as CSS background-color values directly).
//
// 1 = Verbal Cooperation   → blue
// 2 = Material Cooperation → green
// 3 = Verbal Conflict      → yellow
// 4 = Material Conflict    → red
// ---------------------------------------------------------------------------
export const QUAD_CLASS_HEX: Record<number, string> = {
  1: '#3B82F6',
  2: '#22C55E',
  3: '#EAB308',
  4: '#EF4444',
};
