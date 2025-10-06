import { defineConfig } from 'rolldown'

export default defineConfig({
  input: 'src/index.ts',
  output: {
    format: 'esm',
    file: 'dist/index.js',
    inlineDynamicImports: true, // Required for dynamic import of @tauri-apps/plugin-http
  },
  platform: 'browser',
  define: {
    JAN_API_BASE: JSON.stringify(process.env.JAN_API_BASE || 'https://api-dev.jan.ai/v1'),
  },
})
