'use client';
import { useLang } from '@/app/_landing/useLang';

export default function LanguageLineAlternative() {
  const { t } = useLang();
  return (
    <>
      <p>
        {t(
          'If you\'ve ever used LanguageLine Solutions for over-the-phone interpretation, you know the drill: enterprise contracts, per-minute rates of $2–5/min, and a setup process designed for hospitals and government agencies — not regular people who just need help with a phone call.',
          'Если вы когда-нибудь пользовались LanguageLine Solutions для телефонного перевода, вы знаете: корпоративные контракты, тарифы $2–5/мин, и процесс подключения, рассчитанный на больницы и госучреждения — а не на обычных людей, которым просто нужна помощь со звонком.'
        )}
      </p>
      <p>
        {t(
          'In 2026, AI-powered phone translation has changed the game. You can now get real-time phone translation for $0.15/min — no app, no contract, any phone. Here\'s how the alternatives stack up.',
          'В 2026 году AI-перевод звонков изменил правила игры. Теперь можно получить перевод в реальном времени за $0.15/мин — без приложений, без контрактов, с любого телефона. Вот как выглядят альтернативы.'
        )}
      </p>

      <h2>{t('Why People Look for LanguageLine Alternatives', 'Почему ищут альтернативы LanguageLine')}</h2>
      <p>{t(
        'LanguageLine is the industry standard for over-the-phone interpretation (OPI). They support 240+ languages with human interpreters and serve major healthcare systems, courts, and government agencies. But for individuals and small businesses, LanguageLine has significant drawbacks:',
        'LanguageLine — отраслевой стандарт телефонного перевода (OPI). Они поддерживают 240+ языков с живыми переводчиками и обслуживают крупные медицинские системы, суды и госорганы. Но для частных лиц и малого бизнеса у LanguageLine есть серьёзные минусы:'
      )}</p>
      <ul>
        <li><strong>{t('High cost', 'Высокая стоимость')}</strong>: {t('$2–5 per minute, with minimum commitments', '$2–5 за минуту, с минимальными обязательствами')}</li>
        <li><strong>{t('Enterprise-only', 'Только для бизнеса')}</strong>: {t('Requires a business account and contract', 'Требует бизнес-аккаунт и контракт')}</li>
        <li><strong>{t('No self-service', 'Нет самообслуживания')}</strong>: {t('You can\'t just sign up and start calling', 'Нельзя просто зарегистрироваться и начать звонить')}</li>
        <li><strong>{t('Wait times', 'Время ожидания')}</strong>: {t('Connection to an interpreter can take 30–60 seconds', 'Подключение к переводчику может занять 30–60 секунд')}</li>
        <li><strong>{t('Business hours bias', 'Ограниченные часы работы')}</strong>: {t('Some language pairs have limited availability', 'Некоторые языковые пары доступны не всегда')}</li>
      </ul>

      <h2>{t('Top LanguageLine Alternatives Compared', 'Сравнение лучших альтернатив LanguageLine')}</h2>
      <table>
        <thead>
          <tr>
            <th>{t('Service', 'Сервис')}</th>
            <th>{t('Price', 'Цена')}</th>
            <th>{t('How It Works', 'Как работает')}</th>
            <th>{t('Languages', 'Языки')}</th>
            <th>{t('App Required?', 'Нужно приложение?')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Live Translator</strong></td>
            <td>$0.15/{t('min', 'мин')}</td>
            <td>{t('Merge a number into any call', 'Добавьте номер в любой звонок')}</td>
            <td>15+</td>
            <td>{t('No', 'Нет')}</td>
          </tr>
          <tr>
            <td><strong>LanguageLine</strong></td>
            <td>$2–5/{t('min', 'мин')}</td>
            <td>{t('Human interpreters, enterprise', 'Живые переводчики, корпоративный')}</td>
            <td>240+</td>
            <td>{t('No (but contract)', 'Нет (но контракт)')}</td>
          </tr>
          <tr>
            <td><strong>Boostlingo</strong></td>
            <td>$16.99+/{t('user/mo', 'пользователь/мес')}</td>
            <td>{t('AI + human hybrid platform', 'AI + гибридная платформа')}</td>
            <td>300+</td>
            <td>{t('Yes (platform)', 'Да (платформа)')}</td>
          </tr>
          <tr>
            <td><strong>T-Mobile Live Translation</strong></td>
            <td>{t('Free (beta)', 'Бесплатно (бета)')}</td>
            <td>{t('Carrier-level, dial *87*', 'На уровне оператора, набрать *87*')}</td>
            <td>50+</td>
            <td>{t('No (T-Mobile only)', 'Нет (только T-Mobile)')}</td>
          </tr>
          <tr>
            <td><strong>AIPhone.AI</strong></td>
            <td>$9.99–19.99/{t('mo', 'мес')}</td>
            <td>{t('Mobile app with subtitles', 'Мобильное приложение с субтитрами')}</td>
            <td>91</td>
            <td>{t('Yes', 'Да')}</td>
          </tr>
          <tr>
            <td><strong>KUDO</strong></td>
            <td>{t('Per-meeting', 'За встречу')}</td>
            <td>{t('Video conferencing platform', 'Платформа для видеоконференций')}</td>
            <td>200+</td>
            <td>{t('Yes (browser)', 'Да (браузер)')}</td>
          </tr>
        </tbody>
      </table>

      <h2>{t('How Live Translator Works', 'Как работает Live Translator')}</h2>
      <p>{t(
        'Unlike traditional interpreter services, Live Translator uses AI to translate both sides of a phone call in real-time. Here\'s how:',
        'В отличие от традиционных переводческих сервисов, Live Translator использует AI для перевода обеих сторон телефонного звонка в реальном времени. Вот как:'
      )}</p>
      <ol>
        <li><strong>{t('Make or receive a phone call', 'Позвоните или примите звонок')}</strong> {t('as you normally would — any phone, any carrier', 'как обычно — любой телефон, любой оператор')}</li>
        <li><strong>{t('Merge the translator number', 'Добавьте номер переводчика')}</strong> {t('into the call (like a 3-way conference call)', 'в звонок (как конференц-звонок)')}</li>
        <li><strong>{t('Speak freely in your language', 'Говорите свободно на своём языке')}</strong> {t('— the other person hears English, and vice versa', '— собеседник слышит английский, и наоборот')}</li>
      </ol>
      <p>
        {t(
          'That\'s it. No app to download. No account to create beforehand. No internet required on the other person\'s end. The translator joins your call like a regular participant.',
          'Вот и всё. Не нужно скачивать приложение. Не нужно заранее создавать аккаунт. Не нужен интернет на стороне собеседника. Переводчик подключается к звонку как обычный участник.'
        )}
      </p>

      <h2>{t('Pricing Breakdown', 'Сравнение стоимости')}</h2>
      <p>{t('Let\'s compare the cost of a typical 10-minute phone call:', 'Сравним стоимость типичного 10-минутного звонка:')}</p>
      <table>
        <thead>
          <tr>
            <th>{t('Service', 'Сервис')}</th>
            <th>{t('10-min Call Cost', 'Стоимость 10 мин')}</th>
            <th>{t('Monthly (20 calls)', 'В месяц (20 звонков)')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Live Translator</strong></td>
            <td>$1.50</td>
            <td>$30</td>
          </tr>
          <tr>
            <td>LanguageLine ($3/{t('min avg', 'мин средн.')})</td>
            <td>$30</td>
            <td>$600</td>
          </tr>
          <tr>
            <td>{t('Human interpreter', 'Живой переводчик')} ($75/{t('hr', 'час')})</td>
            <td>$12.50</td>
            <td>$250+</td>
          </tr>
          <tr>
            <td>Boostlingo</td>
            <td>$16.99+ ({t('subscription', 'подписка')})</td>
            <td>$16.99+</td>
          </tr>
        </tbody>
      </table>
      <p>
        {t(
          'For individuals making a few calls per month, Live Translator saves 90–95% compared to traditional interpreter services.',
          'Для людей, которые делают несколько звонков в месяц, Live Translator экономит 90–95% по сравнению с традиционными переводческими услугами.'
        )}
      </p>

      <h2>{t('When to Use LanguageLine vs. Live Translator', 'Когда использовать LanguageLine, а когда Live Translator')}</h2>
      <p><strong>{t('Choose LanguageLine if:', 'Выбирайте LanguageLine, если:')}</strong></p>
      <ul>
        <li>{t('You need certified human interpreters for legal proceedings', 'Вам нужны сертифицированные переводчики для судебных процессов')}</li>
        <li>{t('You\'re a healthcare system requiring HIPAA-certified interpretation', 'Вы медицинская организация, которой нужен HIPAA-сертифицированный перевод')}</li>
        <li>{t('You need rare languages (LanguageLine covers 240+ vs. our 15+)', 'Вам нужны редкие языки (LanguageLine поддерживает 240+ против наших 15+)')}</li>
        <li>{t('You have enterprise volume and budget', 'У вас корпоративные объёмы и бюджет')}</li>
      </ul>
      <p><strong>{t('Choose Live Translator if:', 'Выбирайте Live Translator, если:')}</strong></p>
      <ul>
        <li>{t('You\'re an individual or small business', 'Вы частное лицо или малый бизнес')}</li>
        <li>{t('You need translation for everyday calls (insurance, bank, doctor, utilities)', 'Вам нужен перевод для повседневных звонков (страховая, банк, врач, коммунальные)')}</li>
        <li>{t('You want pay-per-use without contracts', 'Вы хотите платить за использование без контрактов')}</li>
        <li>{t('You value convenience — no app, no setup, works instantly', 'Вам важно удобство — без приложений, без настройки, работает мгновенно')}</li>
        <li>{t('Your budget matters — $0.15/min vs. $2–5/min', 'Бюджет имеет значение — $0.15/мин против $2–5/мин')}</li>
      </ul>

      <h2>{t('Real Use Cases', 'Реальные примеры использования')}</h2>
      <p>{t('Here are the most common scenarios where our users choose Live Translator over LanguageLine:', 'Вот самые частые ситуации, когда наши пользователи выбирают Live Translator вместо LanguageLine:')}</p>
      <ul>
        <li><strong>{t('Immigration', 'Иммиграция')}</strong>: {t('Calling USCIS, lawyers, or government agencies', 'Звонки в USCIS, адвокатам, в госорганы')}</li>
        <li><strong>{t('Healthcare', 'Медицина')}</strong>: {t('Scheduling appointments, understanding lab results, pharmacy calls', 'Запись к врачу, результаты анализов, звонки в аптеку')}</li>
        <li><strong>{t('Insurance', 'Страхование')}</strong>: {t('Filing claims, understanding coverage, disputing bills', 'Подача заявлений, выяснение покрытия, оспаривание счетов')}</li>
        <li><strong>{t('Banking', 'Банки')}</strong>: {t('Account issues, fraud reporting, loan applications', 'Проблемы со счётом, сообщение о мошенничестве, заявки на кредит')}</li>
        <li><strong>{t('Utilities', 'Коммунальные службы')}</strong>: {t('Setting up services, resolving billing issues', 'Подключение услуг, решение проблем с оплатой')}</li>
        <li><strong>{t('Education', 'Образование')}</strong>: {t('Parent-teacher calls, school administration', 'Звонки учителям, школьная администрация')}</li>
      </ul>

      <h2>{t('Getting Started', 'Как начать')}</h2>
      <p>
        {t(
          'Sign up in 30 seconds, get $2 free credit (about 13 minutes of calls), and save the translator number in your phone. Next time you need help with a call, just merge it in.',
          'Зарегистрируйтесь за 30 секунд, получите $2 бесплатно на баланс (примерно 13 минут звонков) и сохраните номер переводчика в телефоне. В следующий раз, когда нужна помощь со звонком — просто добавьте его в звонок.'
        )}
      </p>
    </>
  );
}
