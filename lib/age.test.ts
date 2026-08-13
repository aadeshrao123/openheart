import { describe, expect, it } from 'vitest';
import { ageOn, fromDateColumn, isAdult, toBirthdate, toDateColumn } from './age';

// The age gate is a safety control, so the boundary cases are the point of
// this file. Off by one here is a minor letting themselves into a dating app.
describe('ageOn', () => {
  it('does not count a birthday that has not happened yet this year', () => {
    const birthdate = new Date(2000, 11, 25);

    expect(ageOn(birthdate, new Date(2026, 11, 24))).toBe(25);
    expect(ageOn(birthdate, new Date(2026, 11, 25))).toBe(26);
  });

  it('counts the birthday itself', () => {
    expect(ageOn(new Date(2008, 0, 1), new Date(2026, 0, 1))).toBe(18);
  });

  it('handles a 29 February birthdate in a non-leap year', () => {
    const leapling = new Date(2008, 1, 29);

    // 2026 has no 29 February, so the 18th birthday lands on 1 March.
    expect(ageOn(leapling, new Date(2026, 1, 28))).toBe(17);
    expect(ageOn(leapling, new Date(2026, 2, 1))).toBe(18);
  });
});

describe('isAdult', () => {
  it('rejects the day before the eighteenth birthday and allows the day itself', () => {
    const birthdate = new Date(2008, 5, 15);

    expect(isAdult(birthdate, new Date(2026, 5, 14))).toBe(false);
    expect(isAdult(birthdate, new Date(2026, 5, 15))).toBe(true);
  });

  it('rejects an obvious minor', () => {
    expect(isAdult(new Date(2015, 0, 1), new Date(2026, 0, 1))).toBe(false);
  });
});

describe('toBirthdate', () => {
  it('rejects a day that does not exist in that month', () => {
    // JavaScript would roll this into 2 or 3 March rather than refusing it.
    expect(toBirthdate(31, 2, 1995)).toBeNull();
    expect(toBirthdate(29, 2, 2007)).toBeNull();
  });

  it('accepts 29 February in a leap year', () => {
    expect(toBirthdate(29, 2, 2008)).not.toBeNull();
  });

  it('rejects non-integers and out-of-range parts', () => {
    expect(toBirthdate(1.5, 1, 1995)).toBeNull();
    expect(toBirthdate(0, 1, 1995)).toBeNull();
    expect(toBirthdate(1, 13, 1995)).toBeNull();
  });
});

describe('fromDateColumn', () => {
  // The reason this exists rather than new Date(value): that parses as UTC
  // midnight, so west of Greenwich it lands on the previous day and the age is
  // a year out for the whole of the user's birthday.
  it('reads the column as a local calendar date', () => {
    const date = fromDateColumn('1995-03-04');

    expect(date?.getFullYear()).toBe(1995);
    expect(date?.getMonth()).toBe(2);
    expect(date?.getDate()).toBe(4);
  });

  it('round trips with toDateColumn', () => {
    const original = '2008-02-29';

    expect(toDateColumn(fromDateColumn(original)!)).toBe(original);
  });

  it('rejects anything that is not a plain date', () => {
    expect(fromDateColumn('1995-3-4')).toBeNull();
    expect(fromDateColumn('1995-02-30')).toBeNull();
    expect(fromDateColumn('not a date')).toBeNull();
    expect(fromDateColumn('1995-03-04T00:00:00Z')).toBeNull();
  });

  // 0018 clears the column when an account is deleted, so null is now a value
  // the column really holds rather than a shape that cannot occur.
  it('treats a cleared column as no date', () => {
    expect(fromDateColumn(null)).toBeNull();
  });
});

describe('toDateColumn', () => {
  it('formats the local calendar date, not the UTC one', () => {
    // Late evening east of Greenwich: toISOString would report the day before.
    expect(toDateColumn(new Date(1995, 2, 4, 23, 30))).toBe('1995-03-04');
  });

  it('pads single digit months and days', () => {
    expect(toDateColumn(new Date(2001, 0, 5))).toBe('2001-01-05');
  });
});
