import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

vi.mock('cesium', () => ({
  Math: { toDegrees: (r: number) => (r * 180) / Math.PI },
}));

vi.mock('../../lib/viewerRegistry', () => ({
  zoomStep: vi.fn(),
  setPitchPreset: vi.fn(),
  setHeading: vi.fn(),
  getViewer: vi.fn().mockReturnValue(null),
}));

import { zoomStep, setPitchPreset, setHeading } from '../../lib/viewerRegistry';
import { CameraControlWidget } from '../CameraControlWidget';

describe('CameraControlWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Zoom
  it('renders a zoom-in button labeled "+"', () => {
    const { getByLabelText } = render(<CameraControlWidget />);
    expect(getByLabelText('zoom in').textContent).toBe('+');
  });

  it('renders a zoom-out button labeled "−"', () => {
    const { getByLabelText } = render(<CameraControlWidget />);
    expect(getByLabelText('zoom out').textContent).toBe('−');
  });

  it('clicking "+" calls zoomStep with "in"', () => {
    const { getByLabelText } = render(<CameraControlWidget />);
    fireEvent.click(getByLabelText('zoom in'));
    expect(zoomStep).toHaveBeenCalledWith('in');
  });

  it('clicking "−" calls zoomStep with "out"', () => {
    const { getByLabelText } = render(<CameraControlWidget />);
    fireEvent.click(getByLabelText('zoom out'));
    expect(zoomStep).toHaveBeenCalledWith('out');
  });

  // Pitch presets
  it('renders pitch preset buttons: HRZ, 30°, 45°, 60°, 75°, TOP', () => {
    const { getByRole } = render(<CameraControlWidget />);
    ['HRZ', '30°', '45°', '60°', '75°', 'TOP'].forEach((label) => {
      expect(getByRole('button', { name: label })).toBeTruthy();
    });
  });

  it('clicking "TOP" calls setPitchPreset with -90', () => {
    const { getByRole } = render(<CameraControlWidget />);
    fireEvent.click(getByRole('button', { name: 'TOP' }));
    expect(setPitchPreset).toHaveBeenCalledWith(-90);
  });

  it('clicking "45°" calls setPitchPreset with -45', () => {
    const { getByRole } = render(<CameraControlWidget />);
    fireEvent.click(getByRole('button', { name: '45°' }));
    expect(setPitchPreset).toHaveBeenCalledWith(-45);
  });

  it('clicking "HRZ" calls setPitchPreset with -10', () => {
    const { getByRole } = render(<CameraControlWidget />);
    fireEvent.click(getByRole('button', { name: 'HRZ' }));
    expect(setPitchPreset).toHaveBeenCalledWith(-10);
  });

  it('clicking "60°" calls setPitchPreset with -60', () => {
    const { getByRole } = render(<CameraControlWidget />);
    fireEvent.click(getByRole('button', { name: '60°' }));
    expect(setPitchPreset).toHaveBeenCalledWith(-60);
  });

  // Pitch arrows
  it('renders pitch up and pitch down arrow buttons', () => {
    const { getByLabelText } = render(<CameraControlWidget />);
    expect(getByLabelText('pitch up')).toBeTruthy();
    expect(getByLabelText('pitch down')).toBeTruthy();
  });

  it('mousedown on pitch up calls setPitchPreset with a less steep angle', () => {
    const { getByLabelText } = render(<CameraControlWidget />);
    fireEvent.mouseDown(getByLabelText('pitch up'));
    expect(setPitchPreset).toHaveBeenCalledWith(expect.any(Number));
    const arg = (setPitchPreset as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(arg).toBeGreaterThanOrEqual(-90);
    expect(arg).toBeLessThan(0);
  });

  it('mousedown on pitch down calls setPitchPreset with a steeper angle', () => {
    const { getByLabelText } = render(<CameraControlWidget />);
    fireEvent.mouseDown(getByLabelText('pitch down'));
    expect(setPitchPreset).toHaveBeenCalledWith(expect.any(Number));
  });

  // Heading presets
  it('renders heading preset buttons: N, E, S, W', () => {
    const { getByRole } = render(<CameraControlWidget />);
    ['N', 'E', 'S', 'W'].forEach((label) => {
      expect(getByRole('button', { name: label })).toBeTruthy();
    });
  });

  it('clicking "N" calls setHeading with 0', () => {
    const { getByRole } = render(<CameraControlWidget />);
    fireEvent.click(getByRole('button', { name: 'N' }));
    expect(setHeading).toHaveBeenCalledWith(0);
  });

  it('clicking "E" calls setHeading with 90', () => {
    const { getByRole } = render(<CameraControlWidget />);
    fireEvent.click(getByRole('button', { name: 'E' }));
    expect(setHeading).toHaveBeenCalledWith(90);
  });

  it('clicking "S" calls setHeading with 180', () => {
    const { getByRole } = render(<CameraControlWidget />);
    fireEvent.click(getByRole('button', { name: 'S' }));
    expect(setHeading).toHaveBeenCalledWith(180);
  });

  // Heading arrows
  it('renders heading left and heading right arrow buttons', () => {
    const { getByLabelText } = render(<CameraControlWidget />);
    expect(getByLabelText('heading left')).toBeTruthy();
    expect(getByLabelText('heading right')).toBeTruthy();
  });

  it('mousedown on heading right calls setHeading', () => {
    const { getByLabelText } = render(<CameraControlWidget />);
    fireEvent.mouseDown(getByLabelText('heading right'));
    expect(setHeading).toHaveBeenCalledWith(expect.any(Number));
  });

  it('mousedown on heading left calls setHeading', () => {
    const { getByLabelText } = render(<CameraControlWidget />);
    fireEvent.mouseDown(getByLabelText('heading left'));
    expect(setHeading).toHaveBeenCalledWith(expect.any(Number));
  });
});
