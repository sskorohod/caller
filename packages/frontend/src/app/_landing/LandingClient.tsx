'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { LangProvider, useLang } from './useLang';

/* ════════════════════════════════════════════════════════════════════
   Caller — Live phone translation for expats.
   Light editorial / "international" aesthetic. Fraunces + Hanken Grotesk,
   warm paper + ink + a single deep-green accent, grain texture, and a
   signature "live bilingual call transcript" hero. CSS-only motion.
   ═══════════════════════════════════════════════════════════════════ */

export default function LandingClient() {
  return (
    <LangProvider>
      <Landing />
    </LangProvider>
  );
}

const REGISTER = '/login?mode=register';

function Landing() {
  const { t, lang } = useLang();

  // Tasteful scroll-reveal (respects reduced-motion). One mechanism, no deps.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const els = Array.from(document.querySelectorAll('[data-reveal]'));
    if (reduce) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  }, []);

  return (
    <div className="lp">
      <style>{LP_CSS}</style>
      <div className="grain" aria-hidden />

      {/* ─── Nav ─────────────────────────────────────────────── */}
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-inner">
          <Link href="/" className="wordmark" aria-label="Caller — home">
            <span className="wordmark-dot" />Caller
          </Link>
          <nav className="lp-nav-links">
            <a href="#how">{t('How it works', 'Как это работает')}</a>
            <a href="#pricing">{t('Pricing', 'Цены')}</a>
            <a href="#faq">{t('FAQ', 'Вопросы')}</a>
          </nav>
          <div className="lp-nav-right">
            <LangToggle />
            <Link href="/login" className="nav-login">{t('Log in', 'Войти')}</Link>
            <Link href={REGISTER} className="btn-accent btn-sm">{t('Start free', 'Начать бесплатно')}</Link>
          </div>
        </div>
      </header>

      {/* ─── Hero ────────────────────────────────────────────── */}
      <section className="lp-wrap hero">
        <div className="hero-copy">
          <p className="eyebrow" data-reveal>{t('Live phone translation for expats', 'Живой перевод звонков для экспатов')}</p>
          <h1 className="display hero-h" data-reveal style={{ transitionDelay: '60ms' }}>
            {t('Make the call.', 'Звоните.')}<br />
            <em>{t('In any language.', 'На любом языке.')}</em>
          </h1>
          <p className="lead hero-lead" data-reveal style={{ transitionDelay: '120ms' }}>
            {t(
              'Caller joins your phone call and interprets both sides in real time — so you can talk to clinics, landlords and government offices without the language barrier, and without clunky apps.',
              'Caller подключается к вашему звонку и переводит обе стороны в реальном времени — говорите с клиниками, арендодателями и госучреждениями без языкового барьера и неудобных приложений.',
            )}
          </p>
          <div className="hero-cta" data-reveal style={{ transitionDelay: '180ms' }}>
            <Link href={REGISTER} className="btn-accent">
              {t('Start free — $2 on us', 'Начать бесплатно — $2 в подарок')}
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
            <a href="#how" className="btn-ghost">{t('See how it works', 'Как это работает')}</a>
          </div>
          <p className="hero-micro" data-reveal style={{ transitionDelay: '240ms' }}>
            {t('No subscription · about $0.20 / minute · works from any phone', 'Без подписки · около $0.20 / мин · с любого телефона')}
          </p>
        </div>

        <div className="hero-visual" data-reveal style={{ transitionDelay: '160ms' }}>
          <Transcript lang={lang} t={t} />
        </div>
      </section>

      {/* ─── Trust strip ─────────────────────────────────────── */}
      <div className="lp-wrap">
        <ul className="trust">
          {[
            t('Any phone', 'Любой телефон'),
            t('No app to install', 'Без приложения'),
            t('12 languages', '12 языков'),
            t('Pay per minute', 'Оплата за минуты'),
            t('$2 free to try', '$2 бесплатно на пробу'),
          ].map((item, i) => (
            <li key={i}><span className="material-symbols-outlined">check</span>{item}</li>
          ))}
        </ul>
      </div>

      {/* ─── Problem ─────────────────────────────────────────── */}
      <section className="lp-wrap section problem" data-reveal>
        <p className="eyebrow">{t('The problem', 'Проблема')}</p>
        <h2 className="display problem-h">{t('You know the feeling.', 'Знакомое чувство.')}</h2>
        <p className="lead problem-lead">
          {t(
            'A call to the doctor. The leasing office. The tax line. You rehearse the words, you dread the moment they start speaking too fast — and you hang up having understood half of it.',
            'Звонок врачу. В офис аренды. На налоговую линию. Вы репетируете фразы и боитесь момента, когда заговорят слишком быстро — и кладёте трубку, поняв половину.',
          )}
        </p>
        <p className="problem-turn">
          {t(
            'Caller takes that wall down. You speak your language, they speak theirs, and everyone is understood — live, on the very same call.',
            'Caller убирает эту стену. Вы говорите на своём языке, они на своём — и все друг друга понимают, прямо во время звонка.',
          )}
        </p>
      </section>

      {/* ─── How it works ────────────────────────────────────── */}
      <section id="how" className="lp-wrap section">
        <div className="section-head" data-reveal>
          <p className="eyebrow">{t('How it works', 'Как это работает')}</p>
          <h2 className="display section-h">{t('Three steps. A minute to set up.', 'Три шага. Минута на настройку.')}</h2>
        </div>
        <ol className="steps">
          {[
            {
              n: '01',
              title: t('Save your Caller number', 'Сохраните номер Caller'),
              body: t('After signup you get a personal number. Save it in your contacts as “Translator”.', 'После регистрации вы получаете персональный номер. Сохраните его в контактах как «Переводчик».'),
            },
            {
              n: '02',
              title: t('On the call, add it and merge', 'Во время звонка добавьте и объедините'),
              body: t('Call the person as usual. Say “one moment, I’ll add an interpreter,” tap Add call, dial Caller, then tap Merge.', 'Позвоните человеку как обычно. Скажите «секунду, добавлю переводчика», нажмите «Добавить вызов», наберите Caller и нажмите «Объединить».'),
            },
            {
              n: '03',
              title: t('Speak naturally', 'Говорите естественно'),
              body: t('Take turns and pause briefly. Caller speaks the translation out loud — both directions, detected automatically.', 'Говорите по очереди с короткой паузой. Caller озвучивает перевод в обе стороны, направление определяется само.'),
            },
          ].map((s, i) => (
            <li key={s.n} className="step" data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
              <span className="step-n display">{s.n}</span>
              <h3 className="step-title">{s.title}</h3>
              <p className="step-body">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="step-note" data-reveal>
          <span className="material-symbols-outlined">group</span>
          {t('In the same room? Just call Caller and put it on speaker.', 'Рядом друг с другом? Просто позвоните Caller и включите громкую связь.')}
        </p>
      </section>

      {/* ─── Why ─────────────────────────────────────────────── */}
      <section className="lp-wrap section">
        <div className="rule" />
        <div className="why">
          {[
            {
              k: t('Accuracy', 'Точность'),
              title: t('Accurate — and it sounds human', 'Точно — и звучит по-человечески'),
              body: t('Premium AI voices, not robotic text-to-speech. Two-way translation with the language detected automatically — no fiddling with settings mid-call.', 'Премиальные AI-голоса, а не роботный синтез. Двусторонний перевод с авто-определением языка — без настроек посреди разговора.'),
            },
            {
              k: t('Simplicity', 'Простота'),
              title: t('Nothing to install', 'Нечего устанавливать'),
              body: t('No app, no headset, no account for the other person. It works on any phone — mobile or landline — because it’s just a phone call.', 'Без приложения, гарнитуры и аккаунта для собеседника. Работает на любом телефоне — мобильном или стационарном — это обычный звонок.'),
            },
            {
              k: t('Honesty', 'Честность'),
              title: t('Just top up. No subscription.', 'Просто пополняйте. Без подписки.'),
              body: t('Add credit and pay about $0.20 a minute, only while you’re talking. No plans, no monthly fee, no surprises. New accounts start with $2 free.', 'Пополняете баланс и платите около $0.20 за минуту, только во время разговора. Без тарифов и абонплаты. Новым аккаунтам — $2 бесплатно.'),
            },
          ].map((c, i) => (
            <div key={c.k} className="why-col" data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
              <p className="eyebrow">{c.k}</p>
              <h3 className="display why-h">{c.title}</h3>
              <p className="why-body">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Languages ───────────────────────────────────────── */}
      <section className="lp-wrap section">
        <div className="section-head" data-reveal>
          <p className="eyebrow">{t('Languages', 'Языки')}</p>
          <h2 className="display section-h">{t('Twelve languages, any direction', 'Двенадцать языков, в любую сторону')}</h2>
        </div>
        <div className="langs" data-reveal>
          {['English', 'Русский', 'Español', 'Deutsch', 'Français', '中文', '日本語', '한국어', 'العربية', 'Português', 'Italiano', 'हिन्दी'].map((l) => (
            <span key={l} className="lang display">{l}</span>
          ))}
        </div>
        <p className="langs-note" data-reveal>
          {t('Direction is detected automatically — just speak, and Caller knows which way to translate.', 'Направление определяется автоматически — просто говорите, и Caller сам поймёт, куда переводить.')}
        </p>
      </section>

      {/* ─── Pricing ─────────────────────────────────────────── */}
      <section id="pricing" className="lp-wrap section">
        <div className="rule" />
        <div className="pricing" data-reveal>
          <div className="pricing-left">
            <p className="eyebrow">{t('Pricing', 'Цены')}</p>
            <h2 className="display pricing-h">{t('Pay as you go.', 'Оплата по факту.')}</h2>
            <p className="lead pricing-lead">
              {t('No plans to compare, nothing to cancel. You pay for the minutes you actually talk — and nothing when you don’t.', 'Никаких тарифов для сравнения и ничего не нужно отменять. Платите за минуты, которые реально говорите — и ничего, когда молчите.')}
            </p>
          </div>
          <div className="pricing-card">
            <div className="price-row">
              <span className="price display">≈&nbsp;$0.20</span>
              <span className="price-unit">{t('/ minute', '/ минута')}</span>
            </div>
            <ul className="price-list">
              {[
                t('$2 free to start — about 10 minutes', '$2 бесплатно на старте — около 10 минут'),
                t('No subscription, ever', 'Никаких подписок'),
                t('Top up any time; only pay while talking', 'Пополняйте когда угодно; платите только во время разговора'),
                t('No card required to try', 'Карта для пробы не нужна'),
              ].map((p, i) => (
                <li key={i}><span className="material-symbols-outlined">check</span>{p}</li>
              ))}
            </ul>
            <Link href={REGISTER} className="btn-accent btn-block">
              {t('Start free — $2 on us', 'Начать бесплатно — $2 в подарок')}
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────────────────── */}
      <section id="faq" className="lp-wrap section">
        <div className="section-head" data-reveal>
          <p className="eyebrow">{t('Questions', 'Вопросы')}</p>
          <h2 className="display section-h">{t('Good to know', 'Полезно знать')}</h2>
        </div>
        <div className="faq" data-reveal>
          {FAQ(t).map((f, i) => (
            <details key={i} className="faq-item">
              <summary>{f.q}<span className="material-symbols-outlined">add</span></summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ─── Final CTA ───────────────────────────────────────── */}
      <section className="lp-wrap section">
        <div className="final" data-reveal>
          <h2 className="display final-h">{t('Make your next call without the fear.', 'Сделайте следующий звонок без страха.')}</h2>
          <p className="final-lead">
            {t('Two dollars of free credit is already waiting. No card, no subscription — just try it on a real call.', 'Два доллара бесплатного баланса уже ждут. Без карты и подписки — просто попробуйте на реальном звонке.')}
          </p>
          <Link href={REGISTER} className="btn-accent btn-lg">
            {t('Start free — $2 on us', 'Начать бесплатно — $2 в подарок')}
            <span className="material-symbols-outlined">arrow_forward</span>
          </Link>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-wrap footer-inner">
          <div className="footer-brand">
            <Link href="/" className="wordmark"><span className="wordmark-dot" />Caller</Link>
            <p>{t('Live phone interpretation for people living between languages.', 'Живой перевод звонков для тех, кто живёт между языками.')}</p>
          </div>
          <div className="footer-cols">
            <div>
              <h4>{t('Product', 'Продукт')}</h4>
              <a href="#how">{t('How it works', 'Как это работает')}</a>
              <a href="#pricing">{t('Pricing', 'Цены')}</a>
              <a href="#faq">{t('FAQ', 'Вопросы')}</a>
              <Link href="/login">{t('Log in', 'Войти')}</Link>
            </div>
            <div>
              <h4>{t('Legal', 'Правовое')}</h4>
              <Link href="/privacy">{t('Privacy', 'Конфиденциальность')}</Link>
              <Link href="/terms">{t('Terms', 'Условия')}</Link>
              <Link href="/acceptable-use">{t('Acceptable Use', 'Допустимое использование')}</Link>
            </div>
          </div>
        </div>
        <div className="lp-wrap footer-bottom">
          <span>© {new Date().getFullYear()} Caller</span>
          <LangToggle />
        </div>
      </footer>
    </div>
  );
}

/* ─── Live transcript hero visual ───────────────────────────── */
function Transcript({ lang, t }: { lang: 'en' | 'ru'; t: (en: string, ru: string) => string }) {
  // Believable expat scenario: calling a clinic. Localized speaker side.
  const rows = lang === 'ru'
    ? [
        { who: 'Clinic', sideClass: 'them', src: 'Vida Clinic, how can I help you?', dst: 'Клиника «Вида», чем могу помочь?' },
        { who: t('You', 'Вы'), sideClass: 'you', src: 'Здравствуйте, хочу записаться на приём.', dst: 'Hello, I’d like to book an appointment.' },
        { who: 'Clinic', sideClass: 'them', src: 'Of course — what day works for you?', dst: 'Конечно — какой день вам удобен?' },
      ]
    : [
        { who: 'Clínica', sideClass: 'them', src: 'Clínica Vida, ¿en qué puedo ayudarle?', dst: 'Vida Clinic, how can I help you?' },
        { who: t('You', 'Вы'), sideClass: 'you', src: 'Hello, I’d like to book an appointment.', dst: 'Hola, quisiera reservar una cita.' },
        { who: 'Clínica', sideClass: 'them', src: '¿Para qué día le viene bien?', dst: 'What day works for you?' },
      ];

  return (
    <div className="tx" role="img" aria-label={t('Example of a live translated call', 'Пример звонка с живым переводом')}>
      <div className="tx-head">
        <span className="tx-live"><span className="tx-dot" />{t('Live', 'В эфире')}</span>
        <span className="tx-meta">{t('auto-detected · both ways', 'авто-определение · в обе стороны')}</span>
      </div>
      <div className="tx-body">
        {rows.map((r, i) => (
          <div key={i} className={`tx-row ${r.sideClass}`} style={{ animationDelay: `${0.5 + i * 0.55}s` }}>
            <span className="tx-who">{r.who}</span>
            <p className="tx-dst">{r.dst}</p>
            <p className="tx-src">“{r.src}”</p>
          </div>
        ))}
        <div className="tx-typing" style={{ animationDelay: `${0.5 + rows.length * 0.55}s` }}>
          <span /><span /><span />
        </div>
      </div>
      <div className="tx-foot">
        <span className="material-symbols-outlined">graphic_eq</span>
        {t('Translating in real time', 'Перевод в реальном времени')}
      </div>
    </div>
  );
}

function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <button className="lang-toggle" onClick={() => setLang(lang === 'en' ? 'ru' : 'en')}
      title={lang === 'en' ? 'Переключить на русский' : 'Switch to English'}>
      <span className="material-symbols-outlined">language</span>{lang === 'en' ? 'RU' : 'EN'}
    </button>
  );
}

function FAQ(t: (en: string, ru: string) => string) {
  return [
    { q: t('Do I need to install an app?', 'Нужно ли устанавливать приложение?'), a: t('No. Caller is a phone number you merge into a normal call. Nothing to download, and the other person needs nothing at all.', 'Нет. Caller — это номер, который вы подключаете в обычный звонок. Ничего скачивать не нужно, а собеседнику — тем более.') },
    { q: t('Which languages are supported?', 'Какие языки поддерживаются?'), a: t('Twelve: English, Russian, Spanish, German, French, Chinese, Japanese, Korean, Arabic, Portuguese, Italian and Hindi — in any direction, detected automatically.', 'Двенадцать: английский, русский, испанский, немецкий, французский, китайский, японский, корейский, арабский, португальский, итальянский и хинди — в любую сторону, с авто-определением.') },
    { q: t('How accurate and natural is it?', 'Насколько это точно и естественно?'), a: t('It uses premium AI voices and translates both sides of the call out loud. Take turns and pause briefly so each phrase can finish — it sounds like a real interpreter, not a robot.', 'Используются премиальные AI-голоса, перевод озвучивается для обеих сторон. Говорите по очереди с короткой паузой, чтобы фраза успевала завершиться — звучит как живой переводчик, а не робот.') },
    { q: t('Is it really no subscription?', 'Правда без подписки?'), a: t('Yes. You top up a balance and pay about $0.20 per minute, only while you’re actually talking. No monthly fee, no commitment. New accounts get $2 free to try.', 'Да. Вы пополняете баланс и платите около $0.20 за минуту, только во время разговора. Без абонплаты и обязательств. Новым аккаунтам — $2 бесплатно на пробу.') },
    { q: t('Does it work on the other person’s landline or mobile?', 'Работает ли с мобильным или стационарным телефоном собеседника?'), a: t('Yes. Because it’s an ordinary phone call, it works whoever you’re calling — a mobile, a landline, a clinic’s switchboard. They just talk normally.', 'Да. Это обычный звонок, поэтому работает с кем угодно — мобильный, стационарный, телефон регистратуры. Собеседник просто говорит как обычно.') },
    { q: t('How do I pay?', 'Как оплачивать?'), a: t('Top up your balance by card through Stripe whenever you like. Usage is deducted per minute. You don’t need a card to create an account and use your free credit.', 'Пополняйте баланс картой через Stripe в любой момент. Списание идёт по минутам. Карта не нужна, чтобы создать аккаунт и потратить бесплатный баланс.') },
  ];
}

/* ─── Scoped styles ─────────────────────────────────────────── */
const LP_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..560&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');

.lp {
  --paper: #f4f1ea;
  --paper-2: #efeae0;
  --card: #fbfaf6;
  --ink: #1b1a17;
  --ink-2: #4a463e;
  --ink-3: #6b6459;
  --line: #e2dccf;
  --line-2: rgba(27,26,23,0.10);
  --accent: #1f5d4c;
  --accent-hover: #174a3c;
  --accent-soft: rgba(31,93,76,0.08);
  --clay: #b34a2b;
  position: relative;
  background: var(--paper);
  color: var(--ink);
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  overflow-x: clip;
}
.lp * { box-sizing: border-box; }
.lp .display { font-family: 'Fraunces', Georgia, serif; font-weight: 540; letter-spacing: -0.012em; }
.lp em { font-style: italic; color: var(--accent); }

.grain {
  position: fixed; inset: 0; z-index: 0; pointer-events: none; opacity: 0.5;
  mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.045'/%3E%3C/svg%3E");
}
.lp > *:not(.grain) { position: relative; z-index: 1; }

.lp-wrap { width: 100%; max-width: 1120px; margin: 0 auto; padding-left: 24px; padding-right: 24px; }

/* Nav */
.lp-nav { position: sticky; top: 0; z-index: 50; background: rgba(244,241,234,0.82); backdrop-filter: saturate(140%) blur(10px); border-bottom: 1px solid var(--line-2); }
.lp-nav-inner { display: flex; align-items: center; justify-content: space-between; height: 64px; gap: 24px; }
.wordmark { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 18px; letter-spacing: -0.02em; color: var(--ink); text-decoration: none; }
.wordmark-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); display: inline-block; }
.lp-nav-links { display: flex; gap: 28px; }
.lp-nav-links a { color: var(--ink-2); text-decoration: none; font-size: 14.5px; font-weight: 500; transition: color .18s; }
.lp-nav-links a:hover { color: var(--ink); }
.lp-nav-right { display: flex; align-items: center; gap: 12px; }
.nav-login { color: var(--ink); text-decoration: none; font-size: 14.5px; font-weight: 600; }
.lang-toggle { display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; border-radius: 9px; border: 1px solid var(--line); background: var(--card); color: var(--ink-2); font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all .18s; }
.lang-toggle:hover { border-color: var(--ink-3); color: var(--ink); }
.lang-toggle .material-symbols-outlined { font-size: 16px; }

/* Buttons */
.btn-accent { display: inline-flex; align-items: center; gap: 8px; background: var(--accent); color: #fbfaf6; border: 1px solid var(--accent); padding: 13px 22px; border-radius: 11px; font-weight: 600; font-size: 15px; text-decoration: none; transition: transform .15s, background .18s, box-shadow .18s; box-shadow: 0 1px 0 rgba(0,0,0,0.04); }
.btn-accent:hover { background: var(--accent-hover); transform: translateY(-1px); box-shadow: 0 8px 22px rgba(31,93,76,0.22); }
.btn-accent .material-symbols-outlined { font-size: 19px; transition: transform .18s; }
.btn-accent:hover .material-symbols-outlined { transform: translateX(3px); }
.btn-sm { padding: 9px 15px; font-size: 14px; border-radius: 10px; }
.btn-lg { padding: 16px 28px; font-size: 16.5px; }
.btn-block { width: 100%; justify-content: center; margin-top: 22px; }
.btn-ghost { display: inline-flex; align-items: center; gap: 8px; color: var(--ink); border: 1px solid var(--line); background: transparent; padding: 13px 20px; border-radius: 11px; font-weight: 600; font-size: 15px; text-decoration: none; transition: all .18s; }
.btn-ghost:hover { background: var(--card); border-color: var(--ink-3); }

.eyebrow { font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--accent); margin: 0 0 14px; }
.lead { color: var(--ink-2); }
.rule { height: 1px; background: var(--line); margin: 0 0 56px; }
.section { padding-top: 96px; }
.section-head { max-width: 640px; margin-bottom: 44px; }
.section-h { font-size: clamp(28px, 4vw, 40px); line-height: 1.08; margin: 0; }

/* Hero */
.hero { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 56px; align-items: center; padding-top: 72px; padding-bottom: 40px; }
.hero-h { font-size: clamp(44px, 7vw, 78px); line-height: 0.98; margin: 0 0 22px; letter-spacing: -0.02em; }
.hero-lead { font-size: clamp(17px, 1.6vw, 19.5px); max-width: 30em; margin: 0 0 30px; }
.hero-cta { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; }
.hero-micro { font-size: 13.5px; color: var(--ink-3); margin: 0; }

/* Trust */
.trust { display: flex; flex-wrap: wrap; gap: 10px 26px; list-style: none; margin: 28px 0 0; padding: 22px 0 0; border-top: 1px solid var(--line-2); }
.trust li { display: inline-flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 500; color: var(--ink-2); }
.trust .material-symbols-outlined { font-size: 17px; color: var(--accent); }

/* Transcript */
.tx { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 18px; box-shadow: 0 1px 2px rgba(27,26,23,0.04), 0 30px 60px -28px rgba(27,26,23,0.28); transform: rotate(-0.6deg); }
.tx-head { display: flex; align-items: center; justify-content: space-between; padding: 4px 6px 14px; border-bottom: 1px solid var(--line-2); }
.tx-live { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 700; color: var(--accent); letter-spacing: 0.04em; text-transform: uppercase; }
.tx-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 0 rgba(31,93,76,0.5); animation: tx-pulse 1.8s infinite; }
.tx-meta { font-size: 11.5px; color: var(--ink-3); }
.tx-body { display: flex; flex-direction: column; gap: 16px; padding: 18px 6px 8px; min-height: 230px; }
.tx-row { opacity: 0; animation: tx-in .5s ease forwards; max-width: 86%; }
.tx-row.you { align-self: flex-end; text-align: right; }
.tx-who { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-3); }
.tx-dst { font-family: 'Fraunces', Georgia, serif; font-weight: 500; font-size: 18px; line-height: 1.3; color: var(--ink); margin: 4px 0 2px; }
.tx-row.them .tx-dst { color: var(--accent); }
.tx-src { font-size: 12.5px; color: var(--ink-3); margin: 0; font-style: italic; }
.tx-typing { display: inline-flex; gap: 5px; padding: 6px 4px; opacity: 0; animation: tx-in .4s ease forwards; }
.tx-typing span { width: 7px; height: 7px; border-radius: 50%; background: var(--ink-3); opacity: .5; animation: tx-bounce 1.2s infinite; }
.tx-typing span:nth-child(2) { animation-delay: .15s; } .tx-typing span:nth-child(3) { animation-delay: .3s; }
.tx-foot { display: flex; align-items: center; gap: 8px; padding: 14px 6px 4px; border-top: 1px solid var(--line-2); font-size: 12.5px; color: var(--ink-3); }
.tx-foot .material-symbols-outlined { font-size: 17px; color: var(--accent); }
@keyframes tx-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes tx-pulse { 0% { box-shadow: 0 0 0 0 rgba(31,93,76,0.45); } 70% { box-shadow: 0 0 0 8px rgba(31,93,76,0); } 100% { box-shadow: 0 0 0 0 rgba(31,93,76,0); } }
@keyframes tx-bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }

/* Problem */
.problem { max-width: 760px; }
.problem-h { font-size: clamp(30px, 4.4vw, 46px); line-height: 1.05; margin: 0 0 22px; }
.problem-lead { font-size: clamp(18px, 1.8vw, 21px); margin: 0 0 18px; }
.problem-turn { font-size: clamp(18px, 1.8vw, 21px); color: var(--ink); font-weight: 500; margin: 0; }

/* Steps */
.steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
.step { border-top: 2px solid var(--ink); padding-top: 18px; }
.step-n { display: block; font-size: 40px; color: var(--accent); line-height: 1; margin-bottom: 14px; }
.step-title { font-size: 19px; font-weight: 700; margin: 0 0 8px; letter-spacing: -0.01em; }
.step-body { color: var(--ink-2); font-size: 15px; margin: 0; }
.step-note { display: inline-flex; align-items: center; gap: 9px; margin-top: 36px; padding: 12px 18px; background: var(--accent-soft); border-radius: 11px; color: var(--accent); font-size: 14.5px; font-weight: 500; }
.step-note .material-symbols-outlined { font-size: 19px; }

/* Why */
.why { display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; }
.why-h { font-size: 22px; line-height: 1.18; margin: 0 0 12px; }
.why-body { color: var(--ink-2); font-size: 15px; margin: 0; }

/* Languages */
.langs { display: flex; flex-wrap: wrap; gap: 10px 30px; }
.lang { font-size: clamp(26px, 3.6vw, 40px); color: var(--ink); line-height: 1.2; }
.lang:nth-child(3n+1) { color: var(--accent); }
.langs-note { margin-top: 28px; color: var(--ink-2); max-width: 44em; }

/* Pricing */
.pricing { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
.pricing-h { font-size: clamp(30px, 4.4vw, 46px); margin: 0 0 16px; }
.pricing-lead { font-size: 17px; max-width: 26em; }
.pricing-card { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 32px; box-shadow: 0 1px 2px rgba(27,26,23,0.04), 0 24px 50px -30px rgba(27,26,23,0.25); }
.price-row { display: flex; align-items: baseline; gap: 10px; padding-bottom: 20px; border-bottom: 1px solid var(--line-2); }
.price { font-size: 52px; line-height: 1; color: var(--ink); }
.price-unit { font-size: 16px; color: var(--ink-3); font-weight: 500; }
.price-list { list-style: none; margin: 20px 0 0; padding: 0; display: flex; flex-direction: column; gap: 13px; }
.price-list li { display: flex; align-items: flex-start; gap: 10px; font-size: 15px; color: var(--ink-2); }
.price-list .material-symbols-outlined { font-size: 19px; color: var(--accent); flex-shrink: 0; margin-top: 1px; }

/* FAQ */
.faq { border-top: 1px solid var(--line); max-width: 800px; }
.faq-item { border-bottom: 1px solid var(--line); }
.faq-item summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 2px; font-size: 17px; font-weight: 600; color: var(--ink); cursor: pointer; list-style: none; }
.faq-item summary::-webkit-details-marker { display: none; }
.faq-item summary .material-symbols-outlined { color: var(--accent); transition: transform .25s; font-size: 22px; }
.faq-item[open] summary .material-symbols-outlined { transform: rotate(45deg); }
.faq-item p { margin: 0; padding: 0 2px 22px; color: var(--ink-2); font-size: 15.5px; max-width: 64em; }

/* Final */
.final { background: var(--ink); color: var(--paper); border-radius: 24px; padding: clamp(40px, 6vw, 72px); text-align: center; }
.final-h { font-size: clamp(30px, 4.6vw, 50px); line-height: 1.05; margin: 0 auto 18px; max-width: 16em; color: var(--paper); }
.final-lead { color: rgba(244,241,234,0.72); font-size: 17px; max-width: 34em; margin: 0 auto 30px; }
.final .btn-accent { background: var(--paper); color: var(--ink); border-color: var(--paper); }
.final .btn-accent:hover { background: #fff; box-shadow: 0 10px 26px rgba(0,0,0,0.3); }

/* Footer */
.lp-footer { margin-top: 110px; border-top: 1px solid var(--line); padding: 56px 0 30px; }
.footer-inner { display: flex; justify-content: space-between; gap: 48px; flex-wrap: wrap; }
.footer-brand { max-width: 280px; }
.footer-brand p { color: var(--ink-3); font-size: 14px; margin: 14px 0 0; }
.footer-cols { display: flex; gap: 64px; flex-wrap: wrap; }
.footer-cols h4 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--ink-3); margin: 0 0 14px; font-weight: 700; }
.footer-cols a { display: block; color: var(--ink-2); text-decoration: none; font-size: 14.5px; margin-bottom: 10px; transition: color .18s; }
.footer-cols a:hover { color: var(--accent); }
.footer-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 48px; padding-top: 22px; border-top: 1px solid var(--line-2); color: var(--ink-3); font-size: 13px; }

/* Reveal */
[data-reveal] { opacity: 0; transform: translateY(16px); transition: opacity .7s cubic-bezier(.2,.7,.2,1), transform .7s cubic-bezier(.2,.7,.2,1); }
[data-reveal].in { opacity: 1; transform: none; }

@media (max-width: 900px) {
  .hero { grid-template-columns: 1fr; gap: 40px; }
  .hero-visual { max-width: 460px; }
  .steps, .why { grid-template-columns: 1fr; gap: 30px; }
  .pricing { grid-template-columns: 1fr; gap: 28px; }
  .lp-nav-links { display: none; }
  .section { padding-top: 72px; }
}
@media (max-width: 520px) {
  .lp-wrap { padding-left: 18px; padding-right: 18px; }
  .nav-login { display: none; }
  .tx { transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  [data-reveal], .tx-row, .tx-typing { animation: none !important; transition: none !important; opacity: 1 !important; transform: none !important; }
  .tx-dot { animation: none !important; }
}
`;
