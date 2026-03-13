import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

vi.mock('cesium', () => ({}));

vi.mock('../../lib/viewerRegistry', () => ({
  zoomStep: vi.fn(),
  setPitchPreset: vi.fn(),
}));

import { zoomStep, setPitchPreset } from '../../lib/viewerRegistry';
import { CameraControlWidget } from '../CameraControlWidget';

describe('CameraControlWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a zoom-in button labeled "+"', () => {
    const { getByLabelText } = render(<CameraControlWidget />);
    const btn = getByLabelText('zoom in');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('+');
  });

  it('renders a zoom-out button labeled "−"', () => {
    const { getByLabelText } = render(<CameraControlWidget />);
    const btn = getByLabelText('zoom out');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('−');
  });

  it('renders tilt button labeled "TOP"', () => {
    const { getByText } = render(<CameraControlWidget />);
    expect(getByText('TOP')).toBeTruthy();
  });

  it('renders tilt button labeled "45°"', () => {
    const { getByText } = render(<CameraControlWidget />);
    expect(getByText('45°')).toBeTruthy();
  });

  it('renders tilt button labeled "HRZ"', () => {
    const { getByText } = render(<CameraControlWidget />);
    expect(getByText('HRZ')).toBeTruthy();
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

  it('clicking "TOP" calls setPitchPreset with -90', () => {
    const { getByText } = render(<CameraControlWidget />);
    fireEvent.click(getByText('TOP'));
    expect(setPitchPreset).toHaveBeenCalledWith(-90);
  });

  it('clicking "45°" calls setPitchPreset with -45', () => {
    const { getByText } = render(<CameraControlWidget />);
    fireEvent.click(getByText('45°'));
    expect(setPitchPreset).toHaveBeenCalledWith(-45);
  });

  it('clicking "HRZ" calls setPitchPreset with -10', () => {
    const { getByText } = render(<CameraControlWidget />);
    fireEvent.click(getByText('HRZ'));
    expect(setPitchPreset).toHaveBeenCalledWith(-10);
  });
});
