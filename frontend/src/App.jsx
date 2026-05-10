import { useState, useEffect, useCallback, Suspense, lazy } from 'react'
import api from './api'
import { useToast } from './components/Toast'
import ErrorBoundary from './components/ErrorBoundary'
import CommandPalette from './components/CommandPalette'
import HamburgerMenu from './components/HamburgerMenu'
import SkeletonLoader from './components/SkeletonLoader'
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts'

// Code-split pages
const Repos = lazy(() => import('./pages/Repos'))
const Activity = lazy(() => import('./pages/Activity'))
const Deploy = lazy(() => import('./pages/Deploy'))
const RepoDetail = lazy(() => import('./pages/RepoDetail'))
const Issues = lazy(() => import('./pages/Issues'))
const IssueDetail = lazy(() => import('./pages/IssueDetail'))
const Pulls = lazy(() => import('./pages/Pulls'))
const PullDetail = lazy(() => import('./pages/PullDetail'))
const Actions = lazy(() => import('./pages/Actions'))
const CodeBrowse = lazy(() => import('./pages/CodeBrowse'))
const Search = lazy(() => import('./pages/Search'))
const Profile = lazy(() => import('./pages/Profile'))
const Settings = lazy(() => import('./pages/Settings'))
const Security = lazy(() => import('./pages/Security'))
const Discussions = lazy(() => import('./pages/Discussions'))

// ============ Icons ============
const Icon = {
  github: (s = 16) => (
    <svg width={s} height={s} fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
  ),
  star: (s = 14) => (
    <svg width={s} height={s} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
  ),
  fork: (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/></svg>
  ),
  issue: (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
  ),
  deploy: (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
  ),
  refresh: (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
  ),
  back: (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
  ),
  lock: (s = 12) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
  ),
  gitBranch: (s = 12) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 01-9 9"/></svg>
  ),
  search: (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
  ),
  trash: (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
  ),
  external: (s = 12) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
  ),
  code: (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
  ),
  users: (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
  ),
  plus: (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
  ),
  activity: (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  ),
  commit: (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/></svg>
  ),
  pr: (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 009 9"/></svg>
  ),
  release: (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
  ),
  watch: (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  ),
  create: (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
  ),
  delete: (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
  ),
  public: (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
  ),
  folder: (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
  ),
  file: (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
  ),
  zap: (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
  ),
  tag: (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
  ),
  sun: (s = 16) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
  ),
  messageCircle: (s = 14) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
  ),
  moon: (s = 16) => (
    <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
  ),
}

export { Icon }

// ============ Main App ============
export default function App() {
  const [currentPage, setCurrentPage] = useState('repos')
  const [selectedRepo, setSelectedRepo] = useState(null)
  const [selectedIssue, setSelectedIssue] = useState(null)
  const [selectedPull, setSelectedPull] = useState(null)
  const [githubRepos, setGithubRepos] = useState([])
  const [projects, setProjects] = useState([])
  const [hfSpaces, setHfSpaces] = useState([])
  const [activities, setActivities] = useState([])
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('github-mirror-theme')
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const toast = useToast()

  const [unreadCount, setUnreadCount] = useState(() => {
    return parseInt(sessionStorage.getItem('github-mirror-unread') || '0', 10)
  })

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('github-mirror-theme', theme)
  }, [theme])

  // Listen for system theme changes (only if user hasn't manually set)
  useEffect(() => {
    const saved = localStorage.getItem('github-mirror-theme')
    if (saved) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => setTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const loadAll = useCallback(async () => {
    try {
      const [g, p, h, a] = await Promise.all([
        api.get('/api/github/repos').catch(() => []),
        api.get('/api/projects').catch(() => []),
        api.get('/api/hf/spaces').catch(() => []),
        api.get('/api/github/activity').catch(() => []),
      ])
      setGithubRepos(Array.isArray(g) ? g : [])
      setProjects(Array.isArray(p) ? p : [])
      setHfSpaces(Array.isArray(h) ? h : [])
      setActivities(Array.isArray(a) ? a : [])
    } catch (err) {
      console.error('Failed to load data:', err)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { const t = setInterval(loadAll, 15000); return () => clearInterval(t) }, [loadAll])

  const stats = {
    total: githubRepos.length,
    public: githubRepos.filter(r => r.visibility === 'public').length,
    private: githubRepos.filter(r => r.visibility === 'private').length,
    deployed: projects.length,
    auto: projects.filter(p => p.config?.auto_deploy).length,
  }

  const handleSelectRepo = (repoName) => {
    setSelectedRepo(repoName)
    setCurrentPage('detail')
    setSidebarOpen(false)
  }

  const handleBack = () => {
    setSelectedRepo(null)
    setCurrentPage('repos')
  }

  const handleSelectIssue = (repoName, issueNumber) => {
    setSelectedRepo(repoName)
    setSelectedIssue(issueNumber)
    setCurrentPage('issue-detail')
  }

  const handleIssueBack = () => {
    setSelectedIssue(null)
    setCurrentPage('issues')
  }

  const handleSelectPull = (repoName, pullNumber) => {
    setSelectedRepo(repoName)
    setSelectedPull(pullNumber)
    setCurrentPage('pull-detail')
  }

  const handlePullBack = () => {
    setSelectedPull(null)
    setCurrentPage('pulls')
  }

  const navigateTo = (page) => {
    setSelectedRepo(null)
    setSelectedIssue(null)
    setSelectedPull(null)
    setCurrentPage(page)
    setSidebarOpen(false)
    if (page === 'activity') {
      setUnreadCount(0)
      sessionStorage.setItem('github-mirror-unread', '0')
    }
  }

  const navItems = [
    { key: 'repos', label: '仓库', icon: Icon.github(16) },
    { key: 'issues', label: 'Issues', icon: Icon.issue(16) },
    { key: 'pulls', label: 'Pull Requests', icon: Icon.pr(16) },
    { key: 'actions', label: 'Actions', icon: Icon.zap(16) },
    { key: 'code', label: '代码浏览', icon: Icon.code(16) },
    { key: 'search', label: '搜索', icon: Icon.search(16) },
    { key: 'discussions', label: '讨论区', icon: Icon.messageCircle(16) },
    { key: 'profile', label: '个人中心', icon: Icon.users(16) },
    { key: 'settings', label: '设置', icon: Icon.tag(16) },
    { key: 'activity', label: '活动流', icon: Icon.activity(16), badge: unreadCount },
    { key: 'security', label: '安全中心', icon: Icon.zap(16) },
    { key: 'deploy', label: '部署管理', icon: Icon.deploy(16) },
  ]

  // Keyboard shortcuts
  useKeyboardShortcuts({
    'ctrl+k': () => setCommandPaletteOpen(prev => !prev),
    'escape': () => {
      if (commandPaletteOpen) { setCommandPaletteOpen(false); return }
      if (sidebarOpen) { setSidebarOpen(false); return }
      if (currentPage === 'detail') { handleBack(); return }
      if (currentPage === 'issue-detail') { handleIssueBack(); return }
      if (currentPage === 'pull-detail') { handlePullBack(); return }
    },
    'r': () => loadAll(),
    'ctrl+1': () => navigateTo('repos'),
    'ctrl+2': () => navigateTo('issues'),
    'ctrl+3': () => navigateTo('pulls'),
    'ctrl+4': () => navigateTo('actions'),
    'ctrl+5': () => navigateTo('code'),
    'ctrl+6': () => navigateTo('search'),
    'ctrl+7': () => navigateTo('profile'),
    'ctrl+8': () => navigateTo('settings'),
    'ctrl+9': () => navigateTo('security'),
  })

  // SSE event listener for real-time notifications
  useEffect(() => {
    let eventSource = null
    try {
      eventSource = new EventSource('/api/events/stream')
      eventSource.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'event') {
            setUnreadCount(prev => {
              const next = Math.min(prev + 1, 999)
              sessionStorage.setItem('github-mirror-unread', String(next))
              return next
            })
          }
        } catch (e) {}
      }
      eventSource.onerror = () => {
        // SSE not available, silently fail
        if (eventSource) eventSource.close()
      }
    } catch (e) {}
    return () => { if (eventSource) eventSource.close() }
  }, [])

  const renderContent = () => {
    // Detail pages (with back navigation)
    if (currentPage === 'detail' && selectedRepo) {
      return (
        <ErrorBoundary>
          <Suspense fallback={<SkeletonLoader page="detail" />}>
            <RepoDetail
              repoName={selectedRepo}
              projects={projects}
              hfSpaces={hfSpaces}
              onBack={handleBack}
              onRefresh={loadAll}
            />
          </Suspense>
        </ErrorBoundary>
      )
    }
    if (currentPage === 'issue-detail' && selectedRepo && selectedIssue) {
      return (
        <ErrorBoundary>
          <Suspense fallback={<SkeletonLoader />}>
            <IssueDetail
              repoName={selectedRepo}
              issueNumber={selectedIssue}
              onBack={handleIssueBack}
            />
          </Suspense>
        </ErrorBoundary>
      )
    }
    if (currentPage === 'pull-detail' && selectedRepo && selectedPull) {
      return (
        <ErrorBoundary>
          <Suspense fallback={<SkeletonLoader />}>
            <PullDetail
              repoName={selectedRepo}
              pullNumber={selectedPull}
              onBack={handlePullBack}
            />
          </Suspense>
        </ErrorBoundary>
      )
    }

    // Main pages
    switch (currentPage) {
      case 'repos':
        return (
          <ErrorBoundary>
            <Suspense fallback={<SkeletonLoader page="repos" />}>
              <Repos githubRepos={githubRepos} projects={projects} hfSpaces={hfSpaces} onSelectRepo={handleSelectRepo} />
            </Suspense>
          </ErrorBoundary>
        )
      case 'issues':
        return (
          <ErrorBoundary>
            <Suspense fallback={<SkeletonLoader />}>
              <Issues githubRepos={githubRepos} onSelectIssue={handleSelectIssue} />
            </Suspense>
          </ErrorBoundary>
        )
      case 'pulls':
        return (
          <ErrorBoundary>
            <Suspense fallback={<SkeletonLoader />}>
              <Pulls githubRepos={githubRepos} onSelectPull={handleSelectPull} />
            </Suspense>
          </ErrorBoundary>
        )
      case 'actions':
        return (
          <ErrorBoundary>
            <Suspense fallback={<SkeletonLoader />}>
              <Actions githubRepos={githubRepos} />
            </Suspense>
          </ErrorBoundary>
        )
      case 'code':
        return (
          <ErrorBoundary>
            <Suspense fallback={<SkeletonLoader />}>
              <CodeBrowse githubRepos={githubRepos} />
            </Suspense>
          </ErrorBoundary>
        )
      case 'search':
        return (
          <ErrorBoundary>
            <Suspense fallback={<SkeletonLoader />}>
              <Search githubRepos={githubRepos} onSelectRepo={handleSelectRepo} />
            </Suspense>
          </ErrorBoundary>
        )
      case 'discussions':
        return (
          <ErrorBoundary>
            <Suspense fallback={<SkeletonLoader />}>
              <Discussions githubRepos={githubRepos} />
            </Suspense>
          </ErrorBoundary>
        )
      case 'profile':
        return (
          <ErrorBoundary>
            <Suspense fallback={<SkeletonLoader />}>
              <Profile />
            </Suspense>
          </ErrorBoundary>
        )
      case 'settings':
        return (
          <ErrorBoundary>
            <Suspense fallback={<SkeletonLoader />}>
              <Settings githubRepos={githubRepos} />
            </Suspense>
          </ErrorBoundary>
        )
      case 'activity':
        return (
          <ErrorBoundary>
            <Suspense fallback={<SkeletonLoader />}>
              <Activity activities={activities} onSelectRepo={handleSelectRepo} />
            </Suspense>
          </ErrorBoundary>
        )
      case 'security':
        return (
          <ErrorBoundary>
            <Suspense fallback={<SkeletonLoader />}>
              <Security githubRepos={githubRepos} />
            </Suspense>
          </ErrorBoundary>
        )
      case 'deploy':
        return (
          <ErrorBoundary>
            <Suspense fallback={<SkeletonLoader />}>
              <Deploy githubRepos={githubRepos} projects={projects} hfSpaces={hfSpaces} onRefresh={loadAll} />
            </Suspense>
          </ErrorBoundary>
        )
      default:
        return null
    }
  }

  return (
    <div className="app-layout">
      {/* Mobile hamburger button */}
      <div className="mobile-header">
        <HamburgerMenu isOpen={sidebarOpen} onClick={() => setSidebarOpen(prev => !prev)} />
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>GitHub Mirror</span>
        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'var(--mac-accent)', color: 'white', fontWeight: 500 }}>v5.2</span>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--mac-text)' }}>{Icon.github(18)}</span>
            <span className="sidebar-title" style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>GitHub Mirror</span>
            <span className="sidebar-version" style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'var(--mac-accent)', color: 'white', fontWeight: 500 }}>v5.2</span>
          </div>
          {/* Theme toggle */}
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
          >
            {theme === 'dark' ? Icon.sun(16) : Icon.moon(16)}
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <div
              key={item.key}
              className={`nav-item ${currentPage === item.key || (item.key === 'issues' && currentPage === 'issue-detail') || (item.key === 'pulls' && currentPage === 'pull-detail') ? 'active' : ''}`}
              onClick={() => navigateTo(item.key)}
              title={item.label}
              style={{ position: 'relative' }}
            >
              {item.icon}
              <span className="nav-label">{item.label}</span>
              {item.badge > 0 && (
                <span style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: '#ff3b30', color: 'white', fontSize: 9, fontWeight: 600,
                  minWidth: 16, height: 16, borderRadius: 8, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                }}>
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </div>
          ))}
        </nav>

        {/* Footer Stats */}
        <div className="sidebar-footer">
          <span>{stats.total} 仓库</span>
          <span>{stats.deployed} 已部署</span>
          <span>{stats.auto} 自动</span>
        </div>
      </aside>

      {/* Content Area */}
      <main className="main-content">
        {renderContent()}
      </main>

      {/* Command Palette */}
      <CommandPalette
        navItems={navItems}
        onNavigate={navigateTo}
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  )
}
