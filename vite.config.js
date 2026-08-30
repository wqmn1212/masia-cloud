import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ],
  // occt-import-js (OpenCascade WASM) 지원
  assetsInclude: ['**/*.wasm'],
  // occt-import-js 는 CommonJS(Emscripten glue) 이므로 반드시 프리번들해야
  // ES 모듈 워커에서 default import 가 동작한다. exclude 하면 워커 로드가 실패한다.
  optimizeDeps: {
    include: ['occt-import-js'],
  },
  worker: {
    format: 'es',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('three')) return 'three';
          if (id.includes('occt-import-js')) return 'occt';
        },
      },
    },
  },
});