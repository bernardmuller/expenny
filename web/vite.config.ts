import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { VitePWA } from 'vite-plugin-pwa'
import netlify from '@netlify/vite-plugin'

const API_TARGET = 'http://localhost:8080'

const spaFallback = (req: IncomingMessage, _res: ServerResponse | undefined) =>
  req.headers.accept?.includes('text/html') ? '/index.html' : undefined

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
    proxy: {
      '/auth': API_TARGET,
      '/.well-known': API_TARGET,
      '/budgets': { target: API_TARGET, bypass: spaFallback },
      '/categories': { target: API_TARGET, bypass: spaFallback },
      '/chats': API_TARGET,
      '/notification-preferences': API_TARGET,
      '/recurring-expenses': API_TARGET,
      '/streaks': API_TARGET,
      '/transactions': API_TARGET,
      '/users': API_TARGET,
      '/verifications': API_TARGET,
    },
  },
})
