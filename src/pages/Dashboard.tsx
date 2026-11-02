import { useMemo, type CSSProperties } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookMarked,
  BookOpen,
  Brain,
  ChevronRight,
  Clock,
  Flame,
  ListChecks,
  Newspaper,
  Sparkles,
  Star,
  Target,
  Timer,
  Wand2,
} from 'lucide-react'
import { Heatmap } from '../components/charts/Charts'
import { Button, ProgressBar, Ring } from '../components/ui/primitives'
import { SUBJECT_META, TYPE_META } from '../lib/data'
import { buildKnowledgeIndex } from '../lib/knowledge'
import type { Question, SubjectKey } from '../lib/types'
import { cn, daysToExam, formatDateCN, greeting, navigate, pct, relativeTime } from '../lib/utils'
import { useStudy } from '../store/StudyProvider'

function pickStart(questions: Question[], lastId: string | null): Question | undefined {
  if (lastId) {
    const last = questions.find((q) => q.id === lastId)
    if (last) return last
  }
  return [...questions].sort((a, b) => b.year - a.year || a.number - b.number)[0]
}

interface ModuleItem {
  key: string
  title: string
  desc: string
  href: string
  icon: typeof BookOpen
  meta?: string
  accent?: string
  badge?: number
}

function ModuleCard({ item }: { item: ModuleItem }) {
  const Icon = item.icon
  return (
    <a className="echo-module" href={item.href} style={item.accent ? { '--module-accent': item.accent } as CSSProperties : undefined}>
      <span className="echo-module-icon">
        <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="echo-module-copy">
        <strong>
          {item.title}
          {item.badge ? <i className="echo-module-badge">{item.badge}</i> : null}
        </strong>
        <em>{item.desc}</em>
      </span>
      <span className="echo-module-side">
        {item.meta ? <span>{item.meta}</span> : null}
        <ArrowUpRight size={14} aria-hidden="true" />
      </span>
    </a>
  )
}

export function Dashboard() {
  const { questions, stats, progress } = useStudy()
  const index = useMemo(() => buildKnowledgeIndex(questions), [questions])
  const start = pickStart(questions, progress.lastQuestionId)
  const overall = stats.total ? stats.practiced / stats.total : 0
  const exam = daysToExam()
  const todayTarget = 3
  const todayDone = Math.min(stats.todayCount, todayTarget)
  const recent = Object.entries(progress.records)
    .sort((a, b) => (b[1].at || '').localeCompare(a[1].at || ''))
    .slice(0, 4)
    .map(([id, record]) => ({ question: questions.find((q) => q.id === id), record }))
    .filter((item): item is { question: Question; record: typeof item.record } => Boolean(item.question))

  const yearSpan = useMemo(() => {
    const years = questions.map((q) => q.year)
    return years.length ? `${Math.min(...years)}—${Math.max(...years)}` : ''
  }, [questions])

  const subjectPointCount = (key: SubjectKey) => {
    const tree = index.subjects.find((item) => item.key === key)
    return tree ? `${tree.chapters.length} 章 · ${tree.count} 题` : ''
  }

  const objectiveCount = useMemo(
    () => questions.filter((q) => q.type !== 'analysis').length,
    [questions],
  )

  const headline =
    stats.practiced === 0
      ? '从第一道真题开始'
      : stats.todayCount >= todayTarget
        ? '今天的任务完成了'
        : `今天再学 ${todayTarget - stats.todayCount} 步`

  return (
    <div className="page dashboard echo-home">
      <header className="page-head">
        <div>
          <span className="eyebrow">
            <span className="live-dot" aria-hidden="true" />
            {formatDateCN()}
          </span>
          <h1>
            {greeting()}，<span className="headline-accent">{headline}</span>
          </h1>
          <p className="page-sub">
            {yearSpan} 年 {stats.total} 道真实真题 · {index.total} 个知识点 · 打开即学，不需要登录。
          </p>
        </div>
        <div className="page-head-aside">
          <div className="countdown-chip">
            <span>{exam.label}</span>
            <strong>{exam.days}</strong>
            <em>天</em>
          </div>
        </div>
      </header>

      <section className="echo-hero" aria-label="今日学习">
        <div className="echo-hero-glow" aria-hidden="true" />
        <div className="echo-hero-copy">
          <span className="echo-hero-kicker">
            <Sparkles size={14} aria-hidden="true" /> 今日学习
          </span>
          <h2>
            {stats.practiced === 0
              ? '先做一道题，找到今天的感觉。'
              : stats.todayCount >= todayTarget
                ? '今天的三步已完成，可以再往前一点。'
                : '今天的节奏，接着昨天的位置继续。'}
          </h2>
          <p>
            推荐顺序：先看一个知识点，再做一组选择题，最后让 AI 讲讲错在哪里。
            每天三步，政治就不再是临时抱佛脚。
          </p>
          <div className="echo-hero-actions">
            <Button
              variant="primary"
              size="lg"
              onClick={() => (start ? navigate(`/practice?q=${start.id}`) : navigate('/practice'))}
              trailing={<ArrowRight size={16} />}
            >
              {progress.lastQuestionId ? '继续上次的题' : '开始第一题'}
            </Button>
            <Button variant="secondary" size="lg" onClick={() => navigate('/knowledge')} leading={<BookOpen size={15} />}>
              看知识点
            </Button>
            <Button variant="ghost" size="lg" onClick={() => navigate('/ai')} leading={<Brain size={15} />}>
              问 AI
            </Button>
          </div>
          <div className="echo-hero-meta">
            <span><Flame size={13} /> 连续 {stats.streak} 天</span>
            <span>今天完成 {stats.todayCount} 题</span>
            <span>题库进度 {Math.round(overall * 100)}%</span>
          </div>
        </div>
        <div className="echo-hero-ring">
          <Ring value={todayDone / todayTarget} size={150} stroke={10} tone="accent">
            <strong>{todayDone}<em>/{todayTarget}</em></strong>
            <span>今日三步</span>
          </Ring>
          {start ? (
            <p className="echo-hero-next">
              下一题：{start.year} · 第 {start.number} 题
              <em>{TYPE_META[start.type].short}</em>
            </p>
          ) : null}
        </div>
      </section>

      <section className="echo-stat-strip" aria-label="学习概览">
        <div>
          <span>已练题目</span>
          <strong>{stats.practiced}<em>/ {stats.total}</em></strong>
          <ProgressBar value={overall} />
        </div>
        <div>
          <span>客观题正确率</span>
          <strong>{pct(stats.accuracy)}</strong>
          <em>{stats.graded} 道已判分</em>
        </div>
        <div>
          <span>待巩固错题</span>
          <strong>{stats.wrong}<em>题</em></strong>
          <button type="button" onClick={() => navigate('/mistakes')}>
            去错题本 <ArrowRight size={12} />
          </button>
        </div>
        <div>
          <span>收藏与模考</span>
          <strong>{progress.favorites.length + progress.knowledge.favorites.length}<em>项收藏</em></strong>
          <em>{progress.exams.length} 场模拟考试</em>
        </div>
      </section>

      <section className="echo-section" aria-label="政治知识点">
        <header className="echo-section-head">
          <div>
            <span className="panel-label">KNOWLEDGE</span>
            <h2>政治知识点</h2>
          </div>
          <a href="#/knowledge" className="quiet-link">
            全部 {index.total} 个知识点 <ArrowRight size={13} />
          </a>
        </header>
        <div className="echo-module-grid is-wide">
          <ModuleCard
            item={{
              key: 'all-knowledge',
              title: '政治知识点',
              desc: '按科目、章节、知识点逐层浏览，支持搜索与关联推荐',
              href: '#/knowledge',
              icon: BookOpen,
              meta: `${index.total} 个`,
            }}
          />
          {SUBJECT_META.filter((s) => index.subjects.some((tree) => tree.key === s.key)).map((s) => (
            <ModuleCard
              key={s.key}
              item={{
                key: s.key,
                title: s.name,
                desc: s.desc,
                href: `#/knowledge?subject=${encodeURIComponent(s.key)}`,
                icon: BookOpen,
                meta: subjectPointCount(s.key),
                accent: s.color,
              }}
            />
          ))}
        </div>
      </section>

      <section className="echo-section" aria-label="练习与考试">
        <header className="echo-section-head">
          <div>
            <span className="panel-label">PRACTICE</span>
            <h2>练习与考试</h2>
          </div>
          <a href="#/insights" className="quiet-link">
            学习统计 <ArrowRight size={13} />
          </a>
        </header>
        <div className="echo-module-grid">
          <ModuleCard
            item={{
              key: 'papers',
              title: '历年真题',
              desc: '按年份整卷练习，保留原始题目与解析',
              href: '#/papers',
              icon: Clock,
              meta: `${yearSpan}`,
            }}
          />
          <ModuleCard
            item={{
              key: 'practice',
              title: '选择题练习',
              desc: '单选、多选、随机、专项与错题重练',
              href: '#/practice',
              icon: ListChecks,
              meta: `${objectiveCount} 道客观题`,
            }}
          />
          <ModuleCard
            item={{
              key: 'exam',
              title: '模拟考试',
              desc: '真实题库自动组卷，限时作答并自动评分',
              href: '#/exam',
              icon: Timer,
              meta: `${progress.exams.length} 场记录`,
            }}
          />
          <ModuleCard
            item={{
              key: 'daily',
              title: '今日训练',
              desc: '优先错题与未练题，20 题一组，约 15 分钟',
              href: '#/practice?smart=1',
              icon: Flame,
              meta: '智能组题',
            }}
          />
        </div>
      </section>

      <section className="echo-section" aria-label="AI 工具">
        <header className="echo-section-head">
          <div>
            <span className="panel-label">AI TOOLS</span>
            <h2>AI 学习助手</h2>
          </div>
          <span className="echo-section-note">基于 DeepSeek · 结合真实题库</span>
        </header>
        <div className="echo-module-grid">
          <ModuleCard
            item={{
              key: 'ai-chat',
              title: 'AI 智能答疑',
              desc: '解释知识点、比较易混概念、整理框架、出练习题',
              href: '#/ai',
              icon: Brain,
              meta: '随时提问',
            }}
          />
          <ModuleCard
            item={{
              key: 'ai-explain',
              title: 'AI 题目解析',
              desc: '逐项辨析选项，指出考点并给出记忆提示',
              href: '#/ai?tab=explain',
              icon: Wand2,
              meta: '做完题再看',
            }}
          />
        </div>
      </section>

      <section className="echo-section" aria-label="我的学习">
        <header className="echo-section-head">
          <div>
            <span className="panel-label">MY LEARNING</span>
            <h2>我的学习</h2>
          </div>
          <a href="#/me" className="quiet-link">
            本地记录与备份 <ArrowRight size={13} />
          </a>
        </header>
        <div className="echo-module-grid">
          <ModuleCard
            item={{
              key: 'mistakes',
              title: '错题本',
              desc: '自动收录做错的题，连续答对两次移入已掌握',
              href: '#/mistakes',
              icon: BookMarked,
              meta: `${stats.wrong} 题待巩固`,
              badge: stats.wrong,
            }}
          />
          <ModuleCard
            item={{
              key: 'collection',
              title: '收藏夹',
              desc: '收藏题目与知识点，支持分类查看',
              href: '#/collection',
              icon: Star,
              meta: `${progress.favorites.length} 题 · ${progress.knowledge.favorites.length} 知识点`,
            }}
          />
          <ModuleCard
            item={{
              key: 'insights',
              title: '学习统计',
              desc: '学科正确率、薄弱专题与近 12 周学习节奏',
              href: '#/insights',
              icon: BarChart3,
              meta: pct(stats.accuracy),
            }}
          />
          <ModuleCard
            item={{
              key: 'me',
              title: '我的记录',
              desc: '导出、导入、清空本地学习数据',
              href: '#/me',
              icon: Target,
              meta: '仅存本机',
            }}
          />
        </div>
      </section>

      <div className="echo-home-lower">
        <section className="panel" aria-label="学科进度">
          <header className="panel-head">
            <div>
              <span className="panel-label">SUBJECTS</span>
              <h2>学科进度</h2>
            </div>
            <span className="panel-meta">按学科继续</span>
          </header>
          <div className="subject-list">
            {SUBJECT_META.map((subject) => {
              const data = stats.subjects.find((s) => s.key === subject.key)
              if (!data) return null
              const ratio = data.total ? data.practiced / data.total : 0
              return (
                <a key={subject.key} className="subject-row" href={`#/knowledge?subject=${encodeURIComponent(subject.key)}`}>
                  <span
                    className="subject-symbol"
                    style={{ color: subject.color, borderColor: `color-mix(in srgb, ${subject.color} 35%, transparent)` }}
                  >
                    {subject.initial}
                  </span>
                  <span className="subject-name">
                    <strong>{subject.short}</strong>
                    <em>{data.practiced} / {data.total} 题</em>
                  </span>
                  <span className="subject-bar">
                    <i style={{ width: `${ratio * 100}%`, background: subject.color }} />
                  </span>
                  <span className="subject-accuracy">
                    {data.accuracy === null ? '—' : `${Math.round(data.accuracy * 100)}%`}
                    <em>正确率</em>
                  </span>
                  <ChevronRight size={15} className="subject-arrow" aria-hidden="true" />
                </a>
              )
            })}
          </div>
        </section>

        <div className="echo-home-side">
          <section className="panel" aria-label="练习节奏">
            <header className="panel-head">
              <div>
                <span className="panel-label">RHYTHM</span>
                <h2>练习节奏</h2>
              </div>
              <span className="panel-meta">近 12 周</span>
            </header>
            <Heatmap activity={progress.activity} weeks={12} />
          </section>

          <section className="panel" aria-label="最近练习">
            <header className="panel-head">
              <div>
                <span className="panel-label">RECENT</span>
                <h2>最近练习</h2>
              </div>
            </header>
            {recent.length ? (
              <div className="recent-list">
                {recent.map(({ question, record }) => (
                  <a key={question.id} className="recent-row" href={`#/practice?q=${question.id}`}>
                    <span
                      className={cn(
                        'recent-dot',
                        record.correct === true && 'is-correct',
                        record.correct === false && 'is-wrong',
                      )}
                      aria-hidden="true"
                    />
                    <span className="recent-main">
                      <strong>{question.year} · 第 {question.number} 题</strong>
                      <em>{question.topic}</em>
                    </span>
                    <span className="recent-time">{relativeTime(record.at)}</span>
                    <ChevronRight size={13} aria-hidden="true" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="recent-empty">完成第一道题后，这里会留下最近的练习轨迹。</p>
            )}
          </section>
        </div>
      </div>

      <p className="echo-home-note">
        <Newspaper size={13} aria-hidden="true" />
        时事政治以题库真实收录的专题为准；最新时政请以官方权威发布核对。
      </p>
    </div>
  )
}
