import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
const transport = {
  name: 'synthetic-build-transport', enforce: 'pre',
  resolveId(source, importer) {
    if (/^(?:\.\.\/|\.\/)+supabase(?:\.js)?$/.test(source) && importer?.replaceAll('\\', '/').includes('/src/'))
      return resolve('test/analyse-pakke-dashboard/supabase-mock.js')
  },
  load(id) {
    if (id.replaceAll('\\', '/').endsWith('/src/supabase.js')) throw new Error('Forbidden production transport load')
  },
}
await build({ configFile: false, envDir: false, plugins: [transport, react()], define: { __BUILD_ID__: JSON.stringify('synthetic-1210') }, build: { outDir: 'outputs/1210/build', emptyOutDir: false } })
