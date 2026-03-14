import { describe, it, vi } from 'vitest';
import React from 'react';

vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) => selector({
    selectedGdeltEventId: null,
    gdeltOsintPrefill: null,
    setGdeltOsintPrefill: vi.fn(),
    setSelectedGdeltEventId: vi.fn(),
  })),
}));

vi.mock('../DraggablePanel', () => ({
  DraggablePanel: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

describe('GdeltDetailPanel — GDELT-08 render', () => {
  it.todo('renders nothing when selectedGdeltEventId is null');
  it.todo('renders panel content when selectedGdeltEventId is set');
  it.todo('shows source_url, actor1_name, actor2_name, goldstein_scale, avg_tone');
  it.todo('shows automated-extraction disclaimer');
});

describe('GdeltDetailPanel — GDELT-09 OSINT bridge', () => {
  it.todo('"Log as OSINT Event" button calls setGdeltOsintPrefill with event lat/lon/ts/sourceUrl');
});
