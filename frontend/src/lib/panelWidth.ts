export const PANEL_MIN = 240;
export const PANEL_MAX = 420;
export const PANEL_VIEWPORT_FRAC = 0.28;
export const DEFAULT_LEFT_PANEL_WIDTH = 280;
export const DEFAULT_RIGHT_PANEL_WIDTH = 300;

export function maxPanelWidth(viewportWidth = 1440): number {
  return Math.max(PANEL_MIN, Math.min(PANEL_MAX, Math.floor(viewportWidth * PANEL_VIEWPORT_FRAC)));
}

export function clampPanelWidth(raw: number, fallback = DEFAULT_LEFT_PANEL_WIDTH, viewportWidth = 1440): number {
  const n = Number.isFinite(raw) && raw > 0 ? raw : fallback;
  return Math.round(Math.min(maxPanelWidth(viewportWidth), Math.max(PANEL_MIN, n)));
}

export function loadStoredPanelWidth(key: string, fallback: number): number {
  const viewport = typeof window === 'undefined' ? 1440 : window.innerWidth;
  try {
    const stored = parseInt(localStorage.getItem(key) ?? '', 10);
    return clampPanelWidth(Number.isFinite(stored) ? stored : fallback, fallback, viewport);
  } catch {
    return clampPanelWidth(fallback, fallback, viewport);
  }
}
