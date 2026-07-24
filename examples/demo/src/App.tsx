import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { SiteLayout } from './layout/SiteLayout.js';
import { LandingPage } from './pages/LandingPage.js';
import { DemoPage } from './pages/DemoPage.js';
import { AdminPage } from './pages/AdminPage.js';
import { DocsLayout, DocsIndexPage, DocRoutePage } from './docs/DocsLayout.js';

function LayoutRoute() {
  const { pathname } = useLocation();
  const portal = pathname.startsWith('/portal');
  const wide = portal || pathname.startsWith('/docs') || pathname.startsWith('/demo');
  const hideFooter = pathname === '/' || portal;
  return <SiteLayout wide={wide} hideFooter={hideFooter} admin={portal} />;
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
        <Route path="portal" element={<AdminPage />} />
        <Route path="admin" element={<Navigate to="/portal" replace />} />
      </Route>
    </Routes>
  );
}
