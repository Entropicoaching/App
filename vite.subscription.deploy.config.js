import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

import { validatePilotConfig } from './src/subscription/pilotConfig.js'

// Adds the customer-facing subscription entry to the existing portal build.
// The dedicated asset namespace and emptyOutDir:false are deliberate: this
// build may add subscription.html, but it must never replace the portal.
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const subscriptionConfig = validatePilotConfig(env)

  if (!subscriptionConfig.ok) {
    throw new Error(`Subscription deploy-konfiguration er afvist: ${subscriptionConfig.reason}`)
  }

  return {
    plugins: [react()],
    base: '/',
    publicDir: false,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      rollupOptions: {
        input: {
          subscription: 'subscription.html',
        },
        output: {
          entryFileNames: 'subscription-assets/[name]-[hash].js',
          chunkFileNames: 'subscription-assets/chunks/[name]-[hash].js',
          assetFileNames: 'subscription-assets/[name]-[hash][extname]',
        },
      },
    },
  }
})
