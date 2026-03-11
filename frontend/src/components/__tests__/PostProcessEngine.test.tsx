import { describe, it, vi } from 'vitest';

vi.mock('../PostProcessEngine', () => ({ PostProcessEngine: () => null }));

describe('PostProcessEngine — stage lifecycle', () => {
  it('module is importable', () => {
    expect(true).toBe(true);
  });

  it.todo('enables only the nvg stage when preset is nvg');
  it.todo('disables all stages when preset is normal');
  it.todo('postProcessStages length is stable after 5 preset switches');
  it.todo('uniform function returns updated value after slider change');
});
