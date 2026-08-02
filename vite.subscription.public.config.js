import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployment-facing build for the closed subscription pilot. Keep this input
// list deliberately narrow: review, QA and local demo pages belong only in the
// separate local pilot build.
export default defineConfig({
  plugins: [react()],
  base: './',
  publicDir: false,
  build: {
    outDir: 'dist-subscription-public',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        subscription: 'subscription.html',
      },
    },
  },
})
