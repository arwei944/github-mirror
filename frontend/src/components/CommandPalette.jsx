import React, { useState, useEffect, useRef, useCallback } from 'react';

function CommandPalette({ navItems = [], onNavigate, isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const filteredItems = navItems.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredItems[activeIndex]) {
            handleSelect(filteredItems[activeIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        default:
          break;
      }
    },
    [isOpen, filteredItems, activeIndex, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (listRef.current) {
      const activeItem = listRef.current.children[activeIndex];
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  const handleSelect = (item) => {
    if (onNavigate) {
      onNavigate(item.key);
    }
    onClose();
  };

  const highlightMatch = (text, search) => {
    if (!search) return text;
    const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} style={styles.highlight}>
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={styles.searchWrapper}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            style={styles.searchIcon}
          >
            <path
              d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242.656a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"
              fill="var(--mac-text-secondary, #86868b)"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="搜索页面..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <div ref={listRef} style={styles.resultsList}>
          {filteredItems.length === 0 && (
            <div style={styles.emptyState}>没有找到匹配的结果</div>
          )}

          {filteredItems.length > 0 && (
            <div style={styles.groupLabel}>导航</div>
          )}

          {filteredItems.map((item, index) => (
            <div
              key={item.key}
              onClick={() => handleSelect(item)}
              style={{
                ...styles.resultItem,
                ...(index === activeIndex ? styles.resultItemActive : {}),
              }}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                style={{ flexShrink: 0 }}
              >
                <path
                  d="M7.5 1L1 7.5 7.5 14 14 7.5 7.5 1z"
                  fill="none"
                  stroke={index === activeIndex ? 'var(--mac-accent, #007aff)' : 'var(--mac-text-secondary, #86868b)'}
                  strokeWidth="1.2"
                />
              </svg>
              <span style={styles.resultLabel}>
                {highlightMatch(item.label, query)}
              </span>
              {index === activeIndex && (
                <span style={styles.enterHint}>Enter ↵</span>
              )}
            </div>
          ))}
        </div>

        <div style={styles.footer}>
          <span style={styles.footerHint}>
            <kbd style={styles.kbd}>↑↓</kbd> 导航
          </span>
          <span style={styles.footerHint}>
            <kbd style={styles.kbd}>↵</kbd> 选择
          </span>
          <span style={styles.footerHint}>
            <kbd style={styles.kbd}>Esc</kbd> 关闭
          </span>
          <span style={{ ...styles.footerHint, marginLeft: 'auto' }}>
            <kbd style={styles.kbd}>⌘K</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '15vh',
    zIndex: 9999,
  },
  dialog: {
    width: '520px',
    maxWidth: '90vw',
    maxHeight: '420px',
    background: 'var(--mac-glass, rgba(255, 255, 255, 0.9))',
    backdropFilter: 'blur(40px)',
    WebkitBackdropFilter: 'blur(40px)',
    borderRadius: '14px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.06)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  searchWrapper: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 16px',
    borderBottom: '1px solid var(--mac-border, rgba(0, 0, 0, 0.08))',
    gap: '10px',
  },
  searchIcon: {
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '16px',
    color: 'var(--mac-text, #1d1d1f)',
    background: 'transparent',
    fontFamily: 'inherit',
  },
  resultsList: {
    flex: 1,
    overflow: 'auto',
    padding: '8px',
  },
  groupLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--mac-text-secondary, #86868b)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '8px 12px 4px',
  },
  resultItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.15s',
    fontSize: '14px',
    color: 'var(--mac-text, #1d1d1f)',
  },
  resultItemActive: {
    background: 'var(--mac-accent-bg, rgba(0, 122, 255, 0.08))',
  },
  resultLabel: {
    flex: 1,
  },
  enterHint: {
    fontSize: '12px',
    color: 'var(--mac-text-secondary, #86868b)',
  },
  highlight: {
    fontWeight: 600,
    color: 'var(--mac-accent, #007aff)',
  },
  emptyState: {
    padding: '32px 16px',
    textAlign: 'center',
    fontSize: '14px',
    color: 'var(--mac-text-secondary, #86868b)',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '10px 16px',
    borderTop: '1px solid var(--mac-border, rgba(0, 0, 0, 0.08))',
    fontSize: '12px',
    color: 'var(--mac-text-secondary, #86868b)',
  },
  footerHint: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  kbd: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '20px',
    height: '20px',
    padding: '0 5px',
    fontSize: '11px',
    fontFamily: 'inherit',
    color: 'var(--mac-text-secondary, #86868b)',
    background: 'var(--mac-gray, #e5e5ea)',
    borderRadius: '4px',
    border: '1px solid var(--mac-border, rgba(0, 0, 0, 0.1))',
  },
};

export default CommandPalette;
