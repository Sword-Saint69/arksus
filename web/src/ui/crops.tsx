import { ArrowRight, Bean, Sprout, Tractor, Wheat } from 'lucide-react';
import type { CropId, Rotation } from '@/lib/types';
import { ROTATION_COLOR } from '@/domain/sim';
import { useT, type Key } from '@/i18n';

export function CropIcon({ crop, size = 22 }: { crop: CropId; size?: number }) {
  if (crop === 'wheat') return <Wheat size={size} aria-hidden="true" />;
  if (crop === 'chickpea') return <Bean size={size} aria-hidden="true" />;
  if (crop === 'lentil') return <Sprout size={size} aria-hidden="true" />;
  return <Tractor size={size} aria-hidden="true" />;
}

/** "Fallow → Wheat" with the two crop icons: the same picture everywhere a rotation is named. */
export function RotationName({ rotation, size = 'md', onDark }: { rotation: Rotation; size?: 'md' | 'lg'; onDark?: boolean }) {
  const { t } = useT();
  const [first, second] = rotation.crops;
  const icon = size === 'lg' ? 34 : 20;
  return (
    <span className={size === 'lg' ? 'flex flex-wrap items-center gap-x-3 gap-y-1' : 'inline-flex flex-wrap items-center gap-x-1.5'}>
      <span className="inline-flex items-center gap-1.5"><CropIcon crop={first} size={icon} />{t(`crop_${first}` as Key)}</span>
      <ArrowRight size={size === 'lg' ? 28 : 16} strokeWidth={2.6} className={onDark ? 'text-gold' : 'text-faint'} aria-hidden="true" />
      <span className="inline-flex items-center gap-1.5"><CropIcon crop={second} size={icon} />{t(`crop_${second}` as Key)}</span>
    </span>
  );
}

/** Colour chip of a rotation: a filled square, so it reads without relying on hue alone next to its name. */
export function RotationDot({ id }: { id: Rotation['id'] }) {
  return <span aria-hidden="true" className="inline-block h-3.5 w-3.5 shrink-0 rounded-[4px]" style={{ background: ROTATION_COLOR[id] }} />;
}
