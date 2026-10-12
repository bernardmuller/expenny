import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    proxy: {
      '/transactions': {
        target: 'http://localhost:8080',
        bypass(req) {
          console.error('DEBUG_ACCEPT=' + JSON.stringify(req.headers.accept))
          return req.headers.accept?.includes('text/html') ? '/index.html' : undefined
        },
      },
    },
  },
})
