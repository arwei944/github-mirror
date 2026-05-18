import { Icon } from '../../App'

export default function Modal({ title, onClose, children, width = 520 }) {
  if (!onClose) return null
  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="glass animate-fade-in"
        style={{ width, maxHeight: '80vh', overflowY: 'auto', padding: 20 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--mac-text)' }}>{title}</h2>
          <button className="btn-icon" onClick={onClose}><Icon.back(16)}</button>
        </div>
        {children}
      </div>
    </div>
  )
}
