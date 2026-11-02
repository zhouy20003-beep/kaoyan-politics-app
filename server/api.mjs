/**
 * Echo 考研政治 AI —— 服务端接口（Node.js 20，无第三方依赖）
 *
 * 只在这里读取 DeepSeek API Key，前端永远拿不到密钥。
 * 未配置密钥时返回 503，基础学习功能不受影响。
 *
 * 环境变量：
 *   DEEPSEEK_API_KEY   必填，DeepSeek 平台密钥
 *   DEEPSEEK_MODEL     可选，默认 deepseek-chat
 *   DEEPSEEK_BASE_URL  可选，默认 https://api.deepseek.com/chat/completions
 *   AI_RATE_WINDOW_MIN 可选，默认 10 分钟
 *   AI_RATE_MAX        可选，单 IP 每窗口次数，默认 8
 *   AI_DAILY_MAX       可选，单 IP 每日次数，默认 60
 *   AI_GLOBAL_DAILY_MAX 可选，全站每日总次数，默认 400
 */

const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/chat/completions'
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

const RATE_WINDOW_MS = Number(process.env.AI_RATE_WINDOW_MIN || 10) * 60 * 1000
const RATE_MAX = Number(process.env.AI_RATE_MAX || 8)
const DAILY_MAX = Number(process.env.AI_DAILY_MAX || 60)
const GLOBAL_DAILY_MAX = Number(process.env.AI_GLOBAL_DAILY_MAX || 400)

const MAX_BODY_BYTES = 48 * 1024
const MAX_QUESTION = 900
const MAX_CONTEXT = 9000

const state = globalThis.__echoAiState || (globalThis.__echoAiState = {
  ips: new Map(),
  day: '',
  dayTotal: 0,
})

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function rollDay() {
  const day = todayKey()
  if (state.day !== day) {
    state.day = day
    state.dayTotal = 0
    state.ips.clear()
  }
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return forwarded || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown'
}

function checkRate(ip) {
  rollDay()
  const now = Date.now()
  let bucket = state.ips.get(ip)
  if (!bucket || now - bucket.start > RATE_WINDOW_MS) {
    bucket = { start: now, count: 0, day: 0 }
    state.ips.set(ip, bucket)
  }
  bucket.day += 1
  bucket.count += 1
  state.dayTotal += 1

  if (bucket.day > DAILY_MAX) {
    return { ok: false, code: 'daily_limit', message: '今天的 AI 使用次数已用完，明天再来。题库与刷题功能不受影响。' }
  }
  if (bucket.count > RATE_MAX) {
    return {
      ok: false,
      code: 'rate_limit',
      message: `AI 请求太频繁了，请休息 ${Math.ceil(
        (RATE_WINDOW_MS - (now - bucket.start)) / 60000,
      )} 分钟后再试。`,
    }
  }
  if (state.dayTotal > GLOBAL_DAILY_MAX) {
    return { ok: false, code: 'global_limit', message: '今天的 AI 调用额度已满，请明天再来。题库与刷题功能不受影响。' }
  }
  return { ok: true, remaining: Math.max(0, RATE_MAX - bucket.count) }
}

export function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body_too_large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve(text ? JSON.parse(text) : {})
      } catch {
        reject(new Error('bad_json'))
      }
    })
    req.on('error', reject)
  })
}

function clip(text, max) {
  const value = typeof text === 'string' ? text.trim() : ''
  return value.length > max ? value.slice(0, max) : value
}

const PERSONA = `你是「Echo 考研政治 AI 助教」，只服务中国考研政治的复习。
回答必须遵守：
1. 以考研政治通行教材表述与提供的【知识库材料】为依据；材料中没有的内容，明确说明“题库暂未收录，建议结合现行教材核对”，不得杜撰。
2. 不得编造历年真题、官方答案、评分细则、政策文件原文或领导人讲话原文。
3. 使用简体中文，先给结论再解释，分点清晰，重点用「」标出，必要时举例或做对比。
4. 学生问记忆方法时，给出口诀、对比表或关键词链；问区别时，用“相同点/不同点”结构。
5. 只回答考研政治与学习方法相关问题，拒绝无关请求。`

const CHAT_SYSTEM = `${PERSONA}
6. 回答控制在 650 字以内，结尾给一句可执行的学习建议。`

const EXPLAIN_SYSTEM = `${PERSONA}
6. 你正在讲解一道题：先引用题库原有解析（如有），再做补充分析，不能改变题库给出的正确答案。
7. 按“正确答案与理由 → 逐项辨析 → 本题考点 → 知识串联 → 记忆提示”的顺序输出，控制在 700 字以内。`

async function callDeepSeek(system, user, maxTokens) {
  if (!process.env.DEEPSEEK_API_KEY) {
    const error = new Error('ai_not_configured')
    error.code = 'ai_not_configured'
    throw error
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 75000)
  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.4,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      const error = new Error('deepseek_http')
      error.code = response.status === 401 ? 'ai_auth' : response.status === 402 ? 'ai_balance' : response.status === 429 ? 'ai_busy' : 'ai_error'
      error.status = response.status
      error.detail = detail.slice(0, 300)
      throw error
    }

    const data = await response.json()
    const answer = data?.choices?.[0]?.message?.content
    if (!answer || typeof answer !== 'string') {
      const error = new Error('ai_empty')
      error.code = 'ai_empty'
      throw error
    }
    return { answer: answer.trim(), model: data.model || MODEL }
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('ai_timeout')
      timeoutError.code = 'ai_timeout'
      throw timeoutError
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function friendlyError(error) {
  switch (error.code) {
    case 'ai_not_configured':
      return {
        status: 503,
        code: 'ai_not_configured',
        message:
          'AI 功能尚未启用：网站还没有配置 DeepSeek API Key。知识点、题库、刷题、错题本和模拟考试都可以正常使用。',
      }
    case 'ai_auth':
      return { status: 502, code: 'ai_auth', message: 'DeepSeek 密钥无效，请联系网站管理员检查 API Key。' }
    case 'ai_balance':
      return { status: 502, code: 'ai_balance', message: 'DeepSeek 账户余额不足，AI 功能暂时不可用。' }
    case 'ai_busy':
      return { status: 429, code: 'ai_busy', message: 'DeepSeek 当前请求过多，请稍后重试。' }
    case 'ai_timeout':
      return { status: 504, code: 'ai_timeout', message: 'AI 响应超时，请稍后重试。' }
    default:
      return { status: 502, code: 'ai_error', message: 'AI 服务暂时不可用，请稍后重试。' }
  }
}

export function aiConfigured() {
  return Boolean(process.env.DEEPSEEK_API_KEY)
}

async function handleChat(req, res, ip) {
  const rate = checkRate(ip)
  if (!rate.ok) return sendJson(res, 429, { error: rate.code, message: rate.message })

  let body
  try {
    body = await readBody(req)
  } catch {
    return sendJson(res, 400, { error: 'bad_request', message: '请求格式不正确。' })
  }

  const question = clip(body.question, MAX_QUESTION)
  if (!question) return sendJson(res, 400, { error: 'empty_question', message: '请先输入你的问题。' })

  const context = clip(body.context, MAX_CONTEXT)
  const history = Array.isArray(body.history) ? body.history.slice(-6) : []
  const historyText = history
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
    .map((item) => `${item.role === 'user' ? '学生' : '助教'}：${clip(item.content, 400)}`)
    .join('\n')

  const user = [
    context ? `【知识库材料】\n${context}` : '【知识库材料】暂无直接匹配条目，请只使用考研政治通行教材表述，并说明不确定性。',
    historyText ? `【最近的对话】\n${historyText}` : '',
    `【学生问题】\n${question}`,
    '请直接回答，不要复述材料。',
  ]
    .filter(Boolean)
    .join('\n\n')

  const result = await callDeepSeek(CHAT_SYSTEM, user, 1200)
  return sendJson(res, 200, { ...result, remaining: rate.remaining })
}

async function handleExplain(req, res, ip) {
  const rate = checkRate(ip)
  if (!rate.ok) return sendJson(res, 429, { error: rate.code, message: rate.message })

  let body
  try {
    body = await readBody(req)
  } catch {
    return sendJson(res, 400, { error: 'bad_request', message: '请求格式不正确。' })
  }

  const question = clip(body.question, MAX_QUESTION)
  const context = clip(body.context, MAX_CONTEXT)
  if (!context) return sendJson(res, 400, { error: 'missing_question', message: '缺少题目信息，请重新打开题目后再试。' })

  const meta = body.meta && typeof body.meta === 'object' ? body.meta : {}
  const user = [
    `【题目信息】${clip(meta.subject, 60)} · ${clip(meta.topic, 120)} · ${clip(meta.knowledgePoint, 120)}`,
    `【知识库材料】\n${context}`,
    question ? `【学生的作答与要求】\n${question}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  const result = await callDeepSeek(EXPLAIN_SYSTEM, user, 1300)
  return sendJson(res, 200, { ...result, remaining: rate.remaining })
}

/**
 * @param {string} pathname
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @returns {Promise<boolean>} 是否已处理（true 表示不再走静态资源）
 */
export async function handleApi(pathname, req, res) {
  if (pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      ai: aiConfigured(),
      model: aiConfigured() ? MODEL : null,
      note: aiConfigured() ? 'AI 服务已就绪' : '未配置 DEEPSEEK_API_KEY，AI 功能暂不可用',
    })
    return true
  }

  if (pathname !== '/api/ai/chat' && pathname !== '/api/ai/explain') {
    sendJson(res, 404, { error: 'not_found', message: '接口不存在。' })
    return true
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    sendJson(res, 405, { error: 'method_not_allowed', message: '请使用 POST 请求。' })
    return true
  }

  try {
    if (pathname === '/api/ai/chat') await handleChat(req, res, clientIp(req))
    else await handleExplain(req, res, clientIp(req))
  } catch (error) {
    const friendly = friendlyError(error)
    if (friendly.status >= 500 && error.detail) {
      console.error('[echo-ai]', error.code, error.status || '', String(error.detail).slice(0, 300))
    }
    if (!res.writableEnded) {
      sendJson(res, friendly.status, {
        error: friendly.code,
        message: friendly.message,
      })
    }
  }
  return true
}
