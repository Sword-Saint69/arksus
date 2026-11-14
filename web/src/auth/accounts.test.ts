import { beforeEach, describe, expect, it } from 'vitest';
import { AuthError, LocalAccountStore, normalisePhone } from './accounts';

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

describe('normalisePhone', () => {
  it('accepts the usual Turkish spellings', () => {
    for (const s of ['0532 123 45 67', '+90 532 123 4567', '5321234567', '(0532) 123-45-67']) expect(normalisePhone(s)).toBe('5321234567');
  });
  it('rejects landlines and short numbers', () => {
    expect(normalisePhone('0312 123 45 67')).toBeNull();
    expect(normalisePhone('53212')).toBeNull();
  });
});

describe('LocalAccountStore', () => {
  let storage: MemoryStorage;
  let store: LocalAccountStore;
  beforeEach(() => { storage = new MemoryStorage(); store = new LocalAccountStore(storage); });

  it('registers, logs out, logs back in with the PIN', async () => {
    const f = await store.register({ name: 'Ayşe Yılmaz', phone: '0532 123 45 67', pin: '4821', locationId: 'karapinar' });
    expect(store.current()?.id).toBe(f.id);
    store.logout();
    expect(store.current()).toBeNull();
    const again = await store.login('+905321234567', '4821');
    expect(again.name).toBe('Ayşe Yılmaz');
  });

  it('never stores the PIN itself', async () => {
    await store.register({ name: 'A', phone: '5321234567', pin: '4821', locationId: 'develi' });
    expect(JSON.stringify([...Array(storage.length).keys()].map((i) => storage.getItem(storage.key(i)!)))).not.toContain('4821');
  });

  it('reports the right errors', async () => {
    await store.register({ name: 'A', phone: '5321234567', pin: '4821', locationId: 'develi' });
    const code = (p: Promise<unknown>) => p.then(() => 'ok', (e: AuthError) => e.code);
    expect(await code(store.login('5321234567', '0000'))).toBe('wrong_pin');
    expect(await code(store.login('5559998877', '4821'))).toBe('not_found');
    expect(await code(store.register({ name: 'B', phone: '05321234567', pin: '1111', locationId: 'develi' }))).toBe('exists');
    expect(await code(store.register({ name: 'B', phone: '5321111111', pin: '12', locationId: 'develi' }))).toBe('bad_pin');
  });

  it('saves fields to the profile', async () => {
    const f = await store.register({ name: 'A', phone: '5321234567', pin: '4821', locationId: 'develi' });
    store.save({ ...f, fields: [{ id: 'x', name: 'Yukarı tarla', locationId: 'develi', areaDonum: 12, depthId: 'medium', priority: 'balanced', note: '', createdAt: '' }] });
    expect(store.current()?.fields[0].name).toBe('Yukarı tarla');
  });
});
