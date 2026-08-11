import { describe, expect, it } from 'vitest';
import { calendarDayOffset } from './calendar';

describe('calendarDayOffset', () => {
  it('is zero for two times on the same day', () => {
    expect(
      calendarDayOffset(new Date(2026, 7, 11, 1, 0), new Date(2026, 7, 11, 23, 0)),
    ).toBe(0);
  });

  // Three hours apart and still a day, which a subtraction of milliseconds
  // would report as zero.
  it('counts a crossing of midnight as a whole day', () => {
    expect(
      calendarDayOffset(new Date(2026, 7, 10, 22, 0), new Date(2026, 7, 11, 1, 0)),
    ).toBe(-1);
  });

  it('counts backwards across a month boundary', () => {
    expect(
      calendarDayOffset(new Date(2026, 6, 30, 12, 0), new Date(2026, 7, 2, 12, 0)),
    ).toBe(-3);
  });
});
