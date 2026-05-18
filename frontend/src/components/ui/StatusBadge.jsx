export default function StatusBadge({ status, size = 'sm' }) {
  const colors = {
    success: { bg: 'rgba(52,199,89,0.15)', color: '#34c759' },
    error: { bg: 'rgba(255,59,48,0.15)', color: '#ff3b30' },
    warning: { bg: 'rgba(255,149,0,0.15)', color: '#ff9500' },
    info: { bg: 'rgba(0,122,255,0.15)', color: '#007aff' },
    default: { bg: 'rgba(142,142,147,0.15)', color: '#8e8e93' },
  }
  const c = colors[status] || colors.default
  const fontSize = size === 'sm' ? 10 : 12
  const padding = size === 'sm' ? '2px 8px' : '4px 10px'
  return (
    <span style={{
      display: 'inline-block', fontSize, fontWeight: 600, padding,
      borderRadius: 10, background: c.bg, color: c.color,
    }}>
      {status}
    </span>
  )
}
