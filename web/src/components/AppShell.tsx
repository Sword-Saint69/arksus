import { useState, type ReactNode } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { t, type Lang } from '@/strings';
import { cn } from '@/utils/cn';
import type { Route } from '@/router';

type Props = { lang: Lang; onLang: (l: Lang) => void; route: Route; children: ReactNode; bare?: boolean };

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#2f5d46" />
      <path d="M5 22c4-1 7-6 11-6s7 5 11 6" fill="none" stroke="#f3c45c" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 6c3 4 4 6 4 8a4 4 0 01-8 0c0-2 1-4 4-8z" fill="#cfe8f5" />
    </svg>
  );
}

export function AppShell({ lang, onLang, route, children, bare }: Props) {
  const { farmer, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const link = (href: string, label: string, active: boolean) => (
    <a href={href} onClick={() => setOpen(false)} aria-current={active ? 'page' : undefined}
      className={cn('flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted hover:bg-raise hover:text-ink', active && 'bg-raise text-ink')}>
      {label}
    </a>
  );
  const nav = (
    <>
      {link('#/', t(lang, 'navHome'), route.name === 'home')}
      {link('#/harita', t(lang, 'navMap'), route.name === 'map')}
      {link('#/analiz', t(lang, 'navAnalysis'), route.name === 'analysis')}
      {farmer && link('#/panel', t(lang, 'navPanel'), ['panel', 'field', 'field-new', 'field-edit'].includes(route.name))}
      {farmer && link('#/profil', t(lang, 'navProfile'), route.name === 'profile')}
    </>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <a href="#/" className="flex items-center gap-2 font-bold text-primary"><Logo className="h-9 w-9" /><span className="text-lg">NöbetSu</span></a>
          <nav aria-label={t(lang, 'menu')} className="ml-4 hidden items-center gap-1 md:flex">{nav}</nav>
          <div className="ml-auto flex items-center gap-2">
            <div role="group" aria-label={t(lang, 'language')} className="flex rounded-lg border border-line bg-canvas p-0.5">
              {(['tr', 'en'] as const).map((l) => (
                <button key={l} aria-pressed={lang === l} onClick={() => onLang(l)}
                  className={cn('h-9 min-w-9 rounded-md px-2 font-mono text-xs font-semibold uppercase text-muted', lang === l && 'bg-paper text-ink shadow-sm')}>
                  {l}
                </button>
              ))}
            </div>
            {farmer ? (
              <button onClick={logout} className="hidden min-h-10 rounded-lg border border-line px-3 text-sm md:block">{t(lang, 'logout')}</button>
            ) : (
              <a href="#/giris" className="hidden min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white md:flex">{t(lang, 'navLogin')}</a>
            )}
            <button className="grid h-10 w-10 place-items-center rounded-lg border border-line md:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label={t(lang, 'menu')} onClick={() => setOpen(!open)}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>
        {open && (
          <nav id="mobile-nav" aria-label={t(lang, 'menu')} className="grid gap-1 border-t border-line px-4 py-3 md:hidden">
            {nav}
            {farmer
              ? <button onClick={() => { logout(); setOpen(false); }} className="min-h-11 rounded-lg px-3 text-left text-sm font-medium text-bad">{t(lang, 'logout')}</button>
              : link('#/giris', t(lang, 'navLogin'), route.name === 'login')}
          </nav>
        )}
      </header>
      <div className="flex-1">{children}</div>
      {!bare && <footer className="border-t border-line bg-paper">
        <div className="mx-auto grid max-w-5xl gap-1 px-4 py-6 text-xs text-muted sm:px-6">
          <p>{t(lang, 'sources')}</p>
          <p>{t(lang, 'supports')}</p>
        </div>
      </footer>}
    </div>
  );
}
