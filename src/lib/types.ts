export const SUBJECT_KEYS = ['马原', '毛中特', '新思想', '史纲', '思法', '时政', '综合'] as const

export type SubjectKey = (typeof SUBJECT_KEYS)[number]
export type QuestionType = 'single' | 'multiple' | 'analysis'
export type ThemeMode = 'light' | 'dark' | 'system'
export type FontMode = 'comfortable' | 'compact'

export interface SourceLink {
  title: string
  url: string
}

export interface RawQuestion {
  id: string
  year: number
  number: number
  type: string
  subject: string
  topic?: string
  tags?: string[]
  stem: string
  options?: Record<string, string> | null
  answer?: string[] | string | null
  explanation?: string | null
  sourceUrl?: string
  sourceTitle?: string
  verified?: boolean
  sourceLinks?: SourceLink[]
  knowledgePoint?: string
  referenceAnswer?: string | null
  sourceNote?: string
  imageUrls?: string[]
  figureNote?: string
  missingImage?: boolean
  score?: number
  referenceAnswerNote?: string
}

export interface Question {
  id: string
  year: number
  number: number
  type: QuestionType
  subject: string
  subjectKey: SubjectKey
  topic: string
  tags: string[]
  stem: string
  options: Record<string, string>
  answer: string[]
  explanation: string
  sourceUrl: string
  sourceTitle: string
  sourceLinks: SourceLink[]
  knowledgePoint: string
  referenceAnswer: string
  referenceAnswerNote: string
  sourceNote: string
  imageUrls: string[]
  figureNote: string
  missingImage: boolean
  verified: boolean
}

export interface AnswerRecord {
  selected: string[]
  correct: boolean | null
  method: 'answer' | 'self'
  at: string
  attempts: number
  streakCorrect: number
  wrongCount: number
  text?: string
  durationMs?: number
}

export interface Draft {
  selected?: string[]
  text?: string
}

export interface PaperResult {
  year: number
  best: number
  last: number
  attempts: number
  lastAt: string
  durationSec: number
}

export interface ExamDraft {
  year: number
  startedAt: number
  answers: Record<string, string[]>
  texts: Record<string, string>
}

export interface KnowledgeProgress {
  favorites: string[]
  important: string[]
  visited: Record<string, string>
}

export interface ExamRecord {
  id: string
  at: string
  scope: string
  questionCount: number
  durationSec: number
  limitSec: number
  score: number
  total: number
  correctCount: number
  gradedCount: number
  accuracy: number | null
}

export interface ProgressState {
  records: Record<string, AnswerRecord>
  favorites: string[]
  notes: Record<string, string>
  drafts: Record<string, Draft>
  activity: Record<string, number>
  lastQuestionId: string | null
  papers: Record<string, PaperResult>
  examDraft: ExamDraft | null
  knowledge: KnowledgeProgress
  exams: ExamRecord[]
}

export interface Settings {
  theme: ThemeMode
  fontSize: FontMode
  motion: boolean
}

export interface SubjectMeta {
  key: SubjectKey
  name: string
  short: string
  desc: string
  color: string
  initial: string
}

export interface SubjectStat {
  key: SubjectKey
  name: string
  short: string
  color: string
  total: number
  practiced: number
  graded: number
  correct: number
  accuracy: number | null
}

export interface TypeStat {
  type: QuestionType
  total: number
  practiced: number
  graded: number
  correct: number
  accuracy: number | null
}

export interface YearStat {
  year: number
  total: number
  practiced: number
  graded: number
  correct: number
  accuracy: number | null
}

export interface TopicStat {
  topic: string
  subjectKey: SubjectKey
  total: number
  graded: number
  correct: number
  accuracy: number
  wrong: number
}

export interface Stats {
  total: number
  practiced: number
  graded: number
  correct: number
  accuracy: number | null
  wrong: number
  favorites: number
  notes: number
  streak: number
  todayCount: number
  weekCount: number
  subjects: SubjectStat[]
  types: TypeStat[]
  years: YearStat[]
  topics: TopicStat[]
}
