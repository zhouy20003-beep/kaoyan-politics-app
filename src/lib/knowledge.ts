import { SUBJECT_MAP } from './data'
import type { Question, SubjectKey } from './types'

/**
 * 知识库完全由项目真实题库推导：
 * 科目 → 章节（题库 topic）→ 知识点（题库 knowledgePoint）。
 * 释义只摘录真题解析原文，不新增任何编造的政治理论内容。
 */

export interface KnowledgePoint {
  id: string
  name: string
  topic: string
  subjectKey: SubjectKey
  subjectName: string
  count: number
  years: number[]
  questionIds: string[]
  explanations: string[]
  tags: string[]
  reference: string
}

export interface Chapter {
  topic: string
  subjectKey: SubjectKey
  count: number
  points: KnowledgePoint[]
}

export interface SubjectTree {
  key: SubjectKey
  name: string
  short: string
  desc: string
  color: string
  count: number
  chapters: Chapter[]
}

export interface KnowledgeIndex {
  subjects: SubjectTree[]
  points: KnowledgePoint[]
  byId: Map<string, KnowledgePoint>
  total: number
  totalChapters: number
}

function pointId(subjectKey: string, topic: string, name: string): string {
  return `${subjectKey}::${topic}::${name}`
}

export function buildKnowledgeIndex(questions: Question[]): KnowledgeIndex {
  const pointMap = new Map<string, KnowledgePoint>()

  for (const question of questions) {
    const name = question.knowledgePoint || question.topic
    const id = pointId(question.subjectKey, question.topic, name)
    let point = pointMap.get(id)
    if (!point) {
      point = {
        id,
        name,
        topic: question.topic,
        subjectKey: question.subjectKey,
        subjectName: SUBJECT_MAP[question.subjectKey]?.name || question.subjectKey,
        count: 0,
        years: [],
        questionIds: [],
        explanations: [],
        tags: [],
        reference: '',
      }
      pointMap.set(id, point)
    }
    point.count += 1
    if (!point.years.includes(question.year)) point.years.push(question.year)
    point.questionIds.push(question.id)
    if (
      question.explanation &&
      question.explanation.length > 10 &&
      !point.explanations.includes(question.explanation)
    ) {
      point.explanations.push(question.explanation)
    }
    for (const tag of question.tags) {
      if (tag === question.subjectKey || point.tags.includes(tag)) continue
      if (point.tags.length < 8) point.tags.push(tag)
    }
  }

  const questionById = new Map(questions.map((q) => [q.id, q]))

  for (const point of pointMap.values()) {
    point.years.sort((a, b) => b - a)
    point.explanations = point.explanations.slice(0, 3)
    point.questionIds.sort((a, b) => {
      const qa = questionById.get(a)
      const qb = questionById.get(b)
      return (qb?.year || 0) - (qa?.year || 0) || (qa?.number || 0) - (qb?.number || 0)
    })
    point.reference = point.explanations[0] || ''
  }

  const subjects = new Map<SubjectKey, SubjectTree>()

  for (const meta of Object.values(SUBJECT_MAP)) {
    const subjectQuestions = questions.filter((q) => q.subjectKey === meta.key)
    if (!subjectQuestions.length) continue
    const chapters = new Map<string, Chapter>()
    for (const question of subjectQuestions) {
      const chapter = chapters.get(question.topic) || {
        topic: question.topic,
        subjectKey: meta.key,
        count: 0,
        points: [],
      }
      chapter.count += 1
      chapters.set(question.topic, chapter)
    }
    for (const point of pointMap.values()) {
      if (point.subjectKey !== meta.key) continue
      const chapter = chapters.get(point.topic)
      if (chapter) chapter.points.push(point)
    }
    const tree: SubjectTree = {
      key: meta.key,
      name: meta.name,
      short: meta.short,
      desc: meta.desc,
      color: meta.color,
      count: subjectQuestions.length,
      chapters: [...chapters.values()]
        .map((chapter) => ({
          ...chapter,
          points: chapter.points.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN')),
        }))
        .sort((a, b) => b.count - a.count),
    }
    subjects.set(meta.key, tree)
  }

  const points = [...pointMap.values()]
  return {
    subjects: [...subjects.values()].sort(
      (a, b) => questions.filter((q) => q.subjectKey === a.key).length - questions.filter((q) => q.subjectKey === b.key).length,
    ),
    points,
    byId: pointMap,
    total: points.length,
    totalChapters: [...new Set(points.map((p) => `${p.subjectKey}::${p.topic}`))].length,
  }
}

export function relatedPoints(index: KnowledgeIndex, point: KnowledgePoint, limit = 6): KnowledgePoint[] {
  const chapter = index.subjects
    .find((s) => s.key === point.subjectKey)
    ?.chapters.find((c) => c.topic === point.topic)
  const sameChapter = (chapter?.points || []).filter((item) => item.id !== point.id)
  const sameSubject = index.points
    .filter((item) => item.subjectKey === point.subjectKey && item.id !== point.id && item.topic !== point.topic)
    .sort((a, b) => b.count - a.count)
  return [...sameChapter, ...sameSubject].slice(0, limit)
}

export interface KnowledgeHit {
  point: KnowledgePoint
  score: number
}

export function searchKnowledge(index: KnowledgeIndex, query: string, limit = 30): KnowledgeHit[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  const hits: KnowledgeHit[] = []
  for (const point of index.points) {
    const name = point.name.toLowerCase()
    const topic = point.topic.toLowerCase()
    const subject = point.subjectName.toLowerCase()
    let score = 0
    if (name === needle) score += 20
    if (name.includes(needle)) score += 12
    if (topic.includes(needle)) score += 7
    if (subject.includes(needle)) score += 3
    if (point.tags.some((tag) => tag.toLowerCase().includes(needle))) score += 5
    if (point.explanations.some((text) => text.toLowerCase().includes(needle))) score += 2
    if (score > 0) hits.push({ point, score })
  }
  return hits.sort((a, b) => b.score - a.score || b.point.count - a.point.count).slice(0, limit)
}

export function knowledgeStats(
  points: KnowledgePoint[],
  records: Record<string, { correct?: boolean | null }>,
): { totalQuestions: number; practiced: number; accuracy: number | null } {
  let totalQuestions = 0
  let graded = 0
  let correct = 0
  for (const point of points) {
    totalQuestions += point.count
    for (const id of point.questionIds) {
      const record = records[id]
      if (!record || typeof record.correct !== 'boolean') continue
      graded += 1
      if (record.correct) correct += 1
    }
  }
  return {
    totalQuestions,
    practiced: graded,
    accuracy: graded ? correct / graded : null,
  }
}
