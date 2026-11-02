import { SUBJECT_MAP, TYPE_META } from './data'
import type { KnowledgeIndex, KnowledgePoint } from './knowledge'
import type { Question } from './types'

export type AiMode = 'chat' | 'explain'

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
  at?: string
}

export interface AiReply {
  answer: string
  model?: string
  remaining?: number | null
}

export class AiError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status = 0) {
    super(message)
    this.name = 'AiError'
    this.code = code
    this.status = status
  }
}

const MAX_CONTEXT = 7000

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

function bigrams(text: string): Set<string> {
  const clean = text.toLowerCase().replace(/[^\u4e00-\u9fa5a-z0-9]/g, '')
  const set = new Set<string>()
  for (let i = 0; i < clean.length - 1; i += 1) set.add(clean.slice(i, i + 2))
  return set
}

function overlap(a: Set<string>, b: Set<string>): number {
  let count = 0
  for (const item of a) if (b.has(item)) count += 1
  return count
}

/** 在本地知识库中做轻量检索，命中真实知识点后拼成 AI 上下文。 */
export function retrieveKnowledge(
  index: KnowledgeIndex,
  query: string,
  anchor?: Question,
  limit = 5,
): KnowledgePoint[] {
  const queryBigrams = bigrams(query)
  const anchorBigrams = anchor ? bigrams(`${anchor.topic}${anchor.knowledgePoint}${anchor.stem.slice(0, 80)}`) : new Set<string>()
  const scored: Array<{ point: KnowledgePoint; score: number }> = []

  for (const point of index.points) {
    const nameB = bigrams(point.name)
    const topicB = bigrams(point.topic)
    let score = overlap(nameB, queryBigrams) * 6 + overlap(nameB, anchorBigrams) * 4
    score += overlap(topicB, queryBigrams) * 2
    if (anchor && point.name === anchor.knowledgePoint && point.topic === anchor.topic) score += 30
    if (anchor && point.subjectKey === anchor.subjectKey) score += 1
    if (score > 0) scored.push({ point, score })
  }

  scored.sort((a, b) => b.score - a.score || b.point.count - a.point.count)
  const picked = scored.slice(0, limit).map((item) => item.point)

  if (!picked.length && anchor) {
    const fallback = index.points
      .filter((p) => p.subjectKey === anchor.subjectKey && p.topic === anchor.topic)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
    return fallback.length ? fallback : index.points.slice(0, limit)
  }
  if (!picked.length && index.subjects.length) {
    const popular = [...index.points].sort((a, b) => b.count - a.count).slice(0, limit)
    return popular
  }
  return picked
}

export function buildKnowledgeContext(
  points: KnowledgePoint[],
  questions: Question[],
): string {
  const byId = new Map(questions.map((q) => [q.id, q]))
  const blocks: string[] = []
  let size = 0

  for (const point of points) {
    const lines: string[] = []
    lines.push(
      `【知识点】${point.name}｜科目：${point.subjectKey}｜章节：${point.topic}｜题库收录 ${point.count} 道真题${
        point.years.length ? `（年份 ${point.years.slice(0, 5).join('、')}）` : ''
      }`,
    )
    if (point.explanations.length) {
      lines.push('真题解析摘录：')
      point.explanations.slice(0, 2).forEach((text, i) => lines.push(`${i + 1}. ${clip(text, 240)}`))
    }
    const samples = point.questionIds
      .map((id) => byId.get(id))
      .filter((q): q is Question => Boolean(q))
      .slice(0, 2)
    if (samples.length) {
      lines.push('相关真题题干：')
      samples.forEach((q) => {
        lines.push(`- ${q.year} 年第 ${q.number} 题：${clip(q.stem, 190)}`)
        if (q.answer.length && q.options) {
          lines.push(
            `  参考答案 ${q.answer.join('、')}｜对应选项：${q.answer
              .map((key) => `${key}. ${clip(q.options[key] || '', 90)}`)
              .join(' ')}`,
          )
        }
      })
    }
    if (point.tags.length) lines.push(`标签：${point.tags.slice(0, 6).join('、')}`)
    const block = lines.join('\n')
    if (size + block.length > MAX_CONTEXT) break
    blocks.push(block)
    size += block.length
  }

  return blocks.join('\n\n')
}

export function buildQuestionContext(question: Question): string {
  const lines: string[] = []
  lines.push(
    `【当前题目】${question.year} 年第 ${question.number} 题 · ${question.subjectKey} · ${question.topic} · ${
      TYPE_META[question.type].label
    }`,
  )
  lines.push(`题干：${clip(question.stem, 1400)}`)
  if (Object.keys(question.options).length) {
    lines.push('选项：')
    for (const [key, text] of Object.entries(question.options)) {
      lines.push(`${key}. ${clip(text, 300)}`)
    }
  }
  if (question.answer.length) lines.push(`题库参考答案：${question.answer.join('、')}`)
  if (question.explanation) lines.push(`题库原有解析：${clip(question.explanation, 600)}`)
  if (question.referenceAnswer) lines.push(`参考作答要点：${clip(question.referenceAnswer, 600)}`)
  return lines.join('\n')
}

async function post(path: string, body: unknown, timeoutMs = 90000): Promise<AiReply> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const data = (await response.json().catch(() => ({}))) as {
      answer?: string
      message?: string
      error?: string
      model?: string
      remaining?: number | null
    }
    if (!response.ok) {
      throw new AiError(
        data.error || `http_${response.status}`,
        data.message || 'AI 服务暂时不可用，请稍后再试。',
        response.status,
      )
    }
    if (!data.answer) throw new AiError('empty', 'AI 没有返回内容，请稍后重试。', response.status)
    return { answer: data.answer, model: data.model, remaining: data.remaining ?? null }
  } catch (error) {
    if (error instanceof AiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AiError('timeout', 'AI 响应超时，请稍后重试。')
    }
    throw new AiError('network', '无法连接 AI 服务，请检查网络后重试。')
  } finally {
    window.clearTimeout(timer)
  }
}

export async function askChat(payload: {
  question: string
  history?: AiMessage[]
  context?: string
  subject?: string
}): Promise<AiReply> {
  return post('/api/ai/chat', {
    question: payload.question.slice(0, 500),
    history: (payload.history || [])
      .slice(-6)
      .map((message) => ({ role: message.role, content: message.content.slice(0, 400) })),
    context: (payload.context || '').slice(0, MAX_CONTEXT),
    subject: payload.subject || '',
  })
}

export async function askExplain(payload: {
  question: Question
  selected: string[]
  context?: string
  extra?: string
}): Promise<AiReply> {
  const { question, selected } = payload
  const selectedText = selected.length
    ? selected
        .map((key) => `${key}. ${question.options[key] || ''}`)
        .join('；')
    : '未作答'
  const correctText = question.answer.length
    ? question.answer.map((key) => `${key}. ${question.options[key] || ''}`).join('；')
    : '本题为分析题，题库提供参考要点'
  const prompt = [
    payload.extra?.trim() ? `学生的追问：${clip(payload.extra, 300)}` : '',
    `学生所选：${selectedText}`,
    `正确答案：${correctText}`,
    '请按顺序输出：①正确答案与核心判断理由；②逐个分析每个选项为什么对/错；③本题考点；④相关知识点串联；⑤一句好记的记忆提示。',
  ]
    .filter(Boolean)
    .join('\n')

  return post('/api/ai/explain', {
    question: prompt.slice(0, 900),
    context: [(payload.context || '').slice(0, MAX_CONTEXT), buildQuestionContext(question)].join('\n\n'),
    meta: {
      id: question.id,
      subject: SUBJECT_MAP[question.subjectKey]?.name || question.subjectKey,
      topic: question.topic,
      knowledgePoint: question.knowledgePoint,
    },
  })
}
