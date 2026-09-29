import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { VitePWA } from 'vite-plugin-pwa'
import netlify from '@netlify/vite-plugin'

const API_TARGET = 'http://localhost:8080'

// /budgets and /categories are both API prefixes and SPA routes. Browser
// navigations (refresh, deep link) arrive with Accept: text/html and must
// fall through to index.html; openapi-fetch sends no Accept header (*/*)
// and gets proxied to the API.
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
    // Every API prefix the web app calls, so VITE_API_URL stays empty and
    // all traffic — including better-auth's session/state cookies — shares
    // the page origin. Keep this list in sync with the paths in
    // src/lib/http. /oauth is deliberately NOT proxied: /oauth/consent is a
    // SPA route. /auth is NOT given the SPA fallback either — the MCP
    // resume does a full-page navigation to /auth/mcp/authorize with
    // Accept: text/html and must reach the API.
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
