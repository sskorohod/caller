'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { authApi } from '@/lib/api';
// Public-site language (shared with the landing — localStorage 'caller_public_lang'),
// so the language chosen on the landing carries over to the login page.
import { LangProvider, useLang, LangSwitcher } from '@/app/_landing/useLang';

function LoginContent() {
  const { t } = useLang();
  const { login } = useAuth();
  const searchParams = useSearchParams();
  // Raw ?return= value; validated to a safe same-origin path at the redirect
  // sink (auth-context login() → safeRedirectPath).
  const returnUrl = searchParams.get('return');
  const modeParam = searchParams.get('mode');
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(modeParam === 'register' ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      login(res.token, res.user, res.workspace ?? undefined, returnUrl ?? undefined);
    } catch (err: any) {
      setError(err.message || t('Invalid email or password', 'Неверный email или пароль', 'Correo o contraseña incorrectos'));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword({ email });
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || t('Could not send the reset link', 'Не удалось отправить ссылку', 'No se pudo enviar el enlace'));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setError('');
    setLoading(true);
    try {
      const cleanPhone = phoneNumber.replace(/[\s\-\(\)\.]/g, '');
      const res = await authApi.register({ email, password, phone_number: cleanPhone || undefined });
      login(res.token, res.user, res.workspace ?? undefined, returnUrl ?? undefined);
    } catch (err: any) {
      setError(err.message || t('Could not create account', 'Не удалось создать аккаунт', 'No se pudo crear la cuenta'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#0e131f', color: '#dde2f3', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
        .font-headline { font-family: 'Manrope', sans-serif; }
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
        .input-field {
          width: 100%; padding: 14px 16px; border-radius: 12px; font-size: 16px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(140, 144, 159, 0.2);
          color: #dde2f3; outline: none; transition: all 0.2s;
        }
        .input-field::placeholder { color: rgba(194, 198, 214, 0.4); }
        .input-field:focus { border-color: rgba(173, 198, 255, 0.5); box-shadow: 0 0 0 3px rgba(173, 198, 255, 0.08); }
      `}</style>

      {/* Left — Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #0a0f1a 0%, #131a2e 50%, #0e131f 100%)' }}>
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #adc6ff 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute bottom-1/3 right-1/4 w-48 h-48 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #d0bcff 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="relative z-10 max-w-md px-12">
          <Link href="/" className="flex items-center gap-3 mb-10 group">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #adc6ff 0%, #4d8eff 100%)' }}>
              <span className="material-symbols-outlined text-2xl" style={{ color: '#0e131f', fontVariationSettings: "'FILL' 1" }}>call</span>
            </div>
            <span className="text-2xl font-headline font-extrabold tracking-tight">LingoLine</span>
          </Link>
          <h2 className="text-3xl font-headline font-extrabold tracking-tight leading-tight mb-4">
            {t('AI Live', 'AI-переводчик', 'AI en vivo')}
            <br />
            <span style={{ color: '#adc6ff' }}>{t('Translator', 'в реальном времени', 'Traductor')}</span>
          </h2>
          <p className="text-sm leading-relaxed mb-8" style={{ color: '#c2c6d6' }}>
            {t(
              'Real-time AI interpretation on any phone call. Works from any phone — no apps. Start with free credit.',
              'Перевод звонков с помощью ИИ в реальном времени. Работает с любого телефона — без приложений. Начните с бесплатным балансом.',
              'Traducción de llamadas con IA en tiempo real. Funciona desde cualquier teléfono — sin apps. Comienza con crédito gratis.',
            )}
          </p>
          <div className="space-y-3">
            {[
              { icon: 'translate', text: t('Live translation on any phone call', 'Живой перевод любого телефонного звонка', 'Traducción en vivo en cualquier llamada') },
              { icon: 'sync_alt', text: t('Both directions, detected automatically', 'В обе стороны — направление определяется автоматически', 'En ambas direcciones, detectado automáticamente') },
              { icon: 'savings', text: t('No subscription — pay per minute', 'Без подписки — оплата за минуты', 'Sin suscripción — pago por minuto') },
            ].map(f => (
              <div key={f.text} className="flex items-center gap-3">
                <span className="material-symbols-outlined text-lg" style={{ color: '#4ade80', fontVariationSettings: "'FILL' 1" }}>{f.icon}</span>
                <span className="text-sm" style={{ color: '#c2c6d6' }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-6 sm:p-6 lg:p-12 relative">
        {/* Language switch (top-right) */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <LangSwitcher />
        </div>
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <Link href="/" className="lg:hidden flex items-center justify-center gap-3 mb-8 group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #adc6ff 0%, #4d8eff 100%)' }}>
              <span className="material-symbols-outlined text-xl" style={{ color: '#0e131f', fontVariationSettings: "'FILL' 1" }}>call</span>
            </div>
            <span className="text-xl font-headline font-extrabold tracking-tight">LingoLine</span>
          </Link>

          {mode === 'login' ? (
            /* ─── Sign In (email + password) ─── */
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-headline font-bold tracking-tight">{t('Welcome back', 'С возвращением', 'Bienvenido de nuevo')}</h1>
                <p className="text-sm mt-1" style={{ color: '#c2c6d6' }}>{t('Sign in to your account', 'Войдите в свой аккаунт', 'Inicia sesión en tu cuenta')}</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(194, 198, 214, 0.5)' }}>Email</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg" style={{ color: 'rgba(194, 198, 214, 0.3)' }}>mail</span>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                      placeholder="you@company.com" className="input-field" style={{ paddingLeft: '40px' }} />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(194, 198, 214, 0.5)' }}>{t('Password', 'Пароль', 'Contraseña')}</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg" style={{ color: 'rgba(194, 198, 214, 0.3)' }}>lock</span>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                      placeholder={t('Enter password', 'Введите пароль', 'Ingresa tu contraseña')} className="input-field" style={{ paddingLeft: '40px' }} />
                  </div>
                  <div className="text-right mt-1.5">
                    <button type="button" onClick={() => { setMode('forgot'); setError(''); setResetSent(false); }}
                      className="text-xs font-medium hover:underline" style={{ color: '#adc6ff' }}>
                      {t('Forgot password?', 'Забыли пароль?', '¿Olvidaste tu contraseña?')}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                    style={{ background: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.2)', color: '#f87171' }}>
                    <span className="material-symbols-outlined text-base">error</span>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-xl text-sm font-bold transition-all active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  style={{ background: 'linear-gradient(135deg, #adc6ff 0%, #4d8eff 100%)', color: '#0e131f', boxShadow: '0 4px 24px rgba(77, 142, 255, 0.2)' }}>
                  {loading ? t('Signing in...', 'Вход…', 'Iniciando sesión...') : t('Sign In', 'Войти', 'Iniciar sesión')}
                </button>
              </form>

              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px" style={{ background: 'rgba(140, 144, 159, 0.15)' }} />
                <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'rgba(194, 198, 214, 0.3)' }}>{t('new here?', 'впервые здесь?', '¿nuevo aquí?')}</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(140, 144, 159, 0.15)' }} />
              </div>

              <button onClick={() => { setMode('register'); setError(''); }}
                className="w-full py-3 rounded-xl text-sm font-medium transition-all min-h-[44px]"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                {t('Create Account', 'Создать аккаунт', 'Crear cuenta')}
              </button>
            </>
          ) : mode === 'forgot' ? (
            /* ─── Forgot password (email a reset link) ─── */
            <>
              {resetSent ? (
                <div className="text-center space-y-6">
                  <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)' }}>
                    <span className="material-symbols-outlined text-3xl" style={{ color: '#4ade80', fontVariationSettings: "'FILL' 1" }}>mark_email_read</span>
                  </div>
                  <div>
                    <h1 className="text-2xl font-headline font-bold tracking-tight mb-2">{t('Check your email', 'Проверьте почту', 'Revisa tu correo')}</h1>
                    <p className="text-sm" style={{ color: '#c2c6d6' }}>
                      {t('If an account exists for', 'Если аккаунт с адресом', 'Si existe una cuenta para')}<br />
                      <strong style={{ color: '#dde2f3' }}>{email}</strong><br />
                      {t('we sent a password reset link. It expires in 30 minutes.', 'существует — мы отправили ссылку для сброса пароля. Она действует 30 минут.', 'enviamos un enlace para restablecer tu contraseña. Expira en 30 minutos.')}
                    </p>
                  </div>
                  <button onClick={() => { setMode('login'); setError(''); setResetSent(false); }}
                    className="text-sm font-medium hover:underline" style={{ color: '#adc6ff' }}>
                    {t('Back to sign in', 'Вернуться ко входу', 'Volver al inicio de sesión')}
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <h1 className="text-2xl font-headline font-bold tracking-tight">{t('Reset password', 'Сброс пароля', 'Restablecer contraseña')}</h1>
                    <p className="text-sm mt-1" style={{ color: '#c2c6d6' }}>
                      {t('Enter your email and we\'ll send you a link to set a new password.', 'Введите email — мы отправим ссылку для установки нового пароля.', 'Ingresa tu correo y te enviaremos un enlace para establecer una nueva contraseña.')}
                    </p>
                  </div>

                  <form onSubmit={handleForgot} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(194, 198, 214, 0.5)' }}>Email</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg" style={{ color: 'rgba(194, 198, 214, 0.3)' }}>mail</span>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                          placeholder="you@company.com" className="input-field" style={{ paddingLeft: '40px' }} autoFocus />
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                        style={{ background: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.2)', color: '#f87171' }}>
                        <span className="material-symbols-outlined text-base">error</span>
                        {error}
                      </div>
                    )}

                    <button type="submit" disabled={loading || !email}
                      className="w-full py-3.5 rounded-xl text-sm font-bold transition-all active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                      style={{ background: 'linear-gradient(135deg, #adc6ff 0%, #4d8eff 100%)', color: '#0e131f', boxShadow: '0 4px 24px rgba(77, 142, 255, 0.2)' }}>
                      {loading ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          {t('Sending...', 'Отправка…', 'Enviando...')}
                        </span>
                      ) : t('Send reset link', 'Отправить ссылку', 'Enviar enlace')}
                    </button>
                  </form>

                  <button onClick={() => { setMode('login'); setError(''); }}
                    className="w-full mt-4 text-sm font-medium hover:underline" style={{ color: '#adc6ff' }}>
                    {t('Back to sign in', 'Вернуться ко входу', 'Volver al inicio de sesión')}
                  </button>
                </>
              )}
            </>
          ) : (
            /* ─── Register (email + password) ─── */
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-headline font-bold tracking-tight">{t('Create account', 'Создать аккаунт', 'Crear cuenta')}</h1>
                <p className="text-sm mt-1" style={{ color: '#c2c6d6' }}>
                  {t(
                    'Pick a password and you\'re in — no email confirmation needed.',
                    'Придумайте пароль — и вы внутри, без подтверждения по почте.',
                    'Elige una contraseña y listo — sin confirmación por correo.',
                  )}
                </p>
              </div>

              {/* free minutes callout */}
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl mb-6"
                style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
                <span className="material-symbols-outlined text-xl shrink-0" style={{ color: '#4ade80', fontVariationSettings: "'FILL' 1" }}>redeem</span>
                <div>
                  <div className="text-sm font-semibold" style={{ color: '#dde2f3' }}>{t('Ten free minutes as a gift', 'Десять бесплатных минут в подарок', 'Diez minutos gratis de regalo')}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#c2c6d6' }}>{t('One gift per phone number. No card required to start.', 'Один бонус на один номер. Для старта платёжная карта не нужна.', 'Un regalo por número. No se necesita tarjeta para empezar.')}</div>
                </div>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(194, 198, 214, 0.5)' }}>Email</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg" style={{ color: 'rgba(194, 198, 214, 0.3)' }}>mail</span>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                      placeholder="you@company.com" className="input-field" style={{ paddingLeft: '40px' }} autoFocus />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(194, 198, 214, 0.5)' }}>{t('Password', 'Пароль', 'Contraseña')}</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg" style={{ color: 'rgba(194, 198, 214, 0.3)' }}>lock</span>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                      placeholder={t('At least 8 characters', 'Минимум 8 символов', 'Al menos 8 caracteres')} className="input-field" style={{ paddingLeft: '40px' }} />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(194, 198, 214, 0.5)' }}>{t('Phone Number', 'Номер телефона', 'Número de teléfono')}</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg" style={{ color: 'rgba(194, 198, 214, 0.3)' }}>phone</span>
                    <input type="tel" value={phoneNumber}
                      onChange={e => {
                        let v = e.target.value;
                        if (v && !v.startsWith('+') && /^\d/.test(v)) v = '+' + v;
                        setPhoneNumber(v);
                      }}
                      onBlur={() => setPhoneNumber(phoneNumber.replace(/[\s\-\(\)\.]/g, ''))}
                      placeholder="+14155551234" className="input-field" style={{ paddingLeft: '40px' }} />
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: 'rgba(194, 198, 214, 0.3)' }}>{t('Your phone number for translator service (E.164 format). The $2 gift is credited when you add a phone number — now or later in Settings.', 'Ваш номер для сервиса перевода (формат E.164). Бонус $2 начисляется при добавлении номера — сейчас или позже в настройках.', 'Tu número para el servicio de traducción (formato E.164). El bono de $2 se acredita al añadir un número — ahora o más tarde en Configuración.')}</p>
                </div>

                <label className="flex items-start gap-3 cursor-pointer select-none mt-1">
                  <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-blue-500 flex-shrink-0" />
                  <span className="text-xs leading-relaxed" style={{ color: 'rgba(194, 198, 214, 0.5)' }}>
                    {t('I agree to the', 'Я согласен с', 'Acepto los')}{' '}
                    <a href="/terms" target="_blank" className="underline" style={{ color: '#adc6ff' }}>{t('Terms of Service', 'Условиями использования', 'Términos de servicio')}</a>,{' '}
                    <a href="/privacy" target="_blank" className="underline" style={{ color: '#adc6ff' }}>{t('Privacy Policy', 'Политикой конфиденциальности', 'Política de privacidad')}</a>{' '}
                    {t('and', 'и', 'y la')}{' '}
                    <a href="/acceptable-use" target="_blank" className="underline" style={{ color: '#adc6ff' }}>{t('Acceptable Use Policy', 'Правилами допустимого использования', 'Política de uso aceptable')}</a>
                  </span>
                </label>

                {error && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                    style={{ background: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.2)', color: '#f87171' }}>
                    <span className="material-symbols-outlined text-base">error</span>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading || !email || !password || !agreedToTerms}
                  className="w-full py-3.5 rounded-xl text-sm font-bold transition-all active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  style={{ background: 'linear-gradient(135deg, #adc6ff 0%, #4d8eff 100%)', color: '#0e131f', boxShadow: '0 4px 24px rgba(77, 142, 255, 0.2)' }}>
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      {t('Creating account...', 'Создаём аккаунт…', 'Creando cuenta...')}
                    </span>
                  ) : t('Sign Up', 'Зарегистрироваться', 'Registrarse')}
                </button>
              </form>

              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px" style={{ background: 'rgba(140, 144, 159, 0.15)' }} />
                <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'rgba(194, 198, 214, 0.3)' }}>{t('already have an account?', 'уже есть аккаунт?', '¿ya tienes cuenta?')}</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(140, 144, 159, 0.15)' }} />
              </div>

              <button onClick={() => { setMode('login'); setError(''); }}
                className="w-full py-3 rounded-xl text-sm font-medium transition-all min-h-[44px]"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                {t('Sign In with Password', 'Войти по паролю', 'Iniciar sesión con contraseña')}
              </button>
            </>
          )}

          <p className="text-center text-[10px] mt-8" style={{ color: 'rgba(194, 198, 214, 0.3)' }}>
            LingoLine Platform &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <LangProvider>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#0e131f' }}>
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#adc6ff', borderTopColor: 'transparent' }} />
        </div>
      }>
        <LoginContent />
      </Suspense>
    </LangProvider>
  );
}
