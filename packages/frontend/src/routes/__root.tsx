import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router';
import { AudioProvider } from '../hooks/useAudio';
import { AudioBar } from '../components/AudioBar';
import { AdventureProvider } from '../context/AdventureContext';
import { PlayerScreenProvider } from '../hooks/usePlayerScreen';

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
    <AdventureProvider>
      <AudioProvider>
        <PlayerScreenProvider>
          <Outlet />
          <AudioBar />
        </PlayerScreenProvider>
      </AudioProvider>
    </AdventureProvider>
  );
}
