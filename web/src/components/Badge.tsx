import type { Badge as BadgeType } from '@/lib/types';
import { t, type Key, type Lang } from '@/strings';
import { cn } from '@/utils/cn';

const STYLE: Record<BadgeType, string> = {
  measured: 'bg-[#e3f0e7] text-[#1f6b3f]',
  model: 'bg-[#e4eef6] text-[#275b80]',
  official: 'bg-[#ece6f6] text-[#57408a]',
  statistic: 'bg-[#e9ece1] text-[#4c5a2b]',
  literature: 'bg-[#f4e9dc] text-[#7a4f1d]',
  assumption: 'bg-white text-warn border border-dashed border-[#e3c58d]',
  user: 'bg-[#fbe3a6] text-[#5b3d00]',
};

/** Source badge. The word is always printed, so the type never rests on colour alone. */
export function Badge({ type, verified = true, lang, className }: { type: BadgeType; verified?: boolean; lang: Lang; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 align-middle', className)}>
      <span className={cn('inline-flex h-[18px] items-center rounded-full px-1.5 text-[10.5px] font-semibold lowercase', STYLE[type])}>
        {t(lang, `badge_${type}` as Key)}
      </span>
      {!verified && <span className="text-[10.5px] text-faint">{t(lang, 'unverified')}</span>}
    </span>
  );
}
