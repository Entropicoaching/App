import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  publicDir: false,
  server: {
    // Enables a phone on the same Wi-Fi to review the local pilot. This never
    // deploys the app or changes its local-only data boundary.
    host: '0.0.0.0',
    port: 5199,
    strictPort: true,
  },
  build: {
    outDir: 'dist-subscription-pilot',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        subscription: 'subscription.html',
        'customer-journey': 'customer-journey.html',
        'pilot-program-review': 'pilot-program-review.html',
        'program-preview': 'program-preview.html',
        'program-scenarios': 'program-scenarios.html',
        'pilot-feedback': 'pilot-feedback.html',
        'pilot-feedback-review': 'pilot-feedback-review.html',
        'pilot-mobile-checklist': 'pilot-mobile-checklist.html',
        'pilot-qa': 'pilot-qa.html',
        'subscription-shadow-behavioral-qa': 'subscription-shadow-behavioral-qa.html',
        'subscription-pilot-release-bundle': 'subscription-pilot-release-bundle.html',
        'subscription-final-approval': 'subscription-final-approval.html',
        'subscription-launch-candidate': 'subscription-launch-candidate.html',
      },
    },
  },
})
