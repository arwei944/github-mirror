import { Icon } from '../../App'

export default function SearchInput({ value, onChange, placeholder = '搜索...' }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
        <Icon.search(14) />
      </span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '8px 12px 8px 32px', borderRadius: 8,
          border: '1px solid var(--mac-border)', background: 'var(--mac-bg)',
          fontSize: 13, color: 'var(--mac-text)', outline: 'none',
        }}
      />
    </div>
  )
}
