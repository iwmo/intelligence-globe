import { describe, it, expect } from 'vitest';
import { weatherQueryPoint } from '../useWeather';

describe('weatherQueryPoint', () => {
  it('rounds to the nearest half degree', () => {
    expect(weatherQueryPoint(38.72, -9.14)).toEqual([38.5, -9]);
  });

  it('returns nulls for incomplete coordinates', () => {
    expect(weatherQueryPoint(null, -9)).toEqual([null, null]);
    expect(weatherQueryPoint(Number.NaN, 0)).toEqual([null, null]);
  });
});
