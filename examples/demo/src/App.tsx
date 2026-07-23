import { Routes, Route, useLocation } from 'react-router-dom';
import { SiteLayout } from './layout/SiteLayout.js';
import { LandingPage } from './pages/LandingPage.js';
import { DemoPage } from './pages/DemoPage.js';
import { AdminPage } from './pages/AdminPage.js';
import { DocsLayout, DocsIndexPage, DocRoutePage } from './docs/DocsLayout.js';

function LayoutRoute() {
  const { pathname } = useLocation();
  const admin = pathname.startsWith('/admin');
  const wide = admin || pathname.startsWith('/docs') || pathname.startsWith('/demo');
  const hideFooter = pathname === '/' || admin;
  return <SiteLayout wide={wide} hideFooter={hideFooter} admin={admin} />;
}
export function App() {
  return (
    <Routes>
      <Route element={<LayoutRoute />}>
        <Route index element={<LandingPage />} />
        <Route path="demo" element={<DemoPage />} />
        <Route path="docs" element={<DocsLayout />}>
          <Route index element={<DocsIndexPage />} />
          <Route path=":slug" element={<DocRoutePage />} />
        </Route>
        <Route path="admin" element={<AdminPage />} />
      </Route>
    </Routes>
  );
}
