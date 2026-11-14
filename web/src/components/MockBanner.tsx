import { t, type Lang } from '@/strings';

export function MockBanner({ show, lang }: { show: boolean; lang: Lang }) {
  if (!show) return null;
  return (
    <div role="status" className="bg-[#fbe3a6] px-4 py-2 text-center text-sm font-semibold text-[#5b3d00]">
      {t(lang, 'mockBanner')}
    </div>
  );
}
