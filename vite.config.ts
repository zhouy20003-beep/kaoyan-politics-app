import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { handleApi } from './server/api.mjs'

/**
 * 本地开发时，Vite 直接挂载生产环境同一套 /api 逻辑，
 * 这样 npm run dev 就能真实调用 DeepSeek，无需另开服务。
 */
function aiDevMiddleware() {
  return {
    name: 'echo-ai-dev',
    configureServer(server: { middlewares: { use: (fn: unknown) => void } }) {
      server.middlewares.use((req: any, res: any, next: () => void) => {
        if (!req.url || !req.url.startsWith('/api/')) {
          next()
          return
        }
        const pathname = new URL(req.url, 'http://localhost').pathname
        handleApi(pathname, req, res).catch((error: unknown) => {
          console.error('[echo-ai-dev]', error)
          if (!res.writableEnded) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ error: 'server_error', message: '本地 AI 服务出错。' }))
          }
        })
      })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), aiDevMiddleware()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
})
