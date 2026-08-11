import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// twMerge, not plain clsx: without it, cn('bg-brand', 'bg-danger') emits both
// classes and the winner depends on stylesheet order. Every primitive's
// className override prop relies on the later class winning deterministically.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
