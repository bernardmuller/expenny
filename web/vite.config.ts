import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { VitePWA } from 'vite-plugin-pwa'
import netlify from '@netlify/vite-plugin'

export default defineConfig({
  plugins: [
    tanstackRouter({ autoCodeSplitting: true }),
    VitePWA({ registerType: 'autoUpdate' }),
    viteReact({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    tailwindcss(),
    netlify(),
  ],
  optimizeDeps: {
    include: ['@radix-ui/react-dropdown-menu'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    allowedHosts: true,
    // /oauth is deliberately NOT proxied — /oauth/consent is a SPA route.
    proxy: {
      '/auth': 'http://localhost:8080',
      '/.well-known': 'http://localhost:8080',
    },
  },
})
