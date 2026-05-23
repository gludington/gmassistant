import { createRootRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { AudioProvider } from '../hooks/useAudio';
import { AudioBar } from '../components/AudioBar';

export const Route = createRootRoute({
  component: Root,
});

function Root() {
  const { location } = useRouterState();
  const isPlayer = location.pathname === '/player';
  if (isPlayer) {
    return <Outlet />;
  }
  return (
    <AudioProvider>
      <div style={topBar}>
        <Link to="/" style={brand}>
          <img src="/logo.png" alt="GM Assistant" style={logo} />
          <span style={brandName}>GM Assistant</span>
        </Link>
      </div>
      <Outlet />
      <AudioBar />
    </AudioProvider>
  );
}

const topBar: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 900,
  height: 44,
  background: '#0d0d1f',
  borderBottom: '1px solid #2a2a4a',
  display: 'flex',
  alignItems: 'center',
  padding: '0 16px',
};

const brand: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  textDecoration: 'none',
};

const logo: React.CSSProperties = {
  height: 28,
  width: 28,
  borderRadius: 6,
  objectFit: 'contain',
};

const brandName: React.CSSProperties = {
  color: '#c9a84c',
  fontWeight: 700,
  fontSize: '0.95rem',
  letterSpacing: '0.03em',
};
