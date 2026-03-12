export interface OsintEvent {
  id: string;
  ts: number;          // ms epoch
  category: 'KINETIC' | 'AIRSPACE' | 'MARITIME' | 'JAMMING' | 'BLACKOUT';
  label: string;
}

export const EVENT_COLORS: Record<string, string> = {
  KINETIC:  '#ff3333',   // red
  AIRSPACE: '#ffaa00',   // amber
  MARITIME: '#00aaff',   // blue
  JAMMING:  '#ff00ff',   // magenta
  BLACKOUT: '#888888',   // grey
};

/**
 * Static OSINT event seed data for Phase 11 timeline markers.
 * Phase 12 replaces this with database-driven events.
 * Keep empty — PlaybackBar accepts OsintEvent[] as prop for Phase 12 injection.
 */
export const OSINT_EVENTS: OsintEvent[] = [];
