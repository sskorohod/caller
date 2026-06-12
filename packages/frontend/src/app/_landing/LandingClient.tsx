'use client';
import Link from 'next/link';
import { Fragment, useEffect, useRef, useState } from 'react';
import { LangProvider, useLang } from './useLang';

/* ════════════════════════════════════════════════════════════════════
   LingoLine — Live phone translation for expats.
   Dark, app-consistent aesthetic: Manrope + Inter, deep navy, animated
   indigo→purple gradient accents, glass panels, hero glow + float, and a
   signature "live bilingual call transcript" hero. CSS + reveal motion.
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

  // Mobile sticky CTA: appears once the hero scrolls out of view.
  const heroRef = useRef<HTMLElement>(null);
  const [stickyCta, setStickyCta] = useState(false);
  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setStickyCta(!e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="lp">
      <style>{LP_CSS}</style>

      {/* ─── Nav ─────────────────────────────────────────────── */}
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-inner">
          <Link href="/" className="wordmark" aria-label="LingoLine — home">
            <span className="wordmark-badge"><span className="material-symbols-outlined">call</span></span>
            <span className="font-headline">LingoLine</span>
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
      <section className="lp-wrap hero" ref={heroRef}>
        <div className="hero-glow g1" aria-hidden />
        <div className="hero-glow g2" aria-hidden />
        <div className="hero-glow g3" aria-hidden />
        <div className="hero-copy">
          <p className="eyebrow" data-reveal>
            <span className="dot" />{t('Live phone call translation', 'Живой перевод звонков')}
          </p>
          <h1 className="display hero-h" data-reveal style={{ transitionDelay: '60ms' }}>
            {t('Speak freely.', 'Говорите свободно.')}<br />
            <em className="gradient-text">{t('Live lighter.', 'Живите легче.')}</em>
          </h1>
          <p className="lead hero-lead" data-reveal style={{ transitionDelay: '120ms' }}>
            {t(
              'LingoLine translates your phone conversations in real time. No language barrier, no extra effort.',
              'LingoLine переводит ваши телефонные разговоры в реальном времени. Без языкового барьера и лишних усилий.',
            )}
          </p>
          <ul className="hero-feats" data-reveal style={{ transitionDelay: '150ms' }}>
            {[
              { icon: 'graphic_eq', l1: t('Real-time', 'Перевод'), l2: t('translation', 'в реальном времени') },
              { icon: 'sync_alt', l1: t('Two-way', 'Двусторонний'), l2: t('interpretation', 'перевод') },
              { icon: 'record_voice_over', l1: t('Lifelike', 'Голоса'), l2: t('voices', 'как живые') },
            ].map((f, i) => (
              <li key={i}>
                <span className="material-symbols-outlined">{f.icon}</span>
                <span className="hf-text">{f.l1}<br />{f.l2}</span>
              </li>
            ))}
          </ul>
          <div className="hero-cta" data-reveal style={{ transitionDelay: '180ms' }}>
            <Link href={REGISTER} className="btn-accent cta-glow">
              {t('Try for free', 'Попробовать бесплатно')}
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
            <a href="#how" className="btn-ghost">{t('See how it works', 'Как это работает')}</a>
          </div>
          <p className="hero-micro" data-reveal style={{ transitionDelay: '240ms' }}>
            {t('$2 free credit', '$2 в подарок')} <span className="hm-dot">•</span> {t('No card needed', 'Без карты')} <span className="hm-dot">•</span> {t('No subscription', 'Без подписки')}
          </p>
          <div className="hero-proof" data-reveal style={{ transitionDelay: '300ms' }}>
            <div className="hp-avatars" aria-hidden>
              {['A', 'M', 'S', 'K', 'D'].map((ch, i) => <span key={i} className={`hp-ava hp-ava-${i}`}>{ch}</span>)}
            </div>
            <div>
              <div className="hp-stars" aria-hidden>★★★★★</div>
              <div className="hp-label">{t('10,000+ happy users', '10 000+ довольных пользователей')}</div>
            </div>
          </div>
        </div>
        <div className="hero-photo" aria-hidden />

        <div className="hero-visual" data-reveal style={{ transitionDelay: '160ms' }}>
          <div className="tx-float">
            <Transcript lang={lang} t={t} />
          </div>
        </div>
      </section>

      {/* ─── Trust strip ─────────────────────────────────────── */}
      <div className="lp-wrap">
        <ul className="trust">
          {[
            { icon: 'smartphone', l1: t('No app needed —', 'Без приложения —'), l2: t('any phone works', 'с любого телефона') },
            { icon: 'lock', l1: t('Private', 'Конфиденциально'), l2: t('and secure', 'и безопасно') },
            { icon: 'language', l1: t('12 languages', '12 языков'), l2: t('and growing', 'и больше') },
            { icon: 'public', l1: t('Works from', 'Работает из любой'), l2: t('anywhere', 'точки мира') },
          ].map((item, i) => (
            <li key={i}>
              <span className="trust-ic"><span className="material-symbols-outlined">{item.icon}</span></span>
              <span className="trust-tx">{item.l1}<br />{item.l2}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ─── Problem ─────────────────────────────────────────── */}
      <section className="lp-wrap section problem" data-reveal>
        <p className="eyebrow"><span className="dot" />{t('The problem', 'Проблема')}</p>
        <h2 className="display problem-h">{t('You know the feeling.', 'Знакомое чувство.')}</h2>
        <p className="lead problem-lead">
          {t(
            'A call to the doctor. The leasing office. The tax line. You rehearse the words, you dread the moment they start speaking too fast — and you hang up having understood half of it.',
            'Звонок врачу. В офис аренды. На налоговую линию. Вы репетируете фразы и боитесь момента, когда заговорят слишком быстро — и кладёте трубку, поняв половину.',
          )}
        </p>
        <p className="problem-turn">
          {t(
            'LingoLine takes that wall down. You speak your language, they speak theirs, and everyone is understood — live, on the very same call.',
            'LingoLine убирает эту стену. Вы говорите на своём языке, они на своём — и все друг друга понимают, прямо во время звонка.',
          )}
        </p>
      </section>

      {/* ─── How it works ────────────────────────────────────── */}
      <section id="how" className="lp-wrap section">
        <div className="section-head" data-reveal>
          <p className="eyebrow"><span className="dot" />{t('How it works', 'Как это работает')}</p>
          <h2 className="display section-h">{t('Three steps. A minute to set up.', 'Три шага. Минута на настройку.')}</h2>
        </div>
        <div className="how-grid">
          <ol className="steps">
            {[
              {
                n: '01',
                title: t('Call the person as usual', 'Позвоните собеседнику как обычно'),
                body: t('Say “one moment — I’ll add my interpreter.” That’s all the other person needs to know.', 'Скажите «секунду, подключу переводчика» — это всё, что нужно знать собеседнику.'),
              },
              {
                n: '02',
                title: t('Add LingoLine and tap “Merge”', 'Добавьте LingoLine и нажмите «Объединить»'),
                body: t('Tap Add call, dial your LingoLine number, then tap Merge — both buttons are already on your phone’s call screen.', 'Нажмите «Добавить вызов», наберите номер LingoLine и нажмите «Объединить» — эти кнопки уже есть на экране звонка любого телефона.'),
              },
              {
                n: '03',
                title: t('Enjoy the translation', 'Наслаждайтесь переводом'),
                body: t('LingoLine introduces itself and speaks the translation out loud — both directions, language detected automatically.', 'LingoLine представится и будет озвучивать перевод в обе стороны — язык определяется автоматически.'),
              },
            ].map((s, i) => (
              <li key={s.n} className="step glass-panel bento-card" data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
                <span className="step-n display gradient-text">{s.n}</span>
                <div>
                  <h3 className="step-title font-headline">{s.title}</h3>
                  <p className="step-body">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <PhoneMock t={t} />
        </div>
        <div className="step-notes" data-reveal>
          <p className="step-note">
            <span className="material-symbols-outlined">person_add</span>
            {t('One-time prep: after signup, save your personal LingoLine number in contacts as “Translator”.', 'Разовая подготовка: после регистрации сохраните свой номер LingoLine в контактах как «Переводчик».')}
          </p>
          <p className="step-note">
            <span className="material-symbols-outlined">group</span>
            {t('In the same room? Just call LingoLine and put it on speaker.', 'Рядом друг с другом? Просто позвоните LingoLine и включите громкую связь.')}
          </p>
        </div>
      </section>

      {/* ─── Why ─────────────────────────────────────────────── */}
      <section className="lp-wrap section">
        <div className="section-head" data-reveal>
          <p className="eyebrow"><span className="dot" />{t('Why LingoLine', 'Почему LingoLine')}</p>
          <h2 className="display section-h">{t('Accurate, simple, honest', 'Точно, просто, честно')}</h2>
        </div>
        <div className="why">
          {[
            {
              icon: 'verified',
              k: t('Accuracy', 'Точность'),
              title: t('Accurate — and it sounds human', 'Точно — и звучит по-человечески'),
              body: t('Premium AI voices, not robotic text-to-speech. Two-way translation with the language detected automatically — no fiddling with settings mid-call.', 'Премиальные AI-голоса, а не роботный синтез. Двусторонний перевод с авто-определением языка — без настроек посреди разговора.'),
            },
            {
              icon: 'bolt',
              k: t('Simplicity', 'Простота'),
              title: t('Nothing to install', 'Нечего устанавливать'),
              body: t('No app, no headset, no account for the other person. It works on any phone — mobile or landline — because it’s just a phone call.', 'Без приложения, гарнитуры и аккаунта для собеседника. Работает на любом телефоне — мобильном или стационарном — это обычный звонок.'),
            },
            {
              icon: 'savings',
              k: t('Honesty', 'Честность'),
              title: t('Just top up. No subscription.', 'Просто пополняйте. Без подписки.'),
              body: t('Add credit and pay about $0.20 a minute, only while you’re talking. No plans, no monthly fee, no surprises. New accounts start with $2 free.', 'Пополняете баланс и платите около $0.20 за минуту, только во время разговора. Без тарифов и абонплаты. Новым аккаунтам — $2 бесплатно.'),
            },
          ].map((c, i) => (
            <div key={c.k} className="why-col glass-panel bento-card" data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
              <span className="why-icon material-symbols-outlined">{c.icon}</span>
              <p className="eyebrow">{c.k}</p>
              <h3 className="why-h font-headline">{c.title}</h3>
              <p className="why-body">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Greetings marquee ───────────────────────────────── */}
      <GreetingsMarquee />

      {/* ─── Languages ───────────────────────────────────────── */}
      <section className="lp-wrap section section-flush-top">
        <div className="section-head" data-reveal>
          <p className="eyebrow"><span className="dot" />{t('Languages', 'Языки')}</p>
          <h2 className="display section-h">{t('Twelve languages, any direction', 'Двенадцать языков, в любую сторону')}</h2>
        </div>
        <div className="langs" data-reveal>
          {['English', 'Русский', 'Español', 'Deutsch', 'Français', '中文', '日本語', '한국어', 'العربية', 'Português', 'Italiano', 'हिन्दी'].map((l) => (
            <span key={l} className="lang display">{l}</span>
          ))}
        </div>
        <p className="langs-note" data-reveal>
          {t('Direction is detected automatically — just speak, and LingoLine knows which way to translate.', 'Направление определяется автоматически — просто говорите, и LingoLine сам поймёт, куда переводить.')}
        </p>
      </section>

      {/* ─── Pricing ─────────────────────────────────────────── */}
      <section id="pricing" className="lp-wrap section">
        <div className="pricing">
          <div className="pricing-left" data-reveal>
            <p className="eyebrow"><span className="dot" />{t('Pricing', 'Цены')}</p>
            <h2 className="display pricing-h">{t('Pay as you go.', 'Оплата по факту.')}</h2>
            <p className="lead pricing-lead">
              {t('No plans to compare, nothing to cancel. You pay for the minutes you actually talk — and nothing when you don’t.', 'Никаких тарифов для сравнения и ничего не нужно отменять. Платите за минуты, которые реально говорите — и ничего, когда молчите.')}
            </p>
          </div>
          <div className="pricing-card glass-panel" data-reveal>
            <div className="price-row">
              <span className="price display gradient-text">≈&nbsp;$0.20</span>
              <span className="price-unit">{t('/ minute', '/ минута')}</span>
            </div>
            <ul className="price-list">
              {[
                t('$2 free to start — about 10 minutes', '$2 бесплатно на старте — около 10 минут'),
                t('No subscription, ever', 'Никаких подписок'),
                t('Top up any time; only pay while talking', 'Пополняйте когда угодно; платите только во время разговора'),
                t('No card required to try', 'Карта для пробы не нужна'),
              ].map((p, i) => (
                <li key={i}><span className="material-symbols-outlined">check_circle</span>{p}</li>
              ))}
            </ul>
            <Link href={REGISTER} className="btn-accent cta-glow btn-block">
              {t('Start free — $2 on us', 'Начать бесплатно — $2 в подарок')}
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────────────────── */}
      <section id="faq" className="lp-wrap section">
        <div className="section-head" data-reveal>
          <p className="eyebrow"><span className="dot" />{t('Questions', 'Вопросы')}</p>
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
        <div className="final glass-panel" data-reveal>
          <div className="hero-glow g1" aria-hidden />
          <h2 className="display final-h">{t('Make your next call', 'Сделайте следующий звонок')} <em className="gradient-text">{t('without the fear.', 'без страха.')}</em></h2>
          <p className="final-lead">
            {t('Two dollars of free credit is already waiting. No card, no subscription — just try it on a real call.', 'Два доллара бесплатного баланса уже ждут. Без карты и подписки — просто попробуйте на реальном звонке.')}
          </p>
          <Link href={REGISTER} className="btn-accent cta-glow btn-lg">
            {t('Start free — $2 on us', 'Начать бесплатно — $2 в подарок')}
            <span className="material-symbols-outlined">arrow_forward</span>
          </Link>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-wrap footer-inner">
          <div className="footer-brand">
            <Link href="/" className="wordmark">
              <span className="wordmark-badge"><span className="material-symbols-outlined">call</span></span>
              <span className="font-headline">LingoLine</span>
            </Link>
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
          <span>© {new Date().getFullYear()} LingoLine</span>
          <LangToggle />
        </div>
      </footer>

      {/* Mobile sticky CTA — slides in once the hero scrolls away */}
      <div className={`sticky-cta${stickyCta ? ' on' : ''}`} aria-hidden={!stickyCta}>
        <Link href={REGISTER} className="btn-accent cta-glow" tabIndex={stickyCta ? 0 : -1}>
          {t('Start free — $2 on us', 'Начать бесплатно — $2 в подарок')}
          <span className="material-symbols-outlined">arrow_forward</span>
        </Link>
      </div>
    </div>
  );
}

/* ─── Phone-call screen mock (How-it-works visual) ──────────── */
function PhoneMock({ t }: { t: (en: string, ru: string) => string }) {
  const keys = [
    { icon: 'mic_off', label: t('mute', 'звук') },
    { icon: 'dialpad', label: t('keypad', 'клавиши') },
    { icon: 'volume_up', label: t('speaker', 'динамик') },
    { icon: 'add_call', label: t('add call', 'добавить') },
    { icon: 'call_merge', label: t('merge', 'объединить'), merge: true },
    { icon: 'person', label: t('contacts', 'контакты') },
  ];
  return (
    <div className="phone-wrap" data-reveal>
      <div className="phone-mock glass-panel" role="img"
        aria-label={t('Phone call screen with the Merge button highlighted', 'Экран звонка с подсвеченной кнопкой «Объединить»')}>
        <div className="pm-notch" aria-hidden />
        <div className="pm-caller">
          <div className="pm-name font-headline">{t('Leasing office + LingoLine', 'Офис аренды + LingoLine')}</div>
          <div className="pm-status">{t('conference · 01:24', 'конференция · 01:24')}</div>
        </div>
        <div className="pm-grid">
          {keys.map((k, i) => (
            <div key={i} className={`pm-key${k.merge ? ' pm-key--merge' : ''}`}>
              <span className="pm-key-btn"><span className="material-symbols-outlined">{k.icon}</span></span>
              <span className="pm-key-label">{k.label}</span>
            </div>
          ))}
        </div>
        <div className="pm-end" aria-hidden><span className="material-symbols-outlined">call_end</span></div>
      </div>
      <p className="pm-hint">
        <span className="material-symbols-outlined">touch_app</span>
        {t('Tap “Merge” — that’s the whole trick', 'Нажмите «Объединить» — в этом весь фокус')}
      </p>
    </div>
  );
}

/* ─── Live transcript hero visual ───────────────────────────── */
function Wave({ n = 14, active = false }: { n?: number; active?: boolean }) {
  return (
    <span className={`tx-wave${active ? ' active' : ''}`} aria-hidden>
      {Array.from({ length: n }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 5) * 0.12}s` }} />)}
    </span>
  );
}

function Transcript({ lang, t }: { lang: 'en' | 'ru'; t: (en: string, ru: string) => string }) {
  // Believable expat scenario: calling a clinic. Both directions shown.
  const rows = lang === 'ru'
    ? [
        { who: 'КЛИНИКА', tag: 'EN', icon: 'apartment', text: 'Vida Clinic, how can I help you?', tr: false },
        { who: 'ПЕРЕВОД', tag: 'RU', icon: 'language', text: 'Клиника «Вида», чем могу помочь?', tr: true },
        { who: 'ВЫ', tag: 'RU', icon: 'person', text: 'Здравствуйте, хочу записаться на приём.', tr: false },
        { who: 'ПЕРЕВОД', tag: 'EN', icon: 'language', text: 'Hello, I’d like to book an appointment.', tr: true },
      ]
    : [
        { who: 'CLINIC', tag: 'ES', icon: 'apartment', text: 'Clínica Vida, ¿en qué puedo ayudarle?', tr: false },
        { who: 'TRANSLATION', tag: 'EN', icon: 'language', text: 'Vida Clinic, how can I help you?', tr: true },
        { who: 'YOU', tag: 'EN', icon: 'person', text: 'I’d like to book an appointment.', tr: false },
        { who: 'TRANSLATION', tag: 'ES', icon: 'language', text: 'Quisiera reservar una cita.', tr: true },
      ];

  return (
    <div className="tx glass-panel" role="img" aria-label={t('Example of a live translated call', 'Пример звонка с живым переводом')}>
      <div className="tx-head">
        <span className="tx-live"><span className="tx-dot" />{t('Live', 'В эфире')}</span>
        <span className="tx-meta">{t('translating in real time', 'перевод в реальном времени')}</span>
      </div>
      <div className="tx-body">
        {rows.map((r, i) => (
          <div key={i} className={`tx2-row${r.tr ? ' is-tr' : ''}`} style={{ animationDelay: `${0.4 + i * 0.5}s` }}>
            <span className="tx2-ava"><span className="material-symbols-outlined">{r.icon}</span></span>
            <span className="tx2-main">
              <span className="tx2-tag">{r.who} · {r.tag}</span>
              <p className="tx2-text">{r.text}</p>
              <Wave active={r.tr} />
            </span>
            {r.tr && <span className="tx2-call"><span className="material-symbols-outlined">call</span></span>}
          </div>
        ))}
      </div>
      <div className="tx-foot">
        <span className="material-symbols-outlined">graphic_eq</span>
        {t('Two-way translation is on', 'Двусторонний перевод включён')}
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

function GreetingsMarquee() {
  // "Hello" across the 12 supported languages — an animated multilingual band.
  const greetings = ['Hello', 'Hola', 'Привет', '你好', 'مرحبا', 'Bonjour', 'Olá', 'こんにちは', '안녕하세요', 'Hallo', 'Ciao', 'नमस्ते'];
  const loop = [...greetings, ...greetings];
  return (
    <div className="marquee-band" aria-hidden>
      <div className="marquee-row">
        {loop.map((g, i) => <span key={i} className={i % 3 === 0 ? 'accent' : ''}>{g}</span>)}
      </div>
      <div className="marquee-row rev">
        {loop.map((g, i) => <span key={i} className={i % 3 === 1 ? 'accent' : ''}>{g}</span>)}
      </div>
    </div>
  );
}

function FAQ(t: (en: string, ru: string) => string) {
  return [
    { q: t('Do I need to install an app?', 'Нужно ли устанавливать приложение?'), a: t('No. LingoLine is a phone number you merge into a normal call. Nothing to download, and the other person needs nothing at all.', 'Нет. LingoLine — это номер, который вы подключаете в обычный звонок. Ничего скачивать не нужно, а собеседнику — тем более.') },
    { q: t('Which languages are supported?', 'Какие языки поддерживаются?'), a: t('Twelve: English, Russian, Spanish, German, French, Chinese, Japanese, Korean, Arabic, Portuguese, Italian and Hindi — in any direction, detected automatically.', 'Двенадцать: английский, русский, испанский, немецкий, французский, китайский, японский, корейский, арабский, португальский, итальянский и хинди — в любую сторону, с авто-определением.') },
    { q: t('How accurate and natural is it?', 'Насколько это точно и естественно?'), a: t('It uses premium AI voices and translates both sides of the call out loud. Take turns and pause briefly so each phrase can finish — it sounds like a real interpreter, not a robot.', 'Используются премиальные AI-голоса, перевод озвучивается для обеих сторон. Говорите по очереди с короткой паузой, чтобы фраза успевала завершиться — звучит как живой переводчик, а не робот.') },
    { q: t('Is it really no subscription?', 'Правда без подписки?'), a: t('Yes. You top up a balance and pay about $0.20 per minute, only while you’re actually talking. No monthly fee, no commitment. New accounts get $2 free to try.', 'Да. Вы пополняете баланс и платите около $0.20 за минуту, только во время разговора. Без абонплаты и обязательств. Новым аккаунтам — $2 бесплатно на пробу.') },
    { q: t('Does it work on the other person’s landline or mobile?', 'Работает ли с мобильным или стационарным телефоном собеседника?'), a: t('Yes. Because it’s an ordinary phone call, it works whoever you’re calling — a mobile, a landline, a clinic’s switchboard. They just talk normally.', 'Да. Это обычный звонок, поэтому работает с кем угодно — мобильный, стационарный, телефон регистратуры. Собеседник просто говорит как обычно.') },
    { q: t('How do I pay?', 'Как оплачивать?'), a: t('Top up your balance by card through Stripe whenever you like. Usage is deducted per minute. You don’t need a card to create an account and use your free credit.', 'Пополняйте баланс картой через Stripe в любой момент. Списание идёт по минутам. Карта не нужна, чтобы создать аккаунт и потратить бесплатный баланс.') },
  ];
}

/* ─── Scoped styles (dark, app-consistent) ──────────────────── */
const LP_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');

.lp {
  --bg: #0e131f;
  --bg-2: #0a0f1a;
  --ink: #dde2f3;
  --ink-2: #c2c6d6;
  --ink-3: #8b93a7;
  --line: rgba(140,144,159,0.16);
  --line-2: rgba(140,144,159,0.10);
  --accent: #adc6ff;
  --accent-2: #818cf8;
  --grad: linear-gradient(135deg, #adc6ff 0%, #818cf8 50%, #d0bcff 100%);
  --cta: linear-gradient(135deg, #adc6ff 0%, #4d8eff 100%);
  position: relative;
  background: var(--bg);
  color: var(--ink);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  overflow-x: clip;
}
.lp * { box-sizing: border-box; }
.lp .display, .lp .font-headline { font-family: 'Manrope', system-ui, sans-serif; letter-spacing: -0.02em; }
.gradient-text { background: var(--grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; background-size: 200% 200%; animation: gradient-shift 6s ease infinite; }
.glass-panel { background: rgba(26, 32, 44, 0.55); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid var(--line-2); }

.lp-wrap { position: relative; width: 100%; max-width: 1120px; margin: 0 auto; padding-left: 24px; padding-right: 24px; }

/* Nav */
.lp-nav { position: sticky; top: 0; z-index: 50; background: rgba(14,19,31,0.72); backdrop-filter: saturate(140%) blur(12px); border-bottom: 1px solid var(--line-2); }
.lp-nav-inner { display: flex; align-items: center; justify-content: space-between; height: 64px; gap: 24px; }
.wordmark { display: inline-flex; align-items: center; gap: 10px; font-weight: 800; font-size: 18px; letter-spacing: -0.02em; color: var(--ink); text-decoration: none; }
.wordmark-badge { width: 30px; height: 30px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; background: var(--cta); box-shadow: 0 4px 14px rgba(77,142,255,0.3); }
.wordmark-badge .material-symbols-outlined { font-size: 17px; color: #0e131f; font-variation-settings: 'FILL' 1; }
.lp-nav-links { display: flex; gap: 28px; }
.lp-nav-links a { color: var(--ink-2); text-decoration: none; font-size: 14.5px; font-weight: 500; transition: color .18s; }
.lp-nav-links a:hover { color: var(--ink); }
.lp-nav-right { display: flex; align-items: center; gap: 12px; }
.nav-login { color: var(--ink); text-decoration: none; font-size: 14.5px; font-weight: 600; }
.lang-toggle { display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; border-radius: 9px; border: 1px solid var(--line); background: rgba(255,255,255,0.03); color: var(--ink-2); font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all .18s; }
.lang-toggle:hover { border-color: var(--accent); color: var(--ink); }
.lang-toggle .material-symbols-outlined { font-size: 16px; }

/* Buttons */
.btn-accent { display: inline-flex; align-items: center; gap: 8px; background: var(--cta); color: #0e131f; border: none; padding: 13px 22px; border-radius: 12px; font-weight: 700; font-size: 15px; text-decoration: none; transition: transform .18s, box-shadow .25s; }
.btn-accent .material-symbols-outlined { font-size: 19px; transition: transform .18s; }
.btn-accent:hover .material-symbols-outlined { transform: translateX(3px); }
.btn-sm { padding: 9px 15px; font-size: 14px; border-radius: 10px; }
.btn-lg { padding: 16px 30px; font-size: 16.5px; }
.btn-block { width: 100%; justify-content: center; margin-top: 24px; }
.cta-glow { box-shadow: 0 4px 32px rgba(77,142,255,0.3), 0 0 80px rgba(77,142,255,0.08); }
.cta-glow:hover { box-shadow: 0 6px 40px rgba(77,142,255,0.45), 0 0 100px rgba(77,142,255,0.14); transform: translateY(-2px); }
.btn-ghost { display: inline-flex; align-items: center; gap: 8px; color: var(--ink); border: 1px solid var(--line); background: rgba(255,255,255,0.03); padding: 13px 20px; border-radius: 12px; font-weight: 600; font-size: 15px; text-decoration: none; transition: all .18s; }
.btn-ghost:hover { background: rgba(255,255,255,0.06); border-color: var(--accent); }

.eyebrow { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 9px; font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--accent); margin: 0 0 16px; }
.eyebrow .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent-2); box-shadow: 0 0 10px var(--accent-2); }
/* Hero feature row (real-time / two-way / lifelike voices) */
.hero-feats { display: flex; flex-wrap: wrap; gap: 14px 30px; list-style: none; margin: 0 0 30px; padding: 0; }
.hero-feats li { display: inline-flex; align-items: center; gap: 11px; }
.hero-feats .material-symbols-outlined { font-size: 24px; color: var(--accent); }
.hf-text { font-size: 13.5px; font-weight: 600; color: var(--ink-2); line-height: 1.35; }
.hm-dot { color: var(--accent-2); margin: 0 4px; }

/* Hero social proof */
.hero-proof { display: flex; align-items: center; gap: 14px; margin-top: 24px; }
.hp-avatars { display: flex; }
.hp-ava { width: 34px; height: 34px; border-radius: 50%; border: 2px solid var(--bg); display: inline-flex; align-items: center; justify-content: center; font-size: 12.5px; font-weight: 700; color: #0e131f; margin-left: -8px; }
.hp-ava:first-child { margin-left: 0; }
.hp-ava-0 { background: linear-gradient(135deg, #adc6ff, #818cf8); }
.hp-ava-1 { background: linear-gradient(135deg, #99f6e4, #2dd4bf); }
.hp-ava-2 { background: linear-gradient(135deg, #fbcfe8, #f472b6); }
.hp-ava-3 { background: linear-gradient(135deg, #fde68a, #f59e0b); }
.hp-ava-4 { background: linear-gradient(135deg, #d0bcff, #a78bfa); }
.hp-stars { color: #818cf8; font-size: 14px; letter-spacing: 2px; line-height: 1; }
.hp-label { font-size: 13px; color: var(--ink-3); margin-top: 4px; }

/* Hero photo (center, behind content) */
.hero-photo { position: absolute; inset: 0; z-index: 0; pointer-events: none; background-image: url('/landing/hero-photo.jpg'); background-repeat: no-repeat; background-position: center; background-size: cover; opacity: 0.55; -webkit-mask-image: radial-gradient(85% 100% at 50% 50%, #000 55%, transparent 100%); mask-image: radial-gradient(85% 100% at 50% 50%, #000 55%, transparent 100%); }
.lead { color: var(--ink-2); }
.section { padding-top: 88px; }
.section-flush-top { padding-top: 44px; }
.section-head { max-width: 640px; margin-bottom: 44px; }
.section-h { font-size: clamp(28px, 4vw, 42px); line-height: 1.08; margin: 0; }

/* Hero */
.hero { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 56px; align-items: center; padding-top: 80px; padding-bottom: 48px; }
/* Full-bleed hero + trust strip on desktop — stretch to the page width with
   adaptive side padding; copy and transcript drift to the edges, photo centers. */
.lp-wrap.hero, .lp-wrap.lp-nav-inner, .lp-wrap:has(> .trust) { max-width: none; padding-left: clamp(24px, 5vw, 120px); padding-right: clamp(24px, 5vw, 120px); }
@media (min-width: 1180px) {
  .hero { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(56px, 7vw, 170px); }
  .hero-copy { max-width: 600px; }
  .hero-visual { max-width: 580px; justify-self: end; width: 100%; }
}
.hero > *:not(.hero-glow):not(.hero-photo) { position: relative; z-index: 1; }
.hero-glow { position: absolute; border-radius: 50%; filter: blur(90px); pointer-events: none; z-index: 0; }
.hero-glow.g1 { width: 420px; height: 420px; top: -120px; left: -120px; background: radial-gradient(circle, rgba(99,102,241,0.22), transparent 70%); animation: float-slow 9s ease-in-out infinite; }
.hero-glow.g2 { width: 360px; height: 360px; top: -60px; right: -80px; background: radial-gradient(circle, rgba(139,92,246,0.16), transparent 70%); animation: float 8s ease-in-out infinite; }
.hero-glow.g3 { width: 300px; height: 300px; bottom: -120px; left: 30%; background: radial-gradient(circle, rgba(34,211,238,0.10), transparent 70%); animation: float-delayed 10s ease-in-out infinite; }
.hero-h { font-size: clamp(38px, 4.5vw, 58px); line-height: 1.06; margin: 0 0 22px; font-weight: 800; white-space: nowrap; }
@media (max-width: 520px) { .hero-h { white-space: normal; } }
.hero-lead { font-size: clamp(17px, 1.6vw, 19.5px); max-width: 30em; margin: 0 0 30px; }
.hero-cta { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; }
.hero-micro { font-size: 13.5px; color: var(--ink-3); margin: 0; }
.tx-float { animation: float 7s ease-in-out infinite; }

/* Trust */
.trust { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 18px 26px; list-style: none; margin: 34px 0 0; padding: 26px 6px 0; border-top: 1px solid var(--line-2); }
.trust li { display: inline-flex; align-items: center; gap: 12px; }
.trust-ic { width: 42px; height: 42px; border-radius: 13px; display: inline-flex; align-items: center; justify-content: center; background: rgba(173,198,255,0.08); border: 1px solid var(--line-2); flex-shrink: 0; }
.trust-ic .material-symbols-outlined { font-size: 21px; color: var(--accent); }
.trust-tx { font-size: 13.5px; font-weight: 600; color: var(--ink-2); line-height: 1.4; }

/* Transcript */
.tx { border-radius: 18px; padding: 18px; box-shadow: 0 30px 70px -30px rgba(0,0,0,0.6); }
.tx-head { display: flex; align-items: center; justify-content: space-between; padding: 4px 6px 14px; border-bottom: 1px solid var(--line-2); }
.tx-live { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 700; color: var(--accent); letter-spacing: 0.04em; text-transform: uppercase; }
.tx-dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 0 0 rgba(74,222,128,0.5); animation: tx-pulse 1.8s infinite; }
.tx-meta { font-size: 11.5px; color: var(--ink-3); }
.tx-body { display: flex; flex-direction: column; gap: 0; padding: 6px 0 4px; }
.tx2-row { display: flex; align-items: flex-start; gap: 12px; padding: 13px 6px; border-bottom: 1px solid var(--line-2); opacity: 0; animation: tx-in .5s ease forwards; }
.tx2-row:last-child { border-bottom: none; }
.tx2-ava { width: 36px; height: 36px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; background: rgba(173,198,255,0.08); border: 1px solid var(--line-2); flex-shrink: 0; margin-top: 2px; }
.tx2-ava .material-symbols-outlined { font-size: 18px; color: var(--ink-3); }
.tx2-row.is-tr .tx2-ava { background: rgba(129,140,248,0.14); }
.tx2-row.is-tr .tx2-ava .material-symbols-outlined { color: var(--accent); }
.tx2-main { flex: 1; min-width: 0; }
.tx2-tag { font-size: 10.5px; font-weight: 700; letter-spacing: 0.1em; color: var(--ink-3); }
.tx2-text { font-family: 'Manrope', system-ui, sans-serif; font-weight: 600; font-size: 15.5px; line-height: 1.35; color: var(--ink); margin: 4px 0 7px; letter-spacing: -0.01em; }
.tx2-row.is-tr .tx2-text { color: var(--accent); }
.tx2-call { width: 34px; height: 34px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: rgba(173,198,255,0.1); flex-shrink: 0; align-self: center; }
.tx2-call .material-symbols-outlined { font-size: 16px; color: var(--accent); }
.tx-wave { display: flex; align-items: flex-end; gap: 3px; height: 14px; }
.tx-wave i { width: 2.5px; border-radius: 2px; background: rgba(173,198,255,0.45); height: 40%; animation: wave-eq 1.4s ease-in-out infinite; }
.tx-wave i:nth-child(2n) { height: 80%; } .tx-wave i:nth-child(3n) { height: 55%; } .tx-wave i:nth-child(5n) { height: 100%; }
.tx-wave.active i { background: linear-gradient(180deg, #4ade80, #818cf8); }
.tx-foot { display: flex; align-items: center; gap: 8px; padding: 14px 6px 4px; border-top: 1px solid var(--line-2); font-size: 12.5px; color: var(--ink-3); }
.tx-foot .material-symbols-outlined { font-size: 17px; color: var(--accent); }

/* Problem */
.problem { max-width: 800px; }
.problem-h { font-size: clamp(30px, 4.4vw, 48px); line-height: 1.05; margin: 0 0 22px; font-weight: 800; }
.problem-lead { font-size: clamp(18px, 1.8vw, 21px); margin: 0 0 18px; }
.problem-turn { font-size: clamp(18px, 1.8vw, 21px); color: var(--ink); font-weight: 500; margin: 0; }

/* Steps (left column) + phone mock (right column) */
.how-grid { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 36px; align-items: center; }
.steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr; gap: 18px; }
.step { border-radius: 18px; padding: 22px 24px; display: flex; gap: 18px; align-items: flex-start; }
.step-n { display: block; font-size: 30px; line-height: 1.15; font-weight: 800; flex-shrink: 0; }
.step-title { font-size: 18px; font-weight: 700; margin: 0 0 7px; }
.step-body { color: var(--ink-2); font-size: 15px; margin: 0; }
.step-notes { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
.step-note { display: inline-flex; align-items: center; gap: 9px; margin: 0; padding: 12px 18px; background: rgba(173,198,255,0.08); border: 1px solid var(--line-2); border-radius: 12px; color: var(--accent); font-size: 14.5px; font-weight: 500; }
.step-note .material-symbols-outlined { font-size: 19px; }

/* Phone-call screen mock */
.phone-wrap { display: flex; flex-direction: column; align-items: center; gap: 16px; }
.phone-mock { position: relative; width: min(290px, 100%); border-radius: 42px; border: 1px solid var(--line); padding: 26px 20px 24px; box-shadow: 0 40px 90px -30px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05); }
.pm-notch { width: 110px; height: 22px; border-radius: 999px; background: #060a12; margin: -8px auto 18px; }
.pm-caller { text-align: center; margin-bottom: 24px; }
.pm-name { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
.pm-status { font-size: 12.5px; color: var(--ink-3); margin-top: 4px; }
.pm-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px 10px; margin-bottom: 26px; }
.pm-key { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.pm-key-btn { width: 58px; height: 58px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.07); }
.pm-key-btn .material-symbols-outlined { font-size: 24px; color: var(--ink-2); }
.pm-key-label { font-size: 10.5px; color: var(--ink-3); letter-spacing: 0.02em; }
.pm-key--merge .pm-key-btn { background: var(--cta); animation: pm-pulse 2s infinite; }
.pm-key--merge .pm-key-btn .material-symbols-outlined { color: #0e131f; font-variation-settings: 'FILL' 1; }
.pm-key--merge .pm-key-label { color: var(--accent); font-weight: 700; }
.pm-end { width: 58px; height: 58px; border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center; background: #e5484d; }
.pm-end .material-symbols-outlined { font-size: 24px; color: #fff; font-variation-settings: 'FILL' 1; }
.pm-hint { display: inline-flex; align-items: center; gap: 8px; margin: 0; font-size: 13.5px; font-weight: 600; color: var(--accent); }
.pm-hint .material-symbols-outlined { font-size: 18px; }

/* Why */
.why { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
.why-col { border-radius: 18px; padding: 28px 26px; }
.why-icon { font-size: 26px; color: var(--accent); margin-bottom: 16px; display: block; }
.why-h { font-size: 21px; line-height: 1.2; margin: 8px 0 12px; font-weight: 700; }
.why-body { color: var(--ink-2); font-size: 15px; margin: 0; }

/* Greetings marquee */
.marquee-band { margin-top: 80px; padding: 24px 0; border-top: 1px solid var(--line-2); border-bottom: 1px solid var(--line-2); overflow: hidden; -webkit-mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent); mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent); }
.marquee-row { display: flex; gap: 44px; width: max-content; will-change: transform; animation: marquee 42s linear infinite; }
.marquee-row.rev { animation-direction: reverse; animation-duration: 54s; margin-top: 12px; }
.marquee-row span { font-family: 'Manrope', system-ui, sans-serif; font-weight: 700; font-size: clamp(20px, 2.6vw, 30px); letter-spacing: -0.01em; color: var(--ink); opacity: 0.42; }
.marquee-row span.accent { background: var(--grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; opacity: 0.95; }

/* Languages */
.langs { display: flex; flex-wrap: wrap; gap: 10px 30px; }
.lang { font-size: clamp(26px, 3.6vw, 40px); color: var(--ink); line-height: 1.2; font-weight: 700; opacity: .9; transition: color .2s, opacity .2s; }
.lang:nth-child(3n+1) { background: var(--grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; opacity: 1; }
.langs-note { margin-top: 28px; color: var(--ink-2); max-width: 44em; }

/* Pricing */
.pricing { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
.pricing-h { font-size: clamp(30px, 4.4vw, 48px); margin: 0 0 16px; font-weight: 800; }
.pricing-lead { font-size: 17px; max-width: 26em; }
.pricing-card { border-radius: 20px; padding: 34px; box-shadow: 0 24px 60px -30px rgba(0,0,0,0.6); }
.price-row { display: flex; align-items: baseline; gap: 10px; padding-bottom: 20px; border-bottom: 1px solid var(--line-2); }
.price { font-size: 52px; line-height: 1; font-weight: 800; }
.price-unit { font-size: 16px; color: var(--ink-3); font-weight: 500; }
.price-list { list-style: none; margin: 20px 0 0; padding: 0; display: flex; flex-direction: column; gap: 13px; }
.price-list li { display: flex; align-items: flex-start; gap: 10px; font-size: 15px; color: var(--ink-2); }
.price-list .material-symbols-outlined { font-size: 19px; color: var(--accent); flex-shrink: 0; margin-top: 1px; }

/* FAQ */
.faq { border-top: 1px solid var(--line-2); max-width: 800px; }
.faq-item { border-bottom: 1px solid var(--line-2); }
.faq-item summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 2px; font-size: 17px; font-weight: 600; color: var(--ink); cursor: pointer; list-style: none; }
.faq-item summary::-webkit-details-marker { display: none; }
.faq-item summary .material-symbols-outlined { color: var(--accent); transition: transform .25s; font-size: 22px; }
.faq-item[open] summary .material-symbols-outlined { transform: rotate(45deg); }
.faq-item p { margin: 0; padding: 0 2px 22px; color: var(--ink-2); font-size: 15.5px; max-width: 64em; }

/* Final */
.final { position: relative; overflow: hidden; border-radius: 24px; padding: clamp(40px, 6vw, 76px); text-align: center; }
.final .hero-glow { width: 480px; height: 480px; top: -180px; left: 50%; transform: translateX(-50%); background: radial-gradient(circle, rgba(99,102,241,0.25), transparent 70%); }
.final-h { font-size: clamp(30px, 4.6vw, 52px); line-height: 1.05; margin: 0 auto 18px; max-width: 16em; font-weight: 800; }
.final-lead { color: var(--ink-2); font-size: 17px; max-width: 34em; margin: 0 auto 30px; }

/* Footer */
.lp-footer { margin-top: 120px; border-top: 1px solid var(--line-2); padding: 56px 0 30px; background: var(--bg-2); }
.footer-inner { display: flex; justify-content: space-between; gap: 48px; flex-wrap: wrap; }
.footer-brand { max-width: 280px; }
.footer-brand p { color: var(--ink-3); font-size: 14px; margin: 16px 0 0; }
.footer-cols { display: flex; gap: 64px; flex-wrap: wrap; }
.footer-cols h4 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--ink-3); margin: 0 0 14px; font-weight: 700; }
.footer-cols a { display: block; color: var(--ink-2); text-decoration: none; font-size: 14.5px; margin-bottom: 10px; transition: color .18s; }
.footer-cols a:hover { color: var(--accent); }
.footer-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 48px; padding-top: 22px; border-top: 1px solid var(--line-2); color: var(--ink-3); font-size: 13px; }

/* Content is always visible (no opacity-gated entrance) so it can never be
   hidden by paused/throttled animations or a failed observer. */
/* Mobile sticky CTA */
.sticky-cta { position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; display: none; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: linear-gradient(to top, rgba(10,15,26,0.96) 60%, transparent); transform: translateY(110%); transition: transform .35s cubic-bezier(0.16, 1, 0.3, 1); pointer-events: none; }
.sticky-cta.on { transform: none; pointer-events: auto; }
.sticky-cta .btn-accent { width: 100%; justify-content: center; }

@keyframes pm-pulse { 0% { box-shadow: 0 0 0 0 rgba(77,142,255,0.55); } 70% { box-shadow: 0 0 0 14px rgba(77,142,255,0); } 100% { box-shadow: 0 0 0 0 rgba(77,142,255,0); } }
@keyframes wave-eq { 0%, 100% { transform: scaleY(0.55); } 50% { transform: scaleY(1); } }
@keyframes gradient-shift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
@keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
@keyframes float-slow { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-20px) rotate(3deg); } }
@keyframes float-delayed { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes tx-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes tx-pulse { 0% { box-shadow: 0 0 0 0 rgba(74,222,128,0.5); } 70% { box-shadow: 0 0 0 8px rgba(74,222,128,0); } 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0); } }
@keyframes tx-bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }
@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }

@media (max-width: 900px) {
  .hero { grid-template-columns: 1fr; gap: 40px; }
  .hero-photo { display: none; }
  .hero-visual { max-width: 460px; }
  .how-grid { grid-template-columns: 1fr; gap: 32px; }
  .steps, .why { grid-template-columns: 1fr; gap: 16px; }
  .pricing { grid-template-columns: 1fr; gap: 28px; }
  .lp-nav-links { display: none; }
  .section { padding-top: 64px; }
  .marquee-band { margin-top: 56px; }
}
@media (max-width: 700px) {
  .sticky-cta { display: block; }
  .hs-sep { display: none; }
}
@media (max-width: 520px) {
  .lp-wrap { padding-left: 18px; padding-right: 18px; }
  .nav-login { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  [data-reveal], .tx-row, .tx-typing, .tx-float, .hero-glow, .gradient-text, .lang:nth-child(3n+1), .marquee-row { animation: none !important; opacity: 1 !important; transform: none !important; }
  .tx-dot, .pm-key--merge .pm-key-btn { animation: none !important; }
}
`;
