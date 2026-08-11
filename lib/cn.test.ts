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
    expect(cn('rounded-card', 'rounded-control')).toBe('rounded-control');
    expect(cn('rounded-control', 'rounded-card')).toBe('rounded-card');
  });

  it('still lets a later class of the same kind win', () => {
    expect(cn('text-fg', 'text-brand')).toBe('text-brand');
    expect(cn('text-body', 'text-title')).toBe('text-title');
    expect(cn('bg-brand', 'bg-danger')).toBe('bg-danger');
    expect(cn('bg-surface', 'bg-surface-raised')).toBe('bg-surface-raised');
    expect(cn('border-border', 'border-danger')).toBe('border-danger');
  });

  it('leaves unrelated utilities alone', () => {
    expect(cn('rounded-card', 'p-4')).toBe('rounded-card p-4');
    expect(cn('text-title', 'bg-brand')).toBe('text-title bg-brand');
  });
});
