export default function Loading({ text = '加载中...' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--mac-text-secondary)', fontSize: 13 }}>
      <span style={{ animation: 'pulse-dot 1s infinite', marginRight: 8 }}>&#9679;</span>
      {text}
    </div>
  )
}
