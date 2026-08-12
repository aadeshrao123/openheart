import { describe, expect, it } from 'vitest';
import { cn } from './cn';
import tokens from '@/tokens';

// This file exists because of two real failures, not for coverage. Both were
// invisible: the app compiled, rendered and looked plausible, and only reading
// computed styles off a running screen caught them.
//
// Every custom token name added to tailwind.config.js needs a case here, since
// tailwind-merge cannot infer what a name it has never seen is supposed to be.
describe('cn', () => {
  // Regression: tailwind-merge filed text-title under colours, so it conflicted
  // with text-fg and only the colour survived. All text fell back to React
  // Native's default 14px.
  it('keeps a font size and a text colour together', () => {
    for (const size of Object.keys(tokens.fontSize)) {
      const result = cn(`text-${size}`, 'text-fg');

      expect(result).toContain(`text-${size}`);
      expect(result).toContain('text-fg');
    }
  });

  // Regression: the custom radii belonged to no group, so they never conflicted
  // and which one applied depended on stylesheet order rather than call order.
  it('lets a later radius replace an earlier one', () => {
    const radii = Object.keys(tokens.borderRadius);

    for (const earlier of radii) {
      for (const later of radii) {
        if (earlier !== later) {
          expect(cn(`rounded-${earlier}`, `rounded-${later}`)).toBe(`rounded-${later}`);
        }
      }
    }
  });

  // A message bubble rounds every corner and then tightens the one nearest its
  // sender. The two belong to different groups and must both survive.
  it('keeps a corner radius alongside an all-corner one', () => {
    expect(cn('rounded-bubble', 'rounded-ee-tail')).toContain('rounded-bubble');
    expect(cn('rounded-bubble', 'rounded-ee-tail')).toContain('rounded-ee-tail');
  });

  // The deck skeleton fills a card that already has the radius and clips, so it
  // has to cancel the one the primitive sets. rounded-none is Tailwind's own
  // and the custom radii are not, which is exactly the pairing that silently
  // failed for the two bugs above.
  it('lets rounded-none cancel a token radius', () => {
    for (const radius of Object.keys(tokens.borderRadius)) {
      expect(cn(`rounded-${radius}`, 'rounded-none')).toBe('rounded-none');
    }
  });

  it('still lets a later class of the same kind win', () => {
    expect(cn('text-fg', 'text-brand')).toBe('text-brand');
    expect(cn('text-body', 'text-title')).toBe('text-title');
    expect(cn('bg-brand', 'bg-danger')).toBe('bg-danger');
    expect(cn('bg-surface', 'bg-surface-raised')).toBe('bg-surface-raised');
    expect(cn('border-border', 'border-danger')).toBe('border-danger');
  });

  // lib/typeface.ts answers a role with a family class on a Latin script and
  // with a weight class on every other one, because a brand family carries its
  // weight in its name and the platform font does not. The custom family names
  // are in a hand-written group and the weights are in Tailwind's own, so
  // whether those two collide is exactly the kind of thing this file exists to
  // pin: a collision would silently flatten either the family or the hierarchy.
  it('keeps a font family and a font weight in separate groups', () => {
    for (const family of Object.keys(tokens.fontFamily)) {
      const result = cn(`font-${family}`, 'font-semibold');

      expect(result).toContain(`font-${family}`);
      expect(result).toContain('font-semibold');
    }

    // Which is also why a weight class is never paired with a brand family:
    // nothing here would strip it, so it would reach the platform as a second
    // weight request on a face that already has one.
    expect(cn('font-medium', 'font-semibold')).toBe('font-semibold');
    expect(cn('font-display', 'font-body')).toBe('font-body');
    expect(cn('text-display', 'font-semibold', 'text-fg')).toBe(
      'text-display font-semibold text-fg',
    );
    expect(cn('text-heading', 'font-medium italic', 'text-fg')).toBe(
      'text-heading font-medium italic text-fg',
    );
  });

  it('leaves unrelated utilities alone', () => {
    expect(cn('rounded-card', 'p-4')).toBe('rounded-card p-4');
    expect(cn('text-title', 'bg-brand')).toBe('text-title bg-brand');
  });
});
