/**
 * Echo 考研政治 AI —— 生产环境服务器（Node.js 20，无第三方依赖）
 * 同时提供静态页面与 /api 接口，默认监听 PORT=8000。
 */

import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleApi } from './api.mjs'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)))
const PORT = Number(process.env.PORT || 8000)
const HOST = '0.0.0.0'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

const BLOCKED = new Set(['server.mjs', 'api.mjs', 'run.sh'])

function sendFile(req, res, filePath, status = 200) {
  const ext = extname(filePath).toLowerCase()
  const name = filePath.slice(ROOT.length + 1)
  const cache =
    name === 'index.html'
      ? 'no-cache'
      : name.startsWith('assets/')
        ? 'public, max-age=31536000, immutable'
        : name.startsWith('data/')
          ? 'public, max-age=3600'
          : 'public, max-age=86400'

  let size = 0
  try {
    size = statSync(filePath).size
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not Found')
    return
  }

  res.writeHead(status, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': size,
    'Cache-Control': cache,
    'X-Content-Type-Options': 'nosniff',
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  createReadStream(filePath).pipe(res)
}

async function onRequest(req, res) {
  let pathname = '/'
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Bad Request')
    return
  }

  if (pathname.startsWith('/api/')) {
    await handleApi(pathname, req, res)
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' })
    res.end('Method Not Allowed')
    return
  }

  const relative = normalize(pathname).replace(/^[/\\]+/, '')
  if (relative.startsWith('..') || BLOCKED.has(relative) || relative.startsWith('.')) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Forbidden')
    return
  }

  const candidate = join(ROOT, relative)
  if (!candidate.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Forbidden')
    return
  }

  if (relative && existsSync(candidate) && statSync(candidate).isFile()) {
    sendFile(req, res, candidate)
    return
  }

  if (relative && existsSync(candidate) && statSync(candidate).isDirectory()) {
    const index = join(candidate, 'index.html')
    if (existsSync(index)) {
      sendFile(req, res, index)
      return
    }
  }

  sendFile(req, res, join(ROOT, 'index.html'), 200)
}

const server = createServer((req, res) => {
  onRequest(req, res).catch((error) => {
    console.error('[echo-server]', error)
    if (!res.writableEnded) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Internal Server Error')
    }
  })
})

server.listen(PORT, HOST, () => {
  console.log(`Echo 考研政治 AI 已启动: http://${HOST}:${PORT}`)
  console.log(
    process.env.DEEPSEEK_API_KEY
      ? 'AI 接口：已配置 DeepSeek'
      : 'AI 接口：未配置 DEEPSEEK_API_KEY（基础功能正常）',
  )
})

server.on('error', (error) => {
  console.error('[echo-server] 启动失败', error)
  process.exit(1)
})
