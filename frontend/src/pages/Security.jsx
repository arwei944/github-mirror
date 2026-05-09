import { useState, useEffect, useCallback } from 'react'
import { Icon } from '../App'
import api from '../api'

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

const SEVERITY_COLORS = {
  critical: { color: 'var(--mac-red)', bg: 'rgba(255,59,48,0.12)', label: '严重' },
  high: { color: 'var(--mac-orange)', bg: 'rgba(255,149,0,0.12)', label: '高危' },
  medium: { color: '#FFD60A', bg: 'rgba(255,214,10,0.12)', label: '中等' },
  low: { color: 'var(--mac-green)', bg: 'rgba(52,199,89,0.12)', label: '低危' },
}

function getSeverityInfo(severity) {
  return SEVERITY_COLORS[severity] || { color: 'var(--mac-text-secondary)', bg: 'var(--mac-gray)', label: severity || '未知' }
}

const STATE_MAP = {
  open: { text: '待处理', color: 'var(--mac-green)', bg: 'rgba(52,199,89,0.12)' },
  fixed: { text: '已修复', color: 'var(--mac-accent)', bg: 'rgba(0,113,227,0.12)' },
  dismissed: { text: '已忽略', color: 'var(--mac-text-secondary)', bg: 'var(--mac-gray)' },
}

function getStateInfo(state) {
  return STATE_MAP[state] || { text: state || '未知', color: 'var(--mac-text-secondary)', bg: 'var(--mac-gray)' }
}

const CHECK_STATUS_COLORS = {
  queued: { dot: 'var(--mac-orange)', text: '排队中' },
  in_progress: { dot: 'var(--mac-orange)', text: '运行中' },
  completed: { dot: 'var(--mac-green)', text: '已完成' },
}

const CHECK_CONCLUSION_COLORS = {
  success: { dot: 'var(--mac-green)', text: '成功' },
  failure: { dot: 'var(--mac-red)', text: '失败' },
  neutral: { dot: 'var(--mac-text-secondary)', text: '中立' },
  cancelled: { dot: 'var(--mac-text-secondary)', text: '已取消' },
  skipped: { dot: 'var(--mac-text-secondary)', text: '已跳过' },
  timed_out: { dot: 'var(--mac-red)', text: '超时' },
  action_required: { dot: 'var(--mac-orange)', text: '需要操作' },
  stale: { dot: 'var(--mac-text-secondary)', text: '过期' },
}

export default function Security({ githubRepos }) {
  const [activeTab, setActiveTab] = useState('dependabot')
  const [selectedRepo, setSelectedRepo] = useState('')
  const [dependabotAlerts, setDependabotAlerts] = useState([])
  const [codeScanningAlerts, setCodeScanningAlerts] = useState([])
  const [checkRuns, setCheckRuns] = useState([])
  const [loading, setLoading] = useState(false)
  const [checkRef, setCheckRef] = useState('main')
  const [checkLoading, setCheckLoading] = useState(false)
  const [expandedCodeAlert, setExpandedCodeAlert] = useState(null)
  const [codeAlertDetail, setCodeAlertDetail] = useState(null)
  const [codeAlertDetailLoading, setCodeAlertDetailLoading] = useState(false)
  const [dismissing, setDismissing] = useState({})

  const repoName = selectedRepo || (githubRepos.length > 0 ? githubRepos[0].name : '')

  // Load dependabot alerts
  const loadDependabot = useCallback(() => {
    if (!repoName) return
    setLoading(true)
    api.get(`/api/github/repos/${repoName}/dependabot/alerts`)
      .then(data => { setDependabotAlerts(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { setDependabotAlerts([]); setLoading(false) })
  }, [repoName])

  // Load code scanning alerts
  const loadCodeScanning = useCallback(() => {
    if (!repoName) return
    setLoading(true)
    api.get(`/api/github/repos/${repoName}/code-scanning/alerts`)
      .then(data => { setCodeScanningAlerts(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { setCodeScanningAlerts([]); setLoading(false) })
  }, [repoName])

  useEffect(() => {
    if (activeTab === 'dependabot') loadDependabot()
  }, [activeTab, loadDependabot])

  useEffect(() => {
    if (activeTab === 'code-scanning') loadCodeScanning()
  }, [activeTab, loadCodeScanning])

  const handleDismissAlert = async (alertNumber) => {
    setDismissing(prev => ({ ...prev, [alertNumber]: true }))
    try {
      await api.patch(`/api/github/repos/${repoName}/dependabot/alerts/${alertNumber}`, {
        state: 'dismissed',
      })
      setDependabotAlerts(prev =>
        prev.map(a => a.number === alertNumber ? { ...a, state: 'dismissed' } : a)
      )
    } catch (err) {
      // ignore
    } finally {
      setDismissing(prev => ({ ...prev, [alertNumber]: false }))
    }
  }

  const handleFetchCodeAlertDetail = async (alertNumber) => {
    if (expandedCodeAlert === alertNumber) {
      setExpandedCodeAlert(null)
      setCodeAlertDetail(null)
      return
    }
    setExpandedCodeAlert(alertNumber)
    setCodeAlertDetailLoading(true)
    try {
      const data = await api.get(`/api/github/repos/${repoName}/code-scanning/alerts/${alertNumber}`)
      setCodeAlertDetail(data)
    } catch (err) {
      setCodeAlertDetail(null)
    } finally {
      setCodeAlertDetailLoading(false)
    }
  }

  const handleFetchCheckRuns = async () => {
    if (!checkRef.trim() || !repoName) return
    setCheckLoading(true)
    try {
      const data = await api.get(`/api/github/repos/${repoName}/commits/${checkRef.trim()}/check-runs`)
      setCheckRuns(Array.isArray(data?.check_runs) ? data.check_runs : (Array.isArray(data) ? data : []))
    } catch (err) {
      setCheckRuns([])
    } finally {
      setCheckLoading(false)
    }
  }

  const tabItems = [
    { key: 'dependabot', label: '安全告警' },
    { key: 'code-scanning', label: '代码扫描' },
    { key: 'checks', label: 'Checks' },
  ]

  return (
    <div>
      {/* Sort & Filter Bar */}
      <div className="sort-bar">
        {/* Tab selector */}
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {tabItems.map(t => (
            <button
              key={t.key}
              className={`sort-btn ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 16, background: 'var(--mac-border)' }} />

        {/* Repo selector */}
        <select
          value={repoName}
          onChange={e => setSelectedRepo(e.target.value)}
          style={{
            padding: '4px 8px', borderRadius: 6, border: '1px solid var(--mac-border)',
            background: 'var(--mac-bg)', fontSize: 12, color: 'var(--mac-text)',
            outline: 'none', cursor: 'pointer',
          }}
        >
          {githubRepos.map(r => (
            <option key={r.name} value={r.name}>{r.name}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div className="card-grid-scroll">
        <div style={{ padding: '16px 24px 48px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--mac-text-secondary)', gap: 8 }}>
              <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 加载中...
            </div>
          ) : activeTab === 'dependabot' ? (
            /* Dependabot Alerts Tab */
            dependabotAlerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 64, color: 'var(--mac-text-secondary)' }}>
                <div style={{ fontSize: 36, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{Icon.zap(36)}</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>暂无安全告警</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Dependabot 安全告警将在这里显示</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {dependabotAlerts.map(alert => {
                  const severity = getSeverityInfo(alert.security_vulnerability?.severity || alert.security_advisory?.severity)
                  const stateInfo = getStateInfo(alert.state)
                  const pkg = alert.security_vulnerability?.package || alert.dependency?.package || {}
                  return (
                    <div key={alert.number} className="glass animate-fade-in" style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                          background: severity.bg, color: severity.color, flexShrink: 0,
                        }}>
                          {severity.label}
                        </span>
                        <span style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 500,
                          background: stateInfo.bg, color: stateInfo.color, flexShrink: 0,
                        }}>
                          {stateInfo.text}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {pkg.name || alert.dependency?.package?.name || '未知包'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3, fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                            {alert.security_vulnerability?.vulnerable_version_range && (
                              <span style={{ color: 'var(--mac-red)' }}>
                                受影响: {alert.security_vulnerability.vulnerable_version_range}
                              </span>
                            )}
                            {alert.security_vulnerability?.patched_versions && (
                              <span style={{ color: 'var(--mac-green)' }}>
                                已修复: {alert.security_vulnerability.patched_versions}
                              </span>
                            )}
                            {alert.security_advisory?.cve_id && (
                              <code style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'var(--mac-gray)' }}>
                                {alert.security_advisory.cve_id}
                              </code>
                            )}
                          </div>
                        </div>
                        {alert.state === 'open' && (
                          <button
                            className="btn-secondary"
                            onClick={() => handleDismissAlert(alert.number)}
                            disabled={dismissing[alert.number]}
                            style={{ fontSize: 10, padding: '2px 8px', color: 'var(--mac-text-secondary)', flexShrink: 0 }}
                          >
                            {dismissing[alert.number] ? '...' : '忽略'}
                          </button>
                        )}
                        {alert.html_url && (
                          <a href={alert.html_url} target="_blank" rel="noopener noreferrer"
                            style={{ color: 'var(--mac-accent)', fontSize: 11, textDecoration: 'none', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                            查看 {Icon.external(10)}
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          ) : activeTab === 'code-scanning' ? (
            /* Code Scanning Tab */
            codeScanningAlerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 64, color: 'var(--mac-text-secondary)' }}>
                <div style={{ fontSize: 36, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{Icon.code(36)}</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>暂无代码扫描告警</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Code Scanning 告警将在这里显示</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {codeScanningAlerts.map(alert => {
                  const severity = getSeverityInfo(alert.rule?.security_severity_level || alert.most_recent_instance?.state === 'open' ? 'high' : 'low')
                  const stateInfo = getStateInfo(alert.state)
                  const isExpanded = expandedCodeAlert === alert.number
                  return (
                    <div key={alert.number} className="glass animate-fade-in" style={{ padding: '12px 16px' }}>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                        onClick={() => handleFetchCodeAlertDetail(alert.number)}
                      >
                        <span style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                          background: severity.bg, color: severity.color, flexShrink: 0,
                        }}>
                          {severity.label}
                        </span>
                        <span style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 500,
                          background: stateInfo.bg, color: stateInfo.color, flexShrink: 0,
                        }}>
                          {stateInfo.text}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {alert.rule?.description || alert.rule?.name || '未知规则'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3, fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                            {alert.most_recent_instance?.location?.path && (
                              <span style={{ fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 3 }}>
                                {Icon.file(11)} {alert.most_recent_instance.location.path}
                                {alert.most_recent_instance.location.start_line && (
                                  <span>:行 {alert.most_recent_instance.location.start_line}</span>
                                )}
                              </span>
                            )}
                            {alert.tool?.name && (
                              <span>{alert.tool.name}</span>
                            )}
                          </div>
                        </div>
                        <span style={{ color: 'var(--mac-text-secondary)', fontSize: 10, flexShrink: 0 }}>
                          {isExpanded ? '收起' : '展开'}
                        </span>
                      </div>
                      {isExpanded && (
                        <div style={{ marginTop: 10, borderTop: '1px solid var(--mac-border)', paddingTop: 10 }}>
                          {codeAlertDetailLoading ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 60, color: 'var(--mac-text-secondary)', gap: 8 }}>
                              <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 加载详情中...
                            </div>
                          ) : codeAlertDetail ? (
                            <div style={{ fontSize: 12, color: 'var(--mac-text)', lineHeight: 1.6 }}>
                              {codeAlertDetail.rule?.description && (
                                <div style={{ marginBottom: 8 }}>
                                  <span style={{ fontWeight: 600, color: 'var(--mac-text-secondary)' }}>规则描述: </span>
                                  {codeAlertDetail.rule.description}
                                </div>
                              )}
                              {codeAlertDetail.rule?.full_description && (
                                <div style={{ marginBottom: 8 }}>
                                  <span style={{ fontWeight: 600, color: 'var(--mac-text-secondary)' }}>详细说明: </span>
                                  {codeAlertDetail.rule.full_description}
                                </div>
                              )}
                              {codeAlertDetail.most_recent_instance?.location?.path && (
                                <div style={{ marginBottom: 8 }}>
                                  <span style={{ fontWeight: 600, color: 'var(--mac-text-secondary)' }}>文件路径: </span>
                                  <code style={{ fontFamily: 'monospace', padding: '1px 5px', borderRadius: 4, background: 'var(--mac-gray)' }}>
                                    {codeAlertDetail.most_recent_instance.location.path}
                                  </code>
                                </div>
                              )}
                              {codeAlertDetail.most_recent_instance?.location?.start_line && (
                                <div style={{ marginBottom: 8 }}>
                                  <span style={{ fontWeight: 600, color: 'var(--mac-text-secondary)' }}>起始行: </span>
                                  {codeAlertDetail.most_recent_instance.location.start_line}
                                </div>
                              )}
                              {codeAlertDetail.html_url && (
                                <a href={codeAlertDetail.html_url} target="_blank" rel="noopener noreferrer"
                                  style={{ color: 'var(--mac-accent)', fontSize: 11, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                                  在 GitHub 上查看 {Icon.external(10)}
                                </a>
                              )}
                            </div>
                          ) : (
                            <div style={{ textAlign: 'center', padding: 16, color: 'var(--mac-text-secondary)', fontSize: 12 }}>
                              无法加载详情
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          ) : (
            /* Checks Tab */
            <div>
              <div className="glass" style={{ padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--mac-text-secondary)', flexShrink: 0 }}>
                    Commit Ref (SHA / 分支)
                  </label>
                  <input
                    type="text"
                    value={checkRef}
                    onChange={e => setCheckRef(e.target.value)}
                    placeholder="main"
                    style={{
                      flex: 1, padding: '6px 12px', borderRadius: 8,
                      border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
                      fontSize: 13, color: 'var(--mac-text)', outline: 'none',
                      fontFamily: 'monospace',
                    }}
                  />
                  <button
                    className="btn-primary"
                    onClick={handleFetchCheckRuns}
                    disabled={checkLoading || !checkRef.trim()}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
                  >
                    {checkLoading ? '查询中...' : '查询'}
                  </button>
                </div>
              </div>

              {checkLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--mac-text-secondary)', gap: 8 }}>
                  <span style={{ animation: 'pulse-dot 1s infinite' }}>&#9679;</span> 加载中...
                </div>
              ) : checkRuns.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 64, color: 'var(--mac-text-secondary)' }}>
                  <div style={{ fontSize: 36, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{Icon.activity(36)}</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>暂无 Check Runs</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>输入 commit SHA 或分支名查询检查结果</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {checkRuns.map(run => {
                    const statusInfo = CHECK_STATUS_COLORS[run.status] || { dot: 'var(--mac-text-secondary)', text: run.status || '未知' }
                    const conclusionInfo = run.conclusion ? (CHECK_CONCLUSION_COLORS[run.conclusion] || { dot: 'var(--mac-text-secondary)', text: run.conclusion }) : null
                    const displayInfo = conclusionInfo || statusInfo
                    return (
                      <div key={run.id} className="glass animate-fade-in" style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                            background: displayInfo.dot,
                            animation: run.status === 'in_progress' || run.status === 'queued' ? 'pulse-dot 1.2s ease-in-out infinite' : 'none',
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {run.name || 'Check Run'}
                              </span>
                              <span style={{
                                fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 500,
                                background: `${displayInfo.dot}18`, color: displayInfo.dot,
                              }}>
                                {displayInfo.text}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3, fontSize: 11, color: 'var(--mac-text-secondary)' }}>
                              {run.app && (
                                <span>{run.app.name}</span>
                              )}
                              {run.started_at && (
                                <span>{timeAgo(run.started_at)}</span>
                              )}
                              {run.completed_at && (
                                <span>完成于 {timeAgo(run.completed_at)}</span>
                              )}
                            </div>
                          </div>
                          {run.html_url && (
                            <a href={run.html_url} target="_blank" rel="noopener noreferrer"
                              style={{ color: 'var(--mac-accent)', fontSize: 11, textDecoration: 'none', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                              查看 {Icon.external(10)}
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
