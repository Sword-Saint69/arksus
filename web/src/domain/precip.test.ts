import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SiteIndex, ValidationFile } from '@/lib/types';
import { precipGapPct } from './precip';

const DATA = resolve(__dirname, '../../public/data');
const site = JSON.parse(readFileSync(resolve(DATA, 'site_index.json'), 'utf-8')) as SiteIndex;
const validation = JSON.parse(readFileSync(resolve(DATA, 'validation.json'), 'utf-8')) as ValidationFile;

describe('precipGapPct', () => {
  it('reads a gap for every district in site_index', () => {
    for (const loc of site.locations) expect(precipGapPct(validation, loc), loc.id).not.toBeNull();
  });
  it('matches the numbers in the evidence check', () => {
    const by = (id: string) => precipGapPct(validation, site.locations.find((l) => l.id === id)!);
    expect(by('karapinar')).toBe(36);
    expect(by('karaman')).toBe(83);
  });
});
