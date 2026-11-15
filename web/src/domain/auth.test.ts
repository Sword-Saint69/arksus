import { describe, expect, it } from 'vitest';
import { currentAccount, deleteAccount, login, logout, register, savePrefs, USERS_KEY, type Store } from './auth';
import { DEFAULT_PREFS, showFor } from './sections';

// Fixture values for the device-only trial sign-in; not a real account.
const NAME = 'deneme.ciftci';
const PASS = 'deneme-123';

const mem = (): Store => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

describe('device-only sign-in', () => {
  it('registers, signs out, signs back in', async () => {
    const s = mem();
    const r = await register('  Deneme.Ciftci ', PASS, DEFAULT_PREFS, s);
    expect(r.ok && r.value.username).toBe(NAME);
    expect(currentAccount(s)?.username).toBe(NAME);
    logout(s);
    expect(currentAccount(s)).toBeNull();
    expect((await login(NAME, PASS, s)).ok).toBe(true);
    expect(currentAccount(s)?.username).toBe(NAME);
  });

  it('never stores the password itself', async () => {
    const s = mem();
    await register(NAME, PASS, DEFAULT_PREFS, s);
    expect(s.getItem(USERS_KEY)).not.toContain(PASS);
  });

  it('refuses bad input with the same error for unknown name and wrong password', async () => {
    const s = mem();
    expect(await register('a', PASS, DEFAULT_PREFS, s)).toEqual({ ok: false, error: 'username_invalid' });
    expect(await register(NAME, '123', DEFAULT_PREFS, s)).toEqual({ ok: false, error: 'password_short' });
    await register(NAME, PASS, DEFAULT_PREFS, s);
    expect(await register(NAME, PASS, DEFAULT_PREFS, s)).toEqual({ ok: false, error: 'username_taken' });
    expect(await login(NAME, 'yanlis-sifre', s)).toEqual({ ok: false, error: 'wrong_credentials' });
    expect(await login('kimse', PASS, s)).toEqual({ ok: false, error: 'wrong_credentials' });
  });

  it('keeps settings with the account and can delete it', async () => {
    const s = mem();
    await register(NAME, PASS, DEFAULT_PREFS, s);
    savePrefs(NAME, { mode: 'advanced', show: showFor('advanced') }, s);
    logout(s);
    const back = await login(NAME, PASS, s);
    expect(back.ok && back.value.prefs.mode).toBe('advanced');
    deleteAccount(NAME, s);
    expect(currentAccount(s)).toBeNull();
    expect((await login(NAME, PASS, s)).ok).toBe(false);
  });
});
