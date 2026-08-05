// Bygger render-porten til en koerbar node-bundle. Egen config, saa den ikke
// roerer nogen af de fire eksisterende vite-konfigurationer.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    ssr: 'scripts/verify-pilot-landing-renders.mjs',
    outDir: 'node_modules/.pilot-render',
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: 'port.mjs' } },
  },
})
