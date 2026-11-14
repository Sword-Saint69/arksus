import { useEffect, useState } from 'react';

// Hash routes keep the site a static build (Vercel serves one index.html, no
// rewrites needed) and make every page a shareable link.
export type Route =
  | { name: 'home' }
  | { name: 'login'; mode: 'login' | 'register' }
  | { name: 'panel' }
  | { name: 'field-new' }
  | { name: 'field'; id: string }
  | { name: 'field-edit'; id: string }
  | { name: 'profile' }
  | { name: 'analysis'; query: URLSearchParams };

export function parseRoute(hash: string): Route {
  const [path, qs = ''] = hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  switch (parts[0]) {
    case 'giris': return { name: 'login', mode: 'login' };
    case 'kayit': return { name: 'login', mode: 'register' };
    case 'panel': return { name: 'panel' };
    case 'profil': return { name: 'profile' };
    case 'analiz': return { name: 'analysis', query: new URLSearchParams(qs) };
    case 'tarla':
      if (parts[1] === 'yeni') return { name: 'field-new' };
      if (parts[1] && parts[2] === 'duzenle') return { name: 'field-edit', id: parts[1] };
      if (parts[1]) return { name: 'field', id: parts[1] };
      return { name: 'panel' };
    default: return { name: 'home' };
  }
}

export function navigate(path: string) {
  if (location.hash !== `#${path}`) location.hash = path;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  useEffect(() => {
    const on = () => { setRoute(parseRoute(location.hash)); window.scrollTo(0, 0); };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return route;
}
