'use client';
import { useLang } from '@/app/_landing/useLang';

export default function RealTimePhoneTranslation() {
  const { t } = useLang();
  return (
    <>
      <p>
        {t(
          'Real-time phone translation — the ability to speak in one language during a phone call and have the other person hear a different language — was science fiction five years ago. In 2026, it\'s a reality. But not all approaches are created equal.',
          'Перевод телефонных звонков в реальном времени — возможность говорить на одном языке, а собеседник слышит другой — ещё пять лет назад казался фантастикой. В 2026 году это реальность. Но не все подходы одинаковы.'
        )}
      </p>
      <p>
        {t(
          'This guide explains how real-time phone translation actually works, compares the different approaches (app-based, carrier-based, and merge-based), and helps you choose the right one.',
          'Это руководство объясняет, как работает перевод звонков в реальном времени, сравнивает разные подходы (через приложение, оператора связи и метод объединения) и помогает выбрать подходящий.'
        )}
      </p>

      <h2>{t('The Technology Behind It', 'Технология')}</h2>
      <p>
        {t(
          'Modern phone translation uses speech-to-speech AI models rather than the old pipeline of speech-to-text → translate text → text-to-speech. This single-model approach reduces latency dramatically — from 3–5 seconds down to under 1 second.',
          'Современный перевод звонков использует AI-модели речь-в-речь вместо старой цепочки речь-в-текст → перевод текста → текст-в-речь. Такой подход резко снижает задержку — с 3–5 секунд до менее 1 секунды.'
        )}
      </p>
      <p>{t('Key technologies powering real-time phone translation in 2026:', 'Ключевые технологии перевода звонков в реальном времени в 2026 году:')}</p>
      <ul>
        <li><strong>{t('Voice Agent APIs', 'API голосовых агентов')}</strong> (xAI Grok, OpenAI, Google): {t('End-to-end speech translation models', 'Сквозные модели перевода речи')}</li>
        <li><strong>{t('WebSocket audio streaming', 'Потоковая передача аудио через WebSocket')}</strong>: {t('Real-time bidirectional audio over the internet', 'Двусторонняя передача аудио в реальном времени через интернет')}</li>
        <li><strong>{t('Telephony APIs', 'Телефонные API')}</strong> (Twilio, Vonage): {t('Bridge between phone networks and AI', 'Мост между телефонными сетями и AI')}</li>
        <li><strong>{t('Conference call merging', 'Объединение конференц-звонков')}</strong>: {t('Adding a translator as a third participant in any call', 'Добавление переводчика как третьего участника в любой звонок')}</li>
      </ul>

      <h2>{t('Three Approaches to Phone Translation', 'Три подхода к переводу звонков')}</h2>

      <h3>{t('1. App-Based Translation', '1. Перевод через приложение')}</h3>
      <p><strong>{t('Examples: Telelingo, AIPhone.AI, Google Translate', 'Примеры: Telelingo, AIPhone.AI, Google Translate')}</strong></p>
      <p>{t('You install an app and make calls through it. The app captures your voice, translates it, and plays the translation to the other person.', 'Вы устанавливаете приложение и звоните через него. Приложение захватывает вашу речь, переводит и воспроизводит перевод собеседнику.')}</p>
      <p><strong>{t('Pros:', 'Плюсы:')}</strong></p>
      <ul>
        <li>{t('Full control over the experience', 'Полный контроль над процессом')}</li>
        <li>{t('Can show subtitles on screen', 'Могут показывать субтитры на экране')}</li>
        <li>{t('Often includes additional features (recording, transcription)', 'Часто включают дополнительные функции (запись, расшифровка)')}</li>
      </ul>
      <p><strong>{t('Cons:', 'Минусы:')}</strong></p>
      <ul>
        <li>{t('Both parties may need the app (or a special number)', 'Обеим сторонам может понадобиться приложение (или специальный номер)')}</li>
        <li>{t('Calls go through the app\'s servers, changing your caller ID', 'Звонки идут через серверы приложения, меняя ваш номер')}</li>
        <li>{t('Requires a smartphone with internet', 'Нужен смартфон с интернетом')}</li>
        <li>{t('Another app to install and manage', 'Ещё одно приложение для установки и управления')}</li>
      </ul>

      <h3>{t('2. Carrier-Based Translation', '2. Перевод через оператора связи')}</h3>
      <p><strong>{t('Example: T-Mobile Live Translation', 'Пример: T-Mobile Live Translation')}</strong></p>
      <p>{t('Translation is built into the phone network. You dial a prefix (like *87*) before the number, and the carrier translates the call at the network level.', 'Перевод встроен в телефонную сеть. Вы набираете префикс (например *87*) перед номером, и оператор переводит звонок на сетевом уровне.')}</p>
      <p><strong>{t('Pros:', 'Плюсы:')}</strong></p>
      <ul>
        <li>{t('No app needed', 'Не нужно приложение')}</li>
        <li>{t('Seamless — works like a normal call', 'Бесшовно — работает как обычный звонок')}</li>
        <li>{t('Free (during beta) or included in plan', 'Бесплатно (в бета-версии) или включено в тариф')}</li>
        <li>{t('50+ languages', '50+ языков')}</li>
      </ul>
      <p><strong>{t('Cons:', 'Минусы:')}</strong></p>
      <ul>
        <li><strong>{t('Carrier-locked', 'Привязка к оператору')}</strong>: {t('Only works if you\'re a T-Mobile subscriber', 'Работает только для абонентов T-Mobile')}</li>
        <li>{t('Not available on AT&T, Verizon, or other carriers', 'Недоступно для AT&T, Verizon и других операторов')}</li>
        <li>{t('Limited customization (no tone selection, no voice choice)', 'Ограниченная настройка (нет выбора тона, нет выбора голоса)')}</li>
        <li>{t('Still in beta — pricing unknown when it launches fully', 'Всё ещё в бете — цена после полного запуска неизвестна')}</li>
      </ul>

      <h3>{t('3. Merge-Based Translation (Conference Call)', '3. Перевод через объединение (конференц-звонок)')}</h3>
      <p><strong>{t('Example: Live Translator', 'Пример: Live Translator')}</strong></p>
      <p>{t('You make a regular call, then merge in a translator number as a third participant. The translator listens to both sides and speaks the translation.', 'Вы делаете обычный звонок, затем добавляете номер переводчика как третьего участника. Переводчик слушает обе стороны и озвучивает перевод.')}</p>
      <p><strong>{t('Pros:', 'Плюсы:')}</strong></p>
      <ul>
        <li><strong>{t('Works on any phone', 'Работает на любом телефоне')}</strong>: {t('iPhone, Android, landline, VoIP', 'iPhone, Android, стационарный, VoIP')}</li>
        <li><strong>{t('Any carrier', 'Любой оператор')}</strong>: {t('AT&T, Verizon, T-Mobile, international', 'AT&T, Verizon, T-Mobile, международные')}</li>
        <li><strong>{t('No app required', 'Не нужно приложение')}</strong>: {t('Uses your phone\'s built-in conference call feature', 'Использует встроенную функцию конференц-звонка')}</li>
        <li><strong>{t('Other person needs nothing', 'Собеседнику ничего не нужно')}</strong>: {t('They just hear a regular call', 'Они просто слышат обычный звонок')}</li>
        <li><strong>{t('Customizable', 'Настраиваемый')}</strong>: {t('Choose tone (professional, medical, legal, casual), voice, and languages', 'Выбирайте тон (деловой, медицинский, юридический, повседневный), голос и языки')}</li>
        <li><strong>{t('Live transcript', 'Живая расшифровка')}</strong>: {t('Get a web link with the real-time transcript', 'Получите ссылку с расшифровкой в реальном времени')}</li>
      </ul>
      <p><strong>{t('Cons:', 'Минусы:')}</strong></p>
      <ul>
        <li>{t('Fewer languages than carrier-based (15+ vs. 50+)', 'Меньше языков, чем у оператора (15+ против 50+)')}</li>
        <li>{t('Costs $0.15/min (not free like T-Mobile beta)', 'Стоит $0.15/мин (не бесплатно, как бета T-Mobile)')}</li>
        <li>{t('Requires knowing how to use conference/merge calls on your phone', 'Нужно знать, как использовать конференц-звонки на вашем телефоне')}</li>
      </ul>

      <h2>{t('Comparison Table', 'Сравнительная таблица')}</h2>
      <table>
        <thead>
          <tr>
            <th>{t('Feature', 'Характеристика')}</th>
            <th>{t('App-Based', 'Приложение')}</th>
            <th>{t('Carrier-Based', 'Оператор')}</th>
            <th>{t('Merge-Based', 'Объединение')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{t('App required', 'Нужно приложение')}</td>
            <td>{t('Yes', 'Да')}</td>
            <td>{t('No', 'Нет')}</td>
            <td>{t('No', 'Нет')}</td>
          </tr>
          <tr>
            <td>{t('Works on any carrier', 'Любой оператор')}</td>
            <td>{t('Yes', 'Да')}</td>
            <td>{t('No (T-Mobile only)', 'Нет (только T-Mobile)')}</td>
            <td>{t('Yes', 'Да')}</td>
          </tr>
          <tr>
            <td>{t('Works on landlines', 'Стационарные телефоны')}</td>
            <td>{t('No', 'Нет')}</td>
            <td>{t('No', 'Нет')}</td>
            <td>{t('Yes', 'Да')}</td>
          </tr>
          <tr>
            <td>{t('Other person needs setup', 'Собеседнику нужна настройка')}</td>
            <td>{t('Sometimes', 'Иногда')}</td>
            <td>{t('No', 'Нет')}</td>
            <td>{t('No', 'Нет')}</td>
          </tr>
          <tr>
            <td>{t('Customizable tone/voice', 'Настройка тона/голоса')}</td>
            <td>{t('Limited', 'Ограниченно')}</td>
            <td>{t('No', 'Нет')}</td>
            <td>{t('Yes (6 tones)', 'Да (6 тонов)')}</td>
          </tr>
          <tr>
            <td>{t('Live transcript', 'Живая расшифровка')}</td>
            <td>{t('Some apps', 'Некоторые')}</td>
            <td>{t('No', 'Нет')}</td>
            <td>{t('Yes', 'Да')}</td>
          </tr>
          <tr>
            <td>{t('Price', 'Цена')}</td>
            <td>$10–20/{t('mo', 'мес')}</td>
            <td>{t('Free (beta)', 'Бесплатно (бета)')}</td>
            <td>$0.15/{t('min', 'мин')}</td>
          </tr>
          <tr>
            <td>{t('Latency', 'Задержка')}</td>
            <td>{t('1–3 sec', '1–3 сек')}</td>
            <td>{t('<1 sec', '<1 сек')}</td>
            <td>{t('<1 sec', '<1 сек')}</td>
          </tr>
        </tbody>
      </table>

      <h2>{t('Why "Merge a Number" Is the Simplest Approach', 'Почему «добавить номер» — самый простой подход')}</h2>
      <p>
        {t(
          'Every phone made in the last 20 years supports conference calls. It\'s a universal feature — no smartphone required, no app store, no updates, no permissions. When you merge a translator into your call:',
          'Каждый телефон, выпущенный за последние 20 лет, поддерживает конференц-звонки. Это универсальная функция — не нужен смартфон, магазин приложений, обновления или разрешения. Когда вы добавляете переводчика в звонок:'
        )}
      </p>
      <ul>
        <li>{t('You keep your own phone number (caller ID stays the same)', 'Вы сохраняете свой номер (caller ID не меняется)')}</li>
        <li>{t('The other person has no idea you\'re using a translator (if you prefer)', 'Собеседник не знает, что вы используете переводчика (если вы хотите)')}</li>
        <li>{t('You can add or remove the translator mid-call', 'Можно добавить или убрать переводчика посреди звонка')}</li>
        <li>{t('It works with existing calls — even ones you\'ve already answered', 'Работает с текущими звонками — даже теми, на которые вы уже ответили')}</li>
      </ul>
      <p>
        {t(
          'This is the key insight: instead of building a new way to make calls, the translator joins your existing call. No new behavior to learn.',
          'В этом ключевая идея: вместо того чтобы создавать новый способ звонить, переводчик присоединяется к вашему существующему звонку. Не нужно учиться ничему новому.'
        )}
      </p>

      <h2>{t('Supported Languages', 'Поддерживаемые языки')}</h2>
      <p>{t('Live Translator currently supports 15+ language pairs, including:', 'Live Translator поддерживает 15+ языковых пар, включая:')}</p>
      <ul>
        <li>{t('English ↔ Spanish', 'Английский ↔ Испанский')}</li>
        <li>{t('English ↔ Chinese (Mandarin)', 'Английский ↔ Китайский (мандарин)')}</li>
        <li>{t('English ↔ Russian', 'Английский ↔ Русский')}</li>
        <li>{t('English ↔ Arabic', 'Английский ↔ Арабский')}</li>
        <li>{t('English ↔ French', 'Английский ↔ Французский')}</li>
        <li>{t('English ↔ German', 'Английский ↔ Немецкий')}</li>
        <li>{t('English ↔ Japanese', 'Английский ↔ Японский')}</li>
        <li>{t('English ↔ Korean', 'Английский ↔ Корейский')}</li>
        <li>{t('English ↔ Portuguese', 'Английский ↔ Португальский')}</li>
        <li>{t('English ↔ Hindi', 'Английский ↔ Хинди')}</li>
        <li>{t('English ↔ Vietnamese', 'Английский ↔ Вьетнамский')}</li>
        <li>{t('English ↔ Ukrainian', 'Английский ↔ Украинский')}</li>
        <li>{t('And more being added regularly', 'И другие — список постоянно пополняется')}</li>
      </ul>

      <h2>{t('The Future of Phone Translation', 'Будущее перевода звонков')}</h2>
      <p>
        {t(
          'With Google adding live translation to Pixel phones and iOS in 2026, and T-Mobile building it into the network, real-time phone translation is becoming mainstream. The technology will only get better — faster, more accurate, more natural-sounding.',
          'С добавлением Google живого перевода на Pixel и iOS в 2026 году и встраиванием T-Mobile перевода в сеть, перевод звонков в реальном времени становится массовым. Технология будет только улучшаться — быстрее, точнее, естественнее.'
        )}
      </p>
      <p>
        {t(
          'For now, the merge-based approach offers the best combination of universality (any phone, any carrier), simplicity (no app), and affordability ($0.15/min).',
          'Пока что метод объединения предлагает лучшую комбинацию универсальности (любой телефон, любой оператор), простоты (без приложений) и доступности ($0.15/мин).'
        )}
      </p>

      <h2>{t('Try It Yourself', 'Попробуйте сами')}</h2>
      <p>
        {t(
          'Sign up and get $2 free credit. Make your first translated call in under 2 minutes. No app to install — just save a number and merge it into your next call.',
          'Зарегистрируйтесь и получите $2 на баланс бесплатно. Сделайте первый переведённый звонок за 2 минуты. Не нужно устанавливать приложение — просто сохраните номер и добавьте его в следующий звонок.'
        )}
      </p>
    </>
  );
}
