import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Couple } from '../lib/couple'
import { fetchMyProfile } from '../lib/members'
import { Icon, type IconName } from '../components/Icons'
import BudgetPage from './BudgetPage'
import HomePage from './HomePage'
import MyPage from './MyPage'
import TasksPage from './TasksPage'
import TimelinePage from './TimelinePage'

export type TabKey = 'home' | 'timeline' | 'tasks' | 'budget' | 'mine'

const TABS: { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'home', label: '首页', icon: 'home' },
  { key: 'timeline', label: '时间轴', icon: 'timeline' },
  { key: 'tasks', label: '事项', icon: 'calendar' },
  { key: 'budget', label: '账本', icon: 'budget' },
  { key: 'mine', label: '我们', icon: 'us' },
]

export default function MainShell({
  couple,
  onCoupleChange,
}: {
  couple: Couple
  onCoupleChange: () => void
}) {
  const [tab, setTab] = useState<TabKey>('home')
  const { data: me } = useQuery({
    queryKey: ['me-profile'],
    queryFn: () => fetchMyProfile(),
  })

  return (
    <div className="shell">
      <main>
        <div className="shell-head">
          <span className="muted shell-greet">
            {me?.display_name ? `你好，${me.display_name}` : '你好'}
          </span>
        </div>
        {tab === 'home' && (
          <HomePage couple={couple} onGoTab={setTab} onCoupleChange={onCoupleChange} />
        )}
        {tab === 'timeline' && <TimelinePage couple={couple} />}
        {tab === 'tasks' && <TasksPage couple={couple} />}
        {tab === 'budget' && <BudgetPage couple={couple} />}
        {tab === 'mine' && (
          <MyPage couple={couple} onCoupleChange={onCoupleChange} onGoTab={setTab} />
        )}
      </main>
      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'active' : ''}
            onClick={() => setTab(t.key)}
          >
            <span className="tab-icon">
              <Icon name={t.icon} size={19} />
            </span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
