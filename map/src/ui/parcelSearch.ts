// "Ada / Parsel" form: province → district → neighbourhood cascade from TKGM's
// own administrative lists (their ids are what the parcel query needs), then
// block and parcel numbers.

import { districts, neighbourhoods, parcelAt, parcelByNumber, provinces, TkgmError, infoOf, type AdminUnit } from '../tkgm';
import type { Feature } from '../vector/features';
import { t } from '../strings';

export type ParcelSearch = {
  open: () => void;
  close: () => void;
  /** Pre-fill the cascade from a known parcel (after a click or a search). */
  prefill: (f: Feature) => void;
};

export function attachParcelSearch(opts: {
  onFound: (f: Feature) => void;
  viewCenter: () => [number, number];
}): ParcelSearch {
  const panel = document.querySelector<HTMLElement>('#parcel-search')!;
  const form = panel.querySelector<HTMLFormElement>('form')!;
  const opener = document.querySelector<HTMLButtonElement>('.ps-open')!;
  const il = form.elements.namedItem('il') as HTMLSelectElement;
  const ilce = form.elements.namedItem('ilce') as HTMLSelectElement;
  const mah = form.elements.namedItem('mahalle') as HTMLSelectElement;
  const ada = form.elements.namedItem('ada') as HTMLInputElement;
  const parsel = form.elements.namedItem('parsel') as HTMLInputElement;
  const msg = panel.querySelector<HTMLElement>('.ps-msg')!;
  const go = panel.querySelector<HTMLButtonElement>('.ps-go')!;
  let loadedProvinces = false;

  const say = (text: string | null, ok = false) => {
    msg.hidden = !text;
    msg.textContent = text ?? '';
    msg.classList.toggle('ok', ok);
  };

  function fill(sel: HTMLSelectElement, units: AdminUnit[], value?: number) {
    sel.innerHTML = `<option value="">${t('psChoose')}</option>` +
      units.map((u) => `<option value="${u.id}">${u.name.replace(/</g, '&lt;')}</option>`).join('');
    sel.disabled = false;
    if (value !== undefined) sel.value = String(value);
  }
  function loading(sel: HTMLSelectElement) {
    sel.innerHTML = `<option value="">${t('psLoading')}</option>`;
    sel.disabled = true;
  }
  function reset(sel: HTMLSelectElement) {
    sel.innerHTML = '';
    sel.disabled = true;
  }

  async function loadIl(value?: number) {
    loading(il);
    try { fill(il, await provinces(), value); loadedProvinces = true; } catch { say(t('psFail')); reset(il); }
  }
  async function loadIlce(ilId: number, value?: number) {
    loading(ilce); reset(mah);
    try { fill(ilce, await districts(ilId), value); } catch { say(t('psFail')); reset(ilce); }
  }
  async function loadMah(ilceId: number, value?: number) {
    loading(mah);
    try { fill(mah, await neighbourhoods(ilceId), value); } catch { say(t('psFail')); reset(mah); }
  }

  il.addEventListener('change', () => { say(null); if (il.value) loadIlce(+il.value); else { reset(ilce); reset(mah); } });
  ilce.addEventListener('change', () => { say(null); if (ilce.value) loadMah(+ilce.value); else reset(mah); });
  for (const input of [ada, parsel]) {
    // Title deeds sometimes print numbers with spaces or leading zeros; keep digits only.
    input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, ''); say(null); });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!mah.value) { (il.value ? (ilce.value ? mah : ilce) : il).focus(); return; }
    if (!ada.value) { ada.focus(); return; }
    if (!parsel.value) { parsel.focus(); return; }
    go.disabled = true;
    say(t('psFinding'), true);
    try {
      const f = await parcelByNumber(+mah.value, String(+ada.value), String(+parsel.value));
      say(null);
      opts.onFound(f);
      close();
    } catch (err) {
      say(err instanceof TkgmError && err.notFound ? t('psNotFound') : t('psFail'));
    } finally {
      go.disabled = false;
    }
  });

  // One point query at the view centre gives the province/district/neighbourhood
  // ids, so the user only has to type the two numbers.
  panel.querySelector('.ps-here')!.addEventListener('click', async () => {
    const [lon, lat] = opts.viewCenter();
    say(t('psFinding'), true);
    try {
      const f = await parcelAt(lat, lon);
      prefill(f, false);
      say(null);
      ada.focus();
    } catch {
      say(t('psFail'));
    }
  });

  panel.querySelector('.ps-x')!.addEventListener('click', () => close());
  opener.addEventListener('click', () => (panel.hidden ? open() : close()));
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });

  function open() {
    panel.hidden = false;
    opener.setAttribute('aria-expanded', 'true');
    if (!loadedProvinces) loadIl();
    setTimeout(() => (il.value ? (mah.value ? ada : ilce) : il).focus(), 0);
  }
  function close() {
    panel.hidden = true;
    opener.setAttribute('aria-expanded', 'false');
  }

  async function prefill(f: Feature, withNumbers = true) {
    const info = infoOf(f);
    if (!info) return;
    await loadIl(info.ilId);
    await loadIlce(info.ilId, info.ilceId);
    await loadMah(info.ilceId, info.mahalleId);
    if (withNumbers) { ada.value = info.ada; parsel.value = info.parsel; }
  }

  return { open, close, prefill: (f) => { if (!panel.hidden) prefill(f); } };
}
