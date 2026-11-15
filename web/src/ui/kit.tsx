// Small building blocks shared by every screen. Tap targets are at least 48 px
// and nothing relies on colour alone.

import type { ComponentChildren } from './types';
import type { Badge as BadgeType } from '@/lib/types';
import { useT, type Key } from '@/i18n';

export const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'gold';
  size?: 'md' | 'lg';
  icon?: ComponentChildren;
  block?: boolean;
};

export function Button({ variant = 'secondary', size = 'md', icon, block, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition active:scale-[0.98] disabled:opacity-50',
        size === 'lg' ? 'min-h-14 px-6 text-lg' : 'min-h-12 px-4 text-base',
        block && 'w-full',
        variant === 'primary' && 'bg-primary text-white shadow-sm hover:bg-primary-strong',
        variant === 'gold' && 'bg-gold text-primary-strong shadow-float hover:brightness-105',
        variant === 'secondary' && 'border-2 border-line bg-white text-ink hover:border-primary',
        variant === 'ghost' && 'text-primary hover:bg-primary-soft',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

/** One big answer in a list of answers (a radio in behaviour). */
export function Choice({ selected, onSelect, icon, title, help, tone }: {
  selected: boolean; onSelect: () => void; icon?: ComponentChildren; title: string; help?: string; tone?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex min-h-16 w-full items-center gap-3.5 rounded-2xl border-2 bg-white p-3.5 text-left transition active:scale-[0.99]',
        selected ? 'border-primary bg-primary-soft shadow-sm' : 'border-line hover:border-primary/60',
      )}
    >
      {icon && (
        <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-xl', selected ? 'bg-primary text-white' : 'bg-canvas text-primary')} style={tone && !selected ? { color: tone } : undefined}>
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold leading-tight">{title}</span>
        {help && <span className="mt-0.5 block text-[15px] leading-snug text-muted">{help}</span>}
      </span>
      <span aria-hidden="true" className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-sm font-black', selected ? 'border-primary bg-primary text-white' : 'border-line text-transparent')}>✓</span>
    </button>
  );
}

const BADGE_STYLE: Record<BadgeType, string> = {
  measured: 'bg-[#e0f0e6] text-[#1c6339]',
  model: 'bg-[#e2edf6] text-[#23567a]',
  official: 'bg-[#ebe5f6] text-[#523b85]',
  statistic: 'bg-[#e8ecdf] text-[#475526]',
  literature: 'bg-[#f4e8da] text-[#74491a]',
  assumption: 'bg-white text-warn border border-dashed border-[#dfbf85]',
  user: 'bg-[#fbe3a6] text-[#553900]',
};

/** What kind of number this is. The word is always printed. */
export function DataBadge({ type, verified = true, className }: { type: BadgeType; verified?: boolean; className?: string }) {
  const { t } = useT();
  return (
    <span className={cn('inline-flex items-center gap-1 align-middle', className)}>
      <span className={cn('inline-flex h-[19px] items-center rounded-full px-1.5 text-[11px] font-bold lowercase leading-none', BADGE_STYLE[type])}>
        {t(`badge_${type}` as Key)}
      </span>
      {!verified && <span className="text-[11px] text-faint">{t('unverified')}</span>}
    </span>
  );
}

export function Note({ tone = 'info', icon, children, className }: { tone?: 'info' | 'warn' | 'bad' | 'good'; icon?: ComponentChildren; children: ComponentChildren; className?: string }) {
  return (
    <div
      role={tone === 'bad' ? 'alert' : undefined}
      className={cn(
        'flex gap-2.5 rounded-2xl px-3.5 py-3 text-[15px] leading-snug',
        tone === 'info' && 'bg-water-soft text-[#1d4d6b]',
        tone === 'warn' && 'bg-warn-soft text-warn',
        tone === 'bad' && 'bg-bad-soft text-bad',
        tone === 'good' && 'bg-primary-soft text-primary-strong',
        className,
      )}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** 0–1 bar with its value printed beside it by the caller. */
export function Meter({ value, color = 'var(--color-primary)', label }: { value: number; color?: string; label?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <span className="block h-2.5 w-full overflow-hidden rounded-full bg-raise" role="img" aria-label={label ? `${label}: ${pct} / 100` : undefined}>
      <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </span>
  );
}

export function SectionTitle({ children, sub, badge }: { children: ComponentChildren; sub?: ComponentChildren; badge?: ComponentChildren }) {
  return (
    <div>
      <h2 className="flex flex-wrap items-center gap-2 text-xl font-extrabold leading-tight">{children}{badge}</h2>
      {sub && <p className="mt-1 text-[15px] leading-snug text-muted">{sub}</p>}
    </div>
  );
}

export function Card({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-3xl border border-line bg-white p-4 sm:p-5', className)} {...rest}>{children}</div>;
}

/** Collapsed block for the detail a farmer rarely needs. */
export function Fold({ title, children, defaultOpen }: { title: ComponentChildren; children: ComponentChildren; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-2xl border border-line bg-white">
      <summary className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5 text-base font-bold">
        <span className="flex flex-wrap items-center gap-2">{title}</span>
        <span aria-hidden="true" className="text-xl leading-none text-muted transition group-open:rotate-45">+</span>
      </summary>
      <div className="grid gap-3 border-t border-line px-4 py-3 text-[15px] leading-snug">{children}</div>
    </details>
  );
}
