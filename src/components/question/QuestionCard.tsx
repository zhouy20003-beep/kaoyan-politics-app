import { useEffect, useState } from 'react'
import {
  Check,
  ExternalLink,
  Info,
  Lightbulb,
  Link2,
  NotebookPen,
  RotateCcw,
  Star,
  Wand2,
  X,
} from 'lucide-react'
import { hasKnownAnswer, resolveAsset, SUBJECT_MAP, TYPE_META } from '../../lib/data'
import type { AnswerRecord, Question } from '../../lib/types'
import { cn } from '../../lib/utils'
import { Button } from '../ui/primitives'

function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.href)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    return parsed.href
  } catch {
    return null
  }
}

function StemText({ text, suffix }: { text: string; suffix?: string }) {
  const paragraphs = text.split(/\n+/).filter((line) => line.trim())
  return (
    <div className="qstem">
      {paragraphs.map((paragraph, index) => (
        <p key={index}>
          {paragraph}
          {suffix && index === paragraphs.length - 1 ? <span className="qtype-suffix">{suffix}</span> : null}
        </p>
      ))}
    </div>
  )
}

function NoteBox({
  questionId,
  note,
  onSave,
}: {
  questionId: string
  note: string
  onSave: (value: string) => void
}) {
  const [value, setValue] = useState(note)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    setValue(note)
    setEditing(false)
  }, [questionId, note])

  if (!editing && !note.trim()) {
    return (
      <button type="button" className="note-trigger" onClick={() => setEditing(true)}>
        <NotebookPen size={15} aria-hidden="true" />
        添加一条笔记
      </button>
    )
  }

  if (!editing) {
    return (
      <div className="note-view">
        <div className="note-view-head">
          <span>
            <NotebookPen size={14} aria-hidden="true" /> 我的笔记
          </span>
          <button type="button" onClick={() => setEditing(true)}>
            编辑
          </button>
        </div>
        <p>{note}</p>
      </div>
    )
  }

  return (
    <div className="note-editor">
      <label htmlFor={`note-${questionId}`}>我的笔记</label>
      <textarea
        id={`note-${questionId}`}
        value={value}
        rows={3}
        placeholder="记下易错点、记忆线索，或下次要回看的地方…"
        onChange={(event) => setValue(event.target.value)}
      />
      <div className="note-actions">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setValue(note)
            setEditing(false)
          }}
        >
          取消
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            onSave(value.trim())
            setEditing(false)
          }}
        >
          保存笔记
        </Button>
      </div>
    </div>
  )
}

function SourceLinks({ question }: { question: Question }) {
  const links: Array<{ title: string; url: string }> = []
  if (question.sourceUrl) {
    links.push({ title: question.sourceTitle || '查看原始题目', url: question.sourceUrl })
  }
  for (const source of question.sourceLinks) {
    if (source.url && !links.some((link) => link.url === source.url)) links.push(source)
  }
  return (
    <div className="source-links">
      {links.map((link) => {
        const href = safeHref(link.url)
        if (!href) return null
        return (
          <a key={href} href={href} target="_blank" rel="noreferrer noopener">
            <Link2 size={13} aria-hidden="true" />
            {link.title}
            <ExternalLink size={11} aria-hidden="true" />
          </a>
        )
      })}
      {question.sourceNote ? <span className="source-note">{question.sourceNote}</span> : null}
    </div>
  )
}

export interface QuestionCardProps {
  question: Question
  selected: string[]
  onSelect: (letter: string) => void
  revealed: boolean
  record?: AnswerRecord
  examMode?: boolean
  favorite: boolean
  onFavorite: () => void
  note: string
  onNote: (text: string) => void
  onSubmit?: () => void
  onPrev?: () => void
  onNext?: () => void
  canPrev?: boolean
  canNext?: boolean
  onSelfRate?: (correct: boolean) => void
  draftText?: string
  onDraftText?: (text: string) => void
  index?: number
  total?: number
}

export function QuestionCard({
  question,
  selected,
  onSelect,
  revealed,
  record,
  examMode = false,
  favorite,
  onFavorite,
  note,
  onNote,
  onSubmit,
  onPrev,
  onNext,
  canPrev = false,
  canNext = false,
  onSelfRate,
  draftText = '',
  onDraftText,
  index,
  total,
}: QuestionCardProps) {
  const isAnalysis = question.type === 'analysis'
  const known = hasKnownAnswer(question)
  const correct = record?.correct
  const subject = SUBJECT_MAP[question.subjectKey]
  const type = TYPE_META[question.type]
  const options = Object.entries(question.options)

  return (
    <article
      className={cn(
        'qcard',
        revealed && (isAnalysis ? 'is-neutral' : known ? (correct ? 'is-correct' : 'is-wrong') : 'is-neutral'),
      )}
      aria-live="polite"
    >
      <header className="qcard-head">
        <div className="qcard-badges">
          <span className={cn('type-badge', `type-${question.type}`)}>{type.label}</span>
          <span className="qcard-index">
            {question.year} 年 · 第 {question.number} 题
          </span>
          {typeof index === 'number' && typeof total === 'number' ? (
            <span className="qcard-progress">
              {index + 1} / {total}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className={cn('fav-btn', favorite && 'is-on')}
          onClick={onFavorite}
          aria-pressed={favorite}
          aria-label={favorite ? '取消收藏' : '收藏本题'}
        >
          <Star size={17} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true" />
          <span>{favorite ? '已收藏' : '收藏'}</span>
        </button>
      </header>

      <div className="qtopic">
        <span className="subject-dot" style={{ background: subject.color }} aria-hidden="true" />
        <span>{subject.short}</span>
        <span className="qtopic-divider">/</span>
        <span>{question.topic}</span>
        {question.knowledgePoint && question.knowledgePoint !== question.topic ? (
          <>
            <span className="qtopic-divider">/</span>
            <span className="qtopic-point">{question.knowledgePoint}</span>
          </>
        ) : null}
      </div>

      <StemText text={question.stem} suffix={`（${type.short}）`} />

      {question.figureNote || question.missingImage ? (
        <p className="figure-note">
          <Info size={14} aria-hidden="true" />
          {question.figureNote || '此题原卷配有插图，暂未收录清晰图片。'}
        </p>
      ) : null}

      {question.imageUrls.length ? (
        <div className="qfigures">
          {question.imageUrls.map((url, i) => {
            const src = resolveAsset(url)
            return (
              <figure key={src}>
                <a href={src} target="_blank" rel="noreferrer" aria-label={`查看第 ${i + 1} 张配图原图`}>
                  <img src={src} alt={`${question.year} 年第 ${question.number} 题配图 ${i + 1}`} loading="lazy" />
                </a>
                <figcaption>题目配图 {i + 1} · 点击查看原图</figcaption>
              </figure>
            )
          })}
        </div>
      ) : null}

      {!isAnalysis ? (
        <div
          className="qoptions"
          role={question.type === 'single' ? 'radiogroup' : 'group'}
          aria-label="作答选项"
        >
          {options.map(([letter, text], optionIndex) => {
            const chosen = selected.includes(letter)
            const isCorrect = revealed && known && question.answer.includes(letter)
            const isWrong = revealed && known && chosen && !question.answer.includes(letter)
            return (
              <button
                key={letter}
                type="button"
                className={cn(
                  'option',
                  question.type === 'multiple' ? 'is-multiple' : 'is-single',
                  chosen && 'is-selected',
                  isCorrect && 'is-correct',
                  isWrong && 'is-wrong',
                  revealed && known && !isCorrect && !isWrong && 'is-muted',
                )}
                role={question.type === 'single' ? 'radio' : 'checkbox'}
                aria-checked={chosen}
                disabled={revealed}
                onClick={() => onSelect(letter)}
              >
                <span className="option-key">{letter}</span>
                <span className="option-text">{text}</span>
                <span
                  className="option-mark"
                  style={{ animationDelay: `${120 + optionIndex * 45}ms` }}
                  aria-hidden="true"
                >
                  {isCorrect ? <Check size={16} /> : isWrong ? <X size={16} /> : null}
                </span>
              </button>
            )
          })}
          {!options.length ? (
            <p className="qmissing">此题的选项暂未完整收录，请查看原始资料。</p>
          ) : null}
        </div>
      ) : (
        <div className="analysis-input">
          <div className="analysis-label">
            <span>先写下你的思路</span>
            <span className="analysis-tip">原理 + 材料分析 + 结论</span>
          </div>
          <textarea
            value={draftText}
            onChange={(event) => onDraftText?.(event.target.value)}
            placeholder="用自己的话组织答案。提交后会展示参考作答要点，由你自主评估掌握程度。"
            rows={6}
            disabled={revealed}
            aria-label="分析题作答"
          />
          <span className="analysis-save">{draftText.trim() ? '草稿已自动保存' : '草稿会保存在本机'}</span>
        </div>
      )}

      {!examMode ? (
        onPrev || onNext ? (
          <div className="qactions has-pager">
            <Button variant="secondary" onClick={onPrev} disabled={!canPrev} leading={<span aria-hidden="true">←</span>}>
              上一题
            </Button>
            <div className="qactions-center">
              {revealed ? (
                <span className="qsubmitted">{isAnalysis ? '已对照参考' : '已提交'}</span>
              ) : (
                <Button variant="primary" onClick={onSubmit} trailing={<span aria-hidden="true">→</span>}>
                  {isAnalysis ? '查看参考答案' : '提交答案'}
                </Button>
              )}
            </div>
            <Button
              variant={revealed ? 'primary' : 'secondary'}
              onClick={onNext}
              disabled={!canNext}
              trailing={<span aria-hidden="true">→</span>}
            >
              下一题
            </Button>
          </div>
        ) : (
          <div className="qactions">
            <span className="qhint">
              {isAnalysis
                ? '分析题 · 对照参考要点自评'
                : question.type === 'multiple'
                  ? '多项选择 · 选出所有正确选项'
                  : '单项选择 · 选择一个答案'}
            </span>
            {revealed ? null : (
              <Button variant="primary" onClick={onSubmit} trailing={<span aria-hidden="true">→</span>}>
                {isAnalysis ? '查看参考答案' : '提交答案'}
              </Button>
            )}
          </div>
        )
      ) : (
        <div className="qactions exam-hint">
          <span className="qhint">
            {isAnalysis ? '分析题 · 交卷后对照参考要点' : '作答自动保存 · 交卷后统一判分'}
          </span>
        </div>
      )}

      {revealed && !examMode ? (
        <section className="answer-panel" aria-label="答案与解析">
          <div
            className={cn(
              'answer-banner',
              isAnalysis ? 'is-neutral' : known ? (correct ? 'is-correct' : 'is-wrong') : 'is-neutral',
            )}
          >
            <span className="answer-seal" aria-hidden="true">
              {isAnalysis ? '评' : known ? (correct ? '✓' : '×') : '?'}
            </span>
            <div className="answer-banner-text">
              <strong>
                {isAnalysis
                  ? '对照参考，自主评估'
                  : known
                    ? correct
                      ? '回答正确'
                      : '回答错误'
                    : '本题答案待核对'}
              </strong>
              <span>
                {isAnalysis
                  ? '分析题不计入客观题正确率'
                  : known
                    ? `正确答案 ${question.answer.join('、')} · 你的答案 ${selected.join('、') || '未作答'}`
                    : '暂未收录可核验答案，本题不自动判分'}
              </span>
            </div>
            {isAnalysis ? (
              <div className="self-rate">
                <button
                  type="button"
                  className={cn('self-btn', record?.correct === true && 'is-active')}
                  aria-pressed={record?.correct === true}
                  onClick={() => onSelfRate?.(true)}
                >
                  <Check size={14} /> 已掌握
                </button>
                <button
                  type="button"
                  className={cn('self-btn', record?.correct === false && 'is-active')}
                  aria-pressed={record?.correct === false}
                  onClick={() => onSelfRate?.(false)}
                >
                  <RotateCcw size={14} /> 继续巩固
                </button>
              </div>
            ) : null}
            <span className="answer-progress" aria-hidden="true" />
          </div>

          <div className="explain-block">
            <div className="explain-title">
              <Lightbulb size={15} aria-hidden="true" />
              <span>解析</span>
            </div>
            <p>{question.explanation || '本题暂未收录文字解析，可参考下方来源资料。'}</p>
          </div>

          {isAnalysis && question.referenceAnswer ? (
            <div className="explain-block is-reference">
              <div className="explain-title">
                <span className="ref-mark">参</span>
                <span>参考作答要点</span>
              </div>
              <p>{question.referenceAnswer}</p>
              {question.referenceAnswerNote ? (
                <span className="ref-note">{question.referenceAnswerNote}</span>
              ) : null}
            </div>
          ) : null}

          {!isAnalysis && question.referenceAnswer ? (
            <div className="explain-block is-reference">
              <div className="explain-title">
                <span className="ref-mark">参</span>
                <span>参考要点</span>
              </div>
              <p>{question.referenceAnswer}</p>
            </div>
          ) : null}

          <div className="answer-ai">
            <div>
              <strong>AI 深度解析</strong>
              <span>逐项辨析选项、串联相关知识点，并给出一句记忆提示。</span>
            </div>
            <a className="btn btn-secondary btn-sm" href={`#/ai?tab=explain&q=${question.id}`}>
              <Wand2 size={14} aria-hidden="true" />
              <span className="btn-label">让 AI 讲讲</span>
            </a>
          </div>

          <div className="answer-foot">
            <SourceLinks question={question} />
            <NoteBox questionId={question.id} note={note} onSave={onNote} />
          </div>
        </section>
      ) : null}
    </article>
  )
}
