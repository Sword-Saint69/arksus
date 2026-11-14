// Place search: Nominatim (OSM geocoder) restricted to Turkey, plus plain
// "lat, lon" input. Nominatim's policy is at most one request per second and no
// autocomplete-on-keystroke, so we debounce hard and require 3+ characters.

import { via } from '../sources';
import { getLang, t } from '../strings';

export type SearchHit = { label: string; detail: string; lat: number; lon: number; bbox?: [number, number, number, number] };

export function attachSearch(form: HTMLFormElement, onPick: (hit: SearchHit) => void) {
  const input = form.querySelector('input')!;
  const list = form.querySelector('ul')!;
  let hits: SearchHit[] = [];
  let active = -1;
  let timer = 0;
  let lastQuery = '';
  let lastSent = 0;
  let ctrl: AbortController | null = null;

  const render = (msg?: string) => {
    list.innerHTML = '';
    if (msg) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = msg;
      list.append(li);
    }
    hits.forEach((h, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.id = `sr-${i}`;
      li.setAttribute('aria-selected', String(i === active));
      const b = document.createElement('span');
      b.textContent = h.label;
      const s = document.createElement('small');
      s.textContent = h.detail;
      li.append(b, s);
      li.addEventListener('mousedown', (e) => { e.preventDefault(); choose(i); });
      list.append(li);
    });
    const open = !!msg || hits.length > 0;
    list.hidden = !open;
    input.setAttribute('aria-expanded', String(open));
    input.setAttribute('aria-activedescendant', active >= 0 ? `sr-${active}` : '');
  };

  const choose = (i: number) => {
    const h = hits[i];
    if (!h) return;
    input.value = h.label;
    hits = []; active = -1; render();
    input.blur();
    onPick(h);
  };

  const coord = (q: string): SearchHit | null => {
    const m = q.match(/^\s*(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)\s*$/);
    if (!m) return null;
    const lat = parseFloat(m[1].replace(',', '.')), lon = parseFloat(m[2].replace(',', '.'));
    if (Math.abs(lat) > 85 || Math.abs(lon) > 180) return null;
    return { label: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, detail: t('goToCoord'), lat, lon };
  };

  const run = async (q: string) => {
    const c = coord(q);
    if (c) { hits = [c]; active = 0; render(); return; }
    if (q.length < 3 || q === lastQuery) return;
    lastQuery = q;
    const wait = Math.max(0, 1100 - (performance.now() - lastSent));
    await new Promise((r) => setTimeout(r, wait));
    if (input.value.trim() !== q) return;
    ctrl?.abort();
    ctrl = new AbortController();
    lastSent = performance.now();
    render(t('searching'));
    try {
      const url = via('nominatim', `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=tr&limit=7&accept-language=${getLang()}&q=${encodeURIComponent(q)}`);
      const res = await fetch(url, { signal: ctrl.signal });
      const rows = (await res.json()) as { display_name: string; name?: string; lat: string; lon: string; boundingbox: string[]; type: string; addresstype?: string }[];
      hits = rows.map((r) => {
        const parts = r.display_name.split(', ');
        return {
          label: r.name || parts[0],
          detail: parts.slice(1, 4).join(', '),
          lat: +r.lat, lon: +r.lon,
          bbox: r.boundingbox ? [+r.boundingbox[0], +r.boundingbox[1], +r.boundingbox[2], +r.boundingbox[3]] as [number, number, number, number] : undefined,
        };
      });
      active = hits.length ? 0 : -1;
      render(hits.length ? undefined : t('noResults'));
    } catch (e) {
      if ((e as Error).name !== 'AbortError') { hits = []; render(t('searchDown')); }
    }
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (!q) { hits = []; render(); lastQuery = ''; return; }
    timer = window.setTimeout(() => run(q), 650);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && hits.length) { active = (active + 1) % hits.length; render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp' && hits.length) { active = (active - 1 + hits.length) % hits.length; render(); e.preventDefault(); }
    else if (e.key === 'Escape') { hits = []; render(); input.blur(); }
  });
  input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); }, 120));
  input.addEventListener('focus', () => { if (hits.length) render(); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (active >= 0) choose(active);
    else { clearTimeout(timer); run(input.value.trim()); }
  });
}
