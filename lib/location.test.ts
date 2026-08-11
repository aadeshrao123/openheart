import { describe, expect, it } from 'vitest';
import { toCoarseLocation } from './location';

describe('toCoarseLocation', () => {
  // Getting these the wrong way round puts everyone in the Southern Ocean, and
  // it is the single easiest mistake to make here because every location API
  // hands them over as latitude first.
  it('writes longitude before latitude', () => {
    expect(toCoarseLocation(51.5078, -0.1234)).toBe('SRID=4326;POINT(-0.12 51.51)');
  });

  it('coarsens to two decimal places', () => {
    expect(toCoarseLocation(40.712776, -74.005974)).toBe('SRID=4326;POINT(-74.01 40.71)');
  });

  it('keeps the sign on both hemispheres', () => {
    expect(toCoarseLocation(-33.8688, 151.2093)).toBe('SRID=4326;POINT(151.21 -33.87)');
  });

  it('never emits more precision than the trigger would keep', () => {
    const point = toCoarseLocation(12.3456789, 98.7654321);
    const decimals = point.match(/-?\d+\.(\d+)/g)?.map((n) => n.split('.')[1].length) ?? [];

    expect(Math.max(...decimals)).toBeLessThanOrEqual(2);
  });
});
