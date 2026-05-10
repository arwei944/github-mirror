import React from 'react';

function SkeletonLoader({ page }) {
  const renderDefaultSkeleton = () => (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div style={{ ...styles.block, width: '200px', height: '24px' }} />
        <div style={{ ...styles.block, width: '120px', height: '16px', marginTop: '8px' }} />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} style={styles.row}>
          <div style={{ ...styles.block, width: '48px', height: '48px', borderRadius: '12px' }} />
          <div style={{ ...styles.rowContent, flex: 1 }}>
            <div style={{ ...styles.block, width: `${60 + Math.random() * 30}%`, height: '16px' }} />
            <div style={{ ...styles.block, width: `${40 + Math.random() * 30}%`, height: '12px', marginTop: '8px' }} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderReposSkeleton = () => (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div style={{ ...styles.block, width: '160px', height: '28px' }} />
        <div style={{ ...styles.block, width: '240px', height: '36px', marginTop: '16px', borderRadius: '10px' }} />
      </div>
      <div style={styles.grid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={styles.card}>
            <div style={{ ...styles.block, width: '70%', height: '16px' }} />
            <div style={{ ...styles.block, width: '45%', height: '12px', marginTop: '10px' }} />
            <div style={{ ...styles.block, width: '55%', height: '12px', marginTop: '6px' }} />
            <div style={{ ...styles.block, width: '30%', height: '24px', marginTop: '16px', borderRadius: '6px' }} />
          </div>
        ))}
      </div>
    </div>
  );

  const renderDetailSkeleton = () => (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div style={{ ...styles.block, width: '48px', height: '48px', borderRadius: '12px' }} />
        <div style={{ marginTop: '12px' }}>
          <div style={{ ...styles.block, width: '280px', height: '22px' }} />
          <div style={{ ...styles.block, width: '180px', height: '14px', marginTop: '8px' }} />
        </div>
      </div>
      <div style={styles.tabs}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ ...styles.block, width: `${50 + Math.random() * 30}px`, height: '14px', borderRadius: '6px' }} />
        ))}
      </div>
      <div style={styles.content}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={styles.row}>
            <div style={{ ...styles.block, width: '40px', height: '40px', borderRadius: '50%' }} />
            <div style={{ ...styles.rowContent, flex: 1 }}>
              <div style={{ ...styles.block, width: `${50 + Math.random() * 40}%`, height: '14px' }} />
              <div style={{ ...styles.block, width: `${70 + Math.random() * 25}%`, height: '12px', marginTop: '6px' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSkeleton = () => {
    switch (page) {
      case 'repos':
        return renderReposSkeleton();
      case 'detail':
        return renderDetailSkeleton();
      default:
        return renderDefaultSkeleton();
    }
  };

  return (
    <div style={styles.container}>
      {renderSkeleton()}
    </div>
  );
}

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  wrapper: {
    animation: 'skeleton-pulse 1.5s ease-in-out infinite',
  },
  header: {
    marginBottom: '24px',
  },
  block: {
    backgroundColor: 'var(--mac-gray, #e5e5ea)',
    borderRadius: '6px',
    height: '16px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    background: 'var(--mac-glass, rgba(255, 255, 255, 0.72))',
    backdropFilter: 'blur(20px)',
    borderRadius: '12px',
    marginBottom: '10px',
    border: '1px solid var(--mac-border, rgba(0, 0, 0, 0.06))',
  },
  rowContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '16px',
  },
  card: {
    padding: '20px',
    background: 'var(--mac-glass, rgba(255, 255, 255, 0.72))',
    backdropFilter: 'blur(20px)',
    borderRadius: '12px',
    border: '1px solid var(--mac-border, rgba(0, 0, 0, 0.06))',
  },
  tabs: {
    display: 'flex',
    gap: '20px',
    marginBottom: '24px',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--mac-border, rgba(0, 0, 0, 0.06))',
  },
  content: {},
};

const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes skeleton-pulse {
    0%, 100% {
      opacity: 0.4;
    }
    50% {
      opacity: 1;
    }
  }
`;
if (typeof document !== 'undefined' && !document.getElementById('skeleton-keyframes')) {
  styleSheet.id = 'skeleton-keyframes';
  document.head.appendChild(styleSheet);
}

export default SkeletonLoader;
