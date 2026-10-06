// Synthetic, local-only build. envDir:false prevents Vite from reading .env*.
import config from '../vite.config.js'
export default {
  ...config,
  envDir: false,
  define: {
    ...config.define,
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:9230'),
    'import.meta.env.VITE_SUPABASE_KEY': JSON.stringify('synthetic-mock-placeholder'),
  },
}
