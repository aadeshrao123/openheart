import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import tokens from '@/tokens';

// twMerge, not plain clsx: without it, cn('bg-brand', 'bg-danger') emits both
// classes and the winner depends on stylesheet order. Every primitive's
// className override prop relies on the later class winning deterministically.
//
// Extended, not plain twMerge: it recognises Tailwind's own scales and nothing
// else, so both of this project's custom scales were mishandled, in opposite
// directions and both silently.
//
// text-title was filed under colours, judged to conflict with text-fg and
// dropped, so every piece of text rendered at React Native's default 14px on
// every platform in both themes. rounded-card and rounded-control were filed
// under no group at all, so they never conflicted and a caller's className
// override came down to stylesheet order.
//
// Colours need no entry here: their class names are Tailwind's own groups,
// which resolve correctly already.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: Object.keys(tokens.fontSize) }],
      rounded: [{ rounded: Object.keys(tokens.borderRadius) }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
