import { Link } from 'react-router-dom';
import { useSettings } from '../../context/SettingsContext';

export default function PublicFooter() {
  const { settings, logoUrl } = useSettings();
  const socialLinks = settings.social_links || {};
  const hasSocial = socialLinks.twitter || socialLinks.youtube || socialLinks.telegram || socialLinks.whatsapp;

  return (
    <footer className="mt-auto bg-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">

          {/* عمود 1: الشعار والوصف والتواصل */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              {logoUrl ? (
                <img src={logoUrl} alt={settings.site_name} className="h-9 w-auto brightness-0 invert" width={144} height={36} />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
              )}
              <span className="text-base font-bold text-white">{settings.site_name}</span>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed max-w-xs mb-4">
              {settings.seo_description || 'موقع تعليمي يقدم حلول المناهج الدراسية لجميع المراحل'}
            </p>

            {/* الإيميل */}
            {settings.contact_email && (
              <a href={`mailto:${settings.contact_email}`} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <span className="truncate">{settings.contact_email}</span>
              </a>
            )}

            {/* أيقونات سوشال ميديا */}
            {hasSocial && (
              <div className="flex gap-2">
                {socialLinks.twitter && (
                  <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer"
                     className="w-8 h-8 rounded-lg bg-white/10 hover:bg-[#1da1f2] flex items-center justify-center transition-all duration-200 hover:scale-110">
                    <svg className="w-3.5 h-3.5 text-gray-300 hover:text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </a>
                )}
                {socialLinks.telegram && (
                  <a href={socialLinks.telegram} target="_blank" rel="noopener noreferrer"
                     className="w-8 h-8 rounded-lg bg-white/10 hover:bg-[#0088cc] flex items-center justify-center transition-all duration-200 hover:scale-110">
                    <svg className="w-3.5 h-3.5 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                    </svg>
                  </a>
                )}
                {socialLinks.youtube && (
                  <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer"
                     className="w-8 h-8 rounded-lg bg-white/10 hover:bg-[#ff0000] flex items-center justify-center transition-all duration-200 hover:scale-110">
                    <svg className="w-3.5 h-3.5 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                  </a>
                )}
                {socialLinks.whatsapp && (
                  <a href={socialLinks.whatsapp} target="_blank" rel="noopener noreferrer"
                     className="w-8 h-8 rounded-lg bg-white/10 hover:bg-[#25d366] flex items-center justify-center transition-all duration-200 hover:scale-110">
                    <svg className="w-3.5 h-3.5 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* عمود 2: روابط سريعة */}
          <div>
            <h3 className="text-xs font-bold text-gray-300 mb-3 uppercase tracking-wider">روابط سريعة</h3>
            <div className="space-y-2">
              <Link to="/" className="block text-sm text-gray-400 hover:text-white transition-colors">الرئيسية</Link>
              <Link to="/search" className="block text-sm text-gray-400 hover:text-white transition-colors">البحث</Link>
              <Link to="/quizzes" className="block text-sm text-gray-400 hover:text-white transition-colors">الاختبارات</Link>
              <Link to="/faq" className="block text-sm text-gray-400 hover:text-white transition-colors">الأسئلة الشائعة</Link>
            </div>
          </div>

          {/* عمود 3: معلومات */}
          <div>
            <h3 className="text-xs font-bold text-gray-300 mb-3 uppercase tracking-wider">معلومات</h3>
            <div className="space-y-2">
              <Link to="/privacy" className="block text-sm text-gray-400 hover:text-white transition-colors">سياسة الخصوصية</Link>
              <Link to="/terms" className="block text-sm text-gray-400 hover:text-white transition-colors">شروط الاستخدام</Link>
              <Link to="/contact" className="block text-sm text-gray-400 hover:text-white transition-colors">اتصل بنا</Link>
            </div>
          </div>
        </div>

        {/* حقوق النشر */}
        <div className="border-t border-white/10 mt-6 pt-5 text-center">
          <p className="text-xs text-gray-500">
            {settings.footer_text || `جميع الحقوق محفوظة \u00A9 ${new Date().getFullYear()} ${settings.site_name}`}
          </p>
        </div>
      </div>
    </footer>
  );
}
