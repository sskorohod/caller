---
title: Live Translator — Debugging Runbook
type: concept
created: 2026-04-21
updated: 2026-04-21
tags: [live-translator, debugging, operations, runbook]
sources: []
---

# Live Translator — Debugging Runbook

Пошаговый runbook для диагностики пропущенных, обрезанных или некорректных переводов в [[live-translator]]. **Начинай отсюда** — не нужно заново читать исходники, когда прилетает баг-репорт уровня "вот в этом звонке он не перевёл слово X".

---

## 1. Архитектура в одном кадре

```
Twilio Media Stream  ──μ-law 8kHz──▶  ConferenceTranslator
                                             │
                                             ▼
                              Grok Voice Agent WebSocket  ← STT + LLM + TTS в одной сессии
                                             │
                              ┌──────────────┴──────────────┐
                              ▼                             ▼
                      response.audio.delta            response.done
                      (streaming PCM-μ в Twilio)      (final transcript)
                              │                             │
                              ▼                             ▼
                      Twilio media frames           transcript[] push  +  Socket.IO emit
                                                          │
                                                          ▼
                                               translator_sessions.transcript (JSONB)
```

Единственный source of truth: [packages/backend/src/services/conference-translator.ts](../../../packages/backend/src/services/conference-translator.ts).
Важное отличие от обычного [[voice-ai-pipeline]]: **никакого Deepgram/OpenAI в цепочке** — всё STT/LLM/TTS делает Grok Voice Agent. VAD тоже у него (`server_vad`).

---

## 2. Где что лежит

| Слой | Где искать |
|------|------------|
| Транскрипт сессии | Таблица `translator_sessions.transcript` (JSONB массив `{speaker, text, lang, translated, timestamp, untranslated?}`) |
| Схема БД | [packages/backend/src/db/schema.ts:554-589](../../../packages/backend/src/db/schema.ts#L554-L589) + [supabase/migrations/00011_translator_tables.sql](../../../supabase/migrations/00011_translator_tables.sql) |
| Docker-логи backend | `docker compose logs backend` на UGREEN. Формат: pino-json. Фильтруй по `callId` |
| Twilio recording (mp3) | MinIO, путь лежит в `call_sessions.recording_url` (если webhook успел; fallback — post-call worker подтягивает через 30s) |
| UI истории | Subscriber portal: `/translator/portal`. Админка: `/dashboard/translator` |
| API чтения сессий | `GET /api/translator/portal/sessions` (subscriber) / `GET /api/translator/sessions` (admin) |

Ключевая особенность: **до фикса 2026-04-21 фразы с пустым переводом silent-droppились** и не попадали ни в БД, ни в логи. После фикса — пишутся с `untranslated: true` и warn-логом `Translation dropped: empty output from Grok`.

---

## 3. Быстрая диагностика (copy-paste)

### Последние 5 сессий
```bash
ssh ugreen 'cd ~/caller && docker compose exec -T postgres psql -U caller -d caller -c "
  SELECT id, call_id, created_at, duration_seconds, status,
         jsonb_array_length(transcript) AS turns
  FROM translator_sessions ORDER BY created_at DESC LIMIT 5;"'
```

### Транскрипт одной сессии
```bash
ssh ugreen 'cd ~/caller && docker compose exec -T postgres psql -U caller -d caller -At -c "
  SELECT jsonb_pretty(transcript) FROM translator_sessions WHERE id = '"'"'<UUID>'"'"';"'
```

### Все пропущенные фразы за сутки (после фикса 2026-04-21)
```bash
ssh ugreen 'cd ~/caller && docker compose exec -T postgres psql -U caller -d caller -c "
  SELECT s.id, s.call_id, s.created_at, turn->>'"'"'text'"'"' AS untranslated_text
  FROM translator_sessions s,
       jsonb_array_elements(s.transcript) turn
  WHERE (turn->>'"'"'untranslated'"'"')::boolean = true
    AND s.created_at > NOW() - INTERVAL '"'"'1 day'"'"';"'
```

### Логи backend по конкретному callId
```bash
ssh ugreen "cd ~/caller && docker compose logs backend --since 6h 2>&1 | grep '<callId>'"
```
Ищи маркеры:
- `Translation dropped: empty output from Grok` — silent-drop (нужен фикс от 2026-04-21)
- `Same-language echo detected` — Grok вернул выход в языке входа, потребовал re-translate
- `Greeting response timed out` — приветствие не доиграло за 15s (теперь есть safety net)
- `Grok Voice Agent error` — провайдерская ошибка
- `Playback ended` (debug-level) — завершение проигрывания перевода

### Recording (mp3) из MinIO
```bash
ssh ugreen 'cd ~/caller && docker compose exec -T postgres psql -U caller -d caller -At -c "
  SELECT recording_url FROM call_sessions WHERE call_id = '"'"'<callId>'"'"';"'
```
URL вида `minio://<workspace>/<yyyy-mm-dd>/<CallSid>_<RecordingSid>.mp3` — слушай через внутренний MinIO UI или скачивай через `mc`.

---

## 4. Известные точки потери фразы

| # | Место | Файл:строка | Что происходит | Как опознать |
|---|-------|-------------|----------------|--------------|
| 1 | VAD silence timeout | [conference-translator.ts:237](../../../packages/backend/src/services/conference-translator.ts#L237) | `silence_duration_ms: 1400` — длинная пауза внутри фразы может разрезать её на два turn'а | В transcript один turn — обрубок |
| 2 | Playback protection | [conference-translator.ts:395-398, 416-420](../../../packages/backend/src/services/conference-translator.ts#L395-L398) | Пока играет предыдущий перевод (до 6s), входящий audio дропается | В transcript пропущен целый turn сразу после чужого |
| 3 | Greeting guard | [conference-translator.ts:395](../../../packages/backend/src/services/conference-translator.ts#L395) | До `greetingPlayed=true` (~1.5s) входящий audio дропается | Первые пара секунд звонка "глухие" |
| 4 | detectScript < 2 букв | [conference-translator.ts:377-387](../../../packages/backend/src/services/conference-translator.ts#L377-L387) | Если во фразе меньше 2 латинских/кириллических букв — скрипт не определяется | Короткие реплики ("30", "ок") иногда обрабатываются не так как ожидается |
| 5 | Same-language echo re-translate | [conference-translator.ts:665-695](../../../packages/backend/src/services/conference-translator.ts#L665-L695) | Grok вернул тот же скрипт что на входе → просим re-translate. Если второй ответ тоже плохой, фраза теряется | В логах `Same-language echo detected`, а в transcript turn'а нет |
| 6 | Silent-drop пустого вывода (ДО фикса 2026-04-21) | [conference-translator.ts:658, 753-790](../../../packages/backend/src/services/conference-translator.ts#L658) | Grok отправил `response.done` с пустым `translated` — до фикса silent-dropped; **после фикса** пишется с `untranslated: true` и warn'ом | Warn `Translation dropped: empty output from Grok` + запись в transcript с `untranslated: true` |
| 7 | Filler-sound инструкция LLM | `buildInstructions()` в том же файле | Grok обучен молчать на "эм, угу, ммм" | Короткие филлеры корректно игнорируются, но длинные фразы начинающиеся с "Э," обычно проходят |
| 8 | Streaming min length | [conference-translator.ts:507](../../../packages/backend/src/services/conference-translator.ts#L507) | `currentOutputTranscript.length < 6` — слишком короткий вывод не начинает streaming, дожидается `response.done` | Для очень коротких переводов ("Hi", "Да") audio играет с задержкой ~200ms |

---

## 5. Типовые симптомы → причина → фикс

| Симптом | Вероятная причина | Что проверить / как чинить |
|---------|-------------------|---------------------------|
| "Фраза разрезана на две" | #1 VAD cutoff | Увеличить `silence_duration_ms` ещё на 200-400ms или сделать адаптивным по числам |
| "Собеседник не услышал перевод, хотя в transcript он есть" | Twilio packet loss / #2 playback overlap | Послушать recording — был ли TTS проигран вообще. Если да — проблема на стороне Twilio клиента |
| "Пропал целый turn, в transcript его нет" (после фикса — до фикса было silent) | #2 playback protection или #3 greeting guard | Свериться с логами `Translation dropped` и timestamps соседних turn'ов |
| "Перевод в том же языке что оригинал" | #5 echo re-translate сфейлился | `Same-language echo detected` в логах; если много — тюнить prompt |
| "В transcript есть `untranslated: true`" | #6 Grok вернул пустоту | Посмотреть исходный текст — это был филлер или реальная фраза? Если реальная — возможно баг Grok |
| "Первые секунды звонка глухие" | #3 greeting guard | Норма. Если длится >3s — смотреть `Greeting response timed out` |

---

## 6. Deploy flow (повторяемый)

Стандартный цикл для изменений в [packages/backend](../../../packages/backend):

```bash
# 1. Commit & push
git add -A && git commit -m "..." && git push

# 2. Deploy на UGREEN
ssh ugreen 'cd ~/caller && git pull && docker compose build backend && docker compose up -d backend'

# 3. При новых миграциях
ssh ugreen 'cd ~/caller && docker compose exec -T backend node dist/migrate.js'

# 4. Смок-чек
ssh ugreen 'cd ~/caller && docker compose logs backend --tail 50'
```

Продакшн URL: `https://caller.n8nskorx.top` (Cloudflare Tunnel → UGREEN :8880 → nginx → backend).

**Не трогать**: Caddy на UGREEN, Cloudflare Tunnel конфиг. Только `docker-compose.yml` и код.

---

## 7. Полезные инварианты

1. **Pipeline — Grok Voice Agent, не Deepgram.** Настройки VAD/STT у Grok, в `session.update`. Забудьте про Deepgram URL параметры `numerals`/`smart_format` — они тут не применимы.
2. **До фикса 2026-04-21 silent-drop не логировался.** Если баг был раньше этой даты — нет смысла искать warn в логах, его нет.
3. **Все запросы к БД должны быть scoped по `workspace_id`.** В debug-запросах выше это опущено для ясности, но в API код обязан фильтровать.
4. **`transcript` — JSONB, миграции под новые поля НЕ нужны.** Добавление `untranslated?: boolean` обратно-совместимо.
5. **`cyrillicRatio > 0.3` — эвристика направления.** Для не-кириллических пар языков (es↔en и т.п.) она всегда возвращает `isMyLang = (myLang !== 'ru')` — т.е. просто сравнивает `myLang` с 'ru'. Если будут добавлены не-RU subscriber'ы с не-EN собеседниками, эту логику придётся переделывать.
6. **Cost pricing.** `costVoiceAgent = durationMins * 0.05` (хардкод Grok цены) + telephony. См. [finalize()](../../../packages/backend/src/services/conference-translator.ts#L772).

---

## Cross-References

- [[live-translator]] — сам продукт
- [[voice-ai-pipeline]] — общая архитектура voice AI в проекте
- [[caller-platform]] — родительская B2B платформа, инфраструктура общая

## Case Log

### [2026-04-21] "30 minutes" не было переведено

- **Сессия**: `48829987-1810-4e48-9977-2f2ed0a271a3` (callId `3c08aa8b-6551-4201-8467-d2500f54cd30`), 185s, 10 turns
- **Жалоба**: subscriber услышал фразу "Э, я за 30 минут до выезда..." и решил, что она не была переведена
- **Факт из транскрипта**: Turn 6 (15:19:11 UTC) → `translated: "Uh, 30 minutes before I leave, before I arrive, I'll call you on the phone."` — **перевод был**
- **Логи**: чистые, никаких `Translation dropped`, `echo`, errors
- **Вывод**: перевод был сгенерирован, но до subscriber'а не долетел — либо Twilio-side packet loss, либо TTS был воспроизведён в момент когда subscriber уже говорил следующую фразу (подтвердить через recording)
- **Фиксы внесены**: A) warn на silent-drop, B) VAD 1000→1400ms (меньше ложных cutoff'ов), C) запись `untranslated:true` в transcript — чтобы такие кейсы в будущем были явно видны
