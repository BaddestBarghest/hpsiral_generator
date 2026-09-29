/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

// Served from https://baddestbarghest.github.io/hpsiral_generator/ (must match the repo name)
export default defineConfig({
  base: '/hpsiral_generator/',
  plugins: [tailwindcss(), svelte()],
  worker: { format: 'es' },
  test: { include: ['src/**/*.test.ts'] },
});
