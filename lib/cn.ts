import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import tokens from '@/tokens';

// twMerge so a caller's className wins deterministically instead of by
// stylesheet order.
//
// Extended because tailwind-merge only knows Tailwind's own scales, and got both
// custom ones wrong in opposite directions: it filed text-title under colours
// and dropped it, so all text fell back to 14px, and it filed rounded-card under
// no group at all, so overrides never took. See lib/cn.test.ts.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: Object.keys(tokens.fontSize) }],
      'font-family': [{ font: Object.keys(tokens.fontFamily) }],
      rounded: [{ rounded: Object.keys(tokens.borderRadius) }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
