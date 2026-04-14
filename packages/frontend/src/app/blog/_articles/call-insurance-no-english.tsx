'use client';
import { useLang } from '@/app/_landing/useLang';

export default function CallInsuranceNoEnglish() {
  const { t } = useLang();
  return (
    <>
      <p>
        {t(
          'Calling your insurance company is stressful enough in your native language. When English isn\'t your first language, it can feel impossible — automated menus, hold music, medical terminology, and agents who speak quickly. You\'re not alone: over 25 million adults in the US have limited English proficiency.',
          'Звонить в страховую компанию — стресс даже на родном языке. Когда английский — не ваш первый язык, это может казаться невозможным: автоматические меню, музыка ожидания, медицинская терминология и операторы, которые говорят быстро. Вы не одиноки: более 25 миллионов взрослых в США имеют ограниченное владение английским.'
        )}
      </p>
      <p>
        {t(
          'Here\'s a practical guide to handling insurance phone calls when you don\'t speak fluent English — with three different approaches depending on your situation.',
          'Вот практическое руководство по звонкам в страховую, если вы плохо говорите по-английски — три подхода в зависимости от вашей ситуации.'
        )}
      </p>

      <h2>{t('Why Insurance Calls Are So Hard', 'Почему звонки в страховую так сложны')}</h2>
      <p>{t('Insurance companies are notoriously difficult to deal with, even for native English speakers. For non-native speakers, the challenges multiply:', 'Страховые компании сложны в общении даже для носителей английского. Для тех, кто не говорит по-английски, проблемы умножаются:')}</p>
      <ul>
        <li><strong>{t('IVR menus', 'IVR-меню')}</strong>: {t('Automated phone systems with complex options ("Press 1 for billing, press 2 for claims...")', 'Автоматические телефонные системы со сложными опциями («Нажмите 1 для оплаты, 2 для заявлений...»)')}</li>
        <li><strong>{t('Medical terminology', 'Медицинская терминология')}</strong>: {t('"Deductible," "copay," "out-of-pocket maximum," "prior authorization"', '«Deductible» (франшиза), «copay» (доплата), «out-of-pocket maximum» (максимум из кармана), «prior authorization» (предварительное одобрение)')}</li>
        <li><strong>{t('Fast speech', 'Быстрая речь')}</strong>: {t('Agents often speak quickly with idiomatic English', 'Операторы часто говорят быстро, используя идиомы')}</li>
        <li><strong>{t('Legal implications', 'Юридические последствия')}</strong>: {t('Misunderstanding your coverage can cost thousands of dollars', 'Неправильное понимание вашего покрытия может стоить тысячи долларов')}</li>
        <li><strong>{t('Long hold times', 'Долгое ожидание')}</strong>: {t('20–45 minutes of waiting, then pressure to handle everything in one call', '20–45 минут ожидания, затем давление решить всё за один звонок')}</li>
        <li><strong>{t('Documentation requests', 'Запросы документов')}</strong>: {t('Policy numbers, dates of service, provider names — all in English', 'Номера полисов, даты обслуживания, имена провайдеров — всё на английском')}</li>
      </ul>

      <h2>{t('Option 1: Request a Bilingual Agent', 'Вариант 1: Попросить двуязычного оператора')}</h2>
      <p><strong>{t('Cost: Free | Best for: Spanish speakers', 'Стоимость: Бесплатно | Лучше всего для: говорящих по-испански')}</strong></p>
      <p>
        {t(
          'Most major insurance companies offer Spanish-language support. Some also offer Mandarin, Vietnamese, or Korean for their largest markets. Here\'s how to access it:',
          'Большинство крупных страховых предлагают поддержку на испанском. Некоторые также предлагают мандаринский, вьетнамский или корейский для крупнейших рынков. Как получить доступ:'
        )}
      </p>
      <ul>
        <li>{t('Listen to the IVR menu for a "Para español, presione 2" option', 'Прослушайте IVR-меню — ищите опцию «Para español, presione 2»')}</li>
        <li>{t('If no option exists, say "Spanish" or "representative" when prompted', 'Если такой опции нет, скажите «Spanish» или «representative» при запросе')}</li>
        <li>{t('Ask the English-speaking agent: "Can I speak with someone in [language]?"', 'Спросите англоговорящего оператора: «Can I speak with someone in [язык]?»')}</li>
      </ul>
      <p><strong>{t('Limitations:', 'Ограничения:')}</strong></p>
      <ul>
        <li>{t('Only available for the most common languages (usually just Spanish)', 'Доступно только для самых распространённых языков (обычно только испанский)')}</li>
        <li>{t('Bilingual agents may have longer wait times', 'Ожидание двуязычного оператора может быть дольше')}</li>
        <li>{t('Not all departments have bilingual staff', 'Не во всех отделах есть двуязычные сотрудники')}</li>
        <li>{t('Quality varies — some agents are more fluent than others', 'Качество варьируется — некоторые операторы владеют языком лучше других')}</li>
      </ul>

      <h2>{t('Option 2: Use an Interpreter Service', 'Вариант 2: Использовать переводческую службу')}</h2>
      <p><strong>{t('Cost: $2–5/min (LanguageLine) | Best for: Complex claims, legal disputes', 'Стоимость: $2–5/мин (LanguageLine) | Лучше всего для: сложных заявлений, юридических споров')}</strong></p>
      <p>
        {t(
          'Professional over-the-phone interpretation services like LanguageLine connect you with a human interpreter who joins your call. Insurance companies sometimes provide this service for free — ask your insurer if they offer interpreter assistance.',
          'Профессиональные телефонные переводческие службы, такие как LanguageLine, подключают живого переводчика к вашему звонку. Страховые иногда предоставляют эту услугу бесплатно — спросите у своей страховой, есть ли у них помощь переводчика.'
        )}
      </p>
      <p><strong>{t('How to request it:', 'Как запросить:')}</strong></p>
      <ul>
        <li>{t('Call your insurance company and ask: "I need an interpreter for [language]"', 'Позвоните в страховую и скажите: «I need an interpreter for [язык]»')}</li>
        <li>{t('Under federal regulations, health insurers receiving federal funds must provide language access', 'По федеральным правилам, страховые, получающие государственное финансирование, обязаны обеспечивать языковой доступ')}</li>
        <li>{t('If they refuse, file a complaint with the Office for Civil Rights (OCR)', 'Если откажут, подайте жалобу в Офис по гражданским правам (OCR)')}</li>
      </ul>
      <p><strong>{t('Limitations:', 'Ограничения:')}</strong></p>
      <ul>
        <li>{t('Not all insurers provide it proactively — you need to ask', 'Не все страховые предлагают это сами — нужно просить')}</li>
        <li>{t('Wait times for an interpreter can add 5–15 minutes to your call', 'Ожидание переводчика может добавить 5–15 минут к звонку')}</li>
        <li>{t('If you need to call multiple times, you may get a different interpreter each time', 'При повторных звонках каждый раз может быть другой переводчик')}</li>
      </ul>

      <h2>{t('Option 3: Use an AI Phone Translator', 'Вариант 3: Использовать AI-переводчик')}</h2>
      <p><strong>{t('Cost: $0.15/min (Live Translator) | Best for: Routine calls, follow-ups, any language', 'Стоимость: $0.15/мин (Live Translator) | Лучше всего для: обычных звонков, повторных обращений, любого языка')}</strong></p>
      <p>
        {t(
          'AI phone translation works by adding a translator to your call — like a conference call with an interpreter. You speak in your language, and the other person hears English. They respond in English, and you hear your language.',
          'AI-перевод работает путём добавления переводчика в ваш звонок — как конференц-звонок с переводчиком. Вы говорите на своём языке, собеседник слышит английский. Они отвечают по-английски, вы слышите свой язык.'
        )}
      </p>

      <h3>{t('Step-by-Step: Calling Insurance with Live Translator', 'Пошагово: звонок в страховую с Live Translator')}</h3>
      <ol>
        <li><strong>{t('Before the call', 'Перед звонком')}</strong>: {t('Have your insurance card ready with your policy number, group number, and member ID', 'Приготовьте страховую карту с номером полиса, номером группы и ID участника')}</li>
        <li><strong>{t('Dial your insurance company', 'Позвоните в страховую')}</strong> {t('from your phone as usual', 'со своего телефона как обычно')}</li>
        <li><strong>{t('Navigate the IVR', 'Пройдите IVR-меню')}</strong>: {t('Press the number for "representative" or "claims" — the translator helps once you\'re connected to a person', 'Нажмите номер для «representative» или «claims» — переводчик поможет, когда вас соединят с человеком')}</li>
        <li><strong>{t('Once connected to an agent', 'Когда соединитесь с оператором')}</strong>: {t('Tap "Add Call" or "Merge" on your phone, dial the translator number', 'Нажмите «Добавить звонок» или «Объединить» на телефоне, наберите номер переводчика')}</li>
        <li><strong>{t('Speak in your language', 'Говорите на своём языке')}</strong>: {t('The agent hears English. Their response comes back in your language.', 'Оператор слышит английский. Его ответ приходит на вашем языке.')}</li>
        <li><strong>{t('Take notes', 'Записывайте')}</strong>: {t('The call transcript is sent to your Telegram automatically', 'Расшифровка звонка автоматически отправляется в ваш Telegram')}</li>
      </ol>

      <h2>{t('Tips for Effective Insurance Calls', 'Советы для эффективных звонков в страховую')}</h2>
      <p>{t('Regardless of which method you use, these tips will help:', 'Независимо от выбранного метода, эти советы помогут:')}</p>

      <h3>{t('Before the Call', 'Перед звонком')}</h3>
      <ul>
        <li>{t('Write down your questions in advance', 'Запишите вопросы заранее')}</li>
        <li>{t('Have your insurance card, any bills or EOBs (Explanation of Benefits), and a pen ready', 'Приготовьте страховую карту, счета или EOB (разъяснение выплат) и ручку')}</li>
        <li>{t('Note the date, time, and name of the person you speak with', 'Запишите дату, время и имя собеседника')}</li>
        <li>{t('Know your policy number and group number', 'Знайте номер полиса и номер группы')}</li>
      </ul>

      <h3>{t('During the Call', 'Во время звонка')}</h3>
      <ul>
        <li>{t('Ask the agent to speak slowly if needed: "Can you please speak more slowly?"', 'Попросите оператора говорить медленнее: «Can you please speak more slowly?»')}</li>
        <li>{t('Repeat back important information to confirm: "So my copay is $30, correct?"', 'Повторяйте важную информацию для подтверждения: «So my copay is $30, correct?»')}</li>
        <li>{t('Ask for a reference number for your call', 'Попросите номер ссылки вашего звонка')}</li>
        <li>{t('Request any decisions or information in writing: "Can you send that to me in a letter?"', 'Попросите все решения или информацию в письменном виде: «Can you send that to me in a letter?»')}</li>
      </ul>

      <h3>{t('After the Call', 'После звонка')}</h3>
      <ul>
        <li>{t('Save the reference number and the agent\'s name', 'Сохраните номер ссылки и имя оператора')}</li>
        <li>{t('Review the transcript (if using Live Translator) to make sure you understood everything', 'Просмотрите расшифровку (если используете Live Translator), чтобы убедиться, что всё поняли')}</li>
        <li>{t('Follow up in writing if anything was promised during the call', 'Напишите письменно, если что-то было обещано во время звонка')}</li>
      </ul>

      <h2>{t('Key Insurance Terms You Should Know', 'Ключевые страховые термины, которые нужно знать')}</h2>
      <table>
        <thead>
          <tr>
            <th>{t('Term', 'Термин')}</th>
            <th>{t('What It Means', 'Что это значит')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Premium</strong></td>
            <td>{t('The monthly amount you pay for insurance', 'Ежемесячный платёж за страховку')}</td>
          </tr>
          <tr>
            <td><strong>Deductible</strong></td>
            <td>{t('The amount you pay before insurance starts paying', 'Сумма, которую вы платите до начала выплат страховой')}</td>
          </tr>
          <tr>
            <td><strong>Copay</strong></td>
            <td>{t('A fixed amount you pay for a covered service', 'Фиксированная сумма за покрытую услугу')}</td>
          </tr>
          <tr>
            <td><strong>Out-of-pocket maximum</strong></td>
            <td>{t('The most you\'ll pay in a year', 'Максимум, который вы заплатите за год')}</td>
          </tr>
          <tr>
            <td><strong>Prior authorization</strong></td>
            <td>{t('Approval needed from insurance before a procedure', 'Одобрение страховой, необходимое перед процедурой')}</td>
          </tr>
          <tr>
            <td><strong>EOB (Explanation of Benefits)</strong></td>
            <td>{t('A statement showing what was billed and what you owe', 'Документ, показывающий, что было выставлено и сколько вы должны')}</td>
          </tr>
          <tr>
            <td><strong>In-network / Out-of-network</strong></td>
            <td>{t('Doctors your insurance has contracts with (cheaper) vs. those it doesn\'t', 'Врачи, с которыми у страховой контракт (дешевле) и те, с кем нет')}</td>
          </tr>
          <tr>
            <td><strong>Claim</strong></td>
            <td>{t('A request to your insurance company to pay for a service', 'Запрос в страховую на оплату услуги')}</td>
          </tr>
        </tbody>
      </table>

      <h2>{t('Your Rights as a Non-English Speaker', 'Ваши права как неанглоговорящего')}</h2>
      <p>{t('Under federal law:', 'По федеральному закону:')}</p>
      <ul>
        <li><strong>{t('Section 1557 of the ACA', 'Раздел 1557 закона ACA')}</strong> {t('requires health insurers receiving federal funds to provide language access services', 'обязывает медицинские страховые, получающие федеральное финансирование, предоставлять языковые услуги')}</li>
        <li>{t('Insurers must provide qualified interpreters at no cost when you request them', 'Страховые обязаны предоставлять квалифицированных переводчиков бесплатно по вашему запросу')}</li>
        <li>{t('Written materials must be available in the top 15 languages spoken in your state', 'Письменные материалы должны быть доступны на 15 самых распространённых языках вашего штата')}</li>
        <li>{t('If denied interpreter services, you can file a complaint with the HHS Office for Civil Rights', 'Если вам отказали в переводчике, вы можете подать жалобу в Офис по гражданским правам HHS')}</li>
      </ul>

      <h2>{t('Getting Started with Live Translator', 'Как начать с Live Translator')}</h2>
      <p>
        {t(
          'Sign up and get $2 free credit — enough for about 13 minutes of translated calls. That\'s typically enough for one full insurance call including hold time.',
          'Зарегистрируйтесь и получите $2 на баланс бесплатно — хватит примерно на 13 минут переведённых звонков. Обычно этого достаточно для одного полного звонка в страховую, включая ожидание.'
        )}
      </p>
    </>
  );
}
