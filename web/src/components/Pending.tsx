import type { ReactNode } from 'react';
import { t, type Lang } from '@/strings';

/** A V value that may be null: null means "not sourced yet", never zero (types.ts). */
export function ValueOrPending({ value, lang, children }: { value: number | null; lang: Lang; children: (v: number) => ReactNode }) {
  if (value === null) return <span className="italic text-faint">{t(lang, 'pending')}</span>;
  return <>{children(value)}</>;
}
