import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['{shared,webview/src,src}/**/*.test.ts'],
    environment: 'node',
  },
});
