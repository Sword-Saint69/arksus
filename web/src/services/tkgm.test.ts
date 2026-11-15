import { describe, expect, it } from 'vitest';
import { parseTkgmArea, toParcel } from './tkgm';

// The response of parsel/37.876000/34.679500/ (checked 15 Nov 2026).
const SAMPLE = {
  type: 'Feature' as const,
  geometry: {
    type: 'Polygon' as const,
    coordinates: [[[34.67754, 37.87657], [34.67756, 37.87608], [34.67759, 37.87564], [34.67762, 37.87532], [34.67986, 37.87595],
      [34.68065, 37.87615], [34.68159, 37.87638], [34.68178, 37.87643], [34.68213, 37.87653], [34.68193, 37.87691], [34.68149, 37.87776],
      [34.68137, 37.87799], [34.68062, 37.87772], [34.67999, 37.87748], [34.67929, 37.87721], [34.67754, 37.87657]]],
  },
  properties: {
    ilceAd: 'Merkez', mevkii: 'Tosbağlık', ilId: 73, durum: '1', ilceId: 754, zeminKmdurum: 'Ana Taşınmaz', parselNo: '28',
    mahalleAd: 'Sazlica/Yeni', ozet: 'Sazlica/Yeni-220/28', alan: '60,074.32', adaNo: '220', nitelik: 'Tarla', ilAd: 'Niğde',
    mahalleId: 205372, pafta: 'M33-A-14-B',
  },
};

describe('TKGM', () => {
  it('reads both ways TKGM writes an area', () => {
    expect(parseTkgmArea('60,074.32')).toBe(60074.32);
    expect(parseTkgmArea('86.100,00')).toBe(86100);
    expect(parseTkgmArea('950,5')).toBe(950.5);
    expect(parseTkgmArea('1.250')).toBe(1250);
    expect(parseTkgmArea(1234.5)).toBe(1234.5);
    expect(parseTkgmArea('')).toBeNull();
    expect(parseTkgmArea(undefined)).toBeNull();
    expect(parseTkgmArea('yok')).toBeNull();
  });

  it('turns a parcel feature into a field parcel with the registered area', () => {
    const p = toParcel(SAMPLE);
    expect(p.id).toBe('tkgm:205372:220/28');
    expect(p.source).toBe('tkgm');
    expect(p.areaM2).toBe(60074.32);
    expect(p.areaBadge).toBe('official');
    expect(p.label).toBe('Sazlica/Yeni 220/28');
    expect(p.polygons).toHaveLength(1);
    expect(p.polygons[0][0]).toHaveLength(15);          // ring stored open
    expect(p.admin).toMatchObject({ il: 'Niğde', ilce: 'Merkez', mahalle: 'Sazlica/Yeni', ada: '220', parsel: '28', nitelik: 'Tarla', ilId: 73 });
  });

  it('falls back to the geometric area when the register has none', () => {
    const p = toParcel({ ...SAMPLE, properties: { ...SAMPLE.properties, alan: '' } });
    expect(p.areaBadge).toBe('model');
    expect(p.areaM2).toBeGreaterThan(58_000);
    expect(p.areaM2).toBeLessThan(62_000);
  });
});
