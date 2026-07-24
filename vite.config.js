import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Unik id pr. build. Bages ind i bundlen (__BUILD_ID__) og skrives til
// dist/version.json, så klientens versions-tjek kan opdage en ny deploy.
const buildId = new Date().toISOString().replace(/[^\dT]/g, '').slice(0, 15)

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'entropi-build-version',
      apply: 'build',
      writeBundle(options) {
        const dir = options.dir || 'dist'
        writeFileSync(join(dir, 'version.json'), JSON.stringify({ buildId }))
      },
    },
  ],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  base: '/',
})
