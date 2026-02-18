import { Outlet } from 'react-router-dom';
import PublicHeader from '../components/public/PublicHeader';
import PublicFooter from '../components/public/PublicFooter';
import AdUnit from '../components/public/AdUnit';

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50" dir="rtl">
      <PublicHeader />
      <AdUnit position="header_banner" className="max-w-7xl mx-auto w-full px-4 pt-3" />
      <main className="flex-1">
        <Outlet />
      </main>
      <AdUnit position="footer_banner" className="max-w-7xl mx-auto w-full px-4 pb-4" />
      <PublicFooter />
    </div>
  );
}
