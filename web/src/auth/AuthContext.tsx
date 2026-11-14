import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { LocalAccountStore, type AccountStore, type Farmer } from './accounts';

type Auth = {
  farmer: Farmer | null;
  register: AccountStore['register'];
  login: AccountStore['login'];
  logout: () => void;
  update: (f: Farmer) => void;
  remove: () => void;
};

const Ctx = createContext<Auth | null>(null);

function makeStore(): AccountStore {
  // localStorage can throw (private mode, blocked storage); fall back to a store
  // that lives only for this tab rather than breaking the page.
  try { localStorage.getItem('x'); return new LocalAccountStore(localStorage); } catch { return new LocalAccountStore(sessionStorage); }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const store = useMemo(makeStore, []);
  const [farmer, setFarmer] = useState<Farmer | null>(() => store.current());

  const register = useCallback<AccountStore['register']>(async (i) => { const f = await store.register(i); setFarmer(f); return f; }, [store]);
  const login = useCallback<AccountStore['login']>(async (p, pin) => { const f = await store.login(p, pin); setFarmer(f); return f; }, [store]);
  const logout = useCallback(() => { store.logout(); setFarmer(null); }, [store]);
  const update = useCallback((f: Farmer) => { store.save(f); setFarmer(f); }, [store]);
  const remove = useCallback(() => { if (farmer) store.remove(farmer); setFarmer(null); }, [store, farmer]);

  const value = useMemo(() => ({ farmer, register, login, logout, update, remove }), [farmer, register, login, logout, update, remove]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
