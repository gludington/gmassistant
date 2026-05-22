import { createRootRoute, Outlet } from '@tanstack/react-router';
import { AudioProvider } from '../hooks/useAudio';
import { AudioBar } from '../components/AudioBar';

export const Route = createRootRoute({
  component: Root,
});

function Root() {
  return (
    <AudioProvider>
      <Outlet />
      <AudioBar />
    </AudioProvider>
  );
}
