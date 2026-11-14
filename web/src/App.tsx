import { useEffect, useState } from 'react';
import { useSiteData } from '@/data/useSiteData';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { AppShell } from '@/components/AppShell';
import { MockBanner } from '@/components/MockBanner';
import { navigate, useRoute, type Route } from '@/router';
import { initialLang, saveLang, t, type Lang } from '@/strings';
import { Home } from '@/pages/Home';
import { Login } from '@/pages/Login';
import { Panel } from '@/pages/Panel';
import { FieldForm } from '@/pages/FieldForm';
import { FieldDetail } from '@/pages/FieldDetail';
import { Profile } from '@/pages/Profile';
import { Analysis } from '@/pages/Analysis';
import { MapView } from '@/pages/MapView';

export default function App() {
  return (
    <AuthProvider>
      <Site />
    </AuthProvider>
  );
}

const NEEDS_LOGIN: Route['name'][] = ['panel', 'field', 'field-new', 'field-edit', 'profile'];

function Site() {
  const [lang, setLang] = useState<Lang>(initialLang);
  const route = useRoute();
  const site = useSiteData();
  const { farmer } = useAuth();

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `NöbetSu · ${t(lang, 'question')}`;
    saveLang(lang);
  }, [lang]);
  // Signed-out visitors on a private page go to sign-in; signed-in ones skip the sign-in page.
  useEffect(() => {
    if (!farmer && NEEDS_LOGIN.includes(route.name)) navigate('/giris');
    if (farmer && route.name === 'login') navigate('/panel');
  }, [farmer, route.name]);

  let body: React.ReactNode;
  if (site.status === 'loading') body = <p className="p-8 text-muted">{t(lang, 'loading')}</p>;
  else if (site.status === 'error') body = <p role="alert" className="p-8 text-bad">{t(lang, 'loadFailed')}</p>;
  else {
    const data = site.data;
    switch (route.name) {
      case 'login': body = <Login data={data} lang={lang} mode={route.mode} />; break;
      case 'panel': body = <Panel data={data} lang={lang} />; break;
      case 'field-new': body = <FieldForm data={data} lang={lang} />; break;
      case 'field-edit': body = <FieldForm key={route.id} data={data} lang={lang} id={route.id} />; break;
      case 'field': body = <FieldDetail data={data} lang={lang} id={route.id} />; break;
      case 'profile': body = <Profile data={data} lang={lang} />; break;
      // Keyed by the query so opening it from a different field starts from that field's settings.
      case 'analysis': body = <Analysis key={route.query.toString()} data={data} lang={lang} query={route.query} />; break;
      case 'map': body = <MapView data={data} lang={lang} query={route.query} />; break;
      default: body = <Home data={data} lang={lang} />;
    }
  }
  const anyMock = site.status === 'ready' && (site.data.site.mock || site.data.defaults.mock || site.data.validation.mock);

  return (
    <AppShell lang={lang} onLang={setLang} route={route} bare={route.name === 'map'}>
      <MockBanner show={anyMock} lang={lang} />
      {body}
    </AppShell>
  );
}
