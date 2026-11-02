import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { loadQuestionBank } from '../lib/data'
import { computeStats, gradeAnswer } from '../lib/stats'
import {
  defaultProgress,
  defaultSettings,
  downloadBackup,
  loadProgress,
  loadProgressSnapshot,
  loadSettings,
  saveProgress,
  saveSettings,
} from '../lib/storage'
import type {
  AnswerRecord,
  Draft,
  ExamDraft,
  ExamRecord,
  FontMode,
  ProgressState,
  Question,
  Settings,
  Stats,
  ThemeMode,
} from '../lib/types'
import { dateKey } from '../lib/utils'

interface ToastState {
  id: number
  message: string
}

export interface PaperSummary {
  year: number
  score: number
  objectiveTotal: number
  correctCount: number
  gradedCount: number
  answered: number
  durationSec: number
}

interface StudyContextValue {
  questions: Question[]
  loading: boolean
  error: string | null
  progress: ProgressState
  settings: Settings
  stats: Stats
  toast: ToastState | null
  notify: (message: string) => void
  submitAnswer: (question: Question, selected: string[], text?: string) => boolean | null
  rateAnalysis: (question: Question, correct: boolean, text: string) => void
  toggleFavorite: (id: string) => boolean
  setNote: (id: string, note: string) => void
  saveDraft: (id: string, patch: Draft) => void
  setLastQuestion: (id: string) => void
  setTheme: (theme: ThemeMode) => void
  setFontSize: (fontSize: FontMode) => void
  setMotion: (motion: boolean) => void
  saveExamDraft: (draft: ExamDraft | null) => void
  submitPaper: (
    year: number,
    answers: Record<string, string[]>,
    texts: Record<string, string>,
    durationSec: number,
  ) => PaperSummary
  exportBackup: () => void
  importBackup: (file: File) => Promise<void>
  resetProgress: () => void
  removeRecord: (id: string) => void
  markMastered: (id: string) => void
  toggleKnowledgeFavorite: (id: string) => boolean
  toggleKnowledgeImportant: (id: string) => boolean
  visitKnowledge: (id: string) => void
  submitExam: (
    questions: Question[],
    answers: Record<string, string[]>,
    scope: string,
    durationSec: number,
    limitSec: number,
  ) => ExamRecord
}

const StudyContext = createContext<StudyContextValue | null>(null)

function cleanRecord(raw: unknown, knownIds: Set<string>, id: string): AnswerRecord | null {
  if (!knownIds.has(id) || !raw || typeof raw !== 'object') return null
  const value = raw as Partial<AnswerRecord>
  return {
    selected: Array.isArray(value.selected)
      ? value.selected.filter((x): x is string => typeof x === 'string' && /^[A-D]$/.test(x))
      : [],
    correct: typeof value.correct === 'boolean' ? value.correct : null,
    method: value.method === 'self' ? 'self' : 'answer',
    at: typeof value.at === 'string' ? value.at : new Date().toISOString(),
    attempts: Number.isFinite(value.attempts) ? Number(value.attempts) : 1,
    streakCorrect: Number.isFinite(value.streakCorrect) ? Number(value.streakCorrect) : 0,
    wrongCount: Number.isFinite(value.wrongCount) ? Number(value.wrongCount) : 0,
    text: typeof value.text === 'string' ? value.text.slice(0, 60000) : '',
    durationMs: Number.isFinite(value.durationMs) ? Number(value.durationMs) : undefined,
  }
}

export function StudyProvider({ children }: { children: ReactNode }) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress())
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimer = useRef<number | null>(null)

  useEffect(() => {
    let alive = true
    loadQuestionBank()
      .then((bank) => {
        if (!alive) return
        setQuestions(bank.questions)
        setLoading(false)
      })
      .catch((reason: unknown) => {
        if (!alive) return
        setError(reason instanceof Error ? reason.message : '题库加载失败')
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let alive = true
    loadProgressSnapshot()
      .then((snapshot) => {
        if (!alive || !snapshot) return
        setProgress(snapshot.data)
      })
      .catch(() => {
        /* IndexedDB 不可用时继续使用 localStorage 缓存 */
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    saveProgress(progress)
  }, [progress])

  useEffect(() => {
    saveSettings(settings)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark =
        settings.theme === 'dark' || (settings.theme === 'system' && media.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
      document.documentElement.dataset.font = settings.fontSize
      document.documentElement.dataset.motion = settings.motion ? 'on' : 'off'
      const meta = document.querySelector('meta[name="theme-color"]')
      meta?.setAttribute('content', dark ? '#101215' : '#f5f2ea')
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [settings])

  const notify = useCallback((message: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), message })
    toastTimer.current = window.setTimeout(() => setToast(null), 2800)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  const stats = useMemo(() => computeStats(questions, progress), [questions, progress])

  const submitAnswer = useCallback(
    (question: Question, selected: string[], text = ''): boolean | null => {
      const correct = gradeAnswer(question, selected)
      const now = new Date().toISOString()
      const key = dateKey()
      setProgress((prev) => {
        const existing = prev.records[question.id]
        const record: AnswerRecord = {
          selected,
          correct,
          method: question.type === 'analysis' ? 'self' : 'answer',
          at: now,
          attempts: (existing?.attempts || 0) + 1,
          streakCorrect: correct ? (existing?.streakCorrect || 0) + 1 : 0,
          wrongCount: (existing?.wrongCount || 0) + (correct === false ? 1 : 0),
          text,
        }
        const drafts = { ...prev.drafts }
        delete drafts[question.id]
        return {
          ...prev,
          records: { ...prev.records, [question.id]: record },
          drafts,
          activity: { ...prev.activity, [key]: (prev.activity[key] || 0) + 1 },
          lastQuestionId: question.id,
        }
      })
      return correct
    },
    [],
  )

  const rateAnalysis = useCallback((question: Question, correct: boolean, text: string) => {
    const now = new Date().toISOString()
    setProgress((prev) => {
      const existing = prev.records[question.id]
      const wasWrong = existing?.correct === false
      const record: AnswerRecord = {
        selected: [],
        correct,
        method: 'self',
        at: now,
        attempts: existing?.attempts || 1,
        streakCorrect: correct ? (existing?.streakCorrect || 0) + 1 : 0,
        wrongCount:
          (existing?.wrongCount || 0) + (!correct && !wasWrong ? 1 : 0),
        text,
      }
      return { ...prev, records: { ...prev.records, [question.id]: record } }
    })
  }, [])

  const toggleFavorite = useCallback(
    (id: string): boolean => {
      const exists = progress.favorites.includes(id)
      setProgress((prev) => ({
        ...prev,
        favorites: prev.favorites.includes(id)
          ? prev.favorites.filter((x) => x !== id)
          : [id, ...prev.favorites],
      }))
      return !exists
    },
    [progress.favorites],
  )

  const setNote = useCallback((id: string, note: string) => {
    setProgress((prev) => {
      const notes = { ...prev.notes }
      if (note.trim()) notes[id] = note
      else delete notes[id]
      return { ...prev, notes }
    })
  }, [])

  const saveDraft = useCallback((id: string, patch: Draft) => {
    setProgress((prev) => ({
      ...prev,
      drafts: { ...prev.drafts, [id]: { ...prev.drafts[id], ...patch } },
    }))
  }, [])

  const setLastQuestion = useCallback((id: string) => {
    setProgress((prev) =>
      prev.lastQuestionId === id ? prev : { ...prev, lastQuestionId: id },
    )
  }, [])

  const setTheme = useCallback((theme: ThemeMode) => {
    setSettings((prev) => ({ ...prev, theme }))
  }, [])

  const setFontSize = useCallback((fontSize: FontMode) => {
    setSettings((prev) => ({ ...prev, fontSize }))
  }, [])

  const setMotion = useCallback((motion: boolean) => {
    setSettings((prev) => ({ ...prev, motion }))
  }, [])

  const saveExamDraft = useCallback((draft: ExamDraft | null) => {
    setProgress((prev) => ({ ...prev, examDraft: draft }))
  }, [])

  const submitPaper = useCallback(
    (
      year: number,
      answers: Record<string, string[]>,
      texts: Record<string, string>,
      durationSec: number,
    ): PaperSummary => {
      const paperQuestions = questions.filter((q) => q.year === year)
      const now = new Date().toISOString()
      let score = 0
      let objectiveTotal = 0
      let correctCount = 0
      let gradedCount = 0
      let answered = 0
      const patch: Record<string, AnswerRecord> = {}

      for (const question of paperQuestions) {
        if (question.type === 'single') objectiveTotal += 1
        if (question.type === 'multiple') objectiveTotal += 2
        const selected = answers[question.id] || []
        const text = texts[question.id] || ''
        if (!selected.length && !text.trim()) continue
        answered += 1
        const correct = gradeAnswer(question, selected)
        if (correct !== null) {
          gradedCount += 1
          if (correct) {
            correctCount += 1
            score += question.type === 'multiple' ? 2 : 1
          }
        }
        patch[question.id] = {
          selected,
          correct,
          method: question.type === 'analysis' ? 'self' : 'answer',
          at: now,
          attempts: (progress.records[question.id]?.attempts || 0) + 1,
          streakCorrect: correct ? (progress.records[question.id]?.streakCorrect || 0) + 1 : 0,
          wrongCount:
            (progress.records[question.id]?.wrongCount || 0) + (correct === false ? 1 : 0),
          text,
        }
      }

      setProgress((prev) => {
        const existing = prev.papers[String(year)]
        const key = dateKey()
        return {
          ...prev,
          records: { ...prev.records, ...patch },
          activity: { ...prev.activity, [key]: (prev.activity[key] || 0) + answered },
          papers: {
            ...prev.papers,
            [String(year)]: {
              year,
              best: Math.max(existing?.best || 0, score),
              last: score,
              attempts: (existing?.attempts || 0) + 1,
              lastAt: now,
              durationSec,
            },
          },
          examDraft: null,
        }
      })

      return {
        year,
        score,
        objectiveTotal,
        correctCount,
        gradedCount,
        answered,
        durationSec,
      }
    },
    [questions, progress.records],
  )

  const exportBackup = useCallback(() => {
    downloadBackup(progress, settings)
    notify('学习记录已导出')
  }, [progress, settings, notify])

  const importBackup = useCallback(
    async (file: File) => {
      if (file.size > 20 * 1024 * 1024) {
        notify('文件过大，无法导入')
        return
      }
      try {
        const parsed = JSON.parse(await file.text())
        const source = parsed?.progress && typeof parsed.progress === 'object' ? parsed.progress : parsed
        if (!source || typeof source !== 'object' || !source.records) {
          throw new Error('bad format')
        }
        const known = new Set(questions.map((q) => q.id))
        const incomingRecords = source.records as Record<string, unknown>
        const merged = Object.keys(incomingRecords).filter((id) => known.has(id)).length
        setProgress((prev) => {
          const records = { ...prev.records }
          for (const [id, raw] of Object.entries(incomingRecords)) {
            const clean = cleanRecord(raw, known, id)
            if (!clean) continue
            const existing = records[id]
            if (!existing || new Date(clean.at).getTime() >= new Date(existing.at).getTime()) {
              records[id] = clean
            }
          }
          const favorites = new Set(prev.favorites)
          if (Array.isArray(source.favorites)) {
            for (const id of source.favorites) {
              if (typeof id === 'string' && known.has(id)) favorites.add(id)
            }
          }
          const notes = { ...prev.notes }
          if (source.notes && typeof source.notes === 'object') {
            for (const [id, note] of Object.entries(source.notes)) {
              if (known.has(id) && typeof note === 'string' && note.trim()) notes[id] = note
            }
          }
          const activity = { ...prev.activity }
          if (source.activity && typeof source.activity === 'object') {
            for (const [day, count] of Object.entries(source.activity)) {
              if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(count)) {
                activity[day] = Math.max(activity[day] || 0, Number(count))
              }
            }
          }
          const papers = { ...prev.papers }
          if (source.papers && typeof source.papers === 'object') {
            for (const [year, paper] of Object.entries(source.papers)) {
              const value = paper as { best?: number; last?: number; attempts?: number }
              const existing = papers[year]
              if (!existing) {
                papers[year] = {
                  year: Number(year),
                  best: Number(value.best) || 0,
                  last: Number(value.last) || 0,
                  attempts: Number(value.attempts) || 1,
                  lastAt: new Date().toISOString(),
                  durationSec: 0,
                }
              } else {
                papers[year] = {
                  ...existing,
                  best: Math.max(existing.best, Number(value.best) || 0),
                  attempts: Math.max(existing.attempts, Number(value.attempts) || 1),
                }
              }
            }
          }
          const knowledge = { ...prev.knowledge }
          if (source.knowledge && typeof source.knowledge === 'object') {
            const incoming = source.knowledge as { favorites?: unknown; important?: unknown; visited?: unknown }
            const nextFavorites = new Set(knowledge.favorites)
            const nextImportant = new Set(knowledge.important)
            if (Array.isArray(incoming.favorites)) {
              for (const id of incoming.favorites) if (typeof id === 'string') nextFavorites.add(id)
            }
            if (Array.isArray(incoming.important)) {
              for (const id of incoming.important) if (typeof id === 'string') nextImportant.add(id)
            }
            const visited = { ...knowledge.visited }
            if (incoming.visited && typeof incoming.visited === 'object') {
              for (const [id, at] of Object.entries(incoming.visited)) {
                if (typeof id === 'string' && typeof at === 'string') {
                  if (!visited[id] || at > visited[id]) visited[id] = at
                }
              }
            }
            knowledge.favorites = [...nextFavorites]
            knowledge.important = [...nextImportant]
            knowledge.visited = visited
          }
          const exams = Array.isArray(source.exams)
            ? [...source.exams, ...prev.exams]
                .filter((item): item is ExamRecord => Boolean(item && typeof item === 'object' && item.id))
                .sort((a, b) => String(b.at).localeCompare(String(a.at)))
                .slice(0, 20)
            : prev.exams
          return {
            ...prev,
            records,
            favorites: [...favorites],
            notes,
            activity,
            papers,
            knowledge,
            exams,
          }
        })
        if (parsed?.settings && typeof parsed.settings === 'object') {
          const next = parsed.settings as Partial<Settings>
          setSettings((prev) => ({
            theme:
              next.theme === 'light' || next.theme === 'dark' || next.theme === 'system'
                ? next.theme
                : prev.theme,
            fontSize: next.fontSize === 'compact' ? 'compact' : prev.fontSize,
            motion: typeof next.motion === 'boolean' ? next.motion : prev.motion,
          }))
        }
        notify(`已合并 ${merged} 道题的记录`)
      } catch {
        notify('无法导入：请选择由桃子专属导出的 JSON 文件')
      }
    },
    [questions, notify],
  )

  const resetProgress = useCallback(() => {
    setProgress({ ...defaultProgress })
    notify('学习记录已清空')
  }, [notify])

  const removeRecord = useCallback((id: string) => {
    setProgress((prev) => {
      const records = { ...prev.records }
      delete records[id]
      const drafts = { ...prev.drafts }
      delete drafts[id]
      return { ...prev, records, drafts }
    })
  }, [])

  const markMastered = useCallback((id: string) => {
    setProgress((prev) => {
      const record = prev.records[id]
      if (!record) return prev
      return {
        ...prev,
        records: {
          ...prev.records,
          [id]: { ...record, streakCorrect: Math.max(2, record.streakCorrect), correct: true },
        },
      }
    })
  }, [])

  const toggleKnowledgeFavorite = useCallback((id: string): boolean => {
    const exists = progress.knowledge.favorites.includes(id)
    setProgress((prev) => ({
      ...prev,
      knowledge: {
        ...prev.knowledge,
        favorites: prev.knowledge.favorites.includes(id)
          ? prev.knowledge.favorites.filter((x) => x !== id)
          : [id, ...prev.knowledge.favorites],
      },
    }))
    return !exists
  }, [progress.knowledge.favorites])

  const toggleKnowledgeImportant = useCallback((id: string): boolean => {
    const exists = progress.knowledge.important.includes(id)
    setProgress((prev) => ({
      ...prev,
      knowledge: {
        ...prev.knowledge,
        important: prev.knowledge.important.includes(id)
          ? prev.knowledge.important.filter((x) => x !== id)
          : [id, ...prev.knowledge.important],
      },
    }))
    return !exists
  }, [progress.knowledge.important])

  const visitKnowledge = useCallback((id: string) => {
    setProgress((prev) => {
      const visited = { ...prev.knowledge.visited, [id]: new Date().toISOString() }
      const entries = Object.entries(visited)
        .sort((a, b) => b[1].localeCompare(a[1]))
        .slice(0, 30)
      return {
        ...prev,
        knowledge: { ...prev.knowledge, visited: Object.fromEntries(entries) },
      }
    })
  }, [])

  const submitExam = useCallback(
    (
      examQuestions: Question[],
      answers: Record<string, string[]>,
      scope: string,
      durationSec: number,
      limitSec: number,
    ): ExamRecord => {
      const now = new Date().toISOString()
      let score = 0
      let total = 0
      let gradedCount = 0
      let correctCount = 0
      const patch: Record<string, AnswerRecord> = {}

      for (const question of examQuestions) {
        const points = question.type === 'multiple' ? 2 : 1
        total += points
        const selected = answers[question.id] || []
        const correct = gradeAnswer(question, selected)
        if (correct !== null) {
          gradedCount += 1
          if (correct) {
            correctCount += 1
            score += points
          }
        }
        patch[question.id] = {
          selected,
          correct,
          method: 'answer',
          at: now,
          attempts: (progress.records[question.id]?.attempts || 0) + 1,
          streakCorrect: correct ? (progress.records[question.id]?.streakCorrect || 0) + 1 : 0,
          wrongCount:
            (progress.records[question.id]?.wrongCount || 0) + (correct === false ? 1 : 0),
        }
      }

      const record: ExamRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        at: now,
        scope,
        questionCount: examQuestions.length,
        durationSec,
        limitSec,
        score,
        total,
        correctCount,
        gradedCount,
        accuracy: gradedCount ? correctCount / gradedCount : null,
      }

      setProgress((prev) => {
        const key = dateKey()
        return {
          ...prev,
          records: { ...prev.records, ...patch },
          activity: { ...prev.activity, [key]: (prev.activity[key] || 0) + examQuestions.length },
          exams: [record, ...prev.exams].slice(0, 20),
        }
      })

      return record
    },
    [progress.records],
  )

  const value: StudyContextValue = {
    questions,
    loading,
    error,
    progress,
    settings,
    stats,
    toast,
    notify,
    submitAnswer,
    rateAnalysis,
    toggleFavorite,
    setNote,
    saveDraft,
    setLastQuestion,
    setTheme,
    setFontSize,
    setMotion,
    saveExamDraft,
    submitPaper,
    exportBackup,
    importBackup,
    resetProgress,
    removeRecord,
    markMastered,
    toggleKnowledgeFavorite,
    toggleKnowledgeImportant,
    visitKnowledge,
    submitExam,
  }

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>
}

export function useStudy(): StudyContextValue {
  const context = useContext(StudyContext)
  if (!context) throw new Error('useStudy must be used inside StudyProvider')
  return context
}

export { defaultSettings }
