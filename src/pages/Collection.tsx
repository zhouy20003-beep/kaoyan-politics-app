import { useMemo, useState } from 'react'
import { ArrowRight, ArrowUpRight, Bookmark, BookOpen, NotebookPen, Star, StarOff } from 'lucide-react'
import { Button, Chip, EmptyState, Segmented } from '../components/ui/primitives'
import { SUBJECT_MAP, SUBJECT_META, TYPE_META } from '../lib/data'
import { buildKnowledgeIndex } from '../lib/knowledge'
import type { SubjectKey } from '../lib/types'
import { useStudy } from '../store/StudyProvider'

type CollectionMode = 'question' | 'knowledge'

export function Collection() {
  const { questions, progress, toggleFavorite, toggleKnowledgeFavorite, notify } = useStudy()
  const [mode, setMode] = useState<CollectionMode>('question')
  const [subject, setSubject] = useState<SubjectKey | 'all'>('all')
  const [keyword, setKeyword] = useState('')

  const index = useMemo(() => buildKnowledgeIndex(questions), [questions])

  const favorites = useMemo(
    () =>
      progress.favorites
        .map((id) => questions.find((q) => q.id === id))
        .filter((q): q is NonNullable<typeof q> => Boolean(q)),
    [progress.favorites, questions],
  )

  const knowledgeFavorites = useMemo(
    () =>
      progress.knowledge.favorites
        .map((id) => index.byId.get(id))
        .filter((point): point is NonNullable<typeof point> => Boolean(point)),
    [progress.knowledge.favorites, index],
  )

  const activeList = mode === 'question' ? favorites : knowledgeFavorites

  const filteredQuestions = useMemo(() => {
    const needle = keyword.trim().toLowerCase()
    return favorites.filter((q) => {
      if (subject !== 'all' && q.subjectKey !== subject) return false
      if (needle && !`${q.stem} ${q.topic} ${q.knowledgePoint}`.toLowerCase().includes(needle))
        return false
      return true
    })
  }, [favorites, subject, keyword])

  const filteredKnowledge = useMemo(() => {
    const needle = keyword.trim().toLowerCase()
    return knowledgeFavorites.filter((point) => {
      if (subject !== 'all' && point.subjectKey !== subject) return false
      if (needle && !`${point.name} ${point.topic} ${point.subjectName}`.toLowerCase().includes(needle))
        return false
      return true
    })
  }, [knowledgeFavorites, subject, keyword])

  const subjectCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of activeList) {
      map.set(item.subjectKey, (map.get(item.subjectKey) || 0) + 1)
    }
    return map
  }, [activeList])

  const withNotes = favorites.filter((q) => progress.notes[q.id]?.trim()).length
  const subjectsCovered = new Set(activeList.map((item) => item.subjectKey)).size

  return (
    <div className="page collection-page">
      <header className="page-head">
        <div>
          <span className="eyebrow">
            <span className="live-dot" aria-hidden="true" />
            COLLECTION · 值得再看一遍
          </span>
          <h1>收藏夹</h1>
          <p className="page-sub">题目和知识点都可以收藏，配上自己的笔记，复习时直接回来。</p>
        </div>
        <div className="page-head-aside">
          <div className="mistake-total">
            <span>已收藏</span>
            <strong>{favorites.length + knowledgeFavorites.length}</strong>
            <em>项</em>
          </div>
        </div>
      </header>

      <section className="collection-stats">
        <div>
          <span className="stat-label">收藏题目</span>
          <strong>{favorites.length}</strong>
          <span className="stat-note">来自 {favorites.length ? subjectsCovered : 0} 个学科</span>
        </div>
        <div>
          <span className="stat-label">收藏知识点</span>
          <strong>{knowledgeFavorites.length}</strong>
          <span className="stat-note">随时回看考点</span>
        </div>
        <div>
          <span className="stat-label">带笔记</span>
          <strong>{withNotes}</strong>
          <span className="stat-note">写下自己的理解</span>
        </div>
        <div className="collection-tip">
          <NotebookPen size={16} aria-hidden="true" />
          <p>收藏不是囤积。每周挑 3 条收藏，遮住解析重讲一遍。</p>
        </div>
      </section>

      <section className="collection-toolbar">
        <Segmented
          value={mode}
          onChange={(next) => {
            setMode(next)
            setSubject('all')
            setKeyword('')
          }}
          ariaLabel="收藏类型"
          options={[
            { value: 'question', label: '题目收藏', count: favorites.length },
            { value: 'knowledge', label: '知识点收藏', count: knowledgeFavorites.length },
          ]}
        />
        <div className="subject-chips">
          <Chip active={subject === 'all'} count={activeList.length} onClick={() => setSubject('all')}>
            全部
          </Chip>
          {SUBJECT_META.filter((s) => subjectCounts.get(s.key)).map((s) => (
            <Chip
              key={s.key}
              active={subject === s.key}
              count={subjectCounts.get(s.key)}
              dotColor={s.color}
              onClick={() => setSubject(s.key)}
            >
              {s.short}
            </Chip>
          ))}
        </div>
        <label className="search-field is-compact">
          <Star size={14} aria-hidden="true" />
          <input
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={mode === 'question' ? '搜索收藏题目' : '搜索收藏知识点'}
            aria-label="搜索收藏"
          />
        </label>
      </section>

      {mode === 'question' ? (
        filteredQuestions.length ? (
          <section className="collection-grid" aria-label="收藏题目">
            {filteredQuestions.map((question) => {
              const subjectMeta = SUBJECT_MAP[question.subjectKey]
              const note = progress.notes[question.id]
              return (
                <article key={question.id} className="collection-card">
                  <div className="collection-top">
                    <span className="collection-subject">
                      <i style={{ background: subjectMeta.color }} />
                      {subjectMeta.short}
                      <span className="meta-divider">/</span>
                      {question.topic}
                    </span>
                    <span className={`type-badge type-${question.type}`}>
                      {TYPE_META[question.type].short}
                    </span>
                  </div>
                  <a className="collection-stem" href={`#/practice?view=favorite&q=${question.id}`}>
                    {question.stem}
                  </a>
                  {note ? (
                    <div className="collection-note">
                      <NotebookPen size={13} aria-hidden="true" />
                      <p>{note}</p>
                    </div>
                  ) : null}
                  <div className="collection-foot">
                    <span>
                      {question.year} · 第 {question.number} 题
                    </span>
                    <div>
                      <button
                        type="button"
                        className="collection-remove"
                        onClick={() => {
                          toggleFavorite(question.id)
                          notify('已取消收藏')
                        }}
                        aria-label="取消收藏"
                        title="取消收藏"
                      >
                        <StarOff size={15} />
                      </button>
                      <a className="collection-open" href={`#/practice?view=favorite&q=${question.id}`}>
                        打开 <ArrowUpRight size={13} />
                      </a>
                    </div>
                  </div>
                </article>
              )
            })}
          </section>
        ) : (
          <EmptyState
            icon={<Bookmark size={26} />}
            title={favorites.length ? '这些筛选下没有收藏' : '还没有收藏题目'}
            description={
              favorites.length
                ? '换个学科或关键词看看。'
                : '在刷题时点击题目右上角的收藏，题目就会出现在这里。'
            }
            action={
              <Button variant="primary" onClick={() => (window.location.hash = '#/practice')}>
                去刷题
              </Button>
            }
          />
        )
      ) : filteredKnowledge.length ? (
        <section className="collection-grid" aria-label="收藏知识点">
          {filteredKnowledge.map((point) => (
            <article key={point.id} className="collection-card knowledge-collection-card">
              <div className="collection-top">
                <span className="collection-subject">
                  <i style={{ background: SUBJECT_MAP[point.subjectKey]?.color }} />
                  {point.subjectName}
                  <span className="meta-divider">/</span>
                  {point.topic}
                </span>
                <span className="type-badge">{point.count} 题</span>
              </div>
              <a className="collection-stem" href={`#/knowledge?point=${encodeURIComponent(point.id)}`}>
                {point.name}
              </a>
              {point.explanations[0] ? (
                <div className="collection-note">
                  <BookOpen size={13} aria-hidden="true" />
                  <p>{point.explanations[0]}</p>
                </div>
              ) : null}
              <div className="collection-foot">
                <span>{point.years.slice(0, 3).join(' / ') || '暂无年份'}</span>
                <div>
                  <button
                    type="button"
                    className="collection-remove"
                    onClick={() => {
                      toggleKnowledgeFavorite(point.id)
                      notify('已取消收藏')
                    }}
                    aria-label="取消收藏"
                    title="取消收藏"
                  >
                    <StarOff size={15} />
                  </button>
                  <a className="collection-open" href={`#/knowledge?point=${encodeURIComponent(point.id)}`}>
                    打开 <ArrowRight size={13} />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <EmptyState
          icon={<BookOpen size={26} />}
          title={knowledgeFavorites.length ? '这些筛选下没有收藏' : '还没有收藏知识点'}
          description={
            knowledgeFavorites.length
              ? '换个学科或关键词看看。'
              : '在知识点详情里点击「收藏」，考点就会出现在这里。'
          }
          action={
            <Button variant="primary" onClick={() => (window.location.hash = '#/knowledge')}>
              去看知识点
            </Button>
          }
        />
      )}

      {activeList.length ? (
        <div className="collection-footnote">
          <span>共 {activeList.length} 项收藏 · 记录保存在本机</span>
          <Button variant="ghost" size="sm" onClick={() => (window.location.hash = '#/me')}>
            导出学习记录
          </Button>
        </div>
      ) : null}
    </div>
  )
}
