import { useEffect, useRef, useState } from 'react';
import type { TerrainView } from '@/terrain/TerrainView';
import { Mountain } from 'lucide-react';
import { fmtNum, hasKey, translate, useT } from '@/i18n';
import { useStore } from '@/state/store';
import { fieldPolygons } from '@/domain/field';
import { loadLedger } from '@/data/api';
import { lonLatToMerc, mercScale, type BBox } from '@/terrain/dem';
import { Button, Card, DataBadge } from '@/ui/kit';

/**
 * Invitation to see the farmer's own field in 3D and make it rain on it. The
 * view itself is plain three.js (terrain/TerrainView), opened over the page.
 */
export function FieldTerrain() {
  const { t, lang } = useT();
  const parcels = useStore((s) => s.parcels);
  const locationId = useStore((s) => s.locationId);
  const core = useStore((s) => s.core)!;
  const view = useRef<TerrainView | null>(null);
  const [loading, setLoading] = useState(false);
  const location = core.site.locations.find((l) => l.id === locationId);
  const isPilot = !parcels.length || parcels[0]?.source === 'pilot';

  // Leaving the result screen closes the view and frees its WebGL context.
  useEffect(() => () => view.current?.close(), []);

  const open = async () => {
    if (view.current || loading || !location) return;
    const polys = fieldPolygons(parcels);
    let bbox: BBox;
    let rings: Float64Array[][] | null = null;
    if (!isPilot && polys.length) {
      rings = polys.map((poly) => poly.map((ring) => {
        const out = new Float64Array(ring.length * 2);
        ring.forEach(([lon, lat], i) => { const m = lonLatToMerc(lon, lat); out[i * 2] = m.x; out[i * 2 + 1] = m.y; });
        return out;
      }));
      bbox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
      for (const p of rings) for (let i = 0; i < p[0].length; i += 2) {
        bbox.minX = Math.min(bbox.minX, p[0][i]); bbox.maxX = Math.max(bbox.maxX, p[0][i]);
        bbox.minY = Math.min(bbox.minY, p[0][i + 1]); bbox.maxY = Math.max(bbox.maxY, p[0][i + 1]);
      }
      // Pad around the outline so the slope leading into and out of the field
      // shows; never smaller than 500 m across.
      const k = mercScale((bbox.minY + bbox.maxY) / 2);
      const cx = (bbox.minX + bbox.maxX) / 2, cy = (bbox.minY + bbox.maxY) / 2;
      const hw = Math.max((bbox.maxX - bbox.minX) * 0.65, 250 * k), hh = Math.max((bbox.maxY - bbox.minY) * 0.65, 250 * k);
      bbox = { minX: cx - hw, maxX: cx + hw, minY: cy - hh, maxY: cy + hh };
    } else {
      // No real field (a pilot stand-in): a 2.4 km square around the district point.
      const c = lonLatToMerc(location.lon, location.lat);
      const half = 1200 * mercScale(c.y);
      bbox = { minX: c.x - half, maxX: c.x + half, minY: c.y - half, maxY: c.y + half };
    }
    const wettestWeek = loadLedger(location.id).then((ledger) => {
      let mm = 0;
      // Rain is the same for every rotation and depth; one series per start year is enough.
      for (const s of ledger.series) if (s.rotation_id === 'fallow_wheat' && s.depth_id === 'medium') for (const w of s.weeks) mm = Math.max(mm, w.p_mm);
      return mm > 0 ? { district: location.name, mm } : null;
    }).catch(() => null);

    // three.js and the view load only now: most visitors never open it, and the
    // first page should stay small on a phone connection.
    setLoading(true);
    const [{ TerrainView }] = await Promise.all([import('@/terrain/TerrainView'), import('@/terrain/terrain.css')]).finally(() => setLoading(false));
    view.current = new TerrainView(
      document.body,
      { name: isPilot ? location.name : (parcels.length === 1 && parcels[0].label) || t('fvMyField'), bbox, rings, wettestWeek },
      {
        t: (key, vars) => (hasKey(key) ? translate(lang, key, vars) : key),
        num: (v, digits = 0) => fmtNum(lang, v, digits),
      },
      () => { view.current = null; },
    );
  };

  return (
    <Card className="grid gap-3 border-2 border-water/30 bg-water-soft">
      <h2 className="flex items-center gap-2 text-xl font-extrabold leading-tight"><Mountain size={22} className="text-water" aria-hidden="true" /> {t('terTitle')}</h2>
      <p className="text-base leading-snug">{t('terBody')}</p>
      {isPilot && <p className="text-[15px] leading-snug text-muted">{t('terPilotNote')}</p>}
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted">SRTM ~30 m · <DataBadge type="model" /></p>
      <Button variant="primary" size="lg" onClick={open} disabled={loading} icon={<Mountain size={20} />} className="justify-self-start">{loading ? t('loading') : t('terOpen')}</Button>
    </Card>
  );
}
