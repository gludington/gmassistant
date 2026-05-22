import { createRootRoute, Outlet, Link } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: Root,
});

function Root() {
  return <Outlet />;
}
