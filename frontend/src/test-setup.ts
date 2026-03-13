// Vitest global test setup
// Provides a minimal HTMLCanvasElement.getContext('2d') mock so that
// module-scope canvas draws (e.g., drawMilitaryIcon, drawShipIcon) do not
// throw in the jsdom environment where canvas is not implemented.

import { vi } from 'vitest';

const ctx2dMock = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  globalAlpha: 1,
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  arc: vi.fn(),
  rect: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  setTransform: vi.fn(),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
};

// Patch getContext before any module-scope canvas draw runs
HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
  if (type === '2d') return ctx2dMock as unknown as CanvasRenderingContext2D;
  return null;
}) as typeof HTMLCanvasElement.prototype.getContext;
