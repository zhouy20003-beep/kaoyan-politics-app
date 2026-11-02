import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  CheckCircle2,
  Clock,
  FileText,
  Flag,
  Loader2,
  Play,
  RotateCcw,
  Target,
  X,
} from 'lucide-react'
import { QuestionCard } from '../components/question/QuestionCard'
import { Button, Modal, ProgressBar, Segmented, Select } from '../components/ui/primitives'
import { SUBJECT_META } from '../lib/data'
import type { ExamRecord, Question, SubjectKey } from '../lib/types'
import { cn, formatDuration, navigate, shuffle } from '../lib/utils'
import { useStudy } from '../store/StudyProvider'

const SESSION_KEY = 'echo.exam.session.v1'

interface ExamSession {
  id: string
  scope: string
  scopeKey: SubjectKey | 'all'
  limitSec: number
  startedAt: number
  questionIds: string[]
  answers: Record<string, string[]>
}

type ExamPhase = 'setup' | 'running' | 'report'

interface ExamResultView {
  record: ExamRecord
  questions: Question[]
  answers: Record<string, string[]>
}

function readSession(): ExamSession | null {
  try {
    const raw = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as ExamSession | null
    if (!raw || !Array.isArray(raw.questionIds) || !raw.questionIds.length) return null
    return {
      ...raw,
      answers: raw.answers && typeof raw.answers === 'object' ? raw.answers : {},
      startedAt: Number(raw.startedAt) || Date.now(),
      limitSec: Number(raw.limitSec) || 3600,
    }
  } catch {
    return null
  }
}

export function Exam() {
  const {
    questions,
    progress,
    submitExam,
    toggleFavorite,
    setNote,
    notify,
  } = useStudy()

  const [phase, setPhase] = useState<ExamPhase>('setup')
  const [scopeKey, setScopeKey] = useState<SubjectKey | 'all'>('all')
  const [type, setType] = useState<'objective' | 'single' | 'multiple'>('objective')
  const [count, setCount] = useState(30)
  const [minutes, setMinutes] = useState(60)
  const [session, setSession] = useState<ExamSession | null>(null)
  const [index, setIndex] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [result, setResult] = useState<ExamResultView | null>(null)
  const [resumed, setResumed] = useState(false)
  const submittingRef = useRef(false)

  useEffect(() => {
    const saved = readSession()
    if (saved) {
      setSession(saved)
      setResumed(true)
      setNow(Date.now())
    }
  }, [])

  const pool = useMemo(() => {
    return questions.filter((q) => {
      if (q.type === 'analysis') return false
      if (scopeKey !== 'all' && q.subjectKey !== scopeKey) return false
      if (type !== 'objective' && q.type !== type) return false
      return q.answer.length > 0
    })
  }, [questions, scopeKey, type])

  const examQuestions = useMemo(() => {
    if (!session) return []
    const byId = new Map(questions.map((q) => [q.id, q]))
    return session.questionIds
      .map((id) => byId.get(id))
      .filter((q): q is Question => Boolean(q))
  }, [session, questions])

  const current = examQuestions[index]

  useEffect(() => {
    if (phase !== 'running' || !session) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [phase, session])

  useEffect(() => {
    if (!session) return
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } catch {
      /* 本地存储不可用时仍可继续考试 */
    }
  }, [session])

  const remaining = session
    ? Math.max(0, session.limitSec - Math.floor((now - session.startedAt) / 1000))
    : 0

  const answeredCount = session
    ? examQuestions.filter((q) => (session.answers[q.id] || []).length > 0).length
    : 0

  const start = () => {
    const picked = shuffle(pool).slice(0, Math.min(count, pool.length))
    if (!picked.length) {
      notify('这个范围下没有可组卷的客观题，请换一个范围')
      return
    }
    const next: ExamSession = {
      id: `${Date.now()}`,
      scope: scopeKey === 'all' ? '全部题库' : `${scopeKey}专项`,
      scopeKey,
      limitSec: minutes * 60,
      startedAt: Date.now(),
      questionIds: picked.map((q) => q.id),
      answers: {},
    }
    setSession(next)
    setResult(null)
    setIndex(0)
    setNow(Date.now())
    setResumed(false)
    setPhase('running')
  }

  const submit = () => {
    if (!session || submittingRef.current) return
    submittingRef.current = true
    const durationSec = Math.max(1, Math.floor((Date.now() - session.startedAt) / 1000))
    const record = submitExam(examQuestions, session.answers, session.scope, durationSec, session.limitSec)
    setResult({ record, questions: examQuestions, answers: session.answers })
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
    setSession(null)
    setConfirmOpen(false)
    setPhase('report')
    submittingRef.current = false
  }

  const submitRef = useRef(submit)
  submitRef.current = submit

  useEffect(() => {
    if (phase === 'running' && session && remaining === 0) submitRef.current()
  }, [phase, session, remaining])

  const choose = (letter: string) => {
    if (!current || !session) return
    setSession((prev) => {
      if (!prev) return prev
      const selected = prev.answers[current.id] || []
      const nextSelected =
        current.type === 'single'
          ? [letter]
          : selected.includes(letter)
            ? selected.filter((key) => key !== letter)
            : [...selected, letter].sort()
      return { ...prev, answers: { ...prev.answers, [current.id]: nextSelected } }
    })
  }

  const discard = () => {
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
    setSession(null)
    setResumed(false)
    setPhase('setup')
    notify('已放弃本次模拟考试')
  }

  const shadow = session ? null : readSession()

  return (
    <div className="page exam-page">
      <header className="page-head">
        <div>
          <span className="eyebrow">
            <span className="live-dot" aria-hidden="true" />
            MOCK EXAM · 自动组卷
          </span>
          <h1>模拟考试</h1>
          <p className="page-sub">
            从真实题库中随机组卷，限时作答，交卷后自动评分并给出逐题解析。所有作答只保存在本机。
          </p>
        </div>
        <div className="page-head-aside">
          <div className="echo-stat">
            <span>可组卷客观题</span>
            <strong>{questions.filter((q) => q.type !== 'analysis' && q.answer.length).length}</strong>
            <em>道</em>
          </div>
        </div>
      </header>

      {phase === 'setup' ? (
        <>
          {shadow ? (
            <section className="exam-resume">
              <div>
                <span className="panel-label">UNFINISHED</span>
                <h2>你有一场未完成的模拟考试</h2>
                <p>
                  {shadow.scope} · 共 {shadow.questionIds.length} 题 · 已作答{' '}
                  {Object.values(shadow.answers).filter((value) => value.length).length} 题
                </p>
              </div>
              <div className="exam-resume-actions">
                <Button
                  variant="primary"
                  onClick={() => {
                    setSession(shadow)
                    setIndex(0)
                    setNow(Date.now())
                    setResumed(true)
                    setPhase('running')
                  }}
                  leading={<Play size={15} />}
                >
                  继续考试
                </Button>
                <Button variant="ghost" onClick={discard}>
                  放弃
                </Button>
              </div>
            </section>
          ) : null}

          <section className="exam-setup">
            <article className="panel">
              <header className="panel-head">
                <div>
                  <span className="panel-label">STEP 1</span>
                  <h2>选择考试范围</h2>
                </div>
              </header>
              <div className="subject-chips">
                <button
                  type="button"
                  className={cn('chip', scopeKey === 'all' && 'is-active')}
                  onClick={() => setScopeKey('all')}
                >
                  全部题库
                </button>
                {SUBJECT_META.filter((s) => s.key !== '综合').map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={cn('chip', scopeKey === s.key && 'is-active')}
                    onClick={() => setScopeKey(s.key)}
                  >
                    <span className="chip-dot" style={{ background: s.color }} />
                    {s.short}
                  </button>
                ))}
              </div>
              <div className="exam-type-row">
                <Segmented
                  value={type}
                  onChange={(next) => setType(next)}
                  ariaLabel="选择题型"
                  options={[
                    { value: 'objective', label: '单选 + 多选' },
                    { value: 'single', label: '仅单项选择' },
                    { value: 'multiple', label: '仅多项选择' },
                  ]}
                />
              </div>
            </article>

            <article className="panel">
              <header className="panel-head">
                <div>
                  <span className="panel-label">STEP 2</span>
                  <h2>题量与时间</h2>
                </div>
              </header>
              <div className="exam-config">
                <label>
                  <span>题量</span>
                  <Select value={String(count)} onChange={(event) => setCount(Number(event.target.value))}>
                    <option value="20">20 题</option>
                    <option value="30">30 题</option>
                    <option value="50">50 题</option>
                  </Select>
                </label>
                <label>
                  <span>限时</span>
                  <Select value={String(minutes)} onChange={(event) => setMinutes(Number(event.target.value))}>
                    <option value="30">30 分钟</option>
                    <option value="60">60 分钟</option>
                    <option value="90">90 分钟</option>
                  </Select>
                </label>
              </div>
              <div className="exam-summary">
                <span>
                  <FileText size={14} aria-hidden="true" />
                  当前范围可组卷 {pool.length} 题
                </span>
                <span>
                  <Target size={14} aria-hidden="true" />
                  将抽取 {Math.min(count, pool.length)} 题
                </span>
                <span>
                  <Clock size={14} aria-hidden="true" />
                  限时 {minutes} 分钟
                </span>
              </div>
              <Button
                variant="primary"
                size="lg"
                onClick={start}
                disabled={!pool.length}
                leading={<Play size={16} />}
                trailing={<ArrowRight size={15} />}
              >
                开始模拟考试
              </Button>
            </article>

            {progress.exams.length ? (
              <article className="panel exam-history">
                <header className="panel-head">
                  <div>
                    <span className="panel-label">HISTORY</span>
                    <h2>最近的模拟考试</h2>
                  </div>
                </header>
                <div className="exam-history-list">
                  {progress.exams.slice(0, 5).map((item) => (
                    <div key={item.id} className="exam-history-row">
                      <span>{new Date(item.at).toLocaleDateString('zh-CN')}</span>
                      <strong>{item.scope}</strong>
                      <span>
                        {item.score} / {item.total} 分
                      </span>
                      <span>
                        {item.accuracy === null ? '—' : `${Math.round(item.accuracy * 100)}%`}
                      </span>
                      <span>{formatDuration(item.durationSec)}</span>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}
          </section>
        </>
      ) : null}

      {phase === 'running' && session && current ? (
        <div className="exam-run">
          {resumed ? (
            <div className="exam-resume-note">
              <Clock size={14} aria-hidden="true" />
              已恢复上次考试进度，计时从原来的开始时间继续。
              <button type="button" onClick={() => setResumed(false)}>
                知道了
              </button>
            </div>
          ) : null}

          <div className="exam-bar">
            <div className="exam-bar-left">
              <span className="exam-scope">{session.scope}</span>
              <span>
                第 {index + 1} / {examQuestions.length} 题
              </span>
              <span className={cn('exam-timer', remaining < 300 && 'is-urgent')}>
                <Clock size={14} aria-hidden="true" />
                {formatDuration(remaining)}
              </span>
            </div>
            <div className="exam-bar-right">
              <span className="exam-saved">
                <CheckCircle2 size={13} aria-hidden="true" />
                答案已自动暂存
              </span>
              <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)} leading={<Flag size={14} />}>
                提交试卷
              </Button>
            </div>
          </div>

          <div className="exam-progress">
            <ProgressBar value={answeredCount / Math.max(1, examQuestions.length)} />
            <span>
              已作答 {answeredCount} / {examQuestions.length}
            </span>
          </div>

          <QuestionCard
            question={current}
            selected={session.answers[current.id] || []}
            onSelect={choose}
            revealed={false}
            examMode
            favorite={progress.favorites.includes(current.id)}
            onFavorite={() => {
              const on = toggleFavorite(current.id)
              notify(on ? '已收藏本题' : '已取消收藏')
            }}
            note={progress.notes[current.id] || ''}
            onNote={(text) => setNote(current.id, text)}
            index={index}
            total={examQuestions.length}
          />

          <div className="exam-navigator">
            <div className="exam-navigator-head">
              <span>答题卡</span>
              <span>灰色为未作答，蓝色为已作答</span>
            </div>
            <div className="exam-dots">
              {examQuestions.map((q, i) => {
                const done = (session.answers[q.id] || []).length > 0
                return (
                  <button
                    key={q.id}
                    type="button"
                    className={cn('exam-dot', done && 'is-done', i === index && 'is-current')}
                    onClick={() => setIndex(i)}
                    aria-label={`第 ${i + 1} 题${done ? '，已作答' : '，未作答'}`}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
            <div className="exam-pager">
              <Button
                variant="secondary"
                onClick={() => setIndex((value) => Math.max(0, value - 1))}
                disabled={index === 0}
                leading={<ArrowLeft size={15} />}
              >
                上一题
              </Button>
              <Button
                variant="secondary"
                onClick={() => setIndex((value) => Math.min(examQuestions.length - 1, value + 1))}
                disabled={index >= examQuestions.length - 1}
                trailing={<ArrowRight size={15} />}
              >
                下一题
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {phase === 'report' && result ? (
        <div className="exam-report">
          <section className="exam-report-hero">
            <div>
              <span className="panel-label">RESULT</span>
              <h2>模拟考试成绩报告</h2>
              <p>{new Date(result.record.at).toLocaleString('zh-CN')} · {result.record.scope}</p>
            </div>
            <div className="exam-score">
              <strong>{result.record.score}</strong>
              <span>/ {result.record.total} 分</span>
            </div>
          </section>

          <section className="exam-report-stats">
            <div>
              <span className="stat-label">正确率</span>
              <strong>
                {result.record.accuracy === null ? '—' : `${Math.round(result.record.accuracy * 100)}%`}
              </strong>
              <span className="stat-note">
                {result.record.correctCount} / {result.record.gradedCount} 题答对
              </span>
            </div>
            <div>
              <span className="stat-label">用时</span>
              <strong>{formatDuration(result.record.durationSec)}</strong>
              <span className="stat-note">限时 {formatDuration(result.record.limitSec)}</span>
            </div>
            <div>
              <span className="stat-label">题量</span>
              <strong>{result.record.questionCount}</strong>
              <span className="stat-note">错题已自动进入错题本</span>
            </div>
          </section>

          <div className="exam-report-actions">
            <Button variant="primary" onClick={start} leading={<RotateCcw size={15} />}>
              再来一场
            </Button>
            <Button variant="secondary" onClick={() => navigate('/mistakes')}>
              去错题本复习
            </Button>
            <Button variant="secondary" onClick={() => navigate('/insights')}>
              查看学习统计
            </Button>
          </div>

          <section className="exam-report-list">
            {result.questions.map((q, i) => {
              const selected = result.answers[q.id] || []
              const correct = q.answer.length > 0 && selected.length === q.answer.length && selected.every((key) => q.answer.includes(key))
              const unanswered = selected.length === 0
              return (
                <article key={q.id} className={cn('exam-report-row', correct ? 'is-correct' : unanswered ? 'is-neutral' : 'is-wrong')}>
                  <div className="exam-report-index">
                    <strong>{i + 1}</strong>
                    <span>{q.year} · 第 {q.number} 题</span>
                  </div>
                  <div className="exam-report-main">
                    <p className="exam-report-stem">{q.stem}</p>
                    <div className="exam-report-meta">
                      <span className={cn('type-badge', `type-${q.type}`)}>{q.type === 'multiple' ? '多选' : '单选'}</span>
                      <span>{q.topic}</span>
                      <span>
                        你的答案 {selected.join('、') || '未作答'} · 正确答案 {q.answer.join('、')}
                      </span>
                    </div>
                    {q.explanation ? (
                      <details className="exam-report-explain">
                        <summary>查看解析</summary>
                        <p>{q.explanation}</p>
                      </details>
                    ) : null}
                  </div>
                  <div className="exam-report-row-actions">
                    <span className={cn('exam-mark', correct ? 'is-correct' : unanswered ? 'is-neutral' : 'is-wrong')}>
                      {correct ? <CheckCircle2 size={16} /> : unanswered ? <Clock size={16} /> : <X size={16} />}
                    </span>
                    <a className="quiet-link" href={`#/ai?tab=explain&q=${q.id}`}>
                      <Brain size={13} /> AI 解析
                    </a>
                  </div>
                </article>
              )
            })}
          </section>
        </div>
      ) : null}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="确认提交试卷？"
        description={`已作答 ${answeredCount} / ${examQuestions.length} 题，未作答的题按 0 分计算。`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              继续作答
            </Button>
            <Button variant="primary" onClick={submit} leading={<Flag size={15} />}>
              提交并评分
            </Button>
          </>
        }
      >
        <p className="exam-confirm-note">交卷后会立即显示成绩与逐题解析，错题会自动加入错题本。</p>
      </Modal>

      {phase === 'running' && !current ? (
        <div className="exam-error">
          <Loader2 size={16} className="is-spinning" /> 题目载入异常，请返回重新组卷。
        </div>
      ) : null}
    </div>
  )
}
