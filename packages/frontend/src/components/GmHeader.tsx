import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

export function GmHeader({ children, wrap, rightSlot }: { children: ReactNode; wrap?: boolean; rightSlot?: ReactNode }) {
  return (
    <header style={{ ...header, flexWrap: wrap ? 'wrap' : 'nowrap' }}>
      <Link to="/" style={brand} title="GM Assistant — Home">
        <img src="/logo.png" alt="GM Assistant" style={logo} />
      </Link>
      {children}
      <div style={rightGroup}>
        {rightSlot}
        <Link to="/help" style={helpLink} title="Help">?</Link>
      </div>
    </header>
  );
}

const header: React.CSSProperties = {
  padding: '12px 32px',
  borderBottom: '1px solid #2a2a4a',
  background: '#16213e',
  display: 'flex',
  alignItems: 'center',
  gap: 16,
};

const brand: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
};

const logo: React.CSSProperties = {
  height: 36,
  width: 36,
  borderRadius: 6,
  objectFit: 'contain',
};

const rightGroup: React.CSSProperties = {
  marginLeft: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
};

const helpLink: React.CSSProperties = {
  flexShrink: 0,
  width: 28,
  height: 28,
  borderRadius: '50%',
  border: '1px solid #3a3a5a',
  background: 'transparent',
  color: '#888',
  fontSize: '0.95rem',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
  lineHeight: 1,
};
