import React from 'react';

function HamburgerMenu({ isOpen, onClick }) {
  return (
    <button
      onClick={onClick}
      style={styles.button}
      aria-label="菜单"
      aria-expanded={isOpen}
      type="button"
    >
      <span style={{ ...styles.line, ...(isOpen ? styles.lineTopOpen : {}) }} />
      <span style={{ ...styles.line, ...(isOpen ? styles.lineMiddleOpen : {}) }} />
      <span style={{ ...styles.line, ...(isOpen ? styles.lineBottomOpen : {}) }} />
    </button>
  );
}

const styles = {
  button: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    width: '24px',
    height: '24px',
    padding: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    gap: '0',
    position: 'relative',
  },
  line: {
    display: 'block',
    width: '18px',
    height: '2px',
    backgroundColor: 'var(--mac-text, #1d1d1f)',
    borderRadius: '1px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    transformOrigin: 'center',
  },
  lineTopOpen: {
    transform: 'translateY(4px) rotate(45deg)',
  },
  lineMiddleOpen: {
    opacity: 0,
    transform: 'scaleX(0)',
  },
  lineBottomOpen: {
    transform: 'translateY(-4px) rotate(-45deg)',
  },
};

export default HamburgerMenu;
