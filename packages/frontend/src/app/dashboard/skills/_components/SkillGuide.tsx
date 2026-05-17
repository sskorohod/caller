'use client';
import { useEffect, useState } from 'react';

interface SkillGuideProps {
  open: boolean;
  onClose: () => void;
  initialSection?: string;
}

interface Section {
  id: string;
  icon: string;
  title: string;
  body: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: 'start',
    icon: 'rocket_launch',
    title: 'С чего начать',
    body: (
      <>
        <p>Скилл — это модуль поведения агента под одну задачу: запись на приём, обработка жалобы, квалификация лида.</p>
        <ul>
          <li>Создавать с нуля стоит только для редкого кастомного сценария.</li>
          <li>В 90% случаев — взять <b>template</b> из «New skill» и поправить под себя.</li>
          <li>Скилл <b>Human-Like Conversation</b> уже есть в каждом workspace — это core-скилл, который делает речь похожей на человека. Аттачь его ко всем агентам по умолчанию.</li>
        </ul>
        <p className="callout">
          <b>Core vs Optional.</b> Скиллы, приаттаченные к агенту (`agent_skill_packs`), идут в system prompt полностью — это <b>core</b>, всегда активны. Остальные workspace-скиллы агент видит как список и активирует фразой `[ACTIVATE:intent]` — это <b>optional</b>.
        </p>
      </>
    ),
  },
  {
    id: 'general',
    icon: 'info',
    title: 'General — основные поля',
    body: (
      <>
        <h4>Name</h4>
        <p>Человекочитаемое название. Видит только оператор: «Запись на приём», «Возврат денег».</p>

        <h4>Intent</h4>
        <p>Машинный код намерения, snake_case: `schedule_appointment`, `handle_refund`. По нему агент активирует optional-скилл маркером <code>[ACTIVATE:schedule_appointment]</code>.</p>
        <ul>
          <li>Уникальный в рамках workspace.</li>
          <li>Короткий: 2–3 слова через `_`.</li>
          <li>Глагол + объект: <i>schedule_appointment</i>, не <i>appointments</i>.</li>
        </ul>

        <h4>Description</h4>
        <p>Одна фраза, которую увидит LLM в списке optional-скиллов. От её ясности зависит, активирует ли агент скилл вовремя.</p>
        <p className="callout">Плохо: «Скилл для записи».<br/>Хорошо: «Запись клиента на приём — берёт имя, телефон, дату и слот».</p>

        <h4>Conversation rules</h4>
        <p>Главное поле. Это пошаговая инструкция, которую агент будет выполнять, когда скилл активен. Пиши императивно, нумеруй шаги.</p>
        <ul>
          <li><b>1–2 предложения на ход.</b> Не пиши длинных абзацев — LLM будет их озвучивать.</li>
          <li><b>Один вопрос за раз.</b> Никогда «Скажите имя, телефон и удобное время».</li>
          <li>Указывай <b>что делать, если</b>: «если клиент не помнит дату — предложи ближайшую неделю».</li>
          <li>Заканчивай явным критерием готовности.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'humanLike',
    icon: 'record_voice_over',
    title: 'Human-Like — как звучать как человек',
    body: (
      <>
        <p>Поля этого раздела автоматически добавляются в system prompt. Используются всегда, если скилл приаттачен к агенту.</p>

        <h4>Opening line</h4>
        <p>Первая фраза агента. Должна содержать <b>кто</b> и <b>зачем</b>, и больше ничего.</p>
        <p className="callout">
          <b>Хорошо:</b> «Здравствуйте, я Анна из FixarCRM, звоню подтвердить запись на завтра.»<br/>
          <b>Плохо:</b> «Здравствуйте, Вам удобно сейчас говорить? Это Анна, …»
        </p>
        <p>Никаких «Вам удобно говорить?» — раз ответили, значит могут. Никаких «Это Иван?» — представься первой.</p>

        <h4>Talk-listen ratio</h4>
        <p>Доля времени, которое агент говорит. Цель — <b>≤55%</b>. Топ-перформеры в реальных звонках держат 57/43 в пользу слушания, аутсайдеры — 71/29 в пользу болтовни. Меньше говорить = больше конверсия.</p>

        <h4>Pause profile (паузы в мс)</h4>
        <table>
          <tbody>
            <tr><td><b>Перед ответом</b></td><td>~200 мс</td><td>Естественная человеческая пауза. Не отвечай мгновенно — звучит как робот.</td></tr>
            <tr><td><b>После вопроса</b></td><td>~600 мс</td><td>Дай человеку начать говорить. Не добивай тишину.</td></tr>
            <tr><td><b>Перед ценой/датой</b></td><td>~400 мс</td><td>Привлекает внимание к важной информации.</td></tr>
            <tr><td><b>После closing-вопроса</b></td><td>~3000 мс</td><td>После «Записываем на вторник 14:00?» — молчи 3 секунды. Не продолжай продавать.</td></tr>
          </tbody>
        </table>

        <h4>Backchannels («угу», «mm-hmm»)</h4>
        <p>Когда юзер долго говорит, агент вставляет короткое подтверждение, чтобы было слышно «я слушаю».</p>
        <ul>
          <li><b>min_user_turn_ms</b> — порог, после которого вставляется backchannel. Дефолт 4000 (4 секунды).</li>
          <li>Фразы перечисли через запятую. По одной на язык.</li>
          <li>Не злоупотребляй — раз в 5–10 секунд, не чаще.</li>
        </ul>

        <h4>Bridging phrases</h4>
        <p>Что агент говорит во время паузы на lookup, RAG-поиск, tool call. Без них клиент слышит тишину 500–1500 мс и думает, что связь оборвалась.</p>
        <p className="callout">
          <b>RU:</b> «Секунду, посмотрю», «Минутку», «Сейчас уточню».<br/>
          <b>EN:</b> «One moment, let me check», «Let me pull that up».
        </p>

        <h4>Objection branches</h4>
        <p>Дерево типовых возражений. Это самое важное поле для outbound-звонков.</p>
        <ul>
          <li><b>Trigger</b> — что юзер скажет: «дорого», «не интересно», «уже работаю с другими».</li>
          <li><b>Response</b> — ответ агента. Структура: <i>acknowledge</i> → <i>pivot</i> → <i>конкретный шаг</i>.</li>
          <li><b>Action</b> (опц.) — техническое действие: `offer_callback`, `escalate`, `book_demo`.</li>
        </ul>
        <p className="callout">
          <b>Пример: «не интересно»</b><br/>
          → «Понимаю. А если бесплатно посмотрим, что у вас сейчас работает? Среда утром или четверг после обеда?»<br/>
          Никогда не используй слово «<b>просто</b>» / «<b>just</b>» — в исследовании 500 звонков оно убивает recovery почти всегда.
        </p>
        <p>Веди реальный список возражений из записей звонков, а не выдумывай. В типичном плейбуке 12–15, в реальности — 40+.</p>

        <h4>Escalation tags</h4>
        <p>Когда разговор попадает в один из тегов — агент <b>не импровизирует</b>, а эскалирует на человека.</p>
        <ul>
          <li><b>regulated</b> — мед/юр/фин советы. Юридический риск.</li>
          <li><b>emotional</b> — смерть в семье, кризис, сильный стресс. Не наш контекст.</li>
          <li><b>novel_objection</b> — возражение, которого нет в branches. Лучше передать, чем выдумать.</li>
        </ul>

        <h4>Closed-loop confirmation</h4>
        <p>Перед тем как пометить цель достигнутой (записал, оформил, изменил), агент обязан <b>повторить результат</b> и получить явное «да».</p>
        <p>Без этого: агент решил, что записал, а клиент имел в виду «подумаю». Молчание ≠ согласие.</p>
      </>
    ),
  },
  {
    id: 'activation',
    icon: 'play_circle',
    title: 'Activation rules',
    body: (
      <>
        <p>Когда optional-скилл должен активироваться. Игнорируется для core-скиллов (они всегда on).</p>
        <ul>
          <li><b>Keywords</b> — массив фраз. Если LLM «слышит» одну из них в реплике юзера, он сам решает активировать.</li>
          <li>Confidence threshold можно не трогать — дефолт работает.</li>
        </ul>
        <p className="callout">Сильный сигнал — глаголы намерения: «записать», «отменить», «вернуть деньги». Слабый — общие слова: «здравствуйте», «помогите».</p>
      </>
    ),
  },
  {
    id: 'data',
    icon: 'build',
    title: 'Data & Tools',
    body: (
      <>
        <h4>Required data</h4>
        <p>Поля, которые агент обязан собрать до завершения скилла. На каждое поле:</p>
        <ul>
          <li><b>Name</b> — snake_case, попадает в результат звонка как ключ JSON.</li>
          <li><b>Type</b> — text / email / phone / date / number / boolean. По типу включается валидация.</li>
          <li><b>Required</b> — если true, скилл не закончится без этого поля.</li>
          <li><b>Description</b> — что именно агент должен спросить.</li>
        </ul>
        <p className="callout">Ставь <i>required: true</i> только для критичного. Каждое required-поле = ещё один вопрос. Длинный список превращает звонок в анкету.</p>

        <h4>Tool sequence</h4>
        <p>Порядок tool calls, который агент должен выполнить во время скилла. Например: `crm_lookup` → если не найден `crm_create`.</p>

        <h4>Allowed tools</h4>
        <p>Белый список — какие тулы скилл вообще имеет право вызвать. По умолчанию пусто = все доступные. Стоит сузить, чтобы скилл «оформить запись» не вызвал случайно `send_payment`.</p>
      </>
    ),
  },
  {
    id: 'escalation',
    icon: 'warning',
    title: 'Escalation & Interruption',
    body: (
      <>
        <h4>Escalation conditions</h4>
        <p>Триггеры передачи человеку. Это динамические условия (sentiment, retries, timeout), в отличие от статических <i>escalation_tags</i> в Human-Like разделе.</p>
        <ul>
          <li><b>negative_sentiment</b> — клиент злится. Threshold 0.3 = эскалация если sentiment ниже -0.3.</li>
          <li><b>max_retries</b> — N раз не понял ответ. Threshold = N.</li>
          <li><b>user_request</b> — клиент просит человека. Threshold 1.</li>
          <li><b>timeout</b> — слишком долго не двигается к цели.</li>
        </ul>

        <h4>Interruption rules</h4>
        <p>Можно ли перебивать агента и что делать.</p>
        <ul>
          <li><b>allow_interruption: true</b> — почти всегда true. Иначе агент перебивает клиента, выглядит как робот.</li>
          <li><b>pause_on_interrupt: true</b> — мгновенно замолчать и слушать.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'completion',
    icon: 'check_circle',
    title: 'Completion criteria',
    body: (
      <>
        <p>Когда скилл считается выполненным. Без этого агент может либо болтаться вечно, либо завершить слишком рано.</p>
        <ul>
          <li><b>all_data_collected: true</b> — все required-поля заполнены.</li>
          <li><b>confirmation_required: true</b> — клиент явно подтвердил.</li>
          <li><b>issue_resolved: true</b> — для жалоб: проблема решена.</li>
          <li><b>success_message</b> — что сказать в конце.</li>
        </ul>
        <p className="callout">Сочетай с <b>Closed-loop confirmation</b> в Human-Like — это страховка от ложных «готово».</p>
      </>
    ),
  },
  {
    id: 'rules',
    icon: 'auto_awesome',
    title: 'Главные правила (TL;DR)',
    body: (
      <>
        <ol>
          <li><b>Skill = одна цель.</b> Не пихай в один скилл «запись + жалоба + продажа». Лучше три отдельных.</li>
          <li><b>Conversation rules — императивно.</b> «Спроси X. Подтверди Y». А не «агент мог бы…».</li>
          <li><b>1–2 предложения на ход.</b> Один вопрос за раз. Никогда не дампи весь контекст.</li>
          <li><b>Talk-listen ≤55%.</b> Меньше говорить — выше конверсия. Доказано на 500 звонках.</li>
          <li><b>Никакого «просто»/«just».</b> Убивает recovery возражения.</li>
          <li><b>Closed-loop перед completion.</b> «Записываю на вторник 14:00, верно?» → ждём «да».</li>
          <li><b>Не клонируй жёсткий скрипт.</b> Adherence 78% / 23% конверсия топа vs 93% / 11% худшего. Жёсткий скрипт = робот.</li>
          <li><b>Тестируй на 10 реальных звонках,</b> прежде чем включать в продакшен. И <i>слушай</i> записи — текст транскрипта врёт.</li>
        </ol>
      </>
    ),
  },
];

export default function SkillGuide({ open, onClose, initialSection = 'start' }: SkillGuideProps) {
  const [active, setActive] = useState(initialSection);

  useEffect(() => {
    if (open) setActive(initialSection);
  }, [open, initialSection]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const current = SECTIONS.find(s => s.id === active) ?? SECTIONS[0];

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close guide overlay" onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <aside className="relative w-full md:w-[640px] lg:w-[760px] h-full bg-[var(--th-card)] shadow-[0_20px_60px_rgba(0,0,0,0.4)] flex flex-col border-l border-[var(--th-card-border-subtle)] animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--th-card-border-subtle)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_2px_8px_rgba(99,102,241,0.4)]">
              <span className="material-symbols-outlined text-white text-lg">menu_book</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--th-text)]">Как настроить скилл</h2>
              <p className="text-xs text-[var(--th-text-muted)]">Гайд по полям и лучшим практикам</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close guide"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)] transition-colors">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar nav */}
          <nav className="hidden md:flex flex-col w-52 border-r border-[var(--th-card-border-subtle)] py-3 overflow-y-auto flex-shrink-0">
            {SECTIONS.map(s => (
              <button key={s.id} type="button" onClick={() => setActive(s.id)}
                className={`flex items-center gap-2 px-4 py-2.5 mx-2 rounded-xl text-sm text-left transition-all ${
                  s.id === active
                    ? 'bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white font-semibold shadow-[0_2px_8px_var(--th-shadow-primary)]'
                    : 'text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)]'
                }`}>
                <span className="material-symbols-outlined text-base">{s.icon}</span>
                <span>{s.title}</span>
              </button>
            ))}
          </nav>

          {/* Mobile tabs */}
          <div className="md:hidden flex overflow-x-auto border-b border-[var(--th-card-border-subtle)] px-2 py-2 gap-1 absolute top-[73px] left-0 right-0 bg-[var(--th-card)] z-10 scrollbar-none">
            {SECTIONS.map(s => (
              <button key={s.id} type="button" onClick={() => setActive(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-all ${
                  s.id === active
                    ? 'bg-gradient-to-r from-[var(--th-primary)] to-indigo-600 text-white font-semibold'
                    : 'text-[var(--th-text-secondary)] hover:bg-[var(--th-surface)]'
                }`}>
                <span className="material-symbols-outlined text-base">{s.icon}</span>
                <span>{s.title}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto pt-12 md:pt-0">
            <article className="skill-guide-content max-w-2xl mx-auto px-5 py-5 md:px-7 md:py-7 text-sm leading-relaxed text-[var(--th-text-secondary)]">
              <h3 className="text-xl font-bold text-[var(--th-text)] mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--th-primary)]">{current.icon}</span>
                {current.title}
              </h3>
              {current.body}
            </article>
          </div>
        </div>
      </aside>

      <style jsx>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right { animation: slide-in-right 0.2s ease-out; }
      `}</style>

      <style jsx global>{`
        .skill-guide-content h4 {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--th-text);
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .skill-guide-content h4:first-child { margin-top: 0; }
        .skill-guide-content p { margin: 0.6rem 0; }
        .skill-guide-content ul, .skill-guide-content ol { margin: 0.6rem 0 0.6rem 1.25rem; padding: 0; }
        .skill-guide-content ul { list-style: disc; }
        .skill-guide-content ol { list-style: decimal; }
        .skill-guide-content li { margin: 0.3rem 0; }
        .skill-guide-content code {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.85em;
          padding: 0.1em 0.35em;
          background: var(--th-surface);
          border-radius: 0.35em;
          color: var(--th-text);
        }
        .skill-guide-content b { color: var(--th-text); font-weight: 600; }
        .skill-guide-content i { color: var(--th-text); font-style: italic; }
        .skill-guide-content .callout {
          background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.08));
          border: 1px solid rgba(99,102,241,0.18);
          border-radius: 0.75rem;
          padding: 0.75rem 1rem;
          margin: 0.85rem 0;
          font-size: 0.85rem;
        }
        .skill-guide-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 0.75rem 0;
          font-size: 0.85rem;
        }
        .skill-guide-content td {
          padding: 0.5rem 0.6rem;
          border-bottom: 1px solid var(--th-card-border-subtle);
          vertical-align: top;
        }
        .skill-guide-content td:first-child { white-space: nowrap; color: var(--th-text); }
        .skill-guide-content td:nth-child(2) {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          color: var(--th-primary-text);
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
