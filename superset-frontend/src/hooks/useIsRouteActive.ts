import { useLocation } from 'react-router-dom';

export function useIsRouteActive(path: string, exact = false): boolean {
  const location = useLocation();

  if (exact) {
    return location.pathname === path;
  }

  return location.pathname.includes(path);
}
