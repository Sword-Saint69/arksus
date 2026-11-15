import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SiteIndex } from '@/lib/types';
import { DEMO_ANSWERS, demoLocation } from './demo';
import { stageOf } from './history';

const site = JSON.parse(readFileSync(resolve(__dirname, '../../public/data/site_index.json'), 'utf-8')) as SiteIndex;

describe('demo link', () => {
  it('finds a known district and ignores anything else', () => {
    expect(demoLocation(site, '?demo=karapinar')?.id).toBe('karapinar');
    expect(demoLocation(site, '?demo=nowhere')).toBeNull();
    expect(demoLocation(site, '')).toBeNull();
  });
  it('fixed answers put the field at the first-year choice', () => {
    expect(stageOf(DEMO_ANSWERS.history)).toBe('choose_first_year');
  });
});
