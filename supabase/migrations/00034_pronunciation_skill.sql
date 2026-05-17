-- Seed a "Pronunciation (US Russian)" skill per workspace and auto-attach it
-- to every existing agent. This skill teaches the agent to say times, dates,
-- numbers, addresses, and prices the way a Russian-speaking person in the US
-- actually speaks — NOT in formal 24-hour military style. Idempotent.

INSERT INTO skill_packs (
  workspace_id,
  name,
  description,
  intent,
  conversation_rules,
  is_active,
  activation_rules
)
SELECT
  w.id,
  'Произношение (Russian for US context)',
  'Правила устной речи на русском в американском контексте: время в 12-часовом формате (утра/дня/вечера), цифры по одной в телефонах и адресах, транслитерация английских названий улиц и городов, доллары и центы.',
  'pronunciation_us_ru',
  $RULES$
APPLIES WHEN: the call language is Russian (call_language = ru) AND the workspace is in the US context.

This skill governs HOW you SAY numbers, times, dates, addresses, and prices out loud. The TTS engine speaks exactly what you write — so write the spoken form, not the digit form. NEVER read "5:00 PM" literally — convert it first.

═══ TIME ═══

Use the 12-HOUR Russian system with утра / дня / вечера / ночи — like Americans do, not 24-hour military style.

Period-of-day mapping:
- 6:00–11:59 → «утра»   ("девять утра")
- 12:00–16:59 → «дня»   ("два дня", "четыре дня")
- 17:00–21:59 → «вечера» ("пять вечера", "восемь вечера")
- 22:00–5:59 → «ночи»   ("одиннадцать ночи", "три ночи")
- 12:00 точно → «полдень»; 00:00 точно → «полночь»

NEVER say "семнадцать часов", "восемнадцать часов" — that's military and sounds robotic. Always convert:
- 17:00 → «пять вечера»
- 18:30 → «полседьмого вечера» OR «шесть тридцать вечера»
- 14:00 → «два часа дня» / «два дня»
- 09:15 → «девять пятнадцать утра» OR «пятнадцать минут десятого» (less common in casual)

For minutes — pick the casual style by default:
- 5:00 → «пять вечера» / «пять часов вечера»
- 5:15 → «пять пятнадцать вечера» (casual, US-style) — preferred
- 5:30 → «полшестого вечера» (very common) OR «пять тридцать вечера»
- 5:45 → «без четверти шесть вечера» OR «пять сорок пять вечера»
- 5:05 → «пять ноль пять вечера»

PHRASING for booking: «записываем на пять вечера», «давайте в три дня», «давайте в десять утра».

═══ PHONE NUMBERS ═══

US phone numbers have format (XXX) XXX-XXXX. Always say DIGIT BY DIGIT in Russian, ONE digit at a time. Never group into hundreds/thousands.

- 818-555-0123 → «восемь-один-восемь, пять-пять-пять, ноль-один-два-три»
- Pauses (commas) between the three groups: area code, prefix, line.
- "Ноль" — never "о" / "оу".
- Confirm by repeating the same way back. Spell out doubles: «два-два» not «двадцать два».

For DICTATING TO the other side, slow down, very clear: «во-семь, о-дин, во-семь, пять, пять, пять, ноль, о-дин, два, три».
For HEARING from the other side, repeat once for clarity, then move on.

═══ ADDRESSES (US) ═══

NEVER translate street names — TRANSLITERATE them.
- "Sunset Boulevard" → «Сансет-бульвар» (NOT «бульвар Закат»)
- "Main Street" → «Мейн-стрит» (NOT «Главная улица»)
- "Wilshire Blvd" → «Уилшир-бульвар»
- "Pico" → «Пико»
- "Hollywood" → «Голливуд»

House numbers — read digit by digit OR in small groups (2 digits at a time):
- 12345 → «один-два-три-четыре-пять» OR «двенадцать-триста сорок пять» (US "twelve thirty-four five" style)
- 8200 → «восемь-две тысячи» OR «восемь-два-ноль-ноль»

City names — keep English transliteration:
- "Los Angeles" → «Лос-Анджелес»
- "San Francisco" → «Сан-Франциско»
- "New York" → «Нью-Йорк»
- "Beverly Hills" → «Беверли-Хиллз»

State abbreviations — say the full state name in Russian when possible:
- "CA" → «Калифорния»
- "NY" → «Нью-Йорк»
- "TX" → «Техас»
- If you must use letters: «си-эй», «эн-уай», «ти-экс».

Zip codes — digit by digit, in pairs/triplets if natural:
- 90028 → «девять-ноль-ноль-два-восемь»
- 10001 → «один-ноль-ноль-ноль-один»

═══ MONEY (USD) ═══

- $100 → «сто долларов»
- $5 → «пять долларов»
- $1 → «один доллар»
- $1,500 → «полторы тысячи долларов» OR «тысяча пятьсот долларов»
- $5.99 → «пять долларов девяносто девять центов» (formal) OR «пять девяносто девять» (casual, US-style)
- $0.50 → «пятьдесят центов»

If the price is a tip / casual amount — use casual style. If it's a formal invoice / large amount — use full form.

═══ DATES ═══

Spoken Russian dates: «(день) (месяц) (год)».
- 03.07.2026 → «третье июля две тысячи двадцать шестого года»
- 17 декабря → «семнадцатое декабря»
- "today" → «сегодня» (not the digit form)
- "tomorrow" → «завтра»
- "next Tuesday" → «в следующий вторник»

Day of week — full Russian word: понедельник, вторник, среда, четверг, пятница, суббота, воскресенье. Not abbreviations.

═══ ID, ORDER #, ANY ALPHANUMERIC CODE ═══

ALWAYS digit by digit, letter by letter:
- "Order #SL4418D" → «эс-эл, четыре-четыре-один-восемь, дэ»
- Pauses between letter groups and number groups.
- Use Russian letter names: А, Бэ, Вэ, Гэ, Дэ, Е, Жэ, Зэ, И, Ка, Эль, Эм, Эн, О, Пэ, Эр, Эс, Тэ, У, Эф, Ха, Цэ, Че, Ша, Ща, Ы, Э, Ю, Я.
- For English letters in codes: use the Russian phonetic name — A=«эй», B=«би», C=«си», D=«ди», E=«и», F=«эф», K=«кей», L=«эл», M=«эм», N=«эн», S=«эс», T=«ти», V=«ви», W=«дабл-ю», X=«экс», Y=«вай», Z=«зэт».

═══ EMAIL ADDRESSES ═══

- @ → «собака» (casual) OR «эт» (technical) — pick "собака" for warm tone, "эт" for formal.
- . → «точка»
- - → «дефис» (in handles) OR «минус» (in numbers)
- _ → «нижнее подчёркивание»
- Spell out the part before @ letter by letter when unfamiliar: "john@" = «джон собака», but "x4z@" = «экс-четыре-зэт собака».

═══ SUMMARY ═══

Three core rules:
1. NEVER speak 24-hour military time in Russian — convert to утра/дня/вечера/ночи.
2. Phone numbers, IDs, zip codes — digit by digit, never grouped as hundreds.
3. US streets/cities — transliterate (Cyrillic), never translate.
$RULES$,
  true,
  '{"always_active": true, "applies_to": "russian_calls_us_context", "notes": "Core pronunciation discipline. Applies whenever the call is in Russian. Auto-attached to every agent."}'::jsonb
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM skill_packs sp
  WHERE sp.workspace_id = w.id
    AND sp.intent = 'pronunciation_us_ru'
);

-- Auto-attach the new skill to every agent in every workspace.
INSERT INTO agent_skill_packs (agent_profile_id, skill_pack_id, priority)
SELECT ap.id, sp.id, 10
FROM agent_profiles ap
JOIN skill_packs sp
  ON sp.workspace_id = ap.workspace_id
 AND sp.intent = 'pronunciation_us_ru'
WHERE NOT EXISTS (
  SELECT 1 FROM agent_skill_packs asp
  WHERE asp.agent_profile_id = ap.id
    AND asp.skill_pack_id = sp.id
);
