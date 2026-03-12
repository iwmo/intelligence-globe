import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('cesium', () => ({}));

vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) => selector({
    replayMode: 'live',
    replayTs: Date.now(),
  })),
}));

// Stub file exists (allows import) but exports nothing.
// Tests RED-fail because OsintEventPanel is undefined.
import * as osintPanelModule from '../OsintEventPanel';

type ComponentType = React.ComponentType;

describe('OsintEventPanel smoke tests (Phase 12 RED)', () => {
  it('OsintEventPanel is exported from the module', () => {
    // RED: stub exports nothing — OsintEventPanel will be undefined
    const mod = osintPanelModule as Record<string, unknown>;
    expect(mod['OsintEventPanel']).toBeDefined();
  });

  it('renders the event creation form', () => {
    const mod = osintPanelModule as Record<string, unknown>;
    const OsintEventPanel = mod['OsintEventPanel'] as ComponentType | undefined;
    expect(OsintEventPanel).toBeDefined();
    if (!OsintEventPanel) return;
    const { container } = render(<OsintEventPanel />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders a label input field', () => {
    const mod = osintPanelModule as Record<string, unknown>;
    const OsintEventPanel = mod['OsintEventPanel'] as ComponentType | undefined;
    if (!OsintEventPanel) return;
    const { container } = render(<OsintEventPanel />);
    const labelInput = container.querySelector(
      'input[name="label"], input[placeholder*="label" i], input[id*="label" i]'
    );
    expect(labelInput).toBeTruthy();
  });

  it('renders a datetime input field', () => {
    const mod = osintPanelModule as Record<string, unknown>;
    const OsintEventPanel = mod['OsintEventPanel'] as ComponentType | undefined;
    if (!OsintEventPanel) return;
    const { container } = render(<OsintEventPanel />);
    const datetimeInput = container.querySelector(
      'input[type="datetime-local"], input[type="datetime"], input[name="ts"]'
    );
    expect(datetimeInput).toBeTruthy();
  });

  it('renders a category select field', () => {
    const mod = osintPanelModule as Record<string, unknown>;
    const OsintEventPanel = mod['OsintEventPanel'] as ComponentType | undefined;
    if (!OsintEventPanel) return;
    const { container } = render(<OsintEventPanel />);
    const categorySelect = container.querySelector(
      'select[name="category"], select[id*="category" i]'
    );
    expect(categorySelect).toBeTruthy();
  });

  it('renders a source URL input field', () => {
    const mod = osintPanelModule as Record<string, unknown>;
    const OsintEventPanel = mod['OsintEventPanel'] as ComponentType | undefined;
    if (!OsintEventPanel) return;
    const { container } = render(<OsintEventPanel />);
    const urlInput = container.querySelector(
      'input[name="source_url"], input[type="url"], input[placeholder*="url" i], input[placeholder*="source" i]'
    );
    expect(urlInput).toBeTruthy();
  });
});
