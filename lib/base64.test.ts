import { describe, expect, it } from 'vitest';
import { base64ToBytes } from './base64';

const decode = (value: string) => Array.from(base64ToBytes(value));

describe('base64ToBytes', () => {
  it('handles every padding length', () => {
    // "Man", "Ma", "M": 0, 1 and 2 padding characters.
    expect(decode('TWFu')).toEqual([77, 97, 110]);
    expect(decode('TWE=')).toEqual([77, 97]);
    expect(decode('TQ==')).toEqual([77]);
    expect(decode('')).toEqual([]);
  });

  it('decodes the full alphabet including the high bytes', () => {
    expect(decode('/w==')).toEqual([255]);
    expect(decode('+/8=')).toEqual([251, 255]);
  });

  it('survives whitespace and newlines in the payload', () => {
    expect(decode('TWFu\n')).toEqual([77, 97, 110]);
    expect(decode('TW Fu')).toEqual([77, 97, 110]);
  });

  // What the upload path actually depends on: the leading bytes have to survive,
  // because moderate-photo sniffs them and rejects anything it cannot identify.
  it('preserves the JPEG magic bytes', () => {
    expect(decode('/9j/4AAQ').slice(0, 3)).toEqual([0xff, 0xd8, 0xff]);
  });

  it('agrees with a known reference string', () => {
    const bytes = base64ToBytes('SGVsbG8sIHdvcmxkIQ==');

    expect(String.fromCharCode(...bytes)).toBe('Hello, world!');
  });
});
