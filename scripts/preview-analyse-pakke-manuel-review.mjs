// Local synthetic review only. No login, credentials or production transport.
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

const server = await createServer({
  configFile: false, envDir: false,
  plugins: [
    { name: 'no-production-transport', load(id) {
      if (id.replaceAll('\\', '/').endsWith('/src/supabase.js')) throw new Error('Production transport forbidden')
    } },
    react(),
  ],
  optimizeDeps: { entries: ['test/analyse-pakke/index.html'] },
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { host: '127.0.0.1', port: 5211, strictPort: true },
})
await server.listen()
console.log('Syntetisk review: http://127.0.0.1:5211/test/analyse-pakke/index.html')
console.log('Hent analyse: test/fixtures/analyse-pakke/syntetisk.json. Stop med Ctrl+C.')
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
  await server.close()
  process.exit(0)
})
