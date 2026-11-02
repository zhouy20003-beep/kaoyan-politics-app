import { dateKey } from './utils'
import { idbAvailable, idbGet, idbSet } from './idb'
import type { ExamRecord, KnowledgeProgress, ProgressState, Settings } from './types'

export const PROGRESS_KEY = 'echo.progress.v2'
export const SETTINGS_KEY = 'echo.settings.v1'
const LEGACY_PROGRESS_KEY = 'polis.progress.v1'
const LEGACY_SETTINGS_KEY = 'polis.settings'

export const defaultKnowledge: KnowledgeProgress = {
  favorites: [],
  important: [],
  visited: {},
}

export const defaultProgress: ProgressState = {
  records: {},
  favorites: [],
  notes: {},
  drafts: {},
  activity: {},
  lastQuestionId: null,
  papers: {},
  examDraft: null,
  knowledge: { ...defaultKnowledge },
  exams: [],
}

export const defaultSettings: Settings = {
  theme: 'system',
  fontSize: 'comfortable',
  motion: true,
}

interface Envelope<T> {
  savedAt: number
  data: T
}

function safeParse<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function readEnvelope<T>(key: string): Envelope<T> | null {
  const value = safeParse<unknown>(key)
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if ('savedAt' in record && 'data' in record) {
    return { savedAt: Number(record.savedAt) || 0, data: record.data as T }
  }
  return { savedAt: 0, data: value as T }
}

export function normalizeProgress(saved: Partial<ProgressState> | null | undefined): ProgressState {
  if (!saved || typeof saved !== 'object') {
    return { ...defaultProgress, knowledge: { ...defaultKnowledge } }
  }
  const knowledge = saved.knowledge && typeof saved.knowledge === 'object' ? saved.knowledge : defaultKnowledge
  return {
    records: saved.records && typeof saved.records === 'object' ? saved.records : {},
    favorites: Array.isArray(saved.favorites) ? saved.favorites.filter((x) => typeof x === 'string') : [],
    notes: saved.notes && typeof saved.notes === 'object' ? saved.notes : {},
    drafts: saved.drafts && typeof saved.drafts === 'object' ? saved.drafts : {},
    activity: saved.activity && typeof saved.activity === 'object' ? saved.activity : {},
    lastQuestionId: typeof saved.lastQuestionId === 'string' ? saved.lastQuestionId : null,
    papers: saved.papers && typeof saved.papers === 'object' ? saved.papers : {},
    examDraft: saved.examDraft && typeof saved.examDraft === 'object' ? saved.examDraft : null,
    knowledge: {
      favorites: Array.isArray(knowledge.favorites)
        ? knowledge.favorites.filter((x) => typeof x === 'string')
        : [],
      important: Array.isArray(knowledge.important)
        ? knowledge.important.filter((x) => typeof x === 'string')
        : [],
      visited:
        knowledge.visited && typeof knowledge.visited === 'object'
          ? knowledge.visited
          : {},
    },
    exams: Array.isArray(saved.exams)
      ? (saved.exams.filter((item) => item && typeof item === 'object') as ExamRecord[])
      : [],
  }
}

export function loadProgress(): ProgressState {
  const current = readEnvelope<ProgressState>(PROGRESS_KEY)
  if (current) return normalizeProgress(current.data)
  const legacy = readEnvelope<ProgressState>(LEGACY_PROGRESS_KEY)
  if (legacy) return normalizeProgress(legacy.data)
  return { ...defaultProgress, knowledge: { ...defaultKnowledge } }
}

/** IndexedDB 中的完整快照（返回 savedAt 便于与 localStorage 缓存比较新旧）。 */
export async function loadProgressSnapshot(): Promise<Envelope<ProgressState> | null> {
  const snapshot = await idbGet<Envelope<ProgressState>>(PROGRESS_KEY)
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.data) return null
  return { savedAt: Number(snapshot.savedAt) || 0, data: normalizeProgress(snapshot.data) }
}

export function saveProgress(progress: ProgressState): void {
  const envelope: Envelope<ProgressState> = { savedAt: Date.now(), data: progress }
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(envelope))
  } catch {
    /* 缓存失败不影响使用，IndexedDB 仍会保存 */
  }
  void idbSet(PROGRESS_KEY, envelope)
}

export function loadSettings(): Settings {
  const current = readEnvelope<Settings>(SETTINGS_KEY)
  const legacy = readEnvelope<Settings>(LEGACY_SETTINGS_KEY)
  const saved = current?.data || legacy?.data
  if (!saved || typeof saved !== 'object') return { ...defaultSettings }
  return {
    theme: saved.theme === 'light' || saved.theme === 'dark' || saved.theme === 'system' ? saved.theme : 'system',
    fontSize: saved.fontSize === 'compact' ? 'compact' : 'comfortable',
    motion: saved.motion !== false,
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ savedAt: Date.now(), data: settings }))
  } catch {
    /* Ignore blocked storage. */
  }
  void idbSet(SETTINGS_KEY, { savedAt: Date.now(), data: settings })
}

export async function checkLocalStorage(): Promise<{ indexedDb: boolean; local: boolean }> {
  const indexedDb = await idbAvailable()
  let local = false
  try {
    localStorage.setItem('echo.probe', '1')
    localStorage.removeItem('echo.probe')
    local = true
  } catch {
    local = false
  }
  return { indexedDb, local }
}

export interface BackupFile {
  app: string
  version: number
  exportedAt: string
  progress: ProgressState
  settings: Settings
}

export function buildBackup(progress: ProgressState, settings: Settings): BackupFile {
  return {
    app: 'Echo 考研政治 AI 学习平台',
    version: 2,
    exportedAt: new Date().toISOString(),
    progress,
    settings,
  }
}

export function downloadBackup(progress: ProgressState, settings: Settings): void {
  const blob = new Blob([JSON.stringify(buildBackup(progress, settings), null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const stamp = dateKey()
  anchor.href = url
  anchor.download = `Echo学习记录_${stamp}.json`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
