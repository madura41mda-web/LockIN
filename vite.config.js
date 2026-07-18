import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// This tells Vite (our dev server/bundler) to use React.
// We run everything through the Vercel CLI locally (see README),
// which serves the frontend AND the /api functions together on one
// port - so no proxy setup is needed here.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
})
