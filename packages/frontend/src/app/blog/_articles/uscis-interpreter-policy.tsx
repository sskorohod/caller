'use client';
import { useLang } from '@/app/_landing/useLang';

export default function UscisInterpreterPolicy() {
  const { t } = useLang();
  return (
    <>
      <p>
        {t(
          'In September 2025, USCIS announced a major policy change: the agency would no longer provide free interpreters at immigration interviews. This affects an estimated 47% of immigrant adults in the United States who have limited English proficiency (LEP).',
          'В сентябре 2025 года USCIS объявила о важном изменении политики: ведомство больше не предоставляет бесплатных переводчиков на иммиграционных собеседованиях. Это затрагивает примерно 47% взрослых иммигрантов в США с ограниченным владением английским языком (LEP).'
        )}
      </p>
      <p>
        {t(
          'If you or someone you know has an upcoming USCIS appointment, here\'s what changed, who\'s affected, and what your options are — including affordable AI-powered alternatives.',
          'Если у вас или ваших знакомых скоро назначена встреча в USCIS — вот что изменилось, кого это касается и какие есть варианты, включая доступные AI-альтернативы.'
        )}
      </p>

      <h2>{t('What Changed', 'Что изменилось')}</h2>
      <p>
        {t(
          'Previously, USCIS would arrange interpreter services for applicants who needed them during interviews for naturalization, green cards, asylum, and other immigration benefits. This service was included at no additional cost.',
          'Раньше USCIS организовывала переводческие услуги для заявителей, которым они были нужны на собеседованиях по натурализации, грин-картам, убежищу и другим иммиграционным вопросам. Эта услуга предоставлялась бесплатно.'
        )}
      </p>
      <p>
        {t(
          'Under the new policy, applicants are now responsible for bringing their own interpreter to USCIS interviews. The interpreter must be:',
          'Согласно новой политике, заявители теперь обязаны самостоятельно приводить переводчика на собеседования в USCIS. Переводчик должен:'
        )}
      </p>
      <ul>
        <li>{t('Fluent in both English and the applicant\'s language', 'Свободно владеть английским и языком заявителя')}</li>
        <li>{t('At least 18 years old', 'Быть не моложе 18 лет')}</li>
        <li>{t('Not also serving as the applicant\'s attorney or representative', 'Не быть адвокатом или представителем заявителя')}</li>
      </ul>

      <h2>{t('Who Is Affected', 'Кого это касается')}</h2>
      <p>{t('This policy change impacts millions of people:', 'Это изменение затрагивает миллионы людей:')}</p>
      <ul>
        <li><strong>{t('47% of immigrant adults', '47% взрослых иммигрантов')}</strong> {t('in the US have limited English proficiency', 'в США имеют ограниченное владение английским')}</li>
        <li><strong>{t('Naturalization applicants', 'Заявители на натурализацию')}</strong> {t('who haven\'t yet passed the English test', 'ещё не сдавшие тест по английскому')}</li>
        <li><strong>{t('Asylum seekers', 'Просители убежища')}</strong> {t('who may not speak English at all', 'которые могут вообще не говорить по-английски')}</li>
        <li><strong>{t('Family-based green card applicants', 'Заявители на грин-карту по семейной линии')}</strong> {t('sponsored by English-speaking relatives', 'спонсируемые англоговорящими родственниками')}</li>
        <li><strong>{t('Elderly immigrants', 'Пожилые иммигранты')}</strong> {t('applying for citizenship exceptions', 'подающие на исключения при получении гражданства')}</li>
      </ul>

      <h2>{t('Your Options for USCIS Interviews', 'Ваши варианты для собеседований в USCIS')}</h2>

      <h3>{t('Option 1: Bring a Friend or Family Member', 'Вариант 1: Привести друга или родственника')}</h3>
      <p><strong>{t('Cost: Free', 'Стоимость: Бесплатно')}</strong></p>
      <p>{t('The most common option, but it has limitations:', 'Самый распространённый вариант, но с ограничениями:')}</p>
      <ul>
        <li>{t('Your interpreter cannot be your attorney', 'Ваш переводчик не может быть вашим адвокатом')}</li>
        <li>{t('They must be truly fluent — partial understanding can lead to misunderstandings', 'Они должны действительно свободно владеть языком — неполное понимание может привести к ошибкам')}</li>
        <li>{t('Immigration interviews are stressful; untrained interpreters may miss nuances', 'Иммиграционные собеседования — это стресс; неподготовленные переводчики могут упустить нюансы')}</li>
        <li>{t('They need to take time off work to accompany you', 'Им нужно отпроситься с работы, чтобы сопровождать вас')}</li>
      </ul>

      <h3>{t('Option 2: Hire a Professional Interpreter', 'Вариант 2: Нанять профессионального переводчика')}</h3>
      <p><strong>{t('Cost: $50–100/hour', 'Стоимость: $50–100/час')}</strong></p>
      <p>{t('Professional interpreters are the gold standard, but they\'re expensive:', 'Профессиональные переводчики — золотой стандарт, но дорого:')}</p>
      <ul>
        <li>{t('Most charge a 2-hour minimum ($100–200 per visit)', 'Большинство берут минимум за 2 часа ($100–200 за визит)')}</li>
        <li>{t('Certified court interpreters cost even more ($75–150/hour)', 'Сертифицированные судебные переводчики стоят ещё дороже ($75–150/час)')}</li>
        <li>{t('You need to schedule in advance — availability may be limited', 'Нужно записываться заранее — доступность может быть ограничена')}</li>
        <li>{t('Travel time and parking add to the hassle', 'Время на дорогу и парковку добавляют хлопот')}</li>
      </ul>

      <h3>{t('Option 3: Use a Phone Interpretation Service', 'Вариант 3: Использовать телефонную переводческую службу')}</h3>
      <p><strong>{t('Cost: $2–5/min (LanguageLine) or $0.15/min (Live Translator)', 'Стоимость: $2–5/мин (LanguageLine) или $0.15/мин (Live Translator)')}</strong></p>
      <p>
        {t(
          'While USCIS interviews are in-person, phone interpretation services are essential for all the other calls you need to make during the immigration process:',
          'Хотя собеседования в USCIS проходят лично, телефонные переводческие услуги незаменимы для всех остальных звонков в рамках иммиграционного процесса:'
        )}
      </p>
      <ul>
        <li>{t('Calling USCIS customer service (1-800-375-5283)', 'Звонки в службу поддержки USCIS (1-800-375-5283)')}</li>
        <li>{t('Speaking with your immigration lawyer', 'Разговоры с вашим иммиграционным адвокатом')}</li>
        <li>{t('Following up on case status', 'Проверка статуса дела')}</li>
        <li>{t('Scheduling appointments', 'Запись на приём')}</li>
        <li>{t('Responding to Requests for Evidence (RFEs)', 'Ответы на запросы доказательств (RFE)')}</li>
      </ul>

      <h2>{t('How to Use AI Phone Translation for Immigration Calls', 'Как использовать AI-перевод для иммиграционных звонков')}</h2>
      <p>
        {t(
          'Live Translator works by joining your phone call as a third participant. Here\'s how to use it:',
          'Live Translator подключается к вашему звонку как третий участник. Вот как это работает:'
        )}
      </p>
      <ol>
        <li>{t('Call the USCIS helpline or your lawyer as usual', 'Позвоните на горячую линию USCIS или адвокату как обычно')}</li>
        <li>{t('Once connected, tap "Merge call" and dial the translator number', 'Когда соединитесь, нажмите «Объединить звонок» и наберите номер переводчика')}</li>
        <li>{t('Speak in your language — the other person hears English', 'Говорите на своём языке — собеседник слышит английский')}</li>
        <li>{t('They respond in English — you hear your language', 'Они отвечают по-английски — вы слышите свой язык')}</li>
      </ol>
      <p>
        {t(
          'The entire call is translated in real-time with under 1 second of delay. You can choose from 6 tone profiles including Legal and Formal, which use appropriate terminology for immigration-related conversations.',
          'Весь звонок переводится в реальном времени с задержкой менее 1 секунды. Вы можете выбрать один из 6 профилей тона, включая «Юридический» и «Формальный», которые используют подходящую терминологию для иммиграционных разговоров.'
        )}
      </p>

      <h2>{t('Frequently Asked Questions', 'Часто задаваемые вопросы')}</h2>

      <h3>{t('Can I use an AI translator for my actual USCIS interview?', 'Можно ли использовать AI-переводчик на самом собеседовании в USCIS?')}</h3>
      <p>
        {t(
          'USCIS in-person interviews require a human interpreter present in the room. AI phone translation is not a substitute for in-person interpretation at the interview itself. However, it\'s invaluable for all the phone calls surrounding your case.',
          'На очных собеседованиях USCIS требуется присутствие живого переводчика. AI-перевод по телефону не заменяет очный перевод на самом собеседовании. Однако он незаменим для всех телефонных звонков, связанных с вашим делом.'
        )}
      </p>

      <h3>{t('Is $0.15/min really enough for immigration calls?', 'Действительно ли $0.15/мин достаточно для иммиграционных звонков?')}</h3>
      <p>
        {t(
          'A typical call to USCIS customer service takes 15–30 minutes (including hold time). At $0.15/min, that\'s $2.25–$4.50 per call — compared to $30–150 with traditional interpreter services.',
          'Типичный звонок в службу поддержки USCIS занимает 15–30 минут (включая ожидание). При $0.15/мин это $2.25–$4.50 за звонок — по сравнению с $30–150 при традиционных переводческих услугах.'
        )}
      </p>

      <h3>{t('What languages are supported?', 'Какие языки поддерживаются?')}</h3>
      <p>
        {t(
          'Live Translator currently supports 15+ languages including Spanish, Chinese (Mandarin), Russian, Arabic, Vietnamese, Korean, French, German, Japanese, Portuguese, Hindi, Ukrainian, Polish, Turkish, and Italian.',
          'Live Translator поддерживает 15+ языков, включая испанский, китайский (мандарин), русский, арабский, вьетнамский, корейский, французский, немецкий, японский, португальский, хинди, украинский, польский, турецкий и итальянский.'
        )}
      </p>

      <h2>{t('Beyond USCIS: Other Immigration-Related Calls', 'Помимо USCIS: другие звонки, связанные с иммиграцией')}</h2>
      <p>{t('The immigration process involves dozens of phone calls beyond USCIS:', 'Иммиграционный процесс включает десятки звонков помимо USCIS:')}</p>
      <ul>
        <li><strong>{t('Health insurance enrollment', 'Оформление медицинской страховки')}</strong> {t('(required for many visa types)', '(требуется для многих типов виз)')}</li>
        <li><strong>{t('Social Security Administration', 'Администрация социального обеспечения')}</strong> {t('(SSN applications)', '(заявления на SSN)')}</li>
        <li><strong>{t('DMV', 'DMV')}</strong> {t('(driver\'s license)', '(водительские права)')}</li>
        <li><strong>{t('Schools', 'Школы')}</strong> {t('(enrolling children)', '(зачисление детей)')}</li>
        <li><strong>{t('Landlords', 'Арендодатели')}</strong> {t('(housing applications)', '(заявки на жильё)')}</li>
        <li><strong>{t('Banks', 'Банки')}</strong> {t('(opening accounts)', '(открытие счетов)')}</li>
      </ul>
      <p>
        {t(
          'Each of these calls becomes easier with a translator on the line. And at $0.15/min, you can handle all of them for less than the cost of a single hour with a human interpreter.',
          'Каждый из этих звонков становится проще с переводчиком на линии. А при $0.15/мин вы справитесь со всеми за сумму меньше стоимости одного часа с живым переводчиком.'
        )}
      </p>

      <h2>{t('Getting Started', 'Как начать')}</h2>
      <p>
        {t(
          'Sign up and get $2 free credit — enough for about 13 minutes of translated calls. Save the translator number in your phone, and you\'ll have an interpreter ready whenever you need one.',
          'Зарегистрируйтесь и получите $2 на баланс бесплатно — хватит примерно на 13 минут переведённых звонков. Сохраните номер переводчика в телефоне, и у вас всегда будет переводчик под рукой.'
        )}
      </p>
    </>
  );
}
