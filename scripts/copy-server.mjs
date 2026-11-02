import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

/** 把 Node 服务器复制进 dist，npm start 与线上运行都使用同一份代码。 */
const root = resolve(process.cwd())
const dist = resolve(root, 'dist')
if (!existsSync(dist)) mkdirSync(dist, { recursive: true })

copyFileSync(resolve(root, 'server/index.mjs'), resolve(dist, 'server.mjs'))
copyFileSync(resolve(root, 'server/api.mjs'), resolve(dist, 'api.mjs'))

console.log('已将 server/index.mjs → dist/server.mjs，server/api.mjs → dist/api.mjs')
