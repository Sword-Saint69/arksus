// A trial sign-in kept on this device only (localStorage): no server, nothing
// sent anywhere. Passwords are never stored, only a salted PBKDF2 hash, but
// anyone with this browser can read or wipe the storage, so this is for trying
// the site, not for protecting anything.

import { normalizePrefs, type Prefs } from './sections';

export const USERS_KEY = 'nobetsu.users';
export const SESSION_KEY = 'nobetsu.session';

export interface Account { username: string; salt: string; hash: string; createdAt: string; prefs: Prefs }
type Users = Record<string, Account>;

export type AuthError = 'username_invalid' | 'password_short' | 'username_taken' | 'wrong_credentials' | 'storage';

export const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
export const MIN_PASSWORD = 6;

export interface Store { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

const local = (): Store | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };

const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (s: string) => new Uint8Array((s.match(/../g) ?? []).map((h) => parseInt(h, 16)));

async function derive(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(salt), iterations: 100_000 }, key, 256);
  return hex(bits);
}

export const cleanUsername = (u: string) => u.trim().toLocaleLowerCase('en');

function readUsers(s: Store): Users {
  try { return JSON.parse(s.getItem(USERS_KEY) ?? '{}') as Users; } catch { return {}; }
}
function writeUsers(s: Store, users: Users) { s.setItem(USERS_KEY, JSON.stringify(users)); }

export type Result<T> = { ok: true; value: T } | { ok: false; error: AuthError };

export async function register(username: string, password: string, prefs: Prefs, s: Store | null = local()): Promise<Result<Account>> {
  if (!s) return { ok: false, error: 'storage' };
  const name = cleanUsername(username);
  if (!USERNAME_RE.test(name)) return { ok: false, error: 'username_invalid' };
  if (password.length < MIN_PASSWORD) return { ok: false, error: 'password_short' };
  const users = readUsers(s);
  if (users[name]) return { ok: false, error: 'username_taken' };
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  const account: Account = { username: name, salt, hash: await derive(password, salt), createdAt: new Date().toISOString(), prefs };
  try { writeUsers(s, { ...users, [name]: account }); s.setItem(SESSION_KEY, name); } catch { return { ok: false, error: 'storage' }; }
  return { ok: true, value: account };
}

export async function login(username: string, password: string, s: Store | null = local()): Promise<Result<Account>> {
  if (!s) return { ok: false, error: 'storage' };
  const name = cleanUsername(username);
  const account = readUsers(s)[name];
  // Same answer for an unknown name and a wrong password.
  if (!account || (await derive(password, account.salt)) !== account.hash) return { ok: false, error: 'wrong_credentials' };
  try { s.setItem(SESSION_KEY, name); } catch { return { ok: false, error: 'storage' }; }
  return { ok: true, value: { ...account, prefs: normalizePrefs(account.prefs) } };
}

export function logout(s: Store | null = local()) { try { s?.removeItem(SESSION_KEY); } catch { /* nothing to do */ } }

/** The account this browser is signed in to, if any. */
export function currentAccount(s: Store | null = local()): Account | null {
  if (!s) return null;
  try {
    const name = s.getItem(SESSION_KEY);
    const a = name ? readUsers(s)[name] : undefined;
    return a ? { ...a, prefs: normalizePrefs(a.prefs) } : null;
  } catch { return null; }
}

export function savePrefs(username: string, prefs: Prefs, s: Store | null = local()) {
  if (!s) return;
  const users = readUsers(s);
  if (!users[username]) return;
  try { writeUsers(s, { ...users, [username]: { ...users[username], prefs } }); } catch { /* storage full or blocked */ }
}

export function deleteAccount(username: string, s: Store | null = local()) {
  if (!s) return;
  const users = readUsers(s);
  delete users[username];
  try { writeUsers(s, users); if (s.getItem(SESSION_KEY) === username) s.removeItem(SESSION_KEY); } catch { /* nothing to do */ }
}
