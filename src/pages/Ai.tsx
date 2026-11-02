import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  Wand2,
} from 'lucide-react'
import { Button, EmptyState, Segmented } from '../components/ui/primitives'
import {
  AiError,
  askChat,
  askExplain,
  buildKnowledgeContext,
  retrieveKnowledge,
  type AiMessage,
} from '../lib/ai'
import { SUBJECT_META } from '../lib/data'
import { buildKnowledgeIndex } from '../lib/knowledge'
import type { Question } from '../lib/types'
import { cn, navigate, relativeTime } from '../lib/utils'
import { useStudy } from '../store/StudyProvider'

type Mode = 'chat' | 'explain'

const QUICK_PROMPTS = [
  '这个知识点是什么意思？',
  '帮我比较两个容易混淆的知识点',
  '这个章节有哪些重点？',
  '给我出几道相关练习题',
  '这个知识点怎么记忆？',
  '帮我整理这一章的知识框架',
]

function AnswerText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((block) => block.trim())
  return (
    <div className="ai-answer">
      {blocks.map((block, index) => (
        <p key={index}>{block}</p>
      ))}
    </div>
  )
}

function QuestionPreview({ question }: { question: Question }) {
  return (
    <div className="ai-question-preview">
      <div className="ai-question-head">
        <span className="type-badge">{question.year} 年 · 第 {question.number} 题</span>
        <span>
          {question.topic}
          {question.knowledgePoint ? ` · ${question.knowledgePoint}` : ''}
        </span>
      </div>
      <p className="ai-question-stem">{question.stem}</p>
      {Object.keys(question.options).length ? (
        <ul className="ai-options">
          {Object.entries(question.options).map(([key, text]) => (
            <li key={key} className={cn(question.answer.includes(key) && 'is-correct')}>
              <span>{key}</span>
              {text}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="ai-answer-line">
        <strong>正确答案：{question.answer.join('、') || '参考要点'}</strong>
        {question.explanation ? <span>{question.explanation}</span> : null}
      </div>
    </div>
  )
}

export function Ai({ params }: { params: URLSearchParams }) {
  const { questions, progress } = useStudy()
  const index = useMemo(() => buildKnowledgeIndex(questions), [questions])

  const [mode, setMode] = useState<Mode>(params.get('tab') === 'explain' ? 'explain' : 'chat')
  const [subject, setSubject] = useState('')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [aiReady, setAiReady] = useState<boolean | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(params.get('q'))
  const [extra, setExtra] = useState('')
  const [explainText, setExplainText] = useState('')
  const [explainLoading, setExplainLoading] = useState(false)
  const [explainError, setExplainError] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const tab = params.get('tab')
    if (tab === 'explain' || tab === 'chat') setMode(tab)
    const q = params.get('q')
    if (q) setSelectedId(q)
    const ask = params.get('ask')
    if (ask) {
      setInput(ask.slice(0, 500))
      setMode('chat')
    }
    const nextSubject = params.get('subject')
    if (nextSubject) setSubject(nextSubject)
  }, [params])

  useEffect(() => {
    let alive = true
    fetch('/api/health')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (alive && data) setAiReady(Boolean(data.ai))
      })
      .catch(() => {
        if (alive) setAiReady(null)
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, loading])

  const recentQuestions = useMemo(() => {
    const ids = Object.entries(progress.records)
      .filter(([, record]) => record && record.at)
      .sort((a, b) => String(b[1].at).localeCompare(String(a[1].at)))
      .map(([id]) => id)
      .slice(0, 8)
    const list = ids
      .map((id) => questions.find((q) => q.id === id))
      .filter((q): q is Question => Boolean(q))
    if (!list.length) {
      return [...questions]
        .sort((a, b) => b.year - a.year || a.number - b.number)
        .slice(0, 4)
    }
    return list
  }, [progress.records, questions])

  const currentQuestion = useMemo(() => {
    if (selectedId) {
      const found = questions.find((q) => q.id === selectedId)
      if (found) return found
    }
    const last = progress.lastQuestionId
      ? questions.find((q) => q.id === progress.lastQuestionId)
      : undefined
    return last || recentQuestions[0] || questions[0]
  }, [selectedId, questions, progress.lastQuestionId, recentQuestions])

  const ask = async (text?: string) => {
    const question = (text ?? input).trim()
    if (!question || loading) return
    if (question.length > 500) {
      setError('问题太长了，请控制在 500 字以内。')
      return
    }
    setError(null)
    setLoading(true)
    setInput('')
    const userMessage: AiMessage = { role: 'user', content: question, at: new Date().toISOString() }
    setMessages((prev) => [...prev, userMessage])

    try {
      const points = retrieveKnowledge(index, question, undefined, 4)
      const context = buildKnowledgeContext(points, questions)
      const reply = await askChat({
        question,
        history: messages,
        context,
        subject,
      })
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply.answer, at: new Date().toISOString() },
      ])
      setRemaining(reply.remaining ?? null)
      setAiReady(true)
    } catch (reason) {
      const message =
        reason instanceof AiError ? reason.message : 'AI 暂时不可用，请稍后再试。'
      setError(message)
      if (reason instanceof AiError && reason.code === 'ai_not_configured') setAiReady(false)
      setInput(question)
    } finally {
      setLoading(false)
    }
  }

  const explain = async () => {
    if (!currentQuestion || explainLoading) return
    setExplainError(null)
    setExplainLoading(true)
    try {
      const points = retrieveKnowledge(
        index,
        `${currentQuestion.knowledgePoint} ${currentQuestion.topic}`,
        currentQuestion,
        4,
      )
      const context = buildKnowledgeContext(points, questions)
      const selected = progress.records[currentQuestion.id]?.selected || []
      const reply = await askExplain({
        question: currentQuestion,
        selected,
        context,
        extra,
      })
      setExplainText(reply.answer)
      setRemaining(reply.remaining ?? null)
      setAiReady(true)
    } catch (reason) {
      const message =
        reason instanceof AiError ? reason.message : 'AI 暂时不可用，请稍后再试。'
      setExplainError(message)
      if (reason instanceof AiError && reason.code === 'ai_not_configured') setAiReady(false)
    } finally {
      setExplainLoading(false)
    }
  }

  return (
    <div className="page ai-page">
      <header className="page-head">
        <div>
          <span className="eyebrow">
            <span className="live-dot" aria-hidden="true" />
            AI TUTOR · 结合真实题库
          </span>
          <h1>AI 政治助教</h1>
          <p className="page-sub">
            答疑与题目解析都只依据本项目的 760 道真题与 663 个知识点；无法确认的内容会明确告诉你。
          </p>
        </div>
        <div className="page-head-aside">
          <div className={cn('ai-status', aiReady === false && 'is-off')}>
            <span className="live-dot" aria-hidden="true" />
            {aiReady === null ? '检测中' : aiReady ? 'AI 已就绪' : 'AI 未配置'}
          </div>
          {remaining !== null ? <span className="ai-remaining">本窗口还可提问 {remaining} 次</span> : null}
        </div>
      </header>

      <div className="ai-mode-bar">
        <Segmented
          value={mode}
          onChange={(next) => setMode(next)}
          ariaLabel="AI 功能切换"
          options={[
            { value: 'chat', label: '智能答疑' },
            { value: 'explain', label: '题目解析' },
          ]}
        />
        {aiReady === false ? (
          <span className="ai-warning">
          AI 暂未启用，知识点、刷题、错题本和模拟考试仍可正常使用。
          </span>
        ) : null}
      </div>

      {mode === 'chat' ? (
        <div className="ai-chat">
          <div className="ai-chat-main">
            {messages.length ? (
              <div className="ai-messages" aria-live="polite">
                {messages.map((message, i) => (
                  <article key={i} className={cn('ai-message', `is-${message.role}`)}>
                    <span className="ai-avatar" aria-hidden="true">
                      {message.role === 'user' ? '你' : <Brain size={16} />}
                    </span>
                    <div className="ai-bubble">
                      {message.role === 'assistant' ? (
                        <AnswerText text={message.content} />
                      ) : (
                        <p>{message.content}</p>
                      )}
                      {message.at ? <span className="ai-time">{relativeTime(message.at)}</span> : null}
                    </div>
                  </article>
                ))}
                {loading ? (
                  <article className="ai-message is-assistant">
                    <span className="ai-avatar" aria-hidden="true">
                      <Brain size={16} />
                    </span>
                    <div className="ai-bubble ai-loading">
                      <Loader2 size={16} className="is-spinning" />
                      正在结合题库检索并组织答案…
                    </div>
                  </article>
                ) : null}
                <div ref={bottomRef} />
              </div>
            ) : (
              <div className="ai-empty">
                <span className="ai-empty-mark">
                  <Sparkles size={24} />
                </span>
                <h2>问一个你在政治上卡住的问题</h2>
                <p>比如一个抽象概念、两道易混知识点，或某道题为什么选这个答案。</p>
                <div className="ai-quick">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button key={prompt} type="button" onClick={() => void ask(prompt)}>
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error ? (
              <div className="ai-error" role="alert">
                <span>{error}</span>
                <button type="button" onClick={() => void ask()} disabled={loading} className="ai-retry">
                  <RefreshCw size={13} /> 重试
                </button>
              </div>
            ) : null}
          </div>

          <div className="ai-composer">
            <div className="ai-composer-top">
              <select
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                aria-label="指定学科"
              >
                <option value="">不限学科</option>
                {SUBJECT_META.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.short}
                  </option>
                ))}
              </select>
              <span>{input.length} / 500</span>
            </div>
            <div className="ai-composer-row">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value.slice(0, 500))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault()
                    void ask()
                  }
                }}
                rows={2}
                placeholder="输入你的政治问题，Ctrl / ⌘ + Enter 发送…"
                aria-label="AI 提问输入框"
              />
              <Button
                variant="primary"
                size="lg"
                disabled={!input.trim() || loading}
                onClick={() => void ask()}
                leading={loading ? <Loader2 size={16} className="is-spinning" /> : <Send size={16} />}
              >
                发送
              </Button>
            </div>
            <p className="ai-composer-note">
              回答由 DeepSeek 生成，仅用于学习参考；涉及教材原文请以纸质教材为准。
            </p>
          </div>
        </div>
      ) : (
        <div className="ai-explain">
          {currentQuestion ? (
            <>
              <section className="panel ai-explain-panel">
                <header className="panel-head">
                  <div>
                    <span className="panel-label">QUESTION</span>
                    <h2>当前题目</h2>
                  </div>
                  <div className="ai-explain-actions">
                    <button
                      type="button"
                      className="quiet-link"
                      onClick={() => {
                        const pool = recentQuestions.length ? recentQuestions : questions
                        const next = pool[Math.floor(Math.random() * pool.length)]
                        setSelectedId(next.id)
                        setExplainText('')
                        setExplainError(null)
                      }}
                    >
                      <RefreshCw size={13} /> 换一题
                    </button>
                    <button
                      type="button"
                      className="quiet-link"
                      onClick={() => navigate(`/practice?q=${currentQuestion.id}`)}
                    >
                      <ArrowRight size={13} /> 去做这题
                    </button>
                  </div>
                </header>
                <QuestionPreview question={currentQuestion} />
                {progress.records[currentQuestion.id] ? (
                  <p className="ai-your-answer">
                    <Star size={13} aria-hidden="true" />
                    你的作答：{progress.records[currentQuestion.id].selected.join('、') || '未作答'}
                    {progress.records[currentQuestion.id].correct === true
                      ? ' · 回答正确'
                      : progress.records[currentQuestion.id].correct === false
                        ? ' · 回答错误'
                        : ''}
                  </p>
                ) : null}
              </section>

              <section className="panel ai-explain-panel">
                <header className="panel-head">
                  <div>
                    <span className="panel-label">DEEP EXPLAIN</span>
                    <h2>AI 深度解析</h2>
                  </div>
                </header>
                <div className="ai-explain-controls">
                  <input
                    type="text"
                    value={extra}
                    onChange={(event) => setExtra(event.target.value.slice(0, 200))}
                    placeholder="可选：补充你想追问的点，比如「C 选项为什么不对」"
                    aria-label="补充追问"
                  />
                  <Button
                    variant="primary"
                    onClick={() => void explain()}
                    disabled={explainLoading}
                    leading={explainLoading ? <Loader2 size={15} className="is-spinning" /> : <Wand2 size={15} />}
                  >
                    {explainLoading ? '分析中…' : '开始深度解析'}
                  </Button>
                </div>
                {explainError ? <div className="ai-error">{explainError}</div> : null}
                {explainText ? (
                  <div className="ai-explain-result">
                    <div className="ai-explain-result-head">
                      <CheckCircle2 size={16} aria-hidden="true" />
                      解析完成 · 先看原解析，再看 AI 补充
                    </div>
                    <AnswerText text={explainText} />
                    <p className="ai-composer-note">AI 不会改变题库给出的正确答案；如遇不一致，请以题库和教材为准。</p>
                  </div>
                ) : (
                  <div className="ai-explain-placeholder">
                    <Sparkles size={18} aria-hidden="true" />
                    <p>点击上方按钮，AI 会逐项辨析选项、指出考点，并给出记忆提示。</p>
                  </div>
                )}
              </section>

              <section className="panel">
                <header className="panel-head">
                  <div>
                    <span className="panel-label">PICK A QUESTION</span>
                    <h2>从最近做过的题开始</h2>
                  </div>
                </header>
                {recentQuestions.length ? (
                  <div className="ai-question-picker">
                    {recentQuestions.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        className={cn(q.id === currentQuestion.id && 'is-active')}
                        onClick={() => {
                          setSelectedId(q.id)
                          setExplainText('')
                          setExplainError(null)
                        }}
                      >
                        <strong>
                          {q.year} · 第 {q.number} 题
                        </strong>
                        <span>{q.topic}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<BookOpen size={24} />}
                    title="还没有做题记录"
                    description="先做几道真题，再回来让 AI 逐项讲解。"
                    action={
                      <Button variant="primary" onClick={() => navigate('/practice')}>
                        去刷题
                      </Button>
                    }
                  />
                )}
              </section>
            </>
          ) : (
            <EmptyState
              icon={<Brain size={26} />}
              title="题库正在载入"
              description="载入完成后就可以选择题目做 AI 深度解析。"
            />
          )}
        </div>
      )}
    </div>
  )
}
