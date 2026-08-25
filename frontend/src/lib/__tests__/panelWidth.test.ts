import { describe, expect, it } from 'vitest';
import { PANEL_MIN, clampPanelWidth, maxPanelWidth } from '../panelWidth';

describe('clampPanelWidth', () => {
  it('raises crushed stored widths to the readable minimum', () => {
    expect(clampPanelWidth(140, 280, 1440)).toBe(PANEL_MIN);
  });

  it('caps a huge stored width', () => {
    expect(clampPanelWidth(900, 280, 1440)).toBe(maxPanelWidth(1440));
  });

  it('leaves a comfortable width alone on a wide viewport', () => {
    expect(clampPanelWidth(280, 280, 1440)).toBe(280);
  });

  it('keeps both panels from eating a narrow viewport', () => {
    expect(maxPanelWidth(800)).toBe(PANEL_MIN);
    expect(clampPanelWidth(300, 280, 800)).toBe(PANEL_MIN);
  });
});
