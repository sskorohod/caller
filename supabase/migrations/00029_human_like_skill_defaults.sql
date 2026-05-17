-- Fill in the remaining default settings for the seeded "Human-Like Conversation" skill.
-- Only updates rows where the field is still at its empty default — never overrides
-- a workspace's manual edits.

-- 1) Objection branches — universal patterns from research on 500 real cold calls.
--    Bilingual triggers. Each follows acknowledge → pivot → specific next step.
UPDATE skill_packs
SET objection_branches = $BRANCHES$[
  {
    "trigger": "не интересно / not interested",
    "response": "Понимаю. А что если коротко покажу, что бы это вам дало? Удобнее во вторник в 14:00 или в среду утром? / I get it. Quick question — would a free look take 10 minutes Tuesday at 2 or Wednesday morning?",
    "action": ""
  },
  {
    "trigger": "дорого / too expensive",
    "response": "Понимаю про бюджет. Скажите, с чем сравниваете — и я подскажу, есть ли смысл вообще говорить дальше. / Fair. What are you comparing it to? That'll tell us in a minute if this even makes sense.",
    "action": ""
  },
  {
    "trigger": "перезвоните позже / call back later",
    "response": "Конечно. Когда удобно — завтра до обеда или после трёх? / Sure — what works better, tomorrow before noon or after three?",
    "action": "schedule_callback"
  },
  {
    "trigger": "уже работаю с другим / already with competitor",
    "response": "Хорошо. А что у них работает отлично, а чего не хватает? Не для продажи — просто чтобы понять, есть ли смысл смотреть. / Got it. What's working great with them, and what's the one thing missing? Not to pitch — just to see if there's any reason to look.",
    "action": ""
  },
  {
    "trigger": "пришлите на почту / send info by email",
    "response": "Без проблем — на какой email? Пока пишу, скажите в двух словах, какая у вас задача — пришлю не общее описание, а ровно то, что вам нужно. / Sure — what's the best email? While I write it down, tell me in one line what you're trying to solve, so I send the right thing instead of a generic deck.",
    "action": "collect_email"
  },
  {
    "trigger": "я подумаю / let me think about it",
    "response": "Конечно. А над чем именно — может, что-то уточню сейчас и думать не придётся? / Of course. What specifically — happy to answer the actual question now so you don't have to think about it later.",
    "action": ""
  },
  {
    "trigger": "у меня нет времени / I have no time",
    "response": "Понимаю, поэтому 30 секунд — потом сами решите, продолжать или нет. Окей? / I hear you — 30 seconds, then you decide if it's worth continuing. Fair?",
    "action": ""
  },
  {
    "trigger": "откуда у вас мой номер / how did you get my number",
    "response": "Хороший вопрос. [укажи источник]. Если хотите, удалю прямо сейчас — но сначала позвольте назвать одну причину, ради которой стоит послушать 20 секунд. / Fair question — [source]. Happy to remove you right now, but let me give you one reason it's worth 20 seconds first.",
    "action": ""
  }
]$BRANCHES$::jsonb
WHERE intent = 'human_like_conversation'
  AND objection_branches = '[]'::jsonb;

-- 2) Interruption rules — agent must allow interruptions and pause on them.
--    Critical for human-likeness: never speak over the caller.
UPDATE skill_packs
SET interruption_rules = '{
  "allow_interruption": true,
  "pause_on_interrupt": true,
  "resume_after_clarification": false
}'::jsonb
WHERE intent = 'human_like_conversation'
  AND interruption_rules = '{}'::jsonb;

-- 3) Escalation conditions — when to hand off to a human.
UPDATE skill_packs
SET escalation_conditions = '[
  {
    "type": "negative_sentiment",
    "threshold": "0.3",
    "action": "transfer_human",
    "message": "Понимаю, что это важно. Передаю звонок коллеге, секунду."
  },
  {
    "type": "user_request",
    "threshold": "1",
    "action": "transfer_human",
    "message": "Конечно, передам человеку прямо сейчас."
  },
  {
    "type": "max_retries",
    "threshold": "3",
    "action": "transfer_human",
    "message": "Подключу коллегу — он поможет точнее."
  }
]'::jsonb
WHERE intent = 'human_like_conversation'
  AND escalation_conditions = '[]'::jsonb;

-- 4) Completion criteria — closed-loop discipline at the skill boundary.
UPDATE skill_packs
SET completion_criteria = '{
  "confirmation_required": true,
  "success_message": "Хорошо, всё подтвердили. Хорошего дня!"
}'::jsonb
WHERE intent = 'human_like_conversation'
  AND completion_criteria = '{}'::jsonb;

-- 5) Activation rules — Human-Like is a CORE skill, so activation_rules don't
--    gate it. But fill keywords for completeness/visibility.
UPDATE skill_packs
SET activation_rules = '{
  "always_active": true,
  "applies_to": "all_calls",
  "notes": "Core conversation discipline — attach to every agent. Activation keywords are not used; this skill is always on once attached."
}'::jsonb
WHERE intent = 'human_like_conversation'
  AND activation_rules = '{}'::jsonb;
