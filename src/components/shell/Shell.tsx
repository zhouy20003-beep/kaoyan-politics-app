import { useEffect, useState } from 'react'
import {
  BarChart3,
  BookMarked,
  BookOpen,
  Brain,
  ChevronRight,
  Clock,
  FileText,
  Flame,
  Home,
  Moon,
  Search,
  Settings,
  Star,
  Sun,
  Target,
  User,
} from 'lucide-react'
import { cn, daysToExam, formatDateCN, navigate } from '../../lib/utils'
import { useStudy } from '../../store/StudyProvider'

const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

function useResolvedTheme(): 'light' | 'dark' {
  const { settings } = useStudy()
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemDark(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme
}

export const NAV_ITEMS = [
  { key: '', label: '首页', en: 'HOME', icon: Home, group: '学习' },
  { key: 'knowledge', label: '知识点', en: 'KNOWLEDGE', icon: BookOpen, group: '学习' },
  { key: 'practice', label: '刷题', en: 'PRACTICE', icon: FileText, group: '学习' },
  { key: 'papers', label: '历年真题', en: 'PAPERS', icon: Clock, group: '学习' },
  { key: 'exam', label: '模拟考试', en: 'EXAM', icon: Target, group: '学习' },
  { key: 'ai', label: 'AI 助教', en: 'AI TUTOR', icon: Brain, group: 'AI 工具' },
  { key: 'mistakes', label: '错题本', en: 'MISTAKES', icon: BookMarked, group: '复盘' },
  { key: 'collection', label: '收藏夹', en: 'COLLECTION', icon: Star, group: '复盘' },
  { key: 'insights', label: '学习统计', en: 'STATS', icon: BarChart3, group: '复盘' },
  { key: 'me', label: '我的', en: 'ME', icon: User, group: '我的' },
] as const

const PAGE_META: Record<string, { label: string; eyebrow: string }> = {
  '': { label: '首页', eyebrow: 'HOME' },
  knowledge: { label: '政治知识点', eyebrow: 'KNOWLEDGE' },
  practice: { label: '刷题练习', eyebrow: 'PRACTICE' },
  papers: { label: '历年真题', eyebrow: 'PAPERS' },
  exam: { label: '模拟考试', eyebrow: 'MOCK EXAM' },
  ai: { label: 'AI 助教', eyebrow: 'AI TUTOR' },
  mistakes: { label: '错题本', eyebrow: 'MISTAKES' },
  collection: { label: '收藏夹', eyebrow: 'COLLECTION' },
  insights: { label: '学习统计', eyebrow: 'STATS' },
  me: { label: '我的', eyebrow: 'ME' },
  settings: { label: '设置', eyebrow: 'SETTINGS' },
}

export function pageMeta(path: string[]): { label: string; eyebrow: string } {
  return PAGE_META[path[0] || ''] || PAGE_META['']
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a className={cn('brand', compact && 'brand-compact')} href="#/" aria-label="桃子专属 首页">
      <span className="brand-seal" aria-hidden="true">
        E
      </span>
      {!compact ? (
        <span className="brand-text">
          <strong>桃子专属</strong>
          <em>POLITICS AI</em>
        </span>
      ) : null}
    </a>
  )
}

export function Sidebar({ active }: { active: string }) {
  const { stats, progress } = useStudy()
  const exam = daysToExam()
  const groups = ['学习', 'AI 工具', '复盘', '我的']

  return (
    <aside className="sidebar" aria-label="主导航">
      <div className="sidebar-top">
        <Brand />
        <span className="brand-tag">考研政治 AI 学习平台</span>
      </div>

      <nav className="side-nav">
        {groups.map((group) => (
          <div className="nav-group" key={group}>
            <span className="nav-group-label">{group}</span>
            {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
              const Icon = item.icon
              const isActive = active === item.key
              const badge =
                item.key === 'mistakes' && stats.wrong
                  ? stats.wrong
                  : item.key === 'collection' && stats.favorites
                    ? stats.favorites
                    : null
              return (
                <a
                  key={item.key}
                  href={`#/${item.key}`}
                  className={cn('nav-item', isActive && 'is-active')}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                  <span>{item.label}</span>
                  {badge ? <span className="nav-badge">{badge}</span> : null}
                  {isActive ? <span className="nav-pip" aria-hidden="true" /> : null}
                </a>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="exam-card">
          <div className="exam-card-head">
            <Target size={15} aria-hidden="true" />
            <span>{exam.label}</span>
          </div>
          <div className="exam-days">
            <strong>{exam.days}</strong>
            <span>天</span>
          </div>
          <p>打开就能学，不需要登录。</p>
          <div className="exam-progress">
            <span style={{ width: `${Math.min(100, (stats.practiced / Math.max(1, stats.total)) * 100)}%` }} />
          </div>
          <span className="exam-progress-label">
            已练 {stats.practiced} / {stats.total}
          </span>
        </div>

        <div className="side-actions">
          <a className="side-link" href="#/settings">
            <Settings size={17} strokeWidth={1.8} aria-hidden="true" />
            <span>设置</span>
          </a>
          <ThemeButton />
        </div>
        <div className="side-note">
          <span className="live-dot" aria-hidden="true" />
          记录保存在本机
        </div>
      </div>
      {progress.examDraft ? <span className="sr-only">有未完成的整卷模考</span> : null}
    </aside>
  )
}

export function ThemeButton() {
  const { setTheme } = useStudy()
  const resolved = useResolvedTheme()
  const next = resolved === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      className="side-link theme-button"
      onClick={() => setTheme(next)}
      aria-label={resolved === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
      title={resolved === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
    >
      {resolved === 'dark' ? <Sun size={17} strokeWidth={1.8} /> : <Moon size={17} strokeWidth={1.8} />}
      <span>{resolved === 'dark' ? '亮色' : '暗色'}</span>
    </button>
  )
}

export function Topbar({
  path,
  onSearch,
}: {
  path: string[]
  onSearch: () => void
}) {
  const { stats, setTheme } = useStudy()
  const meta = pageMeta(path)
  const resolved = useResolvedTheme()

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-mobile-brand">
          <Brand compact />
        </div>
        <div className="crumb">
          <span className="crumb-root">桃子专属 学习平台</span>
          <ChevronRight size={12} aria-hidden="true" />
          <span className="crumb-current">{meta.label}</span>
        </div>
        <span className="topbar-date">{formatDateCN()}</span>
      </div>
      <div className="topbar-right">
        <button type="button" className="search-trigger" onClick={onSearch} aria-label="搜索题目">
          <Search size={16} strokeWidth={1.9} aria-hidden="true" />
          <span>搜索真题、考点</span>
          <kbd>{IS_MAC ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
        <a className="topbar-icon" href="#/collection" aria-label="收藏夹" title="收藏夹">
          <Star size={17} strokeWidth={1.8} />
        </a>
        <button
          type="button"
          className="topbar-icon"
          onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
          aria-label={resolved === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
          title={resolved === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
        >
          {resolved === 'dark' ? <Sun size={17} strokeWidth={1.8} /> : <Moon size={17} strokeWidth={1.8} />}
        </button>
        <a className="topbar-icon topbar-settings" href="#/settings" aria-label="设置" title="设置">
          <Settings size={17} strokeWidth={1.8} />
        </a>
        <span className="streak-pill" title={`连续练习 ${stats.streak} 天`}>
          <Flame size={15} aria-hidden="true" />
          <strong>{stats.streak}</strong>
          <span>天</span>
        </span>
      </div>
    </header>
  )
}

export function MobileNav({ active }: { active: string }) {
  const { stats } = useStudy()
  const items = [
    { key: '', label: '首页', icon: Home },
    { key: 'knowledge', label: '知识点', icon: BookOpen },
    { key: 'practice', label: '刷题', icon: FileText, badge: stats.wrong },
    { key: 'ai', label: 'AI 助教', icon: Brain },
    { key: 'me', label: '我的', icon: User },
  ]
  return (
    <nav className="mobile-nav" aria-label="移动端导航">
      {items.map((item) => {
        const Icon = item.icon
        const isActive = active === item.key
        return (
          <a
            key={item.key}
            href={`#/${item.key}`}
            className={cn('mobile-nav-item', isActive && 'is-active')}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => {
              if (!isActive) navigate(`/${item.key}`)
            }}
          >
            <span className="mobile-icon">
              <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
              {item.badge ? <i className="mobile-badge">{item.badge > 99 ? '99+' : item.badge}</i> : null}
            </span>
            <span>{item.label}</span>
          </a>
        )
      })}
    </nav>
  )
}
