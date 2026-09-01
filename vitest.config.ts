import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Only this project's own tests. The site and the desktop app sit in
    // sibling folders that are not part of this repository and run their own.
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'site', 'app'],
  },
})
