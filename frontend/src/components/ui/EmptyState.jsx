export default function EmptyState({ icon, text, description }) {
  return (
    <div style={{ textAlign: 'center', padding: 64, color: 'var(--mac-text-secondary)' }}>
      {icon && <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.5 }}>{icon}</div>}
      <div style={{ fontSize: 14, fontWeight: 500 }}>{text || '暂无数据'}</div>
      {description && <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>{description}</div>}
    </div>
  )
}
