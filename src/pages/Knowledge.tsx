import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Clock,
  Flame,
  Search,
  Sparkles,
  Star,
  StarOff,
} from 'lucide-react'
import { Button, Chip, EmptyState } from '../components/ui/primitives'
import { SUBJECT_META, TYPE_META } from '../lib/data'
import {
  buildKnowledgeIndex,
  relatedPoints,
  searchKnowledge,
  type KnowledgePoint,
} from '../lib/knowledge'
import type { Question, SubjectKey } from '../lib/types'
import { cn, navigate, relativeTime } from '../lib/utils'
import { useStudy } from '../store/StudyProvider'

type Tab = 'browse' | 'recent' | 'favorite' | 'important'

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'browse', label: '按科目浏览' },
  { key: 'recent', label: '最近学习' },
  { key: 'favorite', label: '我的收藏' },
  { key: 'important', label: '重点标记' },
]

function questionPreview(questions: Question[], id: string): Question | undefined {
  return questions.find((q) => q.id === id)
}

export function Knowledge({ params }: { params: URLSearchParams }) {
  const {
    questions,
    progress,
    toggleKnowledgeFavorite,
    toggleKnowledgeImportant,
    visitKnowledge,
    notify,
  } = useStudy()

  const index = useMemo(() => buildKnowledgeIndex(questions), [questions])
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'favorite' ? 'favorite' : 'browse')
  const [subject, setSubject] = useState<SubjectKey | 'all'>(
    (params.get('subject') as SubjectKey | null) || 'all',
  )
  const [chapter, setChapter] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(params.get('point'))

  useEffect(() => {
    const next = params.get('subject') as SubjectKey | null
    if (next) {
      setSubject(next)
      setTab('browse')
    }
    const point = params.get('point')
    if (point) setSelectedId(point)
    const nextTab = params.get('tab')
    if (nextTab === 'favorite' || nextTab === 'important' || nextTab === 'recent') setTab(nextTab)
  }, [params])

  const subjectTree = subject === 'all' ? null : index.subjects.find((s) => s.key === subject) || null
  const chapters = subjectTree?.chapters || []

  const browsePoints = useMemo(() => {
    const base = subject === 'all' ? index.points : subjectTree?.chapters.flatMap((c) => c.points) || []
    const scoped = chapter === 'all' ? base : base.filter((p) => p.topic === chapter)
    return [...scoped].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
  }, [index.points, subject, subjectTree, chapter])

  const hits = useMemo(() => (keyword.trim() ? searchKnowledge(index, keyword, 40) : []), [index, keyword])

  const tabPoints = useMemo(() => {
    if (tab === 'favorite') {
      return progress.knowledge.favorites
        .map((id) => index.byId.get(id))
        .filter((p): p is KnowledgePoint => Boolean(p))
    }
    if (tab === 'important') {
      return progress.knowledge.important
        .map((id) => index.byId.get(id))
        .filter((p): p is KnowledgePoint => Boolean(p))
    }
    if (tab === 'recent') {
      return Object.entries(progress.knowledge.visited)
        .sort((a, b) => b[1].localeCompare(a[1]))
        .map(([id]) => index.byId.get(id))
        .filter((p): p is KnowledgePoint => Boolean(p))
    }
    return []
  }, [tab, index, progress.knowledge])

  const point = selectedId ? index.byId.get(selectedId) || null : null

  const openPoint = (item: KnowledgePoint) => {
    setSelectedId(item.id)
    visitKnowledge(item.id)
  }

  const visiblePoints = keyword.trim() ? hits.map((hit) => hit.point) : tab === 'browse' ? browsePoints : tabPoints

  const favorite = point ? progress.knowledge.favorites.includes(point.id) : false
  const important = point ? progress.knowledge.important.includes(point.id) : false

  return (
    <div className="page knowledge-page">
      <header className="page-head">
        <div>
          <span className="eyebrow">
            <span className="live-dot" aria-hidden="true" />
            KNOWLEDGE · 真实题库提炼
          </span>
          <h1>政治知识点</h1>
          <p className="page-sub">
            按科目、章节、知识点逐层整理。每个知识点都来自 760 道真题的考点与解析，不额外编造理论。
          </p>
        </div>
        <div className="page-head-aside">
          <div className="echo-stat">
            <span>知识点</span>
            <strong>{index.total}</strong>
            <em>个</em>
          </div>
          <div className="echo-stat">
            <span>章节</span>
            <strong>{index.totalChapters}</strong>
            <em>个</em>
          </div>
        </div>
      </header>

      <section className="knowledge-search">
        <label className="search-field">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索知识点，例如：实践、矛盾、乡村振兴、依法治国"
            aria-label="搜索知识点"
          />
        </label>
        <div className="knowledge-tabs" role="tablist" aria-label="知识点分类">
          {TABS.map((item) => {
            const count =
              item.key === 'favorite'
                ? progress.knowledge.favorites.length
                : item.key === 'important'
                  ? progress.knowledge.important.length
                  : undefined
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                className={cn('knowledge-tab', tab === item.key && 'is-active')}
                onClick={() => {
                  setTab(item.key)
                  setKeyword('')
                }}
              >
                {item.label}
                {typeof count === 'number' ? <span>{count}</span> : null}
              </button>
            )
          })}
        </div>
      </section>

      {tab === 'browse' && !keyword.trim() ? (
        <div className="subject-chips knowledge-subjects">
          <Chip active={subject === 'all'} count={index.total} onClick={() => { setSubject('all'); setChapter('all') }}>
            全部科目
          </Chip>
          {SUBJECT_META.filter((s) => index.subjects.some((tree) => tree.key === s.key)).map((s) => {
            const tree = index.subjects.find((item) => item.key === s.key)
            return (
              <Chip
                key={s.key}
                active={subject === s.key}
                count={tree?.count}
                dotColor={s.color}
                onClick={() => {
                  setSubject(s.key)
                  setChapter('all')
                }}
              >
                {s.short}
              </Chip>
            )
          })}
        </div>
      ) : null}

      {tab === 'browse' && !keyword.trim() && subject === 'all' ? (
        <section className="knowledge-subject-grid" aria-label="按科目学习">
          {index.subjects.map((tree) => (
            <button
              key={tree.key}
              type="button"
              className="knowledge-subject-card"
              onClick={() => setSubject(tree.key)}
              style={{ '--subject-color': tree.color } as CSSProperties}
            >
              <span className="knowledge-subject-initial">{tree.short.slice(0, 1)}</span>
              <strong>{tree.name}</strong>
              <span className="knowledge-subject-meta">
                {tree.chapters.length} 个章节 · {tree.count} 道真题
              </span>
              <span className="knowledge-subject-foot">
                {tree.desc}
                <ArrowRight size={14} aria-hidden="true" />
              </span>
            </button>
          ))}
        </section>
      ) : null}

      {point ? (
        <section className="knowledge-detail" aria-label="知识点详情">
          <div className="knowledge-detail-head">
            <div>
              <span className="knowledge-detail-crumb">
                {point.subjectName}
                <ChevronRight size={12} aria-hidden="true" />
                {point.topic}
              </span>
              <h2>{point.name}</h2>
              <div className="knowledge-detail-meta">
                <span>
                  <BookOpen size={13} aria-hidden="true" /> 收录 {point.count} 道真题
                </span>
                {point.years.length ? <span>年份 {point.years.join('、')}</span> : null}
                {point.tags.length ? <span>标签 {point.tags.slice(0, 4).join('、')}</span> : null}
              </div>
            </div>
            <div className="knowledge-detail-actions">
              <Button
                variant={favorite ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => {
                  const on = toggleKnowledgeFavorite(point.id)
                  notify(on ? '已收藏这个知识点' : '已取消收藏')
                }}
                leading={<Star size={14} fill={favorite ? 'currentColor' : 'none'} />}
              >
                {favorite ? '已收藏' : '收藏'}
              </Button>
              <Button
                variant={important ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => {
                  const on = toggleKnowledgeImportant(point.id)
                  notify(on ? '已标记为重点' : '已取消重点标记')
                }}
                leading={<Flame size={14} />}
              >
                {important ? '重点' : '标记重点'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
                收起
              </Button>
            </div>
          </div>

          <div className="knowledge-detail-body">
            <article className="knowledge-article">
              <h3>真题解析怎么说</h3>
              {point.explanations.length ? (
                point.explanations.map((text, i) => (
                  <p key={i} className="knowledge-explain">
                    <span>{i + 1}</span>
                    {text}
                  </p>
                ))
              ) : (
                <p className="knowledge-empty">
                  该知识点暂时没有可摘录的文字解析，可点击下方「问问 AI」结合教材理解。
                </p>
              )}

              <h3>相关真题</h3>
              <div className="knowledge-question-list">
                {point.questionIds.slice(0, 6).map((id) => {
                  const q = questionPreview(questions, id)
                  if (!q) return null
                  return (
                    <a key={id} href={`#/practice?q=${q.id}`} className="knowledge-question">
                      <span className="knowledge-question-index">
                        {q.year}
                        <em>第 {q.number} 题</em>
                      </span>
                      <span className="knowledge-question-stem">{q.stem}</span>
                      <span className={cn('type-badge', `type-${q.type}`)}>{TYPE_META[q.type].short}</span>
                    </a>
                  )
                })}
              </div>

              <div className="knowledge-cta">
                <Button
                  variant="primary"
                  onClick={() => navigate(`/practice?q=${point.questionIds[0]}`)}
                  trailing={<ArrowRight size={15} />}
                >
                  练相关真题
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    navigate(`/ai?tab=chat&ask=${encodeURIComponent(`请用考研政治教材的语言讲清楚「${point.name}」这个知识点，并给我一个记忆方法。`)}`)
                  }
                  leading={<Sparkles size={15} />}
                >
                  问问 AI
                </Button>
              </div>
            </article>

            <aside className="knowledge-related">
              <h3>容易一起考的知识点</h3>
             {relatedPoints(index, point, 6).map((item) => (
                <button key={item.id} type="button" onClick={() => openPoint(item)}>
                  <span>
                    <strong>{item.name}</strong>
                    <em>{item.topic}</em>
                  </span>
                  <span className="knowledge-related-count">{item.count} 题</span>
                </button>
              ))}
              {!relatedPoints(index, point, 1).length ? (
                <p className="knowledge-empty">本章节暂无更多关联知识点。</p>
              ) : null}
            </aside>
          </div>
        </section>
      ) : null}

      {tab === 'browse' && subject !== 'all' && chapters.length && !keyword.trim() ? (
        <div className="chapter-bar">
          <button
            type="button"
            className={cn('chapter-chip', chapter === 'all' && 'is-active')}
            onClick={() => setChapter('all')}
          >
            全部章节 <span>{subjectTree?.count}</span>
          </button>
          {chapters.map((c) => (
            <button
              key={c.topic}
              type="button"
              className={cn('chapter-chip', chapter === c.topic && 'is-active')}
              onClick={() => setChapter(c.topic)}
            >
              {c.topic} <span>{c.count}</span>
            </button>
          ))}
        </div>
      ) : null}

      {visiblePoints.length ? (
        <section className="knowledge-list" aria-label="知识点列表">
          {visiblePoints.map((item) => {
            const isFav = progress.knowledge.favorites.includes(item.id)
            const isImp = progress.knowledge.important.includes(item.id)
            const visited = progress.knowledge.visited[item.id]
            return (
              <article key={item.id} className={cn('knowledge-row', selectedId === item.id && 'is-current')}>
                <button type="button" className="knowledge-row-main" onClick={() => openPoint(item)}>
                  <span className="knowledge-row-top">
                    <strong>{item.name}</strong>
                    {isImp ? <i className="knowledge-flag">重点</i> : null}
                    {isFav ? <Star size={12} className="knowledge-star" fill="currentColor" aria-hidden="true" /> : null}
                  </span>
                  <span className="knowledge-row-meta">
                    {item.subjectName} · {item.topic} · {item.count} 道真题
                    {visited ? ` · ${relativeTime(visited)}看过` : ''}
                  </span>
                </button>
                <span className="knowledge-row-actions">
                  {item.years.length ? <span className="knowledge-years">{item.years.slice(0, 3).join(' / ')}</span> : null}
                  <button
                    type="button"
                    className={cn('knowledge-icon-btn', isFav && 'is-on')}
                    aria-label={isFav ? '取消收藏' : '收藏知识点'}
                    title={isFav ? '取消收藏' : '收藏知识点'}
                    onClick={() => {
                      const on = toggleKnowledgeFavorite(item.id)
                      notify(on ? '已收藏这个知识点' : '已取消收藏')
                    }}
                  >
                    {isFav ? <Star size={15} fill="currentColor" /> : <Star size={15} />}
                  </button>
                  <button
                    type="button"
                    className={cn('knowledge-icon-btn', isImp && 'is-on')}
                    aria-label={isImp ? '取消重点标记' : '标记为重点'}
                    title={isImp ? '取消重点标记' : '标记为重点'}
                    onClick={() => {
                      const on = toggleKnowledgeImportant(item.id)
                      notify(on ? '已标记为重点' : '已取消重点标记')
                    }}
                  >
                    <Flame size={15} />
                  </button>
                  <ArrowUpRight size={14} className="knowledge-open-icon" aria-hidden="true" />
                </span>
              </article>
            )
          })}
        </section>
      ) : (
        <EmptyState
          icon={<Clock size={26} />}
          title={
            keyword.trim()
              ? '没有找到匹配的知识点'
              : tab === 'favorite'
                ? '还没有收藏知识点'
                : tab === 'important'
                  ? '还没有标记重点'
                  : '这个范围下暂无知识点'
          }
          description={
            keyword.trim()
              ? '试试更短的关键词，或直接到 AI 助教提问。'
              : '在知识点详情里点击「收藏」或「标记重点」，就会出现在这里。'
          }
          action={
            <Button
              variant="primary"
              onClick={() => {
                setKeyword('')
                setTab('browse')
                setSubject('all')
              }}
            >
              浏览全部知识点
            </Button>
          }
        />
      )}

      {tab === 'recent' && tabPoints.length ? (
        <p className="knowledge-footnote">
          <StarOff size={13} aria-hidden="true" /> 最近学习记录保存在本机浏览器，换设备不会自动同步。
        </p>
      ) : null}
    </div>
  )
}
