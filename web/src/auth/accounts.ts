import type { DepthId, WaterRegime } from '@/lib/types';
import type { SoilTest } from '@/lib/fertilizer';
import type { PriorityId } from '@/utils/priorities';

// Farmer accounts.
//
// NöbetSu has no server (PLAN_MVP §3), so this first store keeps accounts in the
// browser of the device they were made on. The PIN is stored only as a salted
// SHA-256 hash; that keeps it from being read off a shared phone, but it is not
// server-grade security and the UI says the data stays on this device. A server
// store (e.g. Supabase) replaces LocalAccountStore behind the same interface.

export type Field = {
  id: string;
  name: string;
  locationId: string;
  areaDonum: number | null;
  depthId: DepthId;
  priority: PriorityId;
  note: string;
  createdAt: string;
  /** Fertilizer plan inputs (15 Nov, docs/GUBRE.md). Older fields have neither; the plan then uses defaults. */
  soilTest?: SoilTest;        // the farmer's own lab values (badge: user)
  water?: WaterRegime;        // default 'rainfed'
};

export type Farmer = {
  id: string;
  name: string;
  phone: string;          // normalised: 10 digits, starting with 5
  locationId: string;
  createdAt: string;
  fields: Field[];
};

export type AuthErrorCode = 'bad_phone' | 'bad_pin' | 'bad_name' | 'exists' | 'not_found' | 'wrong_pin' | 'storage';
export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) { super(code); }
}

export interface AccountStore {
  register(input: { name: string; phone: string; pin: string; locationId: string }): Promise<Farmer>;
  login(phone: string, pin: string): Promise<Farmer>;
  current(): Farmer | null;
  save(farmer: Farmer): void;
  logout(): void;
  remove(farmer: Farmer): void;
}

/** Turkish mobile numbers in any common spelling → 5XXXXXXXXX, or null. */
export function normalisePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('90') && d.length === 12) d = d.slice(2);
  if (d.startsWith('0') && d.length === 11) d = d.slice(1);
  return /^5\d{9}$/.test(d) ? d : null;
}

export const isValidPin = (pin: string) => /^\d{4,6}$/.test(pin);

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hashPin(salt: string, pin: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`)));
}

function randomId(bytes = 12): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

type Record_ = { farmer: Farmer; salt: string; pinHash: string };
const KEY = 'nobetsu.accounts.v1';
const SESSION = 'nobetsu.session.v1';

export class LocalAccountStore implements AccountStore {
  constructor(private readonly storage: Storage) {}

  private read(): Record<string, Record_> {
    try { return JSON.parse(this.storage.getItem(KEY) ?? '{}') as Record<string, Record_>; } catch { return {}; }
  }
  private write(all: Record<string, Record_>) {
    try { this.storage.setItem(KEY, JSON.stringify(all)); } catch { throw new AuthError('storage'); }
  }

  async register({ name, phone, pin, locationId }: { name: string; phone: string; pin: string; locationId: string }) {
    const p = normalisePhone(phone);
    if (!name.trim()) throw new AuthError('bad_name');
    if (!p) throw new AuthError('bad_phone');
    if (!isValidPin(pin)) throw new AuthError('bad_pin');
    const all = this.read();
    if (all[p]) throw new AuthError('exists');
    const salt = randomId(16);
    const farmer: Farmer = { id: randomId(), name: name.trim(), phone: p, locationId, createdAt: new Date().toISOString(), fields: [] };
    all[p] = { farmer, salt, pinHash: await hashPin(salt, pin) };
    this.write(all);
    this.setSession(p);
    return farmer;
  }

  async login(phone: string, pin: string) {
    const p = normalisePhone(phone);
    if (!p) throw new AuthError('bad_phone');
    const rec = this.read()[p];
    if (!rec) throw new AuthError('not_found');
    if ((await hashPin(rec.salt, pin)) !== rec.pinHash) throw new AuthError('wrong_pin');
    this.setSession(p);
    return rec.farmer;
  }

  current(): Farmer | null {
    try {
      const p = this.storage.getItem(SESSION);
      return p ? this.read()[p]?.farmer ?? null : null;
    } catch { return null; }
  }

  save(farmer: Farmer) {
    const all = this.read();
    const rec = all[farmer.phone];
    if (!rec) throw new AuthError('not_found');
    all[farmer.phone] = { ...rec, farmer };
    this.write(all);
  }

  logout() {
    try { this.storage.removeItem(SESSION); } catch { /* ignore */ }
  }

  remove(farmer: Farmer) {
    const all = this.read();
    delete all[farmer.phone];
    this.write(all);
    this.logout();
  }

  private setSession(phone: string) {
    try { this.storage.setItem(SESSION, phone); } catch { throw new AuthError('storage'); }
  }
}

export const newFieldId = () => randomId(6);
