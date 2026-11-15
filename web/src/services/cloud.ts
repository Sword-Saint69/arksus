// Supabase: Google sign-in, consent log, the farmer's own saved answers, district planting intent.
// Tables and access rules: supabase/migrations/20261115_consent_profiles_intents.sql (owner: Gümüş).
// What may be stored is fixed by docs/legal/: il + ilçe only, never the field's shape or GPS.
// Without VITE_SUPABASE_* (tests, a fork) `cloud` is null and the site keeps its device-only trial sign-in.

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { CONSENT_VERSION, NOTICE_VERSION, type ConsentKind, type ConsentRow, type Intent } from '@/domain/consent';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const cloud: SupabaseClient | null = url && key
  ? createClient(url, key, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true, autoRefreshToken: true } })
  : null;

export interface CloudUser { id: string; name: string; email: string }

export const toCloudUser = (u: User): CloudUser => ({
  id: u.id,
  name: String(u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.email ?? ''),
  email: u.email ?? '',
});

const need = () => { if (!cloud) throw new Error('cloud off'); return cloud; };

export async function signInWithGoogle(): Promise<void> {
  // Back to the page the farmer was on; Supabase's redirect list must allow this origin.
  const { error } = await need().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
  if (error) throw error;
}

export async function signOutCloud(): Promise<void> { await need().auth.signOut(); }

export async function loadConsents(): Promise<ConsentRow[]> {
  const { data, error } = await need().from('consents').select('id, kind, version, granted, created_at');
  if (error) throw error;
  return (data ?? []) as ConsentRow[];
}

/** Appends to the consent log (never edits it: the history is the proof). */
export async function recordConsents(items: { kind: ConsentKind; granted: boolean }[]): Promise<void> {
  if (!items.length) return;
  const rows = items.map((x) => ({ kind: x.kind, granted: x.granted, version: x.kind === 'notice_read' ? NOTICE_VERSION : CONSENT_VERSION }));
  const { error } = await need().from('consents').insert(rows);
  if (error) throw error;
}

export interface SavedProfile { answers: unknown; prefs: unknown; location_id: string | null; il: string | null; ilce: string | null }

export async function loadProfile(): Promise<SavedProfile | null> {
  const { data, error } = await need().from('profiles').select('answers, prefs, location_id, il, ilce').maybeSingle();
  if (error) throw error;
  return (data as SavedProfile | null) ?? null;
}

export async function saveProfile(userId: string, p: SavedProfile): Promise<void> {
  const { error } = await need().from('profiles').upsert({ user_id: userId, ...p, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function loadIntent(year: number): Promise<Intent | null> {
  const { data, error } = await need().from('planting_intents').select('harvest_year, il, ilce, crop, irrigation').eq('harvest_year', year).maybeSingle();
  if (error) throw error;
  return (data as Intent | null) ?? null;
}

/** One record per farmer and harvest year; the database refuses it without district_stats consent. */
export async function saveIntent(userId: string, i: Intent): Promise<void> {
  const { error } = await need().from('planting_intents').upsert({ user_id: userId, ...i, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Deletes the account; every row above goes with it (on delete cascade). */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await need().rpc('delete_my_account');
  if (error) throw error;
  await need().auth.signOut();
}
