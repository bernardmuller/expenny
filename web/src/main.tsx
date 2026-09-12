import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'

import * as TanStackQueryProvider from './integrations/tanstack-query/root-provider.tsx'
import { routeTree } from './routeTree.gen'
import { AuthProvider } from './lib/auth/auth-provider'
import { initAuthMode } from './lib/auth/auth-mode'
import { bootstrapSessionFromCookie } from './lib/auth/session-sync'
import { ThemeProvider } from './components/providers/ThemeProvider'

import './styles.css'
import reportWebVitals from './reportWebVitals.ts'

const TanStackQueryProviderContext = TanStackQueryProvider.getContext()
const router = createRouter({
  routeTree,
  context: {
    ...TanStackQueryProviderContext,
  },
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
  interface HistoryState {
    showConfetti?: boolean
  }
}

const rootElement = document.getElementById('app')
const render = () => {
  if (rootElement && !rootElement.innerHTML) {
    const root = ReactDOM.createRoot(rootElement)
    root.render(
      <StrictMode>
        <ThemeProvider defaultTheme="system">
          <TanStackQueryProvider.Provider {...TanStackQueryProviderContext}>
            <AuthProvider>
              <RouterProvider router={router} />
            </AuthProvider>
          </TanStackQueryProvider.Provider>
        </ThemeProvider>
      </StrictMode>,
    )
  }
}

initAuthMode()
  .catch(() => {})
  .then(() => bootstrapSessionFromCookie())
  .catch(() => {})
  .finally(render)

reportWebVitals()
