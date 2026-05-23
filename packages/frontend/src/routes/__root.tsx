import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router';
import { AudioProvider } from '../hooks/useAudio';
import { AudioBar } from '../components/AudioBar';

export const Route = createRootRoute({
  component: Root,
});

function Root() {
  const { location } = useRouterState();
  const isPlayer = location.pathname === '/player';
  return (
    <AudioProvider>
      <Outlet />
      {!isPlayer && <AudioBar />}
    </AudioProvider>
  );
}
