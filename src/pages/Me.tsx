import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  Database,
  Download,
  HardDrive,
  Info,
  ShieldCheck,
  Target,
  Trash2,
  Upload,
} from 'lucide-react'
import { Button, Modal, ProgressBar } from '../components/ui/primitives'
import { buildKnowledgeIndex } from '../lib/knowledge'
import { checkLocalStorage } from '../lib/storage'
import { cn, formatDuration, navigate, pct, relativeTime } from '../lib/utils'
import { useStudy } from '../store/StudyProvider'

export function Me() {
  const { questions, progress, stats, exportBackup, importBackup, resetProgress, notify } = useStudy()
  const [storage, setStorage] = useState<{ indexedDb: boolean; local: boolean } | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let alive = true
    checkLocalStorage()
      .then((result) => {
        if (alive) setStorage(result)
      })
      .catch(() => {
        if (alive) setStorage({ indexedDb: false, local: false })
      })
    return () => {
      alive = false
    }
  }, [])

  const index = useMemo(() => buildKnowledgeIndex(questions), [questions])

  const recentKnowledge = useMemo(() => {
    return Object.entries(progress.knowledge.visited)
      .sort((a, b) => b[1].localeCompare(a[1]))
      .slice(0, 6)
      .map(([id, at]) => ({ point: index.byId.get(id), at }))
      .filter((item): item is { point: NonNullable<typeof item.point>; at: string } => Boolean(item.point))
  }, [progress.knowledge.visited, index])

  const wrongCount = stats.wrong
  const overall = stats.total ? stats.practiced / stats.total : 0

  return (
    <div className="page me-page">
      <header className="page-head">
        <div>
          <span className="eyebrow">
            <span className="live-dot" aria-hidden="true" />
            MY SPACE · 无需登录
          </span>
          <h1>我的学习</h1>
          <p className="page-sub">
            Echo 不设账号系统。你的错题、收藏、练习记录和模拟考试都保存在当前浏览器里。
          </p>
        </div>
      </header>

      <section className="me-profile">
        <div className="me-avatar" aria-hidden="true">
          E
        </div>
        <div className="me-profile-main">
          <h2>本机学习者</h2>
          <p>打开即用 · 无需注册 · 不需要手机号</p>
          <div className="me-profile-badges">
            <span>
              <ShieldCheck size={13} /> 学习记录仅存本机
            </span>
            <span>
              <Bot size={13} /> AI 由服务端安全调用
            </span>
          </div>
        </div>
        <div className="me-progress">
          <span>题库进度</span>
          <strong>{Math.round(overall * 100)}%</strong>
          <ProgressBar value={overall} />
          <span className="me-progress-note">
            已练 {stats.practiced} / {stats.total} 题
          </span>
        </div>
      </section>

      <section className="me-stat-grid" aria-label="学习数据">
        <button type="button" onClick={() => navigate('/mistakes')}>
          <span>待巩固错题</span>
          <strong>{wrongCount}</strong>
          <em>去复习 <ArrowRight size={12} /></em>
        </button>
        <button type="button" onClick={() => navigate('/collection')}>
          <span>收藏题目</span>
          <strong>{progress.favorites.length}</strong>
          <em>去查看 <ArrowRight size={12} /></em>
        </button>
        <button type="button" onClick={() => navigate('/knowledge?tab=favorite')}>
          <span>收藏知识点</span>
          <strong>{progress.knowledge.favorites.length}</strong>
          <em>去查看 <ArrowRight size={12} /></em>
        </button>
        <button type="button" onClick={() => navigate('/exam')}>
          <span>模拟考试</span>
          <strong>{progress.exams.length}</strong>
          <em>最近成绩 <ArrowRight size={12} /></em>
        </button>
        <div>
          <span>客观题正确率</span>
          <strong>{pct(stats.accuracy)}</strong>
          <em>{stats.graded} 道已判分</em>
        </div>
        <div>
          <span>连续练习</span>
          <strong>{stats.streak} 天</strong>
          <em>本周 {stats.weekCount} 题</em>
        </div>
      </section>

      <div className="me-columns">
        <section className="panel">
          <header className="panel-head">
            <div>
              <span className="panel-label">STORE</span>
              <h2>本地学习记录</h2>
            </div>
            <span className={cn('me-store-badge', storage && (!storage.local || !storage.indexedDb) && 'is-warn')}>
              <Database size={13} />
              {storage === null
                ? '检测中'
                : storage.indexedDb && storage.local
                  ? 'IndexedDB + 本地缓存'
                  : storage.local
                    ? '仅本地缓存'
                    : '存储受限'}
            </span>
          </header>

          <div className="me-store-note">
            <HardDrive size={16} aria-hidden="true" />
            <p>
              刷新页面、关闭浏览器后再打开，记录都会保留。换手机或换浏览器不会自动同步；清除浏览器数据会丢失记录，
              建议定期导出备份。
            </p>
          </div>

          <div className="me-store-actions">
            <Button variant="primary" onClick={exportBackup} leading={<Download size={15} />}>
              导出学习记录
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()} leading={<Upload size={15} />}>
              导入学习记录
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void importBackup(file)
                event.target.value = ''
              }}
            />
            <Button variant="ghost" onClick={() => setResetOpen(true)} leading={<Trash2 size={15} />}>
              清空记录
            </Button>
          </div>

          <div className="me-store-facts">
            <span><CheckCircle2 size={13} /> 错题 {wrongCount} 道</span>
            <span><CheckCircle2 size={13} /> 收藏 {progress.favorites.length + progress.knowledge.favorites.length} 项</span>
            <span><CheckCircle2 size={13} /> 模考 {progress.exams.length} 场</span>
            <span><CheckCircle2 size={13} /> 最近学习 {Object.keys(progress.knowledge.visited).length} 个知识点</span>
          </div>
        </section>

        <section className="panel">
          <header className="panel-head">
            <div>
              <span className="panel-label">RECENT</span>
              <h2>最近学习的知识点</h2>
            </div>
            <button type="button" className="quiet-link" onClick={() => navigate('/knowledge?tab=recent')}>
              全部 <ArrowRight size={13} />
            </button>
          </header>
          {recentKnowledge.length ? (
            <div className="me-recent-list">
              {recentKnowledge.map(({ point, at }) => (
                <button
                  key={point.id}
                  type="button"
                  onClick={() => navigate(`/knowledge?point=${encodeURIComponent(point.id)}`)}
                >
                  <span>
                    <strong>{point.name}</strong>
                    <em>{point.subjectName} · {point.topic}</em>
                  </span>
                  <span className="me-recent-time">{relativeTime(at)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="me-empty">
              <BookOpen size={18} aria-hidden="true" />
              <p>还没有学习过知识点，去「知识点」看看。</p>
              <Button variant="secondary" size="sm" onClick={() => navigate('/knowledge')}>
                开始学习
              </Button>
            </div>
          )}
        </section>

        <section className="panel">
          <header className="panel-head">
            <div>
              <span className="panel-label">EXAMS</span>
              <h2>最近的模拟考试</h2>
            </div>
            <button type="button" className="quiet-link" onClick={() => navigate('/exam')}>
              去考试 <ArrowRight size={13} />
            </button>
          </header>
          {progress.exams.length ? (
            <div className="me-exam-list">
              {progress.exams.slice(0, 4).map((exam) => (
                <div key={exam.id}>
                  <span className="me-exam-icon"><Target size={14} /></span>
                  <span className="me-exam-main">
                    <strong>{exam.scope}</strong>
                    <em>
                      {new Date(exam.at).toLocaleDateString('zh-CN')} · {formatDuration(exam.durationSec)}
                    </em>
                  </span>
                  <span className="me-exam-score">
                    {exam.score}
                    <em>/ {exam.total} 分</em>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="me-empty">
              <Target size={18} aria-hidden="true" />
              <p>还没有模拟考试记录，10 分钟就能完成一场。</p>
              <Button variant="secondary" size="sm" onClick={() => navigate('/exam')}>
                去模拟考试
              </Button>
            </div>
          )}
        </section>
      </div>

      <section className="me-tip">
        <Info size={16} aria-hidden="true" />
        <p>
          Echo 是免费、免登录的学习工具。清除浏览器缓存、使用无痕模式或更换设备可能导致记录丢失，
          请定期使用「导出学习记录」保存一份 JSON 备份。
        </p>
      </section>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="清空全部学习记录？"
        description="错题、收藏、答题历史、模拟考试记录都会被删除，且无法恢复。"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>
              取消
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                resetProgress()
                setResetOpen(false)
                notify('学习记录已清空')
              }}
              leading={<Trash2 size={15} />}
            >
              确认清空
            </Button>
          </>
        }
      >
        <p className="me-reset-note">建议先导出备份，再清空记录。题库和知识点不会受影响。</p>
      </Modal>
    </div>
  )
}
