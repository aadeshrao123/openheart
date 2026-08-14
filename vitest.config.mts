import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Logic only. Anything that renders a component, touches a policy or hits the
// database belongs in supabase test db instead.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname) },
  },
  test: {
    include: ['lib/**/*.test.ts', 'hooks/**/*.test.ts', 'plugins/**/*.test.ts'],
  },
});
