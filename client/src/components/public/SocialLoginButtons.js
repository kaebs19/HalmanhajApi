import { useState, useEffect, useRef, useCallback } from 'react';
import { useUserAuth } from '../../context/UserAuthContext';
import { API_BASE } from '../../lib/api';

let authConfigCache = null;

export default function SocialLoginButtons({ onSuccess, onError }) {
  const { googleLogin, appleLogin } = useUserAuth();
  const [config, setConfig] = useState(authConfigCache);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingApple, setLoadingApple] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const googleBtnRef = useRef(null);

  // جلب إعدادات OAuth
  useEffect(() => {
    if (authConfigCache) {
      setConfig(authConfigCache);
      return;
    }
    fetch(`${API_BASE}/user/auth-config`)
      .then(r => r.json())
      .then(data => {
        authConfigCache = data;
        setConfig(data);
      })
      .catch(() => {});
  }, []);

  // تحميل وتهيئة Google Identity Services SDK
  useEffect(() => {
    if (!config?.google_client_id) return;

    const initGoogle = () => {
      if (!window.google?.accounts?.id) return;

      window.google.accounts.id.initialize({
        client_id: config.google_client_id,
        callback: async (response) => {
          setLoadingGoogle(true);
          try {
            await googleLogin(response.credential);
            onSuccess?.();
          } catch (err) {
            onError?.(err.message || 'فشل تسجيل الدخول بحساب Google');
          } finally {
            setLoadingGoogle(false);
          }
        },
        auto_select: false,
      });

      // عرض زر Google مخفي داخل الـ container
      if (googleBtnRef.current) {
        googleBtnRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          type: 'standard',
          shape: 'rectangular',
          theme: 'outline',
          size: 'large',
          width: googleBtnRef.current.offsetWidth || 350,
          text: 'continue_with',
          locale: 'ar',
        });
      }
      setGoogleReady(true);
    };

    if (window.google?.accounts?.id) {
      initGoogle();
      return;
    }

    // تحميل السكريبت
    if (!document.getElementById('google-gsi-script')) {
      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      document.head.appendChild(script);
    } else {
      // السكريبت محمّل بس ما جهز بعد
      const check = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(check);
          initGoogle();
        }
      }, 100);
      return () => clearInterval(check);
    }
  }, [config, googleLogin, onSuccess, onError]);

  const handleAppleLogin = useCallback(async () => {
    if (!config?.apple_client_id) return;
    setLoadingApple(true);

    try {
      // تحميل Apple JS SDK لو ما محمّل
      if (!window.AppleID) {
        await new Promise((resolve, reject) => {
          if (document.getElementById('apple-auth-script')) {
            const check = setInterval(() => {
              if (window.AppleID) { clearInterval(check); resolve(); }
            }, 100);
            setTimeout(() => { clearInterval(check); reject(new Error('timeout')); }, 5000);
          } else {
            const script = document.createElement('script');
            script.id = 'apple-auth-script';
            script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          }
        });
      }

      window.AppleID.auth.init({
        clientId: config.apple_client_id,
        scope: 'name email',
        redirectURI: window.location.origin + '/auth/login',
        usePopup: true,
      });

      const response = await window.AppleID.auth.signIn();
      const idToken = response.authorization.id_token;
      const userName = response.user?.name
        ? `${response.user.name.firstName || ''} ${response.user.name.lastName || ''}`.trim()
        : undefined;

      await appleLogin(idToken, userName);
      onSuccess?.();
    } catch (err) {
      if (err.error !== 'popup_closed_by_user') {
        onError?.(err.message || 'فشل تسجيل الدخول بحساب Apple');
      }
    } finally {
      setLoadingApple(false);
    }
  }, [config, appleLogin, onSuccess, onError]);

  if (!config) return null;

  return (
    <div className="space-y-3">
      {/* Google - زر Google الرسمي */}
      {config.google_client_id && (
        <div
          ref={googleBtnRef}
          className="w-full flex justify-center [&>div]:!w-full [&_iframe]:!w-full"
          style={{ minHeight: 44, display: googleReady ? 'flex' : 'none' }}
        />
      )}

      {/* Google - placeholder أثناء التحميل */}
      {config.google_client_id && !googleReady && (
        <div className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-400">
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          جاري تحميل Google...
        </div>
      )}

      {/* Apple */}
      {config.apple_client_id && (
        <button
          type="button"
          onClick={handleAppleLogin}
          disabled={loadingApple}
          className="w-full flex items-center justify-center gap-3 bg-black text-white rounded-xl px-4 py-3 text-sm font-medium hover:bg-gray-900 transition-colors disabled:opacity-50"
        >
          <svg width="16" height="18" viewBox="0 0 16 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.182 10.553c-.02-2.157 1.762-3.194 1.842-3.244-1.003-1.467-2.565-1.668-3.12-1.69-1.329-.135-2.594.783-3.268.783-.673 0-1.714-.763-2.816-.743-1.449.02-2.784.843-3.531 2.14-1.505 2.612-.385 6.483 1.081 8.603.717 1.037 1.572 2.202 2.694 2.16 1.082-.044 1.49-.7 2.797-.7 1.307 0 1.675.7 2.817.678 1.163-.02 1.905-1.056 2.618-2.096.825-1.202 1.164-2.365 1.184-2.425-.026-.012-2.271-.872-2.298-3.466zM11.019 3.676c.596-.723.999-1.726.889-2.726-.859.035-1.9.572-2.516 1.294-.553.64-1.037 1.662-.907 2.642.96.075 1.938-.487 2.534-1.21z"/>
          </svg>
          {loadingApple ? 'جاري الدخول...' : 'المتابعة بحساب Apple'}
        </button>
      )}
    </div>
  );
}
