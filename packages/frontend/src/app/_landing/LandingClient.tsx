'use client';
import Link from 'next/link';
import { Fragment, useEffect, useRef, useState } from 'react';
import { LangProvider, useLang } from './useLang';
import { inter, manrope } from '../fonts';
import { landingFaq } from '../_seo/faq';
import './landing.css';

/* ════════════════════════════════════════════════════════════════════
   LingoLine — Live phone translation for expats.
   Dark, app-consistent aesthetic: Manrope + Inter, deep navy, animated
   indigo→purple gradient accents, glass panels, hero glow + float, and a
   signature "live bilingual call transcript" hero. CSS + reveal motion.
   ═══════════════════════════════════════════════════════════════════ */

export default function LandingClient({ initialLang }: { initialLang?: 'en' | 'ru' }) {
  return (
    <LangProvider initialLang={initialLang}>
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

  // Ambient light blobs drift slowly and shift on scroll (subtle parallax).
  const ambientRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        if (ambientRef.current) ambientRef.current.style.transform = `translate3d(0, ${window.scrollY * 0.12}px, 0)`;
        raf = 0;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className={`lp ${inter.variable} ${manrope.variable}`}>
      {/* Ambient drifting light blobs (fixed → parallax, very subtle) */}
      <div className="lp-ambient" ref={ambientRef} aria-hidden>
        <span className="amb a1" />
        <span className="amb a2" />
        <span className="amb a3" />
        <span className="amb a4" />
      </div>

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
              <div className="hp-label">{t('50+ happy clients', '50+ довольных клиентов')}</div>
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
            { icon: 'language', l1: t('13 languages', '13 языков'), l2: t('and growing', 'и больше') },
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
        <div className="problem-photo" role="img" aria-label={t('An older person confused on a phone call', 'Пожилой человек в растерянности во время звонка')} />
        <div className="problem-text">
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
        </div>
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
          <h2 className="display section-h">{t('Thirteen languages, any direction', 'Тринадцать языков, в любую сторону')}</h2>
        </div>
        <div className="langs" data-reveal>
          {['English', 'Русский', 'Українська', 'Español', 'Deutsch', 'Français', '中文', '日本語', '한국어', 'العربية', 'Português', 'Italiano', 'हिन्दी'].map((l) => (
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
      <section id="faq" className="lp-wrap section faq-section">
        <div className="faq-main">
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
        </div>
        <div className="faq-photo" role="img" aria-label={t('A man happily using the translator on his phone', 'Мужчина с радостью пользуется переводчиком на телефоне')} />
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
  // "Hello" across the 13 supported languages — an animated multilingual band.
  const greetings = ['Hello', 'Hola', 'Привет', 'Привіт', '你好', 'مرحبا', 'Bonjour', 'Olá', 'こんにちは', '안녕하세요', 'Hallo', 'Ciao', 'नमस्ते'];
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
  return landingFaq.map((f) => ({ q: t(f.q.en, f.q.ru), a: t(f.a.en, f.a.ru) }));
}

