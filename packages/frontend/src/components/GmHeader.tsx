import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

export function GmHeader({ children, wrap }: { children: ReactNode; wrap?: boolean }) {
  return (
    <header style={{ ...header, flexWrap: wrap ? 'wrap' : 'nowrap' }}>
      <Link to="/" style={brand} title="GM Assistant — Home">
        <img src="/logo.png" alt="GM Assistant" style={logo} />
      </Link>
      {children}
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
