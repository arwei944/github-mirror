import React, { useState, useEffect, useCallback } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import api from '../api'

const COLORS = ['#0066cc', '#3fb950', '#f85149', '#d29922', '#8b5cf6', '#f778ba', '#79c0ff', '#ffa657', '#7ee787', '#ff7b72']

function ContributionHeatmap({ data }) {
  // data: array of { week, total } from commit_activity
  if (!data || data.length === 0) return (
    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--mac-text-secondary)' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>&#128202;</div>
      <div style={{ fontSize: 12 }}>数据加载中或暂无记录</div>
      <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>GitHub Stats API 首次请求可能需要几分钟计算</div>
    </div>
  )

  const getColor = (count) => {
    if (count === 0) return 'var(--mac-border)'
    if (count <= 3) return '#9be9a8'
    if (count <= 6) return '#40c463'
    if (count <= 9) return '#30a14e'
    return '#216e39'
  }

  return (
    <div style={{ overflow: 'auto' }}>
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {data.map((week, i) => (
          <div
            key={i}
            title={`Week ${i + 1}: ${week.total} commits`}
            style={{
              width: 12, height: 12, borderRadius: 2,
              background: getColor(week.total || 0),
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 10, color: 'var(--mac-text-secondary)' }}>
        <span>少</span>
        {[0, 1, 3, 6, 9].map((v, i) => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: getColor(v) }} />
        ))}
        <span>多</span>
      </div>
    </div>
  )
}

function CodeFrequencyChart({ data }) {
  // data: [[week_timestamp, additions, deletions], ...]
  if (!data || data.length === 0) return (
    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--mac-text-secondary)' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>&#128202;</div>
      <div style={{ fontSize: 12 }}>数据加载中或暂无记录</div>
      <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>GitHub Stats API 首次请求可能需要几分钟计算</div>
    </div>
  )

  const chartData = data.map(([week, additions, deletions]) => ({
    week: new Date(week * 1000).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
    additions,
    deletions: Math.abs(deletions),
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--mac-border)" />
        <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--mac-text-secondary)' }} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--mac-text-secondary)' }} />
        <Tooltip contentStyle={{ background: 'var(--mac-surface)', border: '1px solid var(--mac-border)', borderRadius: 8, fontSize: 12 }} />
        <Area type="monotone" dataKey="additions" stroke="#3fb950" fill="rgba(63,185,80,0.1)" name="新增" />
        <Area type="monotone" dataKey="deletions" stroke="#f85149" fill="rgba(248,81,73,0.1)" name="删除" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function LanguagePieChart({ data }) {
  // data: { language: bytes, ... }
  if (!data || Object.keys(data).length === 0) return <div style={{ color: 'var(--mac-text-secondary)', fontSize: 12, textAlign: 'center', padding: 20 }}>暂无数据</div>

  const total = Object.values(data).reduce((s, v) => s + v, 0)
  const chartData = Object.entries(data).map(([name, value]) => ({
    name, value, percent: ((value / total) * 100).toFixed(1),
  }))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <ResponsiveContainer width={180} height={180}>
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: 'var(--mac-surface)', border: '1px solid var(--mac-border)', borderRadius: 8, fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {chartData.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
            <span style={{ color: 'var(--mac-text)' }}>{item.name}</span>
            <span style={{ color: 'var(--mac-text-secondary)' }}>{item.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ContributorTable({ data }) {
  // data: array of { login, avatar_url, contributions, html_url }
  if (!data || data.length === 0) return <div style={{ color: 'var(--mac-text-secondary)', fontSize: 12, textAlign: 'center', padding: 20 }}>暂无数据</div>

  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--mac-border)' }}>
            <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--mac-text-secondary)', fontWeight: 500 }}>排名</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--mac-text-secondary)', fontWeight: 500 }}>贡献者</th>
            <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--mac-text-secondary)', fontWeight: 500 }}>提交数</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 20).map((contributor, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--mac-border)' }}>
              <td style={{ padding: '6px 12px', color: 'var(--mac-text-secondary)' }}>#{i + 1}</td>
              <td style={{ padding: '6px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src={contributor.avatar_url} alt="" style={{ width: 20, height: 20, borderRadius: '50%' }} />
                  <a href={contributor.html_url} target="_blank" rel="noopener" style={{ color: 'var(--mac-accent)', textDecoration: 'none' }}>
                    {contributor.login}
                  </a>
                </div>
              </td>
              <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>{contributor.contributions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Analytics({ githubRepos }) {
  const [selectedRepo, setSelectedRepo] = useState('')
  const [commitActivity, setCommitActivity] = useState([])
  const [codeFrequency, setCodeFrequency] = useState([])
  const [languages, setLanguages] = useState({})
  const [contributors, setContributors] = useState([])
  const [loading, setLoading] = useState(false)

  const repos = Array.isArray(githubRepos) ? githubRepos : []

  useEffect(() => {
    if (repos.length > 0 && !selectedRepo) {
      setSelectedRepo(repos[0].name)
    }
  }, [repos, selectedRepo])

  const loadStats = useCallback(async () => {
    if (!selectedRepo) return
    setLoading(true)
    try {
      const [ca, cf, lang, contrib] = await Promise.all([
        api.get(`/api/github/repos/${selectedRepo}/stats/commit-activity`).catch(() => []),
        api.get(`/api/github/repos/${selectedRepo}/stats/code-frequency`).catch(() => []),
        api.get(`/api/github/repos/${selectedRepo}/languages`).catch(() => ({})),
        api.get(`/api/github/repos/${selectedRepo}/contributors`).catch(() => []),
      ])
      setCommitActivity(Array.isArray(ca) ? ca : [])
      setCodeFrequency(Array.isArray(cf) ? cf : [])
      setLanguages(typeof lang === 'object' && !Array.isArray(lang) ? lang : {})
      setContributors(Array.isArray(contrib) ? contrib : [])
    } catch (err) {
      console.error('Failed to load stats:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedRepo])

  useEffect(() => { loadStats() }, [loadStats])

  const cardStyle = {
    background: 'var(--mac-surface)',
    backdropFilter: 'var(--mac-blur)',
    border: '1px solid var(--mac-border)',
    borderRadius: 12,
    padding: 16,
  }

  const titleStyle = {
    fontSize: 13, fontWeight: 600, color: 'var(--mac-text)', marginBottom: 12,
    display: 'flex', alignItems: 'center', gap: 6,
  }

  return (
    <div className="animate-fade-in" style={{ padding: 20, height: '100%', overflow: 'auto' }}>
      {/* Repo selector */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <select
          value={selectedRepo}
          onChange={(e) => setSelectedRepo(e.target.value)}
          style={{
            background: 'var(--mac-surface)', border: '1px solid var(--mac-border)',
            borderRadius: 8, padding: '6px 12px', color: 'var(--mac-text)',
            fontSize: 13, outline: 'none', minWidth: 200,
          }}
        >
          {repos.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
        </select>
        <button
          onClick={loadStats}
          disabled={loading}
          style={{
            background: 'var(--mac-accent)', color: 'white', border: 'none',
            borderRadius: 8, padding: '6px 14px', cursor: loading ? 'wait' : 'pointer', fontSize: 12,
          }}
        >
          {loading ? '加载中...' : '刷新'}
        </button>
      </div>

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Commit Activity Heatmap */}
        <div style={cardStyle}>
          <div style={titleStyle}>📊 提交活动热力图（52 周）</div>
          <ContributionHeatmap data={commitActivity} />
        </div>

        {/* Code Frequency */}
        <div style={cardStyle}>
          <div style={titleStyle}>📈 代码频率趋势</div>
          <CodeFrequencyChart data={codeFrequency} />
        </div>

        {/* Language Distribution */}
        <div style={cardStyle}>
          <div style={titleStyle}>🌐 语言分布</div>
          <LanguagePieChart data={languages} />
        </div>

        {/* Contributors */}
        <div style={cardStyle}>
          <div style={titleStyle}>👥 贡献者排行</div>
          <ContributorTable data={contributors} />
        </div>
      </div>
    </div>
  )
}
