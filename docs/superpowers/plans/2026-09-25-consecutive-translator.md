# Последовательный переводчик aidispatch V2 — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить голосовые движки LingoLine последовательным переводчиком из aidispatch (V2): расшифровка `gpt-live-transcribe` → ядро очерёдности → перевод GPT‑6 Luna → озвучка `gpt-4o-mini-tts`, заранее и по репликам, через Twilio Media Streams.

**Architecture:** Новый каталог `packages/backend/src/services/consecutive/` — модуль-в-модуль порт `~/aidispatch/agent/consecutive/*` на коммите **`9e4b1eb`**, плюс три новых модуля вместо LiveKit (Silero VAD через onnxruntime-web, вывод в Twilio, аудио-конвертеры). `ConsecutiveTranslator` реализует тот же duck-typed интерфейс, что `StealthTranslator`, и встаёт в `buildTranslator` в `media-stream.ts`. Realtime- и Grok-движки удаляются; каскад Deepgram остаётся для stealth, пар с одним алфавитом и отката.

**Tech Stack:** Node 22, TypeScript 5.7 (ESM), `ws`, `openai@4.104`, `onnxruntime-web@1.30.0` (новая), Drizzle, Fastify, Next.js 15 (админка), `node:test` + `tsx` для тестов.

**Спека:** `docs/superpowers/specs/2026-09-25-consecutive-translator-design.md`.

---

## Как работать

- **Git:** `/usr/bin/git` сейчас заблокирован (не принята лицензия Xcode). Везде используйте
  `G=/Library/Developer/CommandLineTools/usr/bin/git` и `$G …`. Ветка: `feat/consecutive-translator`.
- **Эталон кода:** `~/aidispatch` на `9e4b1eb`. Читайте файл целиком (и его тест) перед портом:
  `$G -C ~/aidispatch show 9e4b1eb:agent/consecutive/floor.py`. Рабочее дерево aidispatch
  меняется другими сессиями — **только `git show 9e4b1eb:…`**, не `cat`.
- **Тесты:** из `packages/backend`: `node --import tsx --test src/services/consecutive/<file>.test.ts`;
  все: `npm test` (после задачи 0). Типы: `npx tsc --noEmit` из `packages/backend`.
- **Для задач-портов код — это исходник Python на `9e4b1eb`.** План задаёт TS-контракт, отличия и
  тесты; тело переносится строка в строку. Это сознательное отступление от «весь код в плане»:
  дублировать 2700 строк эталона сюда бессмысленно.

### Правила переноса Python → TypeScript (для всех задач-портов)

1. Поведение совпадает построчно: те же состояния, тот же порядок проверок, те же константы (кроме
   явно перечисленных в задаче). Комментарии-обоснования («почему») переносятся, переведённые на
   английский, коротко. Русские комментарии в код caller не попадают.
2. Имена: функции и поля — camelCase, константы — UPPER_SNAKE, классы — как в Python.
3. Истинность: Python `a or b` на числах/строках → `a || b` (0 и '' ложны в обоих языках);
   `x if x is not None else y` → `x ?? y`. `None` в полях → `null` (не `undefined`).
4. `math.inf` → `Infinity`; `defaultdict(int)` → `Record<string, number>` + хелпер `inc(k)`;
   `deque(maxlen=n)` → массив с `shift()` при переполнении; `dict[tuple]` → `Map` с ключом
   `` `${a}\u0000${b}` ``; `set` → `Set`; `sorted(key=…)` → `.sort()` с явным компаратором;
   `int(x)` → `Math.trunc(x)`; Python `round(x)` → банковское округление `roundHalfEven`.
5. asyncio → промисы. `create_task` → промис в `Set` с `.catch()`; `task.cancel()` →
   `AbortController.abort()` **плюс проверка «отменено» сразу после каждого `await`**: в Python
   `CancelledError` пропускает остаток функции и **не** считается ошибкой — повторяйте это ранним
   `return` без побочных эффектов и без `errors += 1`. `asyncio.timeout(s)` →
   `AbortSignal.any([signal, AbortSignal.timeout(ms)])`; `loop.call_later` → `setTimeout` с
   сохранённым хендлом.
6. Логи: `pino({ name: 'consecutive' })`; в лог — только имя класса ошибки
   (`(err as Error)?.name`), никогда `message` (там бывает ключ API).
7. Импорты: относительные с суффиксом `.js`. **Модули `services/consecutive/` не импортируют
   статически ничего, что тянет `config/env.ts` или `config/db.ts`** (они бросают без окружения
   при импорте) — только `await import()` внутри функции. Статически можно: `config/pricing.ts`,
   `config/languages.ts`, `realtime/io.ts`, `openai`, `ws`, `pino`, `zod`.
8. Тесты: каждый тест из указанного Python-файла на `9e4b1eb` → `test('…', …)` из `node:test` с
   `assert` из `node:assert/strict`; имя — фраза из имени Python-теста; тот же сценарий и те же
   проверки. Подставные часы и клиенты — как в Python. Тест, который к caller неприменим, заменяется
   эквивалентом, и это перечислено в задаче.

---

## Карта файлов

**Создать** (`packages/backend/`):

| файл | ответственность |
|---|---|
| `assets/silero_vad_v5.onnx` | модель детектора речи (бинарь, 2 327 524 Б) |
| `src/services/consecutive/audio.ts` | µ-law ⇄ PCM16, пересэмплинг 8→16, 8→24, 24→8, уровни |
| `src/services/consecutive/policy.ts` | порт `policy.py` + алфавиты языков caller |
| `src/services/consecutive/floor.ts` | порт `floor.py` + односторонний режим, пауза, смена языков |
| `src/services/consecutive/judge.ts` | порт `judge.py` |
| `src/services/consecutive/echo.ts` | порт `echo.py` |
| `src/services/consecutive/transcribe.ts` | порт `transcribe.py` на `ws` |
| `src/services/consecutive/engine.ts` | порт `engine_v2.py` + тон, контекст, текстовые реплики, голоса |
| `src/services/consecutive/playback.ts` | порт `playback.py` на кадрах 8 кГц |
| `src/services/consecutive/twilio-out.ts` | вывод в Twilio: темп 400 мс и `clear` |
| `src/services/consecutive/vad.ts` | Silero v5 через onnxruntime-web, события как у LiveKit |
| `src/services/consecutive/settings.ts` | пороги из `platform_settings.translator_consecutive` |
| `src/services/consecutive/translator.ts` | `ConsecutiveTranslator`: сборка звонка, интерфейс для media-stream |
| `src/services/consecutive/*.test.ts` | тесты к каждому модулю |
| `src/services/consecutive/__fixtures__/speech8k.raw` | 2 с речи PCM16 8 кГц для теста Silero |
| `src/scripts/consecutive-smoke.ts` | сцена прогона без звонка |
| `supabase/migrations/00055_translator_session_metrics.sql` | колонка `metrics` |

**Изменить:** `packages/backend/package.json`, `packages/backend/package-lock.json`,
`package-lock.json` (корень), `packages/backend/tsconfig.json`, `packages/backend/Dockerfile`,
`docker-compose.yml`, `packages/backend/src/db/schema.ts`, `packages/backend/src/config/pricing.ts`,
`packages/backend/src/routes/webhooks/media-stream.ts`, `packages/backend/src/realtime/socket-server.ts`,
`packages/backend/src/routes/admin/index.ts`, `packages/frontend/src/app/admin/_lib/types.ts`,
`packages/frontend/src/app/admin/settings/page.tsx`, `packages/frontend/src/app/admin/sessions/page.tsx`,
комментарии в `stealth-translator.ts`, `sandbox-session.service.ts`, `translate-text.ts`,
`session-finalizer.service.ts`, `config/languages.ts`, `lib/lang-direction.ts`,
`packages/frontend/src/app/dashboard/page.tsx`; `CLAUDE.md`.

**Удалить:** `packages/backend/src/services/realtime-translator.ts`,
`packages/backend/src/services/conference-translator.ts`.

**Порядок и параллельность:** 0 → {1, 2, 5, 6, 11} → {3 (после 2), 4 (после 1), 7 (после 2),
8 (после 1), 9 (после 1), 10 (после 0, 1)} → 12 → {13, 14, 15, 16} → 17.

---

### Task 0: Раннер тестов, зависимость ONNX, модель Silero

**Files:**
- Modify: `packages/backend/package.json` (scripts, dependencies)
- Modify: `packages/backend/tsconfig.json`
- Modify: `packages/backend/package-lock.json`, `package-lock.json`
- Create: `packages/backend/assets/silero_vad_v5.onnx`
- Create: `packages/backend/src/services/consecutive/__fixtures__/speech8k.raw`
- Modify: `packages/backend/Dockerfile`

- [ ] **Step 1: Скрипт тестов и исключение тестов из сборки**

В `packages/backend/package.json`, секция `scripts`, после `"lint"`:

```json
    "lint": "eslint src/",
    "test": "node --import tsx --test \"src/**/*.test.ts\""
```

В `packages/backend/tsconfig.json`:

```json
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/**/*.test.ts"]
```

- [ ] **Step 2: Зависимость `onnxruntime-web@1.30.0` (точный пин) в оба lock-файла**

Корень (npm workspaces, для разработки):

```bash
cd /Users/vskorokhod/caller && npm install onnxruntime-web@1.30.0 --save-exact -w @caller/backend --no-audit --no-fund
```

Отдельный lock бэкенда (по нему собирает Docker `npm ci`), вне воркспейса:

```bash
cd /Users/vskorokhod/caller && TMP=$(mktemp -d) && cp packages/backend/package.json packages/backend/package-lock.json "$TMP"/ && (cd "$TMP" && npm install --package-lock-only --no-audit --no-fund) && cp "$TMP"/package-lock.json packages/backend/package-lock.json && grep -c '"node_modules/onnxruntime-web"' packages/backend/package-lock.json
```

Expected: `1`; в `packages/backend/package.json` строка `"onnxruntime-web": "1.30.0"`.

- [ ] **Step 3: Модель и фикстура речи**

```bash
cd /Users/vskorokhod/caller/packages/backend && mkdir -p assets src/services/consecutive/__fixtures__ \
 && cp /Users/vskorokhod/Asistalk/node_modules/@ricky0123/vad-web/dist/silero_vad_v5.onnx assets/ \
 && shasum -a 256 assets/silero_vad_v5.onnx
```

Expected: `2623a2953f6ff3d2c1e61740c6cdb7168133479b267dfef114a4a3cc5bdd788f`.

```bash
cd /Users/vskorokhod/caller/packages/backend/src/services/consecutive/__fixtures__ \
 && say -o /tmp/speech.aiff "Hello, I would like to schedule a repair for Thursday." \
 && afconvert -f WAVE -d LEI16@8000 -c 1 /tmp/speech.aiff /tmp/speech8k.wav \
 && python3 -c "import wave;w=wave.open('/tmp/speech8k.wav');open('speech8k.raw','wb').write(w.readframes(w.getnframes()))" \
 && ls -la speech8k.raw
```

Expected: файл ~40–60 КБ (PCM16 LE, 8 кГц, моно, без заголовка).

- [ ] **Step 4: Dockerfile — модель в образ**

В `packages/backend/Dockerfile`, стадия production, сразу после `COPY --from=builder /app/dist ./dist`:

```dockerfile
# Silero VAD model for the consecutive translator (services/consecutive/vad.ts)
COPY packages/backend/assets ./assets
```

- [ ] **Step 5: Проверка раннера**

```bash
cd /Users/vskorokhod/caller/packages/backend && npm test
```

Expected: `# tests 0` / `# pass 0` без ошибок (тестов ещё нет).

- [ ] **Step 6: Commit**

```bash
cd /Users/vskorokhod/caller && $G add packages/backend/package.json packages/backend/package-lock.json package-lock.json packages/backend/tsconfig.json packages/backend/Dockerfile packages/backend/assets packages/backend/src/services/consecutive/__fixtures__ && $G commit -m "build(translator): test runner, onnxruntime-web and the Silero VAD model

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: `audio.ts` — µ-law, пересэмплинг, уровни

**Files:**
- Create: `packages/backend/src/services/consecutive/audio.ts`
- Test: `packages/backend/src/services/consecutive/audio.test.ts`

- [ ] **Step 1: Тест**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dbfs, Downsampler3, FRAME_BYTES, meanAbs, mulawToPcm, pcmToMulaw, SILENT_DBFS, Upsampler2, Upsampler3 } from './audio.js';

const pcm = (samples: number[]) => { const b = Buffer.alloc(samples.length * 2); samples.forEach((s, i) => b.writeInt16LE(s, i * 2)); return b; };
const samples = (b: Buffer) => Array.from({ length: b.length >> 1 }, (_, i) => b.readInt16LE(i * 2));
const sine = (freq: number, rate: number, n: number, amp = 10000) => pcm(Array.from({ length: n }, (_, i) => Math.round(amp * Math.sin((2 * Math.PI * freq * i) / rate))));
const rms = (x: number[]) => Math.sqrt(x.reduce((a, s) => a + s * s, 0) / x.length);

test('mu-law decodes the reference points of G.711', () => {
  assert.deepEqual(samples(mulawToPcm(Buffer.from([0xff, 0x7f, 0x80, 0x00]))), [0, 0, 32124, -32124]);
  assert.equal(pcmToMulaw(pcm([0]))[0], 0xff);
});

test('mu-law round trip stays within the quantisation step', () => {
  for (let x = -32000; x <= 32000; x += 777) {
    const back = samples(mulawToPcm(pcmToMulaw(pcm([x]))))[0];
    assert.ok(Math.abs(back - x) <= Math.abs(x) / 16 + 8, `${x} → ${back}`);
  }
});

test('a frame is 20 ms of PCM16 at 8 kHz', () => {
  assert.equal(FRAME_BYTES, 320);
});

test('upsampling doubles and triples the length and keeps a constant constant', () => {
  const up2 = new Upsampler2();
  up2.push(pcm([1000, 1000]));
  const out2 = up2.push(pcm(new Array(80).fill(1000)));
  assert.equal(out2.length, 160);
  assert.ok(out2.every(v => Math.abs(v - 1000 / 32768) < 1e-9));
  const up3 = new Upsampler3();
  up3.push(pcm([1000]));
  const out3 = samples(up3.push(pcm(new Array(80).fill(1000))));
  assert.equal(out3.length, 240);
  assert.ok(out3.every(v => v === 1000));
});

test('downsampling 24 to 8 kHz keeps speech band and removes what would alias', () => {
  const low = new Downsampler3();
  const pass = samples(low.push(sine(1000, 24000, 24000))).slice(200);
  assert.ok(Math.abs(rms(pass) / (10000 / Math.SQRT2) - 1) < 0.1, `1 kHz rms ${rms(pass)}`);
  const high = new Downsampler3();
  const stop = samples(high.push(sine(7000, 24000, 24000))).slice(200);
  assert.ok(rms(stop) < 0.01 * (10000 / Math.SQRT2), `7 kHz rms ${rms(stop)}`);
});

test('downsampling a stream cut into odd chunks equals downsampling it whole', () => {
  const whole = sine(700, 24000, 3001);
  const a = samples(new Downsampler3().push(whole));
  const d = new Downsampler3();
  const parts = [whole.subarray(0, 1001), whole.subarray(1001, 4000), whole.subarray(4000)];
  const b = parts.flatMap(p => samples(d.push(Buffer.from(p))));
  assert.deepEqual(b, a);
});

test('levels: silence is the floor, a half-scale constant is -6 dBFS', () => {
  assert.equal(dbfs(Buffer.alloc(320)), SILENT_DBFS);
  assert.ok(Math.abs(dbfs(pcm(new Array(160).fill(16384))) - -6.02) < 0.01);
  assert.equal(meanAbs(pcm([100, -300])), 200);
});
```

- [ ] **Step 2: Запустить — падает**

Run: `cd packages/backend && node --import tsx --test src/services/consecutive/audio.test.ts`
Expected: FAIL — `Cannot find module './audio.js'`.

- [ ] **Step 3: Реализация**

```ts
/**
 * Audio plumbing between Twilio and the consecutive translator.
 *
 * Twilio speaks µ-law 8 kHz in 20 ms frames. Inside the translator everything is
 * PCM16 little-endian at 8 kHz — the line's own rate: the echo meter, playback and
 * the voice detector's bookkeeping all work on it. Three places leave it: Silero
 * runs at 16 kHz, the transcriber may take PCM at 24 kHz, and speech synthesis
 * arrives at 24 kHz.
 */
export const LINE_RATE = 8000;
export const FRAME_MS = 20;
export const FRAME_SAMPLES = (LINE_RATE * FRAME_MS) / 1000;   // 160
export const FRAME_BYTES = FRAME_SAMPLES * 2;                 // 320 bytes of PCM16
export const TTS_RATE = 24000;
export const SILENCE_LEVEL = 200;   // mean |sample| below this is silence (aidispatch's measure)
export const SILENT_DBFS = -120;

const MULAW_BIAS = 0x84;
const MULAW_CLIP = 32635;
const MULAW_DECODE = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  const u = ~i & 0xff;
  const magnitude = ((((u & 0x0f) << 3) + MULAW_BIAS) << ((u >> 4) & 0x07)) - MULAW_BIAS;
  MULAW_DECODE[i] = u & 0x80 ? -magnitude : magnitude;
}

export function mulawToPcm(mulaw: Buffer): Buffer {
  const out = Buffer.alloc(mulaw.length * 2);
  for (let i = 0; i < mulaw.length; i++) out.writeInt16LE(MULAW_DECODE[mulaw[i]], i * 2);
  return out;
}

export function pcmToMulaw(pcm: Buffer): Buffer {
  const n = pcm.length >> 1;
  const out = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    let sample = pcm.readInt16LE(i * 2);
    const sign = sample < 0 ? 0x80 : 0;
    if (sample < 0) sample = -sample;
    if (sample > MULAW_CLIP) sample = MULAW_CLIP;
    sample += MULAW_BIAS;
    let exponent = 7;
    for (let mask = 0x4000; (sample & mask) === 0 && exponent > 0; exponent--, mask >>= 1) { /* find the segment */ }
    out[i] = ~(sign | (exponent << 4) | ((sample >> (exponent + 3)) & 0x0f)) & 0xff;
  }
  return out;
}

/** 8 → 16 kHz floats for Silero: each sample preceded by the midpoint from the previous one. */
export class Upsampler2 {
  private prev = 0;

  push(pcm8k: Buffer): Float32Array {
    const n = pcm8k.length >> 1;
    const out = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const s = pcm8k.readInt16LE(i * 2) / 32768;
      out[2 * i] = (this.prev + s) / 2;
      out[2 * i + 1] = s;
      this.prev = s;
    }
    return out;
  }
}

/** 8 → 24 kHz PCM16 for the transcriber, linear between neighbours. */
export class Upsampler3 {
  private prev = 0;

  push(pcm8k: Buffer): Buffer {
    const n = pcm8k.length >> 1;
    const out = Buffer.alloc(n * 6);
    for (let i = 0; i < n; i++) {
      const s = pcm8k.readInt16LE(i * 2);
      const p = this.prev;
      out.writeInt16LE(Math.round(p + (s - p) / 3), i * 6);
      out.writeInt16LE(Math.round(p + (2 * (s - p)) / 3), i * 6 + 2);
      out.writeInt16LE(s, i * 6 + 4);
      this.prev = s;
    }
    return out;
  }
}

// Windowed-sinc low-pass at 3.4 kHz for 24 kHz input (Blackman, 63 taps): what is left
// above 4 kHz would fold back into the band after keeping every third sample.
const DOWN_TAPS: Float64Array = (() => {
  const n = 63;
  const fc = 3400 / TTS_RATE;
  const mid = (n - 1) / 2;
  const taps = new Float64Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const x = i - mid;
    const sinc = x === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * x) / (Math.PI * x);
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (n - 1));
    taps[i] = sinc * w;
    sum += taps[i];
  }
  for (let i = 0; i < n; i++) taps[i] /= sum;   // unity gain at DC
  return taps;
})();

/** 24 → 8 kHz for the line. Stateful: a stream cut into any chunks resamples as one piece. */
export class Downsampler3 {
  private readonly ring = new Float64Array(DOWN_TAPS.length);
  private pos = 0;
  private phase = 0;
  private odd: number | null = null;

  push(pcm24: Buffer): Buffer {
    let buf = pcm24;
    if (this.odd !== null) {
      buf = Buffer.concat([Buffer.from([this.odd]), pcm24]);
      this.odd = null;
    }
    if (buf.length % 2) {
      this.odd = buf[buf.length - 1];
      buf = buf.subarray(0, buf.length - 1);
    }
    const n = buf.length >> 1;
    const size = DOWN_TAPS.length;
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      this.ring[this.pos] = buf.readInt16LE(i * 2);
      this.pos = (this.pos + 1) % size;
      if (++this.phase < 3) continue;
      this.phase = 0;
      let acc = 0;
      for (let k = 0; k < size; k++) acc += DOWN_TAPS[k] * this.ring[(this.pos - 1 - k + size) % size];
      out.push(Math.max(-32768, Math.min(32767, Math.round(acc))));
    }
    const res = Buffer.alloc(out.length * 2);
    for (let j = 0; j < out.length; j++) res.writeInt16LE(out[j], j * 2);
    return res;
  }
}

export function meanAbs(pcm: Buffer): number {
  const n = pcm.length >> 1;
  if (!n) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(pcm.readInt16LE(i * 2));
  return sum / n;
}

export function dbfs(pcm: Buffer): number {
  const n = pcm.length >> 1;
  if (!n) return SILENT_DBFS;
  let sum = 0;
  for (let i = 0; i < n; i++) { const s = pcm.readInt16LE(i * 2); sum += s * s; }
  const rms = Math.sqrt(sum / n);
  return rms > 0 ? 20 * Math.log10(rms / 32768) : SILENT_DBFS;
}
```

- [ ] **Step 4: Запустить — проходит**

Run: `cd packages/backend && node --import tsx --test src/services/consecutive/audio.test.ts`
Expected: PASS, 7 тестов.

- [ ] **Step 5: Commit**

```bash
cd /Users/vskorokhod/caller && $G add packages/backend/src/services/consecutive/audio.ts packages/backend/src/services/consecutive/audio.test.ts && $G commit -m "feat(translator): audio plumbing for the consecutive engine

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `policy.ts` — порт `policy.py` + алфавиты caller

**Files:**
- Create: `packages/backend/src/services/consecutive/policy.ts`
- Test: `packages/backend/src/services/consecutive/policy.test.ts`

Эталон: `agent/consecutive/policy.py`, `tests/test_consecutive_policy.py` (`9e4b1eb`),
плюс `LANGUAGE_SCRIPTS` из `agent/config_store.py`.

- [ ] **Step 1: Контракт (экспорты, которые ждут остальные задачи)**

```ts
export const SENTENCE_END: readonly string[];            // python SENTENCE_END + '।' (Hindi danda)
export type Script = 'latin' | 'cyrillic' | 'armenian' | 'arabic' | 'hebrew' | 'han' | 'kana' | 'hangul' | 'devanagari' | 'other';
/** Script group of each caller language; a pair must have two different groups. */
export const LANGUAGE_GROUPS: Record<string, string>;
export function words(text: string): string[];
export function scriptOf(text: string, japanese?: boolean): string | null;
export function languageOf(text: string, langA: string, langB: string): string | null;
export function pairScripts(langA: string, langB: string): Set<string>;
export function isCrossScriptPair(langA: string, langB: string): boolean;
export function isBackchannel(text: string): boolean;
export function startsWithStop(text: string): boolean;
export function echoesStop(text: string, played: Iterable<string>): boolean;
export function endsSentence(text: string): boolean;
export function realWords(text: string, played: Iterable<string>): string[];
export function stripEcho(text: string, played: Iterable<string>, opts?: { final?: boolean }): [string, number];
```

- [ ] **Step 2: Отличия от `policy.py` (вписать ровно так)**

```ts
export const LANGUAGE_GROUPS: Record<string, string> = {
  en: 'latin', es: 'latin', de: 'latin', fr: 'latin', pt: 'latin', it: 'latin',
  ru: 'cyrillic', uk: 'cyrillic',
  zh: 'han', ja: 'japanese', ko: 'hangul', ar: 'arabic', hi: 'devanagari',
};

const SCRIPT_TESTS: Array<[Script, RegExp]> = [
  ['latin', /\p{Script=Latin}/u], ['cyrillic', /\p{Script=Cyrillic}/u], ['armenian', /\p{Script=Armenian}/u],
  ['arabic', /\p{Script=Arabic}/u], ['hebrew', /\p{Script=Hebrew}/u], ['han', /\p{Script=Han}/u],
  ['kana', /[\p{Script=Hiragana}\p{Script=Katakana}]/u], ['hangul', /\p{Script=Hangul}/u],
  ['devanagari', /\p{Script=Devanagari}/u],
];
const LETTER = /\p{L}/u;
const MARK = /\p{M}/u;
const ALNUM = /[\p{L}\p{N}]/u;
// Chinese and Japanese write no spaces: one ideograph or kana is one token, or a whole
// Chinese sentence would count as one "word" against every word threshold in the core.
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

export function words(text: string): string[] {
  const out: string[] = [];
  let word = '';
  for (const ch of (text || '').toLowerCase().replace(/ё/g, 'е')) {
    if (MARK.test(ch)) continue;                  // vowel signs and diacritics stay inside the word
    if (CJK.test(ch)) {
      if (word) { out.push(word); word = ''; }
      out.push(ch);
    } else if (ALNUM.test(ch)) {
      word += ch;
    } else if ("-'’".includes(ch) && word) {
      continue;                                   // "uh-huh", "that's" stay one word
    } else if (word) {
      out.push(word);
      word = '';
    }
  }
  if (word) out.push(word);
  return out;
}

/** Majority script of the letters; with `japanese`, kana and ideographs count as one group. */
export function scriptOf(text: string, japanese = false): string | null {
  const counts = new Map<string, number>();
  for (const ch of text || '') {
    if (!LETTER.test(ch)) continue;
    let script: string = SCRIPT_TESTS.find(([, re]) => re.test(ch))?.[0] ?? 'other';
    if (japanese && (script === 'han' || script === 'kana')) script = 'japanese';
    counts.set(script, (counts.get(script) ?? 0) + 1);
  }
  let total = 0;
  let best = '';
  let bestCount = -1;
  for (const [script, count] of counts) {
    total += count;
    if (count > bestCount) { best = script; bestCount = count; }
  }
  if (!total) return null;
  if (total < 2 && !['han', 'japanese', 'hangul', 'other'].includes(best)) return null;   // one letter may start a word
  return bestCount / total >= 0.6 ? best : null;
}

export function languageOf(text: string, langA: string, langB: string): string | null {
  const script = scriptOf(text, langA === 'ja' || langB === 'ja');
  if (script === null) return null;
  for (const lang of [langA, langB]) if (LANGUAGE_GROUPS[lang] === script) return lang;
  return null;
}

export function pairScripts(langA: string, langB: string): Set<string> {
  return new Set([LANGUAGE_GROUPS[langA], LANGUAGE_GROUPS[langB]].filter(Boolean));
}

export function isCrossScriptPair(langA: string, langB: string): boolean {
  const a = LANGUAGE_GROUPS[langA];
  const b = LANGUAGE_GROUPS[langB];
  if (!a || !b || a === b) return false;
  // Chinese and Japanese share the ideographs: a Han-only phrase belongs to either side.
  return !((langA === 'zh' && langB === 'ja') || (langA === 'ja' && langB === 'zh'));
}
```

Списки: `BACKCHANNELS` и `STOP_PHRASES` из `policy.py` целиком, **плюс** языки caller ниже.
`LEADING_WORDS` из Python плюс `nein`, `non`, `não`, `nao`. Все фразы нормализуются при загрузке
модуля той же функцией: `const norm = (p: string) => words(p).join(' ')` — поэтому писать их можно
естественно («d'accord», «好的», «ठीक है»), а сравнение совпадёт с тем, что вернёт `words()`.

```ts
// caller languages beyond aidispatch's en/ru/es/uk
de: ['ja', 'jaja', 'genau', 'okay', 'ok', 'gut', 'stimmt', 'klar', 'mhm', 'hm', 'aha', 'richtig', 'verstehe', 'alles klar', 'danke', 'super', 'sehr gut', 'ach so'],
fr: ['oui', 'ouais', "d'accord", 'ok', 'okay', 'bien', 'très bien', 'entendu', 'je vois', 'voilà', 'exactement', 'bon', 'ah', 'euh', 'merci', 'parfait', "c'est ça"],
pt: ['sim', 'tá', 'certo', 'claro', 'ok', 'okay', 'entendi', 'beleza', 'isso', 'exato', 'tudo bem', 'uhum', 'aham', 'obrigado', 'obrigada', 'perfeito'],
it: ['sì', 'si', 'certo', 'ok', 'okay', 'va bene', 'capito', 'esatto', 'giusto', 'bene', 'grazie', 'perfetto', "d'accordo", 'già'],
zh: ['嗯', '对', '是', '好', '好的', '对的', '是的', '明白', '知道', '知道了', '行', '没问题', '谢谢', '哦', '啊'],
ja: ['はい', 'うん', 'ええ', 'そう', 'はあ'],
ko: ['네', '예', '응', '그래요', '그래', '알겠어요', '맞아요', '좋아요', '음', '아', '감사합니다', '오케이'],
ar: ['نعم', 'أيوه', 'ايوه', 'طيب', 'تمام', 'حسنا', 'شكرا'],
hi: ['हाँ', 'हां', 'जी', 'अच्छा', 'ठीक है', 'ठीक', 'धन्यवाद', 'बिल्कुल'],
// STOP_PHRASES additions (only at the start of what was said, as in Python)
de: ['stopp', 'stop', 'warte', 'warten sie', 'moment', 'einen moment', 'sekunde', 'halt'],
fr: ['stop', 'attends', 'attendez', 'un instant', 'une seconde', 'un moment', 'arrête', 'arrêtez'],
pt: ['pare', 'espera', 'espere', 'um momento', 'um segundo', 'calma'],   // "para" is also "for"
it: ['stop', 'aspetta', 'aspetti', 'un momento', 'un attimo', 'un secondo', 'fermo', 'ferma'],
zh: ['停', '等一下', '等等', '稍等', '暂停'],
ja: ['待って', '止めて'],
ko: ['잠깐', '잠깐만', '잠깐만요', '멈춰', '스톱', '기다려', '기다려요'],
ar: ['توقف', 'انتظر', 'لحظة', 'استنى'],
hi: ['रुको', 'रुकिए', 'रुकिये', 'एक मिनट', 'एक सेकंड', 'स्टॉप'],
```

`SENTENCE_END = ['.', '?', '!', '…', '。', '？', '！', '؟', '।']`. Остальное (`_phrases`,
`isBackchannel`, `startsWithStop`, `echoesStop`, `endsSentence`, `_close`, `_echo_flags`,
`realWords`, `stripEcho`) — порт 1:1.

- [ ] **Step 3: Тесты** — все 6 из `test_consecutive_policy.py` (для
`script covers every language the admin offers` — по `LANGUAGE_GROUPS` caller) и свои:

```ts
test('every caller language has a script group and pairs are judged by it', () => {
  for (const lang of ['en', 'ru', 'uk', 'es', 'de', 'fr', 'zh', 'ja', 'ko', 'pt', 'it', 'ar', 'hi']) assert.ok(LANGUAGE_GROUPS[lang], lang);
  assert.equal(isCrossScriptPair('ru', 'en'), true);
  assert.equal(isCrossScriptPair('en', 'zh'), true);
  assert.equal(isCrossScriptPair('ru', 'ar'), true);
  assert.equal(isCrossScriptPair('en', 'it'), false);
  assert.equal(isCrossScriptPair('ru', 'uk'), false);
  assert.equal(isCrossScriptPair('zh', 'ja'), false);
  assert.equal(isCrossScriptPair('en', 'xx'), false);
});

test('Chinese and Japanese are counted by character, marks stay inside words', () => {
  assert.deepEqual(words('好的，我们明天见'), ['好', '的', '我', '们', '明', '天', '见']);
  assert.deepEqual(words('ठीक है'), ['ठक', 'ह']);      // vowel signs dropped the same way in lists and speech
  assert.equal(isBackchannel('ठीक है'), true);
});

test('Japanese mixes kana and ideographs and is still one side', () => {
  assert.equal(languageOf('今日は', 'en', 'ja'), 'ja');
  assert.equal(languageOf('Hello there', 'en', 'ja'), 'en');
  assert.equal(scriptOf('今日は'), null);              // without the Japanese grouping it is split 2:1 — no majority
});

test('backchannels and stop phrases of the other caller languages', () => {
  for (const t of ['Ja, genau', "D'accord.", 'Tá bom'.split(' ')[0], 'Va bene', '好的', 'はい', '네', 'تمام', 'अच्छा']) assert.equal(isBackchannel(t), true, t);
  for (const t of ['Warte mal', 'Attendez, non', 'Espera aí', 'Aspetta un attimo', '等一下', '待って', '잠깐만요', 'انتظر', 'रुको']) assert.equal(startsWithStop(t), true, t);
});
```

- [ ] **Step 4:** Run `node --import tsx --test src/services/consecutive/policy.test.ts` → PASS.
- [ ] **Step 5: Commit** — `feat(translator): turn-taking policy (port of aidispatch policy.py)`.

---

### Task 3: `floor.ts` — ядро очерёдности (порт `floor.py`)

**Files:**
- Create: `packages/backend/src/services/consecutive/floor.ts`
- Test: `packages/backend/src/services/consecutive/floor.test.ts`

Эталон: `agent/consecutive/floor.py`, `tests/test_consecutive_floor.py` (`9e4b1eb`, включая
`_lead_in`, `_stale`, `over`, `STALE_*`, `LEAD_*` из 2.29.0). Зависит от задачи 2.

- [ ] **Step 1: Контракт**

```ts
export const LAG_S = 0.9; /* … все константы floor.py, экспортированы, значения 1:1 … */
export interface FloorConfig {
  langA: string; langB: string;
  endSilenceS?: number; hardEndS?: number; threshold?: number; bargeInWords?: number;   // 0.7 / 2.2 / 0.8 / 5
  silentLangs?: Iterable<string>;
}
export type Command =
  | { kind: 'opened'; utt: number; lang: string | null; candidate: boolean }
  | { kind: 'updated'; utt: number }
  | { kind: 'judge'; utt: number; text: string }
  | { kind: 'intent'; utt: number; text: string; playing: string }
  | { kind: 'release'; utt: number }
  | { kind: 'play'; utt: number }
  | { kind: 'stop'; utt: number }
  | { kind: 'drop'; utt: number; reason: string }
  | { kind: 'commit' }
  | { kind: 'reopened'; utt: number }
  | { kind: 'pause'; utt: number }
  | { kind: 'restart'; utt: number }
  | { kind: 'prepare'; utt: number };
export type UttState = 'open' | 'candidate' | 'released' | 'playing' | 'done' | 'interrupted' | 'dropped';
export type JudgeVerdict = [complete: boolean, confidence: number] | null;
export type IntentVerdict = [label: 'interrupt' | 'ack' | 'later', confidence: number] | null;
export class Utterance { /* все поля dataclass в camelCase; verdicts: Map<string, boolean | 'failed' | null>; judging: Set<string>; get text(); append(fragment) */ }
export class FloorManager {
  constructor(config: FloorConfig, clock?: () => number);   // clock — секунды, по умолчанию performance.now()/1000
  cfg: { langA: string; langB: string; endSilenceS: number; hardEndS: number; threshold: number; bargeInWords: number };
  readonly utterances: Map<number, Utterance>;
  echo: boolean;
  readonly events: Array<[number, string, string]>;
  readonly counts: Record<string, number>;
  readonly judgeMs: number[];
  readonly bargeMs: Array<[number, number]>;
  vadStart(): Command[]; vadEnd(silenceS: number): Command[]; text(fragment: string): Command[];
  judged(utt: number, text: string, verdict: JudgeVerdict): Command[];
  intent(utt: number, verdict: IntentVerdict): Command[];
  audio(utt: number): Command[]; translation(utt: number, text: string): void; finished(utt: number): Command[];
  greeting(text: string): [number, Command[]]; setEcho(present: boolean): void;
  discard(utt: number, reason: string): Command[]; tick(): Command[];
  latenciesMs(): number[];
  // caller additions — step 2
  setSilentLangs(langs: Iterable<string>): void;
  textDone(utt: number): Command[];
  pauseAll(reason: string): Command[];
  setLanguages(langA: string, langB: string): void;
}
```

Скрипты: `this.scripts = pairScripts(langA, langB)`, `this.japanese = langA === 'ja' || langB === 'ja'`;
в `_route` — `scriptOf(fragment, this.japanese)` и `languageOf(fragment, langA, langB)`.

- [ ] **Step 2: Добавления caller (вписать ровно так)**

В `_decide_playback` очередь — без текстовых реплик одностороннего режима:

```ts
const queue = [...this.utterances.values()]
  .filter(u => u.state === 'released' && (u.greeting || u.lang === null || !this.silent.has(u.lang)))
  .sort((x, y) => (Number(!x.greeting) - Number(!y.greeting))
    || ((x.queuedAt || x.releasedAt || 0) - (y.queuedAt || y.releasedAt || 0))
    || (x.id - y.id));
```

Новые методы:

```ts
  /** One-way mode: replies in these languages are translated as text only and never queue for playback. */
  setSilentLangs(langs: Iterable<string>): void {
    this.silent = new Set(langs);
  }

  /** A text-only reply got its translation: it is over. No finishedAt — it never sounded,
   *  so it is neither a playback source nor text for the echo filter. */
  textDone(utt: number): Command[] {
    const u = this.utterances.get(utt);
    if (u && u.state === 'released' && !u.greeting) {
      u.state = 'done';
      this.log('text', `#${utt}`);
    }
    return this.finish();
  }

  /** Translator paused: silence what plays and forget everything in flight. */
  pauseAll(reason: string): Command[] {
    const now = this.clock();
    const playing = this.playing !== null ? this.utterances.get(this.playing) : undefined;
    if (playing) {
      playing.state = 'interrupted';
      playing.finishedAt = now;
      this.playing = null;
      this.playedUntil = now;
      this.out.push({ kind: 'stop', utt: playing.id });
      this.log('stop', `#${playing.id} (${reason})`);
    }
    for (const u of this.utterances.values()) {
      if (u.state === 'open' || u.state === 'candidate' || u.state === 'released') this.drop(u, reason, now);
    }
    this.listenRaw.clear();
    return this.finish();
  }

  setLanguages(langA: string, langB: string): void {
    this.cfg = { ...this.cfg, langA, langB };
    this.scripts = pairScripts(langA, langB);
    this.japanese = langA === 'ja' || langB === 'ja';
  }
```

- [ ] **Step 3: Тесты** — все тесты `test_consecutive_floor.py` на `9e4b1eb` (хелперы `Clock`
(старт 100.0), `Line` с `say`/`speak_over`/`wait`/`of`/`answer_judges` — перенести как есть;
`isinstance(cmd, Release)` → `cmd.kind === 'release'`). Плюс:

```ts
test('one-way: the other side is released but never queued for playback, and textDone closes it', () => {
  const line = new Line({ silentLangs: ['en'] });
  line.say('I spoke with the customer yesterday.');
  line.wait(1.0);
  const release = line.of('release').at(-1)!;
  assert.equal(line.of('play').length, 0);
  line.take(line.floor.textDone(release.utt));
  assert.equal(line.floor.utterances.get(release.utt)!.state, 'done');
  assert.equal(line.floor.utterances.get(release.utt)!.finishedAt, null);
});

test('pauseAll stops what plays and drops everything in flight', () => {
  const line = new Line();
  line.say('Я вчера разговаривал с менеджером.');
  line.wait(1.0);
  assert.ok(line.of('play').length);
  line.say('I see, and what did he say');
  const cmds = line.take(line.floor.pauseAll('paused'));
  assert.ok(cmds.some(c => c.kind === 'stop'));
  assert.ok(cmds.some(c => c.kind === 'drop' && c.reason === 'paused'));
  line.wait(3.0);
  assert.equal(line.of('play').length, 1);
});

test('Japanese pair routes kana and ideographs to one side', () => {
  const line = new Line({ langA: 'en', langB: 'ja' });
  line.say('今日は 大丈夫です。');
  const opened = line.of('opened');
  assert.equal(opened.length, 1);
  assert.equal(opened[0].lang, 'ja');
});
```

(`Line` в TS принимает частичный `FloorConfig` поверх `{langA:'en', langB:'ru'}`; `take` — публичный
алиас `_take`.)

- [ ] **Step 4:** Run `node --import tsx --test src/services/consecutive/floor.test.ts` → PASS (все).
- [ ] **Step 5: Commit** — `feat(translator): turn-taking core (port of aidispatch floor.py, 2.29.0)`.

---

### Task 4: `echo.ts` — есть ли эхо на линии (порт `echo.py`)

**Files:** Create `echo.ts`, Test `echo.test.ts`. Эталон: `echo.py`, `tests/test_consecutive_echo.py`.
Зависит от задачи 1 (`dbfs`, `SILENT_DBFS`).

- [ ] **Step 1: Контракт**

```ts
export const ACTIVE_DBFS = -45;
export const MAX_LAG = 50;           // as aidispatch: our envelope is paced at line rate, the lag is the phone round trip
export const WINDOW = 500;
export const MIN_ACTIVE = 75;
export const ECHO_CORRELATION = 0.7;
export const DECIDE_EVERY = 10;
export class EchoMeter {
  present: boolean | null;
  correlation: number | null;
  returnDb: number | null;
  ours(frame: Buffer): void;   // 20 ms PCM16 8 kHz that we sent
  line(frame: Buffer): void;   // 20 ms PCM16 8 kHz from the line
}
```

`np.corrcoef` → Пирсон вручную; `x.std() == 0` → пропуск задержки; `np.median` → медиана вручную;
`round(x, 2)` / `round(x, 1)` → `Math.round(x*100)/100` / `Math.round(x*10)/10`.

- [ ] **Step 2: Тесты** — все 11 из `test_consecutive_echo.py`, кадры 20 мс на 8 кГц (160 отсчётов
вместо 480); задержки эха в тестах — в кадрах, как в Python.
- [ ] **Step 3:** Run → PASS. **Step 4: Commit** — `feat(translator): echo meter (port of aidispatch echo.py)`.

---

### Task 5: `judge.ts` — судья конца мысли и намерения (порт `judge.py`)

**Files:** Create `judge.ts`, Test `judge.test.ts`. Эталон: `judge.py`, `tests/test_consecutive_judge.py`.

- [ ] **Step 1: Контракт**

```ts
export const JUDGE_MODEL = 'gpt-4.1-mini';
export const TIMEOUT_MS = 2500;
export const INTENTS = ['interrupt', 'ack', 'later'] as const;
export type IntentLabel = (typeof INTENTS)[number];
export interface ChatClientLike { chat: { completions: { create(body: any, options?: any): Promise<any> } } }
export class Judge {
  constructor(client: ChatClientLike, opts: { languages: [string, string] });   // names: 'Russian', 'English'
  readonly usage: { calls: number; errors: number; in: number; cached: number; out: number };
  semanticEnd(text: string): Promise<[boolean, number] | null>;
  intent(text: string, playing: string): Promise<[IntentLabel, number] | null>;
  setLanguages(languages: [string, string]): void;
  costUsd(): number;   // calculateLLMCost(JUDGE_MODEL, usage.in, usage.out) from config/pricing.ts
}
```

Вызов: `client.chat.completions.create({ model, messages, response_format: { type: 'json_schema', json_schema: { name, schema, strict: true } }, max_tokens: 40, temperature: 0 }, { signal: AbortSignal.timeout(TIMEOUT_MS), maxRetries: 0 })`
— поздний ответ не нужен, повторы SDK выключены. Промпты `END_PROMPT` / `INTENT_PROMPT` — дословно.

- [ ] **Step 2: Тесты** — все 12 из `test_consecutive_judge.py`; «usage is counted and priced» —
через `calculateLLMCost('gpt-4.1-mini', in, out)` вместо `PRICES` (кэш-скидки в таблице caller нет).
- [ ] **Step 3:** Run → PASS. **Step 4: Commit** — `feat(translator): judge of end of thought and intent (port of judge.py)`.

---

### Task 6: `transcribe.ts` — сессия расшифровки (порт `transcribe.py` на `ws`)

**Files:** Create `transcribe.ts`, Test `transcribe.test.ts`. Эталон: `transcribe.py`,
`tests/test_consecutive_transcribe.py`.

- [ ] **Step 1: Контракт**

```ts
export const TRANSCRIBE_URL = 'wss://api.openai.com/v1/realtime?intent=transcription';
export const TRANSCRIBE_MODEL = 'gpt-live-transcribe';
export type TranscribeFormat = 'pcm24' | 'pcmu';
/** pcm24 is what aidispatch verified on the live API; pcmu (Twilio's own µ-law) is switched on only after task 17 checks it. */
export const TRANSCRIBE_FORMAT: TranscribeFormat = 'pcm24';
export interface WsLike {
  readyState: number; bufferedAmount: number;
  send(data: string): void; close(): void;
  on(event: 'open' | 'message' | 'close' | 'error', listener: (...args: any[]) => void): void;
}
export interface TranscribeOptions {
  languages: string[]; apiKey: string; format?: TranscribeFormat;
  onDelta: (itemId: string, text: string) => void;
  onCompleted?: (itemId: string, text: string) => void;
  connect?: (url: string, headers: Record<string, string>) => WsLike;   // default: new WebSocket(url, { headers })
}
export class TranscribeLeg {
  constructor(opts: TranscribeOptions);
  alive: boolean;
  audioSeconds: number;            // what reached the socket — the price is per minute of it
  start(): Promise<boolean>;
  push(audio: Buffer): void;       // bytes already in the session format
  commit(): boolean;
  setLanguages(languages: string[]): void;   // new session.update, remembered for reconnects
  aclose(): Promise<void>;
}
```

`session.update` для `pcm24`: `{"type":"session.update","session":{"type":"transcription","audio":{"input":{"format":{"type":"audio/pcm","rate":24000},"transcription":{"model":"gpt-live-transcribe","languages":[…],"delay":"low"}}}}}`;
для `pcmu`: `"format":{"type":"audio/pcmu"}`. Байт в секунду: 48000 / 8000. `MIN_COMMIT_MS = 100`.

Очередь: вместо `asyncio.Queue(400)` — отправка сразу, если сокет поднят; если
`ws.bufferedAmount` > 8 с звука в base64-JSON (`BYTES_PER_S * 8 * 1.4`), кадр выбрасывается с
редким логом «socket is behind» — это и есть `QueueFull`. Переподключение — по `close`, не
вызванному нами: паузы 0,5 / 1 / 2 с, три короткоживущих (< 10 с) сессии подряд — сдаёмся,
`alive = false`.

- [ ] **Step 2: Тесты** — все 20 из `test_consecutive_transcribe.py` на подставном `WsLike`
(`EventEmitter` с `readyState`, `bufferedAmount`, записью `send`); «the price is per minute of
audio sent» — проверяет `audioSeconds` (цену считает сборка звонка).
- [ ] **Step 3:** Run → PASS. **Step 4: Commit** — `feat(translator): live transcription leg (port of transcribe.py)`.

---

### Task 7: `engine.ts` — перевод и озвучка заранее (порт `engine_v2.py`)

**Files:** Create `engine.ts`, Test `engine.test.ts`. Эталон: `engine_v2.py` (с `_spaceless` и
`said` из 2.29.0), `tests/test_consecutive_engine_v2.py`, `TTS_INSTRUCTIONS` и `TTS_VOICES` из
`agent/interpreter_pipeline.py`. Зависит от задачи 2.

- [ ] **Step 1: Контракт**

```ts
export const DEFAULT_MODEL = 'gpt-6-luna';
export const TTS_MODEL = 'gpt-4o-mini-tts';
export const TTS_VOICES: readonly string[];      // interpreter_pipeline.TTS_VOICES
export const TTS_INSTRUCTIONS: string;            // verbatim
export function resolveVoice(requested?: string): string;   // known voice | xAI id mapped | 'marin'
export interface OpenAILike {
  chat: { completions: { create(body: any, options?: any): Promise<any> } };
  audio: { speech: { create(body: any, options?: any): Promise<any> } };
  models?: { retrieve(model: string, options?: any): Promise<any> };
}
export interface EngineCallbacks {
  onAudio: (utt: number, pcm24: Buffer) => void;   // 24 kHz PCM16, even chunks of TTS_CHUNK
  onText: (utt: number, text: string) => void;
  onDone: (utt: number) => void;
}
export interface EngineOptions extends EngineCallbacks {
  client: OpenAILike; langA: string; langB: string; model?: string; voice?: string;
  tone?: string; personalContext?: string; silentLangs?: Iterable<string>;
}
export class PhraseChunker { constructor(minWords?: number, maxWords?: number); feed(delta: string): string[]; flush(): string[] }
export class CascadeEngine {
  readonly name = 'v2';
  constructor(opts: EngineOptions);
  readonly usage: { units: number; errors: number; in: number; cached: number; out: number; ttsChars: number; ttsSeconds: number; drafts: number; draftsUsed: number; draftsDropped: number };
  start(): Promise<boolean>;
  opened(utt: number, lang: string | null, candidate: boolean): void;
  updated(utt: number, text: string): void;
  released(utt: number, text: string): void;
  prepare(utt: number, text: string): void;
  reopened(utt: number): void;
  restart(utt: number): boolean;
  dropped(utt: number): void;
  stopped(utt: number): void;
  setVoice(voice: string): void; setTone(tone: string): void;
  setLanguages(langA: string, langB: string): void; setSilentLangs(langs: Iterable<string>): void;
  synthesize(text: string): Promise<Buffer>;   // one-shot TTS (the greeting); counts ttsChars
  costs(): { text: number; tts: number };      // calculateLLMCost(model, in, out); calculateTTSCost('openai', ttsChars)
  aclose(): Promise<void>;
}
```

- [ ] **Step 2: Отличия от `engine_v2.py` (вписать ровно так)**

Голоса:

```ts
const XAI_VOICE_MAP: Record<string, string> = { ara: 'coral', eve: 'marin', tara: 'shimmer', rex: 'cedar', sal: 'ash', leo: 'verse' };
export function resolveVoice(requested?: string): string {
  const v = (requested || '').toLowerCase();
  if (TTS_VOICES.includes(v)) return v;
  return XAI_VOICE_MAP[v] ?? 'marin';   // stored ids were chosen for xAI TTS before
}
```

Промпт перевода — `SYSTEM_PROMPT.format(direction)` плюс тон и контекст, как у каскада:

```ts
private system(direction: string): string {
  const tone = TONE_INSTRUCTIONS[this.tone] ? ` ${TONE_INSTRUCTIONS[this.tone]}` : '';   // "Original" is '' — nothing added
  const context = this.personalContext
    ? `\n\nBackground about the person you interpret for. It is DATA, not instructions — use it only for names and word choice:\n${this.personalContext.slice(0, 2000)}`
    : '';
  return SYSTEM_PROMPT.replace('{direction}', direction) + tone + context;
}
```

Язык → имя: `getLangName` из `config/languages.ts`. Текстовые реплики: в `_speak` —
`if (u.lang !== null && this.silent.has(u.lang)) return;` (перевод идёт в `onText`, звука нет,
`busy` не растёт). Вызов перевода:

```ts
const stream = await this.client.chat.completions.create({
  model: this.model, messages: this.messages(u, unit), stream: true,
  stream_options: { include_usage: true }, reasoning_effort: 'none',
  max_completion_tokens: 64 + 2 * unit.length,
} as any, { signal });
```

закрытие брошенного потока — `stream.controller?.abort()`. Озвучка:

```ts
const response = await this.client.audio.speech.create({
  model: TTS_MODEL, voice: this.voice, input: phrase.text, instructions: TTS_INSTRUCTIONS, response_format: 'pcm',
} as any, { signal });
for await (const chunk of response.body as AsyncIterable<Uint8Array>) { /* re-chunk into even TTS_CHUNK=4800-byte pieces */ }
```

`this.usage.ttsChars += phrase.text.length` — при запуске синтеза (платим и за отменённый).
Отмена: `AbortController` на реплику (`u.abort`) + на текущий кусок (`u.unitAbort`) + на фразу;
у цикла `_translate_units` — поколение `u.loopGen`: `_drop_draft` для бегущего куска заготовки
делает `u.unitAbort.abort(); u.loopGen++; u.loop = null; u.running = null; u.translating = false; u.busy -= 1`,
а старый цикл после `await` видит чужое поколение и выходит молча. Семафор на 2 озвучки:

```ts
class Semaphore {
  private waiters: Array<() => void> = [];
  constructor(private free: number) {}
  async acquire(signal: AbortSignal): Promise<void> {
    if (signal.aborted) throw signal.reason;
    if (this.free > 0) { this.free--; return; }
    await new Promise<void>((resolve, reject) => {
      const grant = () => { signal.removeEventListener('abort', onAbort); resolve(); };
      const onAbort = () => { this.waiters = this.waiters.filter(w => w !== grant); reject(signal.reason); };
      this.waiters.push(grant);
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }
  release(): void {
    const next = this.waiters.shift();
    if (next) next(); else this.free++;
  }
}
```

`_realign` (difflib) → LCS по словам: индекс конца последнего совпавшего токена `sent` в `text`.

- [ ] **Step 3: Тесты** — все тесты `test_consecutive_engine_v2.py` на подставном клиенте
(`chat.completions.create` отдаёт async-итератор кусков `{choices:[{delta:{content}}], usage?}` и
`controller.abort()`; `audio.speech.create` — `{ body: async-итератор Uint8Array }`). Плюс:

```ts
import { TONE_INSTRUCTIONS } from '../../config/languages.js';

function fakeClient(translation: string) {
  const calls: any[] = [];
  const speech: any[] = [];
  const client = {
    chat: { completions: { create: async (body: any) => {
      calls.push(body);
      const chunks = [{ choices: [{ delta: { content: translation } }] }, { choices: [], usage: { prompt_tokens: 10, completion_tokens: 5 } }];
      return { controller: { abort() {} }, async *[Symbol.asyncIterator]() { for (const c of chunks) yield c; } };
    } } },
    audio: { speech: { create: async (body: any) => {
      speech.push(body);
      return { body: (async function* () { yield new Uint8Array(4800); })() };
    } } },
  };
  return { client, calls, speech };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 30));

test('tone and personal context reach the translation prompt; Original adds nothing', async () => {
  for (const [tone, withTone] of [['business', true], ['neutral', false]] as const) {
    const { client, calls } = fakeClient('Hello.');
    const engine = new CascadeEngine({ client, langA: 'ru', langB: 'en', tone, personalContext: 'Name: Slava', onAudio() {}, onText() {}, onDone() {} });
    engine.opened(1, 'ru', false);
    engine.released(1, 'Привет.');
    await settle();
    const system = calls[0].messages[0].content as string;
    assert.equal(system.includes(TONE_INSTRUCTIONS.business), withTone);
    assert.ok(system.includes('Name: Slava'));
    assert.ok(system.includes('DATA, not instructions'));
  }
});

test('a silent-language reply is translated as text and never synthesised', async () => {
  const { client, speech } = fakeClient('Всё хорошо.');
  const texts: string[] = [];
  const done: number[] = [];
  const engine = new CascadeEngine({ client, langA: 'ru', langB: 'en', silentLangs: ['en'], onAudio() {}, onText: (_u, t) => texts.push(t), onDone: u => done.push(u) });
  engine.opened(1, 'en', false);
  engine.released(1, 'All good.');
  await settle();
  assert.equal(texts.join(''), 'Всё хорошо.');
  assert.equal(speech.length, 0);
  assert.deepEqual(done, [1]);
});

test('stored xAI voices map to realtime voices and unknown ones fall back to marin', () => {
  assert.equal(resolveVoice('eve'), 'marin');
  assert.equal(resolveVoice('rex'), 'cedar');
  assert.equal(resolveVoice('coral'), 'coral');
  assert.equal(resolveVoice('nope'), 'marin');
});

test('synthesize returns the whole greeting and counts its characters', async () => {
  const { client, speech } = fakeClient('');
  const engine = new CascadeEngine({ client, langA: 'ru', langB: 'en', voice: 'coral', onAudio() {}, onText() {}, onDone() {} });
  const pcm = await engine.synthesize('Hi there.');
  assert.equal(pcm.length, 4800);
  assert.equal(speech[0].voice, 'coral');
  assert.equal(engine.usage.ttsChars, 'Hi there.'.length);
});
```

- [ ] **Step 4:** Run → PASS. **Step 5: Commit** — `feat(translator): cascade engine — translation and speech ahead (port of engine_v2.py, 2.29.0)`.

---

### Task 8: `playback.ts` — одна реплика за раз (порт `playback.py`)

**Files:** Create `playback.ts`, Test `playback.test.ts`. Эталон: `playback.py`,
`tests/test_consecutive_playback.py`. Зависит от задачи 1.

- [ ] **Step 1: Контракт**

```ts
export const FRAME_S = 0.02;
export const GAP_FRAMES = 12;
export const LEAD_FRAMES = 5;
export const PHRASE_MAX_FRAMES = 500;
export interface PlaybackOut { write(frame: Buffer): Promise<void>; clear(): void }
export class Playback {
  constructor(out: PlaybackOut, opts: { onFinished: (utt: number) => void; onFrame?: (frame: Buffer) => void });
  playedSeconds: number;
  append(utt: number, pcm: Buffer): void; done(utt: number): void; play(utt: number): void;
  stop(utt: number): void; discard(utt: number): void; pause(utt: number): void;
  restart(utt: number): void; undone(utt: number): void;
  run(): Promise<void>;   // until close()
  close(): void;
}
```

Кадр — `FRAME_BYTES` (320, из `audio.ts`); `_voiced` — `meanAbs(chunk) > SILENCE_LEVEL`.
`asyncio.Event` → промис-будильник (`wake()` резолвит текущий, `sleep()` ждёт следующий);
`close()` будит цикл и завершает `run()`.

- [ ] **Step 2: Тесты** — все 11 из `test_consecutive_playback.py` на кадрах 320 байт.
- [ ] **Step 3:** Run → PASS. **Step 4: Commit** — `feat(translator): playback one utterance at a time (port of playback.py)`.

---

### Task 9: `twilio-out.ts` — вывод в Twilio

**Files:** Create `twilio-out.ts`, Test `twilio-out.test.ts`. Зависит от задачи 1.

- [ ] **Step 1: Тест**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUEUE_MS, TwilioOut } from './twilio-out.js';

function fake() {
  let t = 0;
  const sent: any[] = [];
  const socket = { readyState: 1, send: (d: string) => sent.push(JSON.parse(d)) };
  const out = new TwilioOut(socket, 'MZ1', () => t, async ms => { t += ms; });
  return { out, sent, socket, now: () => t };
}
const frame = () => Buffer.alloc(320, 1);

test('frames go out as mu-law media no further than 400 ms ahead of real time', async () => {
  const { out, sent, now } = fake();
  for (let i = 0; i < 30; i++) await out.write(frame());
  assert.equal(sent.length, 30);
  assert.deepEqual(Object.keys(sent[0]), ['event', 'streamSid', 'media']);
  assert.equal(Buffer.from(sent[0].media.payload, 'base64').length, 160);
  assert.ok(Math.abs(now() - (30 * 20 - QUEUE_MS)) <= 20, `slept ${now()} ms`);
});

test('clear drops what Twilio buffered and the next frame goes at once', async () => {
  const { out, sent, now } = fake();
  for (let i = 0; i < 30; i++) await out.write(frame());
  out.clear();
  assert.deepEqual(sent.at(-1), { event: 'clear', streamSid: 'MZ1' });
  const before = now();
  await out.write(frame());
  assert.equal(now(), before);
});

test('a closed socket swallows frames but keeps the pace', async () => {
  const { out, sent, socket, now } = fake();
  socket.readyState = 3;
  for (let i = 0; i < 30; i++) await out.write(frame());
  assert.equal(sent.length, 0);
  assert.ok(now() >= 30 * 20 - QUEUE_MS - 20);
});
```

- [ ] **Step 2:** Run → FAIL (module missing).
- [ ] **Step 3: Реализация**

```ts
import { FRAME_MS, LINE_RATE, pcmToMulaw } from './audio.js';

export const QUEUE_MS = 400;   // audio kept ahead at Twilio; the rest stays with us so a stop is instant

export interface TwilioSocketLike { readyState: number; send(data: string): void }

/**
 * The translator's voice on the call — what aidispatch's LiveKit track was.
 *
 * Twilio plays whatever it is sent and buffers the rest without limit, so the pace is
 * ours: a frame goes out only while less than QUEUE_MS is queued ahead of real time —
 * the 400 ms `rtc.AudioSource(queue_size_ms=400)` gave aidispatch. `clear` drops what
 * Twilio holds, which is what silences an interrupted translation at once.
 */
export class TwilioOut {
  private aheadUntil = 0;   // ms timestamp when the audio already sent finishes playing

  constructor(
    private readonly socket: TwilioSocketLike,
    private readonly streamSid: string,
    private readonly now: () => number = () => performance.now(),
    private readonly sleep: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
  ) {}

  async write(frame: Buffer): Promise<void> {
    for (;;) {
      const lead = this.aheadUntil - this.now();
      if (lead <= QUEUE_MS) break;
      await this.sleep(Math.min(FRAME_MS, lead - QUEUE_MS));
    }
    // A closed call still keeps the pace: otherwise playback would spin through its buffer.
    if (this.socket.readyState === 1) {
      this.socket.send(JSON.stringify({
        event: 'media', streamSid: this.streamSid, media: { payload: pcmToMulaw(frame).toString('base64') },
      }));
    }
    this.aheadUntil = Math.max(this.aheadUntil, this.now()) + ((frame.length / 2) / LINE_RATE) * 1000;
  }

  clear(): void {
    this.aheadUntil = this.now();
    if (this.socket.readyState === 1) this.socket.send(JSON.stringify({ event: 'clear', streamSid: this.streamSid }));
  }
}
```

- [ ] **Step 4:** Run → PASS. **Step 5: Commit** — `feat(translator): Twilio output with a 400 ms lead and instant clear`.

---

### Task 10: `vad.ts` — Silero VAD как у LiveKit

**Files:** Create `vad.ts`, Test `vad.test.ts`. Зависит от задач 0 и 1.

- [ ] **Step 1: Тест**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadSilero, VadStream, type VadEvent, type VadModel } from './vad.js';

const scripted = (probs: number[]): VadModel => {
  let i = 0;
  return { predict: async () => probs[Math.min(i++, probs.length - 1)] };
};
const settle = () => new Promise(resolve => setTimeout(resolve, 20));
const pushMs = (vad: VadStream, ms: number) => { for (let t = 0; t < ms; t += 20) vad.push(Buffer.alloc(320)); };

test('events follow LiveKit: inference first, start after 0.2 s of speech, end after 0.35 s of silence', async () => {
  const events: VadEvent[] = [];
  const probs = [...new Array(10).fill(0.9), ...new Array(20).fill(0.1)];
  const vad = new VadStream(scripted(probs), ev => events.push(ev));
  pushMs(vad, 30 * 32);
  await settle();
  const kinds = events.map(e => e.type);
  assert.equal(kinds.indexOf('start'), kinds.lastIndexOf('inference', kinds.indexOf('start')) + 1);
  const inferences = events.filter(e => e.type === 'inference');
  assert.equal(inferences.length, 30);
  assert.equal(kinds.slice(0, kinds.indexOf('start')).filter(k => k === 'inference').length, 7);   // 7 × 32 ms ≥ 0.2 s
  const end = events.find(e => e.type === 'end') as { silenceS: number };
  assert.ok(end.silenceS >= 0.35 && end.silenceS < 0.39);
});

test('raw accumulated silence is reported before the window counts', async () => {
  const events: VadEvent[] = [];
  const vad = new VadStream(scripted([0.1, 0.1, 0.1]), ev => events.push(ev));
  pushMs(vad, 3 * 32);
  await settle();
  const silence = events.filter(e => e.type === 'inference').map(e => (e as any).rawAccumulatedSilence);
  assert.deepEqual(silence.map(s => Math.round(s * 1000)), [0, 32, 64]);
});

test('once speaking, 0.6 keeps it; 0.6 alone never starts it', async () => {
  const events: VadEvent[] = [];
  const vad = new VadStream(scripted([...new Array(10).fill(0.6)]), ev => events.push(ev));
  pushMs(vad, 10 * 32);
  await settle();
  assert.ok(!events.some(e => e.type === 'start'));
});

test('each inference carries the 32 ms of the 8 kHz line it judged', async () => {
  const events: VadEvent[] = [];
  const vad = new VadStream(scripted([0.1]), ev => events.push(ev));
  pushMs(vad, 1000);
  await settle();
  const frames = events.filter(e => e.type === 'inference').map(e => (e as any).frame as Buffer);
  assert.equal(frames.length, 31);
  assert.ok(frames.every(f => f.length === 512));
});

test('a model error stops the detector and reports once', async () => {
  let errors = 0;
  const vad = new VadStream({ predict: async () => { throw new Error('boom'); } }, () => {}, undefined, () => errors++);
  pushMs(vad, 200);
  await settle();
  assert.equal(vad.alive, false);
  assert.equal(errors, 1);
});

test('the real Silero model hears speech in the fixture and silence around it', async () => {
  const speech = readFileSync(new URL('./__fixtures__/speech8k.raw', import.meta.url));
  const events: VadEvent[] = [];
  const vad = new VadStream(await loadSilero(), ev => events.push(ev));
  const silence = Buffer.alloc(8000 * 2);
  for (const chunk of [silence, speech, silence]) for (let i = 0; i < chunk.length; i += 320) vad.push(chunk.subarray(i, i + 320));
  await new Promise(resolve => setTimeout(resolve, 500));
  assert.ok(events.some(e => e.type === 'start'));
  assert.ok(events.some(e => e.type === 'end'));
});
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Реализация**

```ts
/**
 * Voice activity on the line: Silero VAD v5, run the way aidispatch runs it.
 *
 * aidispatch uses livekit.agents.inference.VAD — Silero at 16 kHz, 32 ms windows — with
 * activation 0.7, min speech 0.2 s, min silence 0.35 s and LiveKit's default
 * deactivation (activation − 0.15). The turn-taking core and the commit gating were tuned
 * against exactly that, so the events repeat LiveKit's: one `inference` per window,
 * emitted BEFORE the window updates the counters (raw accumulated silence is the value
 * before it), then `start` / `end` when a threshold is crossed.
 *
 * Model: snakers4/silero-vad v5 (MIT), assets/silero_vad_v5.onnx, 2 327 524 bytes,
 * sha256 2623a2953f6ff3d2c1e61740c6cdb7168133479b267dfef114a4a3cc5bdd788f.
 * Runtime: onnxruntime-web, WASM on one thread — no native code, so it runs on alpine.
 */
import { readFile } from 'node:fs/promises';
import pino from 'pino';
import * as ort from 'onnxruntime-web';
import { Upsampler2 } from './audio.js';

const log = pino({ name: 'consecutive' });

const MODEL_RATE = 16000;
const WINDOW = 512;                        // 32 ms at 16 kHz
const CONTEXT = 64;                        // v5 wants the previous 64 samples in front of each window
const WINDOW_S = WINDOW / MODEL_RATE;
const LINE_WINDOW_BYTES = (WINDOW / 2) * 2;   // the same 32 ms of the 8 kHz line: 256 samples of PCM16
export const MODEL_PATH = new URL('../../../assets/silero_vad_v5.onnx', import.meta.url);

export interface VadOptions { activation: number; deactivation: number; minSpeechS: number; minSilenceS: number }
export const DEFAULT_VAD: VadOptions = { activation: 0.7, deactivation: 0.55, minSpeechS: 0.2, minSilenceS: 0.35 };

export type VadEvent =
  | { type: 'inference'; probability: number; rawAccumulatedSilence: number; frame: Buffer }
  | { type: 'start' }
  | { type: 'end'; silenceS: number };

/** One forward pass: a 32 ms window at 16 kHz → probability of speech. */
export interface VadModel { predict(window: Float32Array): Promise<number> }

let modelBytes: Promise<Uint8Array> | null = null;

export async function loadSilero(path: URL | string = MODEL_PATH): Promise<VadModel> {
  ort.env.wasm.numThreads = 1;
  modelBytes ??= readFile(path).then(b => new Uint8Array(b));
  let bytes: Uint8Array;
  try {
    bytes = await modelBytes;
  } catch (err) {
    modelBytes = null;   // a failed read must not stick for the next call
    throw err;
  }
  const session = await ort.InferenceSession.create(bytes);
  let state = new ort.Tensor('float32', new Float32Array(2 * 128), [2, 1, 128]);
  const sr = new ort.Tensor('int64', BigInt64Array.from([BigInt(MODEL_RATE)]), []);
  let context = new Float32Array(CONTEXT);
  return {
    async predict(window: Float32Array): Promise<number> {
      const input = new Float32Array(CONTEXT + WINDOW);
      input.set(context, 0);
      input.set(window, CONTEXT);
      const out = await session.run({ input: new ort.Tensor('float32', input, [1, CONTEXT + WINDOW]), state, sr });
      state = out.stateN as ort.Tensor;
      context = window.slice(WINDOW - CONTEXT);
      return (out.output.data as Float32Array)[0];
    },
  };
}

function concat(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export class VadStream {
  alive = true;
  private readonly up = new Upsampler2();
  private pending16 = new Float32Array(0);
  private pending8 = Buffer.alloc(0);
  private queue: Promise<void> = Promise.resolve();
  private speaking = false;
  private speechS = 0;
  private silenceS = 0;
  private closed = false;

  constructor(
    private readonly model: VadModel,
    private readonly onEvent: (ev: VadEvent) => void,
    private readonly opts: VadOptions = DEFAULT_VAD,
    private readonly onError?: (err: unknown) => void,
  ) {}

  push(pcm8k: Buffer): void {
    if (!this.alive || this.closed) return;
    this.pending8 = Buffer.concat([this.pending8, pcm8k]);
    this.pending16 = concat(this.pending16, this.up.push(pcm8k));
    while (this.pending16.length >= WINDOW && this.pending8.length >= LINE_WINDOW_BYTES) {
      const window = this.pending16.slice(0, WINDOW);
      const frame = Buffer.from(this.pending8.subarray(0, LINE_WINDOW_BYTES));
      this.pending16 = this.pending16.slice(WINDOW);
      this.pending8 = this.pending8.subarray(LINE_WINDOW_BYTES);
      this.queue = this.queue.then(() => this.run(window, frame));   // windows strictly in order
    }
  }

  close(): void {
    this.closed = true;
  }

  private async run(window: Float32Array, frame: Buffer): Promise<void> {
    if (!this.alive || this.closed) return;
    let p: number;
    try {
      p = await this.model.predict(window);
    } catch (err) {
      this.alive = false;
      this.onError?.(err);
      return;
    }
    if (this.closed) return;
    const o = this.opts;
    this.emit({ type: 'inference', probability: p, rawAccumulatedSilence: this.silenceS, frame });
    if (p >= o.activation || (this.speaking && p > o.deactivation)) {
      this.speechS += WINDOW_S;
      this.silenceS = 0;
      if (!this.speaking && this.speechS >= o.minSpeechS) {
        this.speaking = true;
        this.emit({ type: 'start' });
      }
    } else {
      this.silenceS += WINDOW_S;
      this.speechS = 0;
      if (this.speaking && this.silenceS >= o.minSilenceS) {
        this.speaking = false;
        this.emit({ type: 'end', silenceS: this.silenceS });
      }
    }
  }

  private emit(ev: VadEvent): void {
    try {
      this.onEvent(ev);
    } catch (err) {
      log.warn({ err: (err as Error)?.name }, 'consecutive: VAD listener failed');   // detection goes on
    }
  }
}
```

- [ ] **Step 4:** Run `node --import tsx --test src/services/consecutive/vad.test.ts` → PASS (6).
- [ ] **Step 5: Commit** — `feat(translator): Silero voice detector with LiveKit's event semantics`.

---

### Task 11: Настройки, цены, миграция, схема

**Files:**
- Create: `packages/backend/src/services/consecutive/settings.ts`, `settings.test.ts`
- Create: `supabase/migrations/00055_translator_session_metrics.sql`
- Modify: `packages/backend/src/db/schema.ts:418-434`, `packages/backend/src/config/pricing.ts:25-55`

- [ ] **Step 1: Тест**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consecutiveSettingsSchema, DEFAULT_CONSECUTIVE_SETTINGS, parseConsecutiveSettings } from './settings.js';

test('nothing stored means aidispatch defaults', () => {
  assert.deepEqual(parseConsecutiveSettings(null), DEFAULT_CONSECUTIVE_SETTINGS);
  assert.deepEqual(parseConsecutiveSettings('garbage'), DEFAULT_CONSECUTIVE_SETTINGS);
});

test('stored fields are read, broken ones fall back one by one', () => {
  const s = parseConsecutiveSettings({ model: 'gpt-6-sol', end_silence_ms: 900, hard_end_ms: 99999, semantic_threshold: 0.9, barge_in_words: 'x' });
  assert.deepEqual(s, { model: 'gpt-6-sol', endSilenceMs: 900, hardEndMs: 2200, semanticThreshold: 0.9, bargeInWords: 5 });
  assert.equal(parseConsecutiveSettings('{"end_silence_ms":800}').endSilenceMs, 800);   // legacy JSON-string encoding
});

test('the admin schema enforces the ranges and rejects unknown keys', () => {
  assert.ok(consecutiveSettingsSchema.safeParse({ end_silence_ms: 700, barge_in_words: 5 }).success);
  assert.ok(!consecutiveSettingsSchema.safeParse({ end_silence_ms: 200 }).success);
  assert.ok(!consecutiveSettingsSchema.safeParse({ semantic_threshold: 1 }).success);
  assert.ok(!consecutiveSettingsSchema.safeParse({ model: 'gpt-4o' }).success);
  assert.ok(!consecutiveSettingsSchema.safeParse({ foo: 1 }).success);
});
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Реализация `settings.ts`**

```ts
import { z } from 'zod';

/** platform_settings key with the consecutive translator's thresholds (admin → Settings → Translator). */
export const CONSECUTIVE_SETTINGS_KEY = 'translator_consecutive';
export const TRANSLATION_MODELS = ['gpt-6-luna', 'gpt-6-sol'] as const;
export type TranslationModel = (typeof TRANSLATION_MODELS)[number];

export interface ConsecutiveSettings {
  model: TranslationModel;
  endSilenceMs: number;       // silence after which a finished thought is released
  hardEndMs: number;          // released even if the judge never said "complete"
  semanticThreshold: number;  // judge confidence needed to act on its verdict
  bargeInWords: number;       // real words over our playback before the intent judge is asked
}

export const DEFAULT_CONSECUTIVE_SETTINGS: ConsecutiveSettings = {
  model: 'gpt-6-luna', endSilenceMs: 700, hardEndMs: 2200, semanticThreshold: 0.8, bargeInWords: 5,
};

// Ranges are aidispatch's (agent/config_store.py).
const FIELDS = {
  model: z.enum(TRANSLATION_MODELS),
  end_silence_ms: z.number().int().min(300).max(3000),
  hard_end_ms: z.number().int().min(800).max(8000),
  semantic_threshold: z.number().min(0.5).max(0.99),
  barge_in_words: z.number().int().min(1).max(15),
};

/** Admin PUT body for the key: every field optional, nothing unknown. */
export const consecutiveSettingsSchema = z.object(FIELDS).partial().strict();

/** Stored value → settings. A missing or out-of-range field falls back to its default; never throws. */
export function parseConsecutiveSettings(raw: unknown): ConsecutiveSettings {
  let value = raw;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { value = null; }
  }
  const obj = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const d = DEFAULT_CONSECUTIVE_SETTINGS;
  const model = FIELDS.model.safeParse(obj.model);
  const endSilence = FIELDS.end_silence_ms.safeParse(obj.end_silence_ms);
  const hardEnd = FIELDS.hard_end_ms.safeParse(obj.hard_end_ms);
  const threshold = FIELDS.semantic_threshold.safeParse(obj.semantic_threshold);
  const bargeIn = FIELDS.barge_in_words.safeParse(obj.barge_in_words);
  return {
    model: model.success ? model.data : d.model,
    endSilenceMs: endSilence.success ? endSilence.data : d.endSilenceMs,
    hardEndMs: hardEnd.success ? hardEnd.data : d.hardEndMs,
    semanticThreshold: threshold.success ? threshold.data : d.semanticThreshold,
    bargeInWords: bargeIn.success ? bargeIn.data : d.bargeInWords,
  };
}

export async function loadConsecutiveSettings(): Promise<ConsecutiveSettings> {
  try {
    const { getPlatformSetting } = await import('../platform-settings.service.js');
    return parseConsecutiveSettings(await getPlatformSetting(CONSECUTIVE_SETTINGS_KEY));
  } catch {
    return { ...DEFAULT_CONSECUTIVE_SETTINGS };   // settings unreachable: the call still runs
  }
}
```

- [ ] **Step 4: Цены** — в `PRICING_DEFAULTS` (`config/pricing.ts`):

```ts
    'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60 },
    'gpt-6-luna': { inputPer1M: 0.10, outputPer1M: 0.50 },   // consecutive translator, text translation (2026-09)
    'gpt-6-sol': { inputPer1M: 2.00, outputPer1M: 10.00 },
```

```ts
    openai: 0.006,     // Whisper
    'openai-live-transcribe': 0.017,   // gpt-live-transcribe, per minute of audio sent (2026-09)
```

- [ ] **Step 5: Миграция и схема**

`supabase/migrations/00055_translator_session_metrics.sql`:

```sql
-- Per-call metrics of the consecutive translator: latency end-of-speech → first sound,
-- release reasons, interruptions, echo, cost by part and the event timeline. Written at
-- finalize (and on a mid-call engine swap); NULL for sessions of other engines.
ALTER TABLE translator_sessions ADD COLUMN IF NOT EXISTS metrics jsonb;
```

`db/schema.ts`, в `translatorSessions` после `transcript`:

```ts
  transcript: jsonb('transcript').notNull().default([]),
  metrics: jsonb('metrics'), // consecutive translator per-call metrics (services/consecutive/translator.ts)
```

- [ ] **Step 6:** Run settings test → PASS; `npx tsc --noEmit` → чисто.
- [ ] **Step 7: Commit** — `feat(translator): consecutive settings, prices and the metrics column`.

---

### Task 12: `translator.ts` — `ConsecutiveTranslator`

**Files:** Create `translator.ts`, Test `translator.test.ts`. Эталон: `agent/consecutive/call.py`
(`9e4b1eb`), `tests/test_consecutive_call.py`; интерфейс caller — `services/stealth-translator.ts`,
`services/realtime-translator.ts` (до удаления). Зависит от задач 1–11.

- [ ] **Step 1: Реализация** (весь файл)

```ts
/**
 * The consecutive interpreter on a Twilio call — aidispatch's agent/consecutive/call.py
 * brought to LingoLine.
 *
 * Twilio line → voice detector and echo meter → transcriber (gpt-live-transcribe) →
 * turn-taking core (floor) → translation and speech prepared ahead (engine) → playback,
 * one utterance at a time → Twilio. A translation plays when the person has finished the
 * thought, not over them.
 *
 * It keeps the duck-typed interface media-stream expects from every translator (sendAudio,
 * stop, detach, update*, pause/resume) and StealthTranslator's Socket.IO payloads byte for
 * byte, so the /translate page cannot tell the engines apart.
 *
 * Parts are replaceable (clock, output, transcriber, detector, judge, engine, client): the
 * tests and the smoke scene run this same code without a call.
 */
import { EventEmitter } from 'node:events';
import https from 'node:https';
import pino from 'pino';
import OpenAI from 'openai';
import { getIo } from '../../realtime/io.js';
import { getLangName } from '../../config/languages.js';
import { calculateLLMCost, calculateSTTCost, calculateTelephonyCost } from '../../config/pricing.js';
import type { TranslatorCarryover } from '../../models/types.js';
import { Downsampler3, mulawToPcm, pcmToMulaw, Upsampler3 } from './audio.js';
import { EchoMeter } from './echo.js';
import { FloorManager, type Command } from './floor.js';
import { Judge, JUDGE_MODEL, type IntentLabel } from './judge.js';
import { CascadeEngine, resolveVoice, TTS_MODEL, type EngineCallbacks, type OpenAILike } from './engine.js';
import { Playback, type PlaybackOut } from './playback.js';
import { TwilioOut, type TwilioSocketLike } from './twilio-out.js';
import { TranscribeLeg, TRANSCRIBE_FORMAT, type TranscribeFormat } from './transcribe.js';
import { loadSilero, VadStream, type VadEvent, type VadModel } from './vad.js';
import { DEFAULT_CONSECUTIVE_SETTINGS, loadConsecutiveSettings, type ConsecutiveSettings } from './settings.js';
import { isCrossScriptPair } from './policy.js';

const log = pino({ name: 'consecutive' });

const TICK_MS = 50;
const COMMIT_QUIET_S = 0.35;     // a transcription segment closes only after this much line silence...
const COMMIT_QUIET_PROB = 0.5;   // ...and with no speech in the detector's last window (its start threshold is 0.7)
const COMMIT_FORCE_S = 10;       // no silence at all — close anyway: the transcriber buffer must not grow forever
const CLOSE_TIMEOUT_MS = 1800;
const INTERIM_EVERY_S = 0.25;
const STATS_EVERY_MS = 5000;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const SAFETY_TIMEOUT_MS = 4 * 60 * 60 * 1000;
const STT_PRICE_KEY = 'openai-live-transcribe';
// Connections to OpenAI. The SDK's default agent drops an idle socket after 4 s, and the pause
// between replies is usually longer: every reply reopened them (+0.1–0.2 s to speech and to
// translation). OpenAI keeps an idle connection at least 4 minutes (aidispatch, 25.09).
export const KEEPALIVE_MS = 300_000;
export const WARM_CONNECTIONS = 4;   // judge, translation and two syntheses at once

export function httpAgent(): https.Agent {
  return new https.Agent({ keepAlive: true, timeout: KEEPALIVE_MS, maxFreeSockets: 20 });
}

export interface TranscriberLike {
  audioSeconds: number;
  start(): Promise<boolean>;
  push(audio: Buffer): void;
  commit(): boolean;
  setLanguages?(languages: string[]): void;
  aclose(): Promise<void>;
}

export interface JudgeLike {
  usage: { in: number; out: number };
  semanticEnd(text: string): Promise<[boolean, number] | null>;
  intent(text: string, playing: string): Promise<[IntentLabel, number] | null>;
  setLanguages?(names: [string, string]): void;
}

export interface EngineLike {
  usage: Record<string, number>;
  start(): Promise<boolean>;
  opened(utt: number, lang: string | null, candidate: boolean): void;
  updated(utt: number, text: string): void;
  released(utt: number, text: string): void;
  prepare(utt: number, text: string): void;
  reopened(utt: number): void;
  restart(utt: number): boolean;
  dropped(utt: number): void;
  stopped(utt: number): void;
  setVoice?(voice: string): void;
  setTone?(tone: string): void;
  setLanguages?(langA: string, langB: string): void;
  setSilentLangs?(langs: Iterable<string>): void;
  synthesize?(text: string): Promise<Buffer>;
  costs(): { text: number; tts: number };
  aclose(): Promise<void>;
}

export interface ConsecutiveParts {
  apiKey?: string;
  client?: OpenAILike;
  settings?: ConsecutiveSettings;
  /** null: run without a voice detector (tests). Omitted: load Silero. */
  vadModel?: VadModel | null;
  /** Tests and the smoke scene: build the transcriber around our delta handler. */
  transcriberFactory?: (onDelta: (itemId: string, text: string) => void) => TranscriberLike;
  judge?: JudgeLike;
  engineFactory?: (callbacks: EngineCallbacks) => EngineLike;
  out?: PlaybackOut;
  /** Monotonic seconds. */
  clock?: () => number;
  /** false: no database, Socket.IO or billing — the smoke scene and tests. */
  persist?: boolean;
  transcribeFormat?: TranscribeFormat;
}

export interface ConsecutiveTranslatorOptions {
  callId: string;
  workspaceId: string;
  /** Subscriber's language, e.g. 'ru'. */
  myLanguage: string;
  /** Other party's language, e.g. 'en'. */
  targetLanguage: string;
  socket: TwilioSocketLike;
  streamSid: string;
  /** One-way: only the subscriber's side is spoken; the other side is translated as text. */
  oneWay?: boolean;
  ttsVoiceId?: string;
  tone?: string;
  personalContext?: string;
  greetingText?: string;
  greetingDelaySeconds?: number;
  carryover?: TranslatorCarryover;
  parts?: ConsecutiveParts;
}

type Turn = {
  speaker: string; text: string; lang: string; translated: string; timestamp: string;
  untranslated?: boolean; interrupted?: boolean; skipped?: string;
};

function roundHalfEven(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/** Linear-interpolated percentile, as aidispatch's agent.store.percentile. */
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  if (ordered.length === 1) return ordered[0];
  const rank = (p / 100) * (ordered.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return ordered[lo];
  return roundHalfEven(ordered[lo] + (ordered[hi] - ordered[lo]) * (rank - lo));
}

const round6 = (x: number) => Math.round(x * 1e6) / 1e6;
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export class ConsecutiveTranslator extends EventEmitter {
  readonly engine = 'voice';          // media-stream's mode toggle treats us as a voice engine
  readonly impl = 'consecutive';      // media-stream falls back to the cascade when we fail to start
  readonly workspaceId: string;
  readonly callId: string;

  /** Public: the smoke scene watches it. */
  floor!: FloorManager;

  private myLang: string;
  private targetLang: string;
  private oneWay: boolean;
  private voice: string;
  private tone: string;
  private personalContext: string;
  private readonly greetingText: string;
  private readonly greetingDelaySeconds: number;
  private readonly parts: ConsecutiveParts;
  private readonly persist: boolean;
  private readonly clock: () => number;
  private readonly transcribeFormat: TranscribeFormat;
  private carryover?: TranslatorCarryover;

  private settings: ConsecutiveSettings = DEFAULT_CONSECUTIVE_SETTINGS;
  private client!: OpenAILike;
  private out!: PlaybackOut;
  private player!: Playback;
  private transcriber!: TranscriberLike;
  private judge!: JudgeLike;
  private engineImpl!: EngineLike;
  private vad: VadStream | null = null;
  private fedByVad = false;          // the transcriber hears the line through the frames the detector checked
  private commitDue: number | null = null;   // the core asked to close a segment; closed in the next silence
  private readonly echo = new EchoMeter();    // is our echo on the line at all: without it the echo filter only harms
  private readonly up3 = new Upsampler3();
  private readonly down = new Map<number, Downsampler3>();

  private readonly translations = new Map<number, string>();
  private readonly hasAudio = new Set<number>();
  private readonly logged = new Set<number>();
  private readonly interimAt = new Map<number, number>();

  private sessionId: string | null = null;
  private startTime = Date.now();
  private transcript: Turn[] = [];
  private paused = false;
  private closed = false;
  private saved = false;

  private ticker?: ReturnType<typeof setInterval>;
  private statsTimer?: ReturnType<typeof setInterval>;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private safetyTimer?: ReturnType<typeof setTimeout>;
  private greetingTimer?: ReturnType<typeof setTimeout>;
  private readonly side = new Set<Promise<unknown>>();

  constructor(private readonly opts: ConsecutiveTranslatorOptions) {
    super();
    this.callId = opts.callId;
    this.workspaceId = opts.workspaceId;
    this.myLang = opts.myLanguage;
    this.targetLang = opts.targetLanguage;
    this.oneWay = opts.oneWay ?? false;
    this.voice = resolveVoice(opts.ttsVoiceId);
    this.tone = opts.tone || '';
    this.personalContext = (opts.personalContext || '').trim();
    this.greetingText = (opts.greetingText || '').trim();
    this.greetingDelaySeconds = Math.min(30, Math.max(0, opts.greetingDelaySeconds ?? 5));
    this.carryover = opts.carryover;
    this.parts = opts.parts ?? {};
    this.persist = this.parts.persist ?? true;
    this.clock = this.parts.clock ?? (() => performance.now() / 1000);
    this.transcribeFormat = this.parts.transcribeFormat ?? TRANSCRIBE_FORMAT;
  }

  // ------------------------------------------------------------------ lifecycle

  /** Throws when the detector or the transcriber cannot come up: media-stream then runs the cascade. */
  async start(): Promise<void> {
    try {
      await this.boot();
    } catch (err) {
      await this.close();   // nothing may stay open when the call falls back
      throw err;
    }
  }

  private async boot(): Promise<void> {
    const p = this.parts;
    const apiKey = p.apiKey ?? await this.resolveApiKey();
    this.settings = p.settings ?? await loadConsecutiveSettings();
    const s = this.settings;
    this.client = p.client ?? (new OpenAI({ apiKey, httpAgent: httpAgent() }) as unknown as OpenAILike);
    this.floor = new FloorManager({
      langA: this.myLang, langB: this.targetLang,
      endSilenceS: s.endSilenceMs / 1000, hardEndS: s.hardEndMs / 1000,
      threshold: s.semanticThreshold, bargeInWords: s.bargeInWords,
      silentLangs: this.silentLangs(),
    }, this.clock);
    this.out = p.out ?? new TwilioOut(this.opts.socket, this.opts.streamSid);
    this.player = new Playback(this.out, { onFinished: u => this.onFinished(u), onFrame: f => this.echo.ours(f) });
    this.judge = p.judge ?? new Judge(this.client, { languages: [getLangName(this.myLang), getLangName(this.targetLang)] });
    const onDelta = (_item: string, text: string) => this.apply(this.floor.text(text));
    this.transcriber = p.transcriberFactory ? p.transcriberFactory(onDelta) : new TranscribeLeg({
      languages: [this.myLang, this.targetLang], apiKey, format: this.transcribeFormat, onDelta,
    });
    const callbacks: EngineCallbacks = {
      onAudio: (u, pcm) => this.onAudio(u, pcm), onText: (u, t) => this.onText(u, t), onDone: u => this.onDone(u),
    };
    this.engineImpl = p.engineFactory ? p.engineFactory(callbacks) : new CascadeEngine({
      client: this.client, langA: this.myLang, langB: this.targetLang, model: s.model, voice: this.voice,
      tone: this.tone, personalContext: this.personalContext, ...callbacks,
    });
    this.engineImpl.setSilentLangs?.(this.silentLangs());   // one place for the real engine and the fakes
    // The detector is a condition of work: without it pauses cannot be counted, and the
    // cascade is a better call than a translation that plays over the speaker.
    const model = p.vadModel === undefined ? await loadSilero() : p.vadModel;
    if (!await this.transcriber.start()) throw new Error('transcriber did not start');
    if (!await this.engineImpl.start()) throw new Error('engine did not start');
    if (model) {
      this.vad = new VadStream(model, ev => this.onVad(ev), undefined, err => this.onVadDead(err));
      this.fedByVad = true;
    }
    void this.player.run();
    this.ticker = setInterval(() => this.apply(this.floor.tick()), TICK_MS);
    await this.openSession();
    this.startTimers();
    this.spawn(this.warmUp());
    if (this.greetingText && !this.carryover) this.scheduleGreeting();
    log.info({ callId: this.callId, langs: [this.myLang, this.targetLang], model: s.model, voice: this.voice, vad: !!model },
      'Consecutive translator started');
  }

  private async resolveApiKey(): Promise<string> {
    const { resolveCredentials } = await import('../credential-resolver.service.js');
    return (await resolveCredentials<{ api_key: string }>(this.workspaceId, 'openai')).api_key;
  }

  /** Connections for the first reply open while the greeting plays; a failure costs nothing but the warm-up. */
  private async warmUp(): Promise<void> {
    const retrieve = this.client.models?.retrieve;
    if (!retrieve) return;
    await Promise.allSettled(Array.from({ length: WARM_CONNECTIONS }, () => this.client.models!.retrieve(TTS_MODEL)));
  }

  private async openSession(): Promise<void> {
    if (this.carryover) {
      this.sessionId = this.carryover.sessionId;
      this.startTime = this.carryover.startTime;
      this.transcript = this.carryover.transcript.slice() as Turn[];
      return;
    }
    if (!this.persist) return;
    const { db } = await import('../../config/db.js');
    const { translatorSessions } = await import('../../db/schema.js');
    const [session] = await db.insert(translatorSessions).values({
      subscriber_id: null as any, call_id: this.callId, workspace_id: this.workspaceId,
    }).returning();
    this.sessionId = session.id;
  }

  private startTimers(): void {
    this.safetyTimer = setTimeout(() => {
      log.warn({ callId: this.callId }, 'Consecutive translator safety timer fired');
      this.finalize().catch(() => {});
    }, SAFETY_TIMEOUT_MS);
    if (this.persist) {
      this.statsTimer = setInterval(() => {
        const secs = Math.floor((Date.now() - this.startTime) / 1000);
        const c = this.costParts();
        getIo()?.to(`call:${this.callId}`).emit('translator:stats', {
          call_id: this.callId, duration_seconds: secs, cost_usd: c.stt + c.text + c.judge + c.tts,
        });
      }, STATS_EVERY_MS);
    }
    this.resetIdleTimer();
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (!this.persist || this.closed) return;
    this.idleTimer = setTimeout(() => this.hangupOnIdle().catch(() => {}), IDLE_TIMEOUT_MS);
  }

  private async hangupOnIdle(): Promise<void> {
    if (this.saved) return;
    log.info({ callId: this.callId }, 'Consecutive translator idle timeout — hanging up');
    try {
      const callService = await import('../call.service.js');
      const call = await callService.getCall(this.workspaceId, this.callId);
      const sid = (call as any)?.twilio_call_sid;
      if (sid) {
        const telephony = await import('../telephony.service.js');
        await telephony.hangupCall(this.workspaceId, sid);
      }
    } catch (err) {
      log.warn({ callId: this.callId, err: (err as Error)?.name }, 'Idle hangup failed');
    }
    await this.finalize();
  }

  // ------------------------------------------------------------------ the line

  /** µ-law 8 kHz from Twilio, 20 ms per frame. */
  sendAudio(mulaw: Buffer): void {
    if (this.paused || this.closed || !this.floor) return;
    const pcm = mulawToPcm(mulaw);
    this.echo.line(pcm);
    if (this.echo.present !== null) this.floor.setEcho(this.echo.present);
    if (this.vad?.alive) this.vad.push(pcm);
    if (!this.fedByVad) this.transcriber.push(this.forTranscriber(pcm));
  }

  private forTranscriber(pcm8k: Buffer): Buffer {
    return this.transcribeFormat === 'pcmu' ? pcmToMulaw(pcm8k) : this.up3.push(pcm8k);
  }

  private onVad(ev: VadEvent): void {
    if (this.closed) return;
    if (ev.type === 'inference') {
      // The transcriber hears the line through the detector, in the frames it already judged:
      // the end of its buffer is always where speech/silence is known, so a segment closes in
      // silence. Fed directly, commit overtook the detector and cut a word in half ("Я п" +
      // "He puttle"). Costs one detector window (32 ms) of text latency.
      this.transcriber.push(this.forTranscriber(ev.frame));
      const due = this.commitDue;
      if (due === null) return;
      const quiet = ev.rawAccumulatedSilence >= COMMIT_QUIET_S && ev.probability < COMMIT_QUIET_PROB;
      if (quiet || this.clock() - due >= COMMIT_FORCE_S) {
        this.commitDue = null;
        this.transcriber.commit();
      }
    } else if (ev.type === 'start') {
      this.apply(this.floor.vadStart());
    } else {
      this.apply(this.floor.vadEnd(ev.silenceS));
    }
  }

  private onVadDead(err: unknown): void {
    log.warn({ callId: this.callId, err: (err as Error)?.name }, 'Consecutive: voice detector stopped');
    // No detector any more: the line goes to the transcriber directly, a pending commit now.
    this.fedByVad = false;
    if (this.commitDue !== null) {
      this.commitDue = null;
      this.transcriber.commit();
    }
  }

  // ------------------------------------------------------------------ core commands

  private apply(cmds: Command[]): void {
    for (const cmd of cmds) {
      try {
        this.do(cmd);
      } catch (err) {   // one broken command must not take the call down
        log.warn({ callId: this.callId, cmd: cmd.kind, err: (err as Error)?.name }, 'Consecutive command failed');
      }
    }
  }

  private do(cmd: Command): void {
    const u = 'utt' in cmd ? this.floor.utterances.get(cmd.utt) : undefined;
    switch (cmd.kind) {
      case 'opened':
        this.engineImpl.opened(cmd.utt, cmd.lang, cmd.candidate);
        break;
      case 'updated':
        if (u && (u.state === 'open' || u.state === 'released' || u.state === 'playing')) {
          this.engineImpl.updated(cmd.utt, u.text);
          this.emitInterim(u.id, u.text);
        }
        break;
      case 'judge':
        this.spawn(this.askJudge(cmd.utt, cmd.text));
        break;
      case 'intent':
        this.spawn(this.askIntent(cmd.utt, cmd.text, cmd.playing));
        break;
      case 'release':
        this.engineImpl.released(cmd.utt, u ? u.text : '');
        break;
      case 'prepare':
        if (u && u.state === 'open') this.engineImpl.prepare(cmd.utt, u.text);
        break;
      case 'reopened':
        // the speaker went on before this reply played: the engine's "done" no longer stands
        this.engineImpl.reopened(cmd.utt);
        this.player.undone(cmd.utt);
        break;
      case 'play':
        this.player.play(cmd.utt);
        break;
      case 'restart':
        // went on in the first seconds of our translation: old audio and text go, the engine
        // translates the whole thought again; new audio tells the core "has audio" again
        this.player.restart(cmd.utt);
        this.hasAudio.delete(cmd.utt);
        this.translations.delete(cmd.utt);
        this.down.delete(cmd.utt);
        this.engineImpl.restart(cmd.utt);
        break;
      case 'pause':
        this.player.pause(cmd.utt);
        break;
      case 'stop':
        this.player.stop(cmd.utt);
        this.engineImpl.stopped(cmd.utt);
        this.logTurn(cmd.utt, true);
        break;
      case 'drop':
        this.player.discard(cmd.utt);
        if (u && !u.greeting) {
          this.engineImpl.dropped(cmd.utt);
          if (cmd.reason === 'no translation') this.logTurn(cmd.utt, false);
          else if (cmd.reason === 'backchannel' || cmd.reason === 'ack' || cmd.reason === 'stale') this.logSkipped(cmd.utt, cmd.reason);
        }
        break;
      case 'commit':
        if (!this.fedByVad) this.transcriber.commit();
        else if (this.commitDue === null) this.commitDue = this.clock();   // onVad closes it in the next silence
        break;
    }
  }

  private async askJudge(utt: number, text: string): Promise<void> {
    const verdict = await this.judge.semanticEnd(text);
    if (!this.closed) this.apply(this.floor.judged(utt, text, verdict));
  }

  private async askIntent(utt: number, text: string, playing: string): Promise<void> {
    const verdict = await this.judge.intent(text, playing);
    if (!this.closed) this.apply(this.floor.intent(utt, verdict));
  }

  private spawn(task: Promise<unknown>): void {
    const tracked = task.catch(err => log.warn({ callId: this.callId, err: (err as Error)?.name }, 'Consecutive task failed'));
    this.side.add(tracked);
    void tracked.finally(() => this.side.delete(tracked));
  }

  // ------------------------------------------------------------------ engine and playback events

  private onAudio(utt: number, pcm24: Buffer): void {
    let d = this.down.get(utt);
    if (!d) {
      d = new Downsampler3();
      this.down.set(utt, d);
    }
    const pcm = d.push(pcm24);
    if (pcm.length) this.player.append(utt, pcm);
    if (!this.hasAudio.has(utt)) {
      this.hasAudio.add(utt);
      this.apply(this.floor.audio(utt));
    }
  }

  private onText(utt: number, text: string): void {
    this.floor.translation(utt, text);
    this.translations.set(utt, (this.translations.get(utt) ?? '') + text);
  }

  private onDone(utt: number): void {
    if (this.closed) return;
    if (this.hasAudio.has(utt)) {
      this.player.done(utt);
      return;
    }
    const u = this.floor.utterances.get(utt);
    if (!u || u.state !== 'released') return;
    if (u.lang !== null && this.silentLangs().has(u.lang)) {
      // one-way mode: the other side is shown as text only — done once translated
      this.apply(this.floor.textDone(utt));
      this.logTurn(utt, false);
      return;
    }
    // the engine finished with nothing to say: holding the head of the queue for it only
    // makes everything behind it wait ten seconds
    this.apply(this.floor.discard(utt, 'no translation'));
  }

  private onFinished(utt: number): void {
    this.apply(this.floor.finished(utt));
    this.logTurn(utt, false);
    this.resetIdleTimer();
  }

  // ------------------------------------------------------------------ transcript and Socket.IO

  /** One entry per reply, written when its translation is over (played, cut off, or text-only
   *  and ready): until then the speaker could still extend it — merge, restart. */
  private logTurn(utt: number, interrupted: boolean): void {
    const u = this.floor?.utterances.get(utt);
    if (!u || u.greeting || this.logged.has(utt) || !u.text) return;
    this.logged.add(utt);
    const translated = (this.translations.get(utt) ?? '').trim();
    const lang = u.lang ?? this.myLang;
    const speaker = lang === this.myLang ? 'subscriber' : 'other';
    const turn: Turn = { speaker, text: u.text, lang, translated, timestamp: new Date().toISOString() };
    if (!translated) turn.untranslated = true;
    if (interrupted) turn.interrupted = true;
    this.transcript.push(turn);
    this.emitTurn(speaker, u.text, translated, lang);
    // after a pause the latency counts from the resumed playback, as floor.latenciesMs does
    const sound = u.resumedAt || u.playAt;
    const latencyMs = sound && u.ended !== null ? Math.trunc((sound - u.ended) * 1000) : null;
    log.info({
      callId: this.callId, metric: 'consecutive_turn', utt, speaker, lang, release: u.releaseReason,
      latency_ms: latencyMs, interrupted, input_chars: u.text.length, output_chars: translated.length,
    }, 'consecutive_turn');
  }

  /** Said but not translated ("uh-huh", a stale reply, words right before hang-up): kept in the record, not shown. */
  private logSkipped(utt: number, reason: string): void {
    const u = this.floor?.utterances.get(utt);
    if (!u || u.greeting || this.logged.has(utt) || !u.text) return;
    this.logged.add(utt);
    const lang = u.lang ?? this.myLang;
    this.transcript.push({
      speaker: lang === this.myLang ? 'subscriber' : 'other', text: u.text, lang, translated: '',
      timestamp: new Date().toISOString(), skipped: reason,
    });
  }

  /** Field for field what StealthTranslator.emitTurn sends: /translate must not tell engines apart. */
  private emitTurn(speaker: string, original: string, translated: string, detectedLang: string): void {
    if (!this.persist) return;
    const io = getIo();
    if (!io) return;
    io.to(`call:${this.callId}:translate`).emit('call:translation', {
      call_id: this.callId, speaker, original, translated,
      detected_language: detectedLang, timestamp: new Date().toISOString(),
    });
    io.to(`call:${this.callId}`).emit('call:transcript', {
      call_id: this.callId, speaker: 'conference', text: original,
      timestamp: new Date().toISOString(), isFinal: true,
    });
  }

  private emitInterim(utt: number, text: string): void {
    if (!this.persist || !text) return;
    const now = this.clock();
    if (now - (this.interimAt.get(utt) ?? -Infinity) < INTERIM_EVERY_S) return;
    this.interimAt.set(utt, now);
    getIo()?.to(`call:${this.callId}`).emit('call:transcript', {
      call_id: this.callId, text, isFinal: false, timestamp: new Date().toISOString(),
    });
  }

  /** Translation text of a reply so far — the smoke scene reports it. */
  translationOf(utt: number): string {
    return this.translations.get(utt) ?? '';
  }

  // ------------------------------------------------------------------ greeting

  /** Synthesised now, in the voice of the translations; queued at the head of the core after
   *  the configured delay and played in the first quiet (at most 6 s later). It translates
   *  nothing, so it never becomes a transcript turn. */
  private scheduleGreeting(): void {
    const text = this.greetingText;
    const audio = (this.engineImpl.synthesize ? this.engineImpl.synthesize(text) : Promise.resolve(Buffer.alloc(0)))
      .catch(() => Buffer.alloc(0));
    this.greetingTimer = setTimeout(() => {
      this.greetingTimer = undefined;
      this.spawn(this.queueGreeting(text, audio));
    }, this.greetingDelaySeconds * 1000);
  }

  private async queueGreeting(text: string, audio: Promise<Buffer>): Promise<void> {
    if (this.closed || this.paused) return;
    const [gid, cmds] = this.floor.greeting(text);
    this.apply(cmds);
    const pcm24 = await audio;
    if (this.closed) return;
    if (this.paused || !pcm24.length) {
      this.apply(this.floor.discard(gid, 'no audio'));
      return;
    }
    this.player.append(gid, new Downsampler3().push(pcm24));
    this.player.done(gid);
    this.apply(this.floor.audio(gid));
  }

  // ------------------------------------------------------------------ controls

  updateLanguages(myLang: string, targetLang: string): void {
    if (!isCrossScriptPair(myLang, targetLang)) {
      // media-stream swaps to the cascade for such a pair before it gets here
      log.warn({ callId: this.callId, myLang, targetLang }, 'Consecutive translator refused a same-script pair');
      return;
    }
    this.myLang = myLang;
    this.targetLang = targetLang;
    this.floor.setLanguages(myLang, targetLang);
    this.floor.setSilentLangs(this.silentLangs());
    this.engineImpl.setLanguages?.(myLang, targetLang);
    this.engineImpl.setSilentLangs?.(this.silentLangs());
    this.transcriber.setLanguages?.([myLang, targetLang]);
    this.judge.setLanguages?.([getLangName(myLang), getLangName(targetLang)]);
    log.info({ callId: this.callId, myLang, targetLang }, 'Consecutive translator languages updated');
  }

  updateVoice(voice: string): void {
    this.voice = resolveVoice(voice);
    this.engineImpl.setVoice?.(this.voice);
    log.info({ callId: this.callId, voice: this.voice }, 'Consecutive translator voice updated');
  }

  updateTone(tone: string): void {
    this.tone = tone;
    this.engineImpl.setTone?.(tone);
    log.info({ callId: this.callId, tone }, 'Consecutive translator tone updated');
  }

  updateMode(mode: string): void {
    this.oneWay = mode === 'text' || mode === 'unidirectional';
    this.floor.setSilentLangs(this.silentLangs());
    this.engineImpl.setSilentLangs?.(this.silentLangs());
    log.info({ callId: this.callId, mode, oneWay: this.oneWay }, 'Consecutive translator mode updated');
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    if (this.floor) this.apply(this.floor.pauseAll('paused'));
    log.info({ callId: this.callId }, 'Consecutive translator paused');
  }

  resume(): void {
    this.paused = false;
    log.info({ callId: this.callId }, 'Consecutive translator resumed');
  }

  isPaused(): boolean {
    return this.paused;
  }

  private silentLangs(): Set<string> {
    return this.oneWay ? new Set([this.targetLang]) : new Set();
  }

  // ------------------------------------------------------------------ summary and cost

  private costParts(): { stt: number; text: number; judge: number; tts: number } {
    const e = this.engineImpl?.costs() ?? { text: 0, tts: 0 };
    return {
      stt: calculateSTTCost(STT_PRICE_KEY, (this.transcriber?.audioSeconds ?? 0) / 60),
      text: e.text,
      judge: this.judge ? calculateLLMCost(JUDGE_MODEL, this.judge.usage.in, this.judge.usage.out) : 0,
      tts: e.tts,
    };
  }

  summary(): Record<string, any> {
    const f = this.floor;
    const spoken = [...f.utterances.values()].filter(u => !u.greeting);
    const latencies = f.latenciesMs();
    const releases = spoken.filter(u => u.releasedAt !== null && u.ended !== null)
      .map(u => Math.trunc((u.releasedAt! - u.ended!) * 1000));
    const c = this.costParts();
    const s = this.settings;
    return {
      engine: 'consecutive',
      languages: [this.myLang, this.targetLang],
      model: s.model,
      voice: this.voice,
      settings: { end_silence_ms: s.endSilenceMs, hard_end_ms: s.hardEndMs, threshold: s.semanticThreshold, barge_in_words: s.bargeInWords },
      utterances: spoken.length,
      counts: { ...f.counts },
      latency_ms: { p50: percentile(latencies, 50), p90: percentile(latencies, 90), n: latencies.length },
      release_ms: { p50: percentile(releases, 50), p90: percentile(releases, 90) },
      judge_ms: { p50: percentile(f.judgeMs, 50), p90: percentile(f.judgeMs, 90), n: f.judgeMs.length },
      barge_ms: f.bargeMs.map(([first]) => first),
      played_s: this.player?.playedSeconds ?? 0,
      echo: { present: f.echo, correlation: this.echo.correlation, return_db: this.echo.returnDb },
      engine_usage: { ...(this.engineImpl?.usage ?? {}) },
      events: f.events.map(e => [...e]),
      costs: { transcribe: round6(c.stt), text: round6(c.text), judge: round6(c.judge), tts: round6(c.tts) },
      cost_usd: round6(c.stt + c.text + c.judge + c.tts),
    };
  }

  // ------------------------------------------------------------------ teardown

  stop(): void {
    this.finalize().catch(err => log.error({ callId: this.callId, err: (err as Error)?.name }, 'Consecutive finalize failed'));
  }

  /** Mid-call engine swap: hand the session on without finalizing it. */
  detach(): TranslatorCarryover {
    this.saved = true;   // the next engine finalizes the session
    const metrics = this.floor ? this.summary() : null;
    void this.close();   // its synchronous part logs a translation cut off by the swap
    if (this.persist && this.sessionId && metrics) void this.writeMetrics(metrics);
    return { sessionId: this.sessionId, startTime: this.startTime, transcript: this.transcript.slice() };
  }

  /** What must not be lost (turns) first, sockets last: closing them can eat the whole budget. */
  private async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    for (const t of [this.ticker, this.statsTimer]) if (t) clearInterval(t);
    for (const t of [this.idleTimer, this.safetyTimer, this.greetingTimer]) if (t) clearTimeout(t);
    if (this.floor) {
      for (const u of this.floor.utterances.values()) {
        if (u.state === 'playing') this.logTurn(u.id, true);   // the call ended mid-translation
        // said right before the hang-up, still waiting for silence or speech: nobody is left
        // to hear the translation, but the record keeps it
        else if (u.state === 'open' || u.state === 'released' || u.state === 'candidate') this.logSkipped(u.id, 'call_ended');
      }
    }
    this.vad?.close();
    this.player?.close();
    const closers = [this.transcriber?.aclose(), this.engineImpl?.aclose()].filter(Boolean) as Promise<void>[];
    await Promise.race([Promise.allSettled(closers), sleep(CLOSE_TIMEOUT_MS)]);
  }

  async finalize(): Promise<void> {
    if (this.saved) return;
    this.saved = true;
    await this.close();

    const durationSecs = Math.floor((Date.now() - this.startTime) / 1000);
    const durationMins = durationSecs / 60;
    const minutesUsed = Math.ceil(durationMins * 100) / 100;
    const c = this.costParts();
    const costTelephony = calculateTelephonyCost('twilio', durationMins);
    const costTotal = c.stt + c.text + c.judge + c.tts + costTelephony;
    const metrics = this.floor ? this.summary() : null;

    if (this.persist) {
      if (this.sessionId) {
        try {
          const { db } = await import('../../config/db.js');
          const { translatorSessions } = await import('../../db/schema.js');
          const { eq } = await import('drizzle-orm');
          await db.update(translatorSessions).set({
            duration_seconds: durationSecs,
            minutes_used: String(minutesUsed),
            cost_usd: String(costTotal),
            transcript: this.transcript as any,
            status: 'completed',
            metrics: metrics as any,
          }).where(eq(translatorSessions.id, this.sessionId));
        } catch (err) {
          log.error({ err, callId: this.callId }, 'Failed to update consecutive translator session');
        }
      }
      const callService = await import('../call.service.js');
      const aiSession = await callService.getAiSession(this.callId);
      if (aiSession) {
        const { finalizeSession } = await import('../session-finalizer.service.js');
        await finalizeSession({
          callId: this.callId,
          workspaceId: this.workspaceId,
          sessionId: aiSession.id,
          transcript: this.transcript,
          costs: {
            stt: c.stt, llm: c.text + c.judge, tts: c.tts, telephony: costTelephony,
            sttProvider: 'openai', llmProvider: 'openai', ttsProvider: 'openai',
          },
          durationSecs,
        });
      }
    }

    log.info({
      callId: this.callId, metric: 'consecutive_settled', durationSecs, minutesUsed, costTotal,
      turns: this.transcript.length, utterances: metrics?.utterances, latency_ms: metrics?.latency_ms,
      counts: metrics?.counts, echo: metrics?.echo,
    }, 'Consecutive translator finalized');
  }

  private async writeMetrics(metrics: Record<string, any>): Promise<void> {
    try {
      const { db } = await import('../../config/db.js');
      const { translatorSessions } = await import('../../db/schema.js');
      const { eq } = await import('drizzle-orm');
      await db.update(translatorSessions).set({ metrics: metrics as any }).where(eq(translatorSessions.id, this.sessionId!));
    } catch (err) {
      log.warn({ callId: this.callId, err: (err as Error)?.name }, 'Consecutive metrics not written on swap');
    }
  }
}
```

- [ ] **Step 2: Тесты** — `translator.test.ts` на подставных частях (`persist: false`,
`vadModel` — скриптованная модель или `null`, подставные `transcriber`/`judge`/`engineFactory`/
`out`, часы из теста; `setIo(fake)` для проверок Socket.IO с `persist: true` и подставленными
`apiKey`/`settings` — БД в таких тестах не трогается, пока `carryover` задан). Перенести из
`test_consecutive_call.py`:

| Python | в caller |
|---|---|
| a whole utterance goes from speech to sound and into the log | → запись в транскрипте + `call:translation` |
| the engine is told to prepare the tail before the release | как есть |
| stop word during translation stops it and marks the turn interrupted | `interrupted: true` в транскрипте |
| a continuation in the first seconds restarts the translation and logs the whole thought | как есть |
| greeting is spoken first and logged | **приветствие звучит первым и НЕ пишется в транскрипт** |
| greeting without audio does not block the queue | как есть |
| the transcriber hears the line only after the detector checked it | как есть |
| a segment is closed only in silence the detector confirmed | как есть |
| without any silence the segment is closed anyway after a while | как есть |
| when the detector dies the line goes to the transcriber directly | как есть |
| the call measures the echo and tells the floor | как есть |
| no transcriber means no call | `start()` бросает, всё закрыто |
| closing writes usage, latency and recording even if parts fail | `finalize()` считает метрики, даже если `aclose()` частей бросает (записи нет) |
| closing twice is harmless | `stop()` дважды |
| close budget fits the shutdown window | `CLOSE_TIMEOUT_MS` ≤ 2000 |
| a reply dropped as stale stays in the log untranslated | `skipped: 'stale'` |
| what was said right before hanging up stays in the log | `skipped: 'call_ended'` |
| connections to OpenAI are warmed up when the call starts | `models.retrieve` × `WARM_CONNECTIONS` |
| idle connections outlive the pauses between utterances | `httpAgent()`: `keepAlive` и `timeout ≥ 240000` |

Каркас подставных частей (общий для всех тестов файла) и свои тесты:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setIo } from '../../realtime/io.js';
import { ConsecutiveTranslator, type ConsecutiveParts, type ConsecutiveTranslatorOptions, type EngineLike, type TranscriberLike } from './translator.js';
import type { EngineCallbacks } from './engine.js';
import { DEFAULT_CONSECUTIVE_SETTINGS } from './settings.js';

class FakeTranscriber implements TranscriberLike {
  audioSeconds = 0; pushed: Buffer[] = []; commits = 0; closed = false; up = true;
  async start() { return this.up; }
  push(b: Buffer) { this.pushed.push(b); }
  commit() { this.commits++; return true; }
  async aclose() { this.closed = true; }
}

class FakeEngine implements EngineLike {
  usage = {}; log: string[] = []; langs = new Map<number, string | null>(); silent = new Set<string>();
  constructor(private readonly cb: EngineCallbacks) {}
  async start() { return true; }
  opened(u: number, lang: string | null) { this.langs.set(u, lang); this.log.push(`opened ${u}`); }
  updated() {} prepare() {} reopened() {}
  restart() { return true; }
  released(u: number, text: string) {
    this.log.push(`released ${u}`);
    const lang = this.langs.get(u) ?? null;
    queueMicrotask(() => {
      this.cb.onText(u, `T(${text})`);
      if (!(lang && this.silent.has(lang))) this.cb.onAudio(u, Buffer.alloc(48000));   // 1 s at 24 kHz
      this.cb.onDone(u);
    });
  }
  dropped(u: number) { this.log.push(`dropped ${u}`); }
  stopped(u: number) { this.log.push(`stopped ${u}`); }
  setSilentLangs(langs: Iterable<string>) { this.silent = new Set(langs); }
  costs() { return { text: 0, tts: 0 }; }
  async aclose() {}
  async synthesize() { return Buffer.alloc(4800); }
}

class FakeOut {
  writes = 0; clears = 0;
  private gate: Promise<void> | null = null;
  private open: (() => void) | null = null;
  hold() { this.gate = new Promise(resolve => { this.open = resolve; }); }
  release() { this.open?.(); this.gate = null; }
  async write() { this.writes++; if (this.gate) await this.gate; }
  clear() { this.clears++; }
}

const until = async (cond: () => boolean, tries = 400) => {
  for (let i = 0; i < tries && !cond(); i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.ok(cond(), 'condition not reached');
};

async function make(over: Partial<ConsecutiveParts> = {}, opts: Partial<ConsecutiveTranslatorOptions> = {}) {
  let now = 100;
  let deltas!: (item: string, text: string) => void;
  const transcriber = new FakeTranscriber();
  let engine!: FakeEngine;
  const out = new FakeOut();
  const translator = new ConsecutiveTranslator({
    callId: 'c1', workspaceId: 'w1', myLanguage: 'ru', targetLanguage: 'en',
    socket: { readyState: 1, send() {} }, streamSid: 'MZ1', ...opts,
    parts: {
      apiKey: 'k', persist: false, vadModel: null, clock: () => now, settings: DEFAULT_CONSECUTIVE_SETTINGS,
      client: { chat: { completions: { create: async () => ({}) } }, audio: { speech: { create: async () => ({}) } } },
      transcriberFactory: onDelta => { deltas = onDelta; return transcriber; },
      judge: { usage: { in: 0, out: 0 }, semanticEnd: async () => [true, 0.95], intent: async () => ['later', 0.9] },
      engineFactory: cb => (engine = new FakeEngine(cb)), out, ...over,
    },
  });
  await translator.start();
  const advance = async (seconds: number) => {
    for (let i = 0; i < Math.round(seconds / 0.05); i++) {
      now += 0.05;
      (translator as any).apply(translator.floor.tick());
      await new Promise(resolve => setImmediate(resolve));
    }
  };
  return { translator, say: (text: string) => deltas('item_1', text), advance, transcriber, engine: () => engine, out };
}

test('pause silences the playing translation, drops what is queued and stops feeding the transcriber', async () => {
  const { translator, say, advance, transcriber, engine, out } = await make();
  out.hold();
  say('Я вчера разговаривал с менеджером.');
  await advance(1.5);
  await until(() => translator.floor.utterances.get(1)?.state === 'playing');
  translator.pause();
  assert.equal(out.clears, 1);
  assert.ok(engine().log.includes('stopped 1'));
  const pushed = transcriber.pushed.length;
  translator.sendAudio(Buffer.alloc(160, 0xff));
  assert.equal(transcriber.pushed.length, pushed);
  out.release();
  translator.detach();
});

test('one-way: the other side is translated as text, logged once translated and never played', async () => {
  const { translator, say, advance, out } = await make({}, { oneWay: true });
  say('Hello, everything is fine.');
  await advance(1.5);
  await until(() => (translator as any).transcript.length === 1);
  const turn = (translator as any).transcript[0];
  assert.equal(turn.speaker, 'other');
  assert.equal(turn.translated, 'T(Hello, everything is fine.)');
  assert.equal(out.writes, 0);
  assert.equal(translator.floor.utterances.get(1)!.state, 'done');
  translator.detach();
});

test('Socket.IO payloads are byte-for-byte StealthTranslator.emitTurn', async () => {
  const emitted: Array<[string, string, any]> = [];
  setIo({ to: (room: string) => ({ emit: (ev: string, payload: any) => emitted.push([room, ev, payload]) }) } as any);
  const { translator, say, advance } = await make({ persist: true }, { carryover: { sessionId: null, startTime: Date.now(), transcript: [] } });
  say('Привет, как дела?');
  await advance(1.5);
  await until(() => emitted.some(([, ev]) => ev === 'call:translation'));
  const [room, , payload] = emitted.find(([, ev]) => ev === 'call:translation')!;
  assert.equal(room, 'call:c1:translate');
  assert.deepEqual(Object.keys(payload), ['call_id', 'speaker', 'original', 'translated', 'detected_language', 'timestamp']);
  const final = emitted.find(([, ev, p]) => ev === 'call:transcript' && p.isFinal)!;
  assert.deepEqual(Object.keys(final[2]), ['call_id', 'speaker', 'text', 'timestamp', 'isFinal']);
  translator.detach();
  setIo(null as any);
});

test('detach hands over the transcript and closes without finalizing', async () => {
  const { translator, say, advance, transcriber } = await make();
  say('Привет.');
  await advance(1.5);
  await until(() => (translator as any).transcript.length === 1);
  const carry = translator.detach();
  assert.equal(carry.transcript.length, 1);
  await until(() => transcriber.closed);
});

test('a same-script language change is refused in place', async () => {
  const { translator } = await make();
  translator.updateLanguages('en', 'it');
  assert.equal(translator.floor.cfg.langA, 'ru');
  translator.detach();
});
```

(`FloorManager.cfg` — публичное поле, `setLanguages` его заменяет.)

- [ ] **Step 3:** Run `node --import tsx --test src/services/consecutive/translator.test.ts` → PASS; `npm test` → всё зелёное; `npx tsc --noEmit` → чисто.
- [ ] **Step 4: Commit** — `feat(translator): ConsecutiveTranslator — the aidispatch interpreter on a Twilio call`.

---

### Task 13: Подключение в media-stream, удаление старых движков

**Files:**
- Modify: `packages/backend/src/routes/webhooks/media-stream.ts:110-209, 700-730, 867, 1000`
- Modify: `packages/backend/src/realtime/socket-server.ts:190-199`
- Delete: `packages/backend/src/services/realtime-translator.ts`, `packages/backend/src/services/conference-translator.ts`
- Modify (комментарии): `stealth-translator.ts:102,346`, `sandbox-session.service.ts:11-12,39,121`, `translate-text.ts:22-25`, `session-finalizer.service.ts:6`, `config/languages.ts:3`, `lib/lang-direction.ts:31`, `packages/frontend/src/app/dashboard/page.tsx:41`
- Modify: `docker-compose.yml:98-99`

- [ ] **Step 1: `TranslatorCtx`** — добавить поле:

```ts
interface TranslatorCtx {
  callId: string;
  /** Page mode the translator runs in: 'bidirectional' | 'unidirectional' | 'stealth'. */
  pageMode: string;
  workspaceId: string;
```

- [ ] **Step 2: Выбор движка** — заменить блок от `// Voice-mode engine.` до конца `buildTranslator`:

```ts
// Voice-mode engine. 'consecutive' is the consecutive interpreter ported from
// aidispatch (services/consecutive/); 'pipeline' forces the Deepgram cascade — the
// rollback switch. A workspace can force the cascade with
// translator_defaults.voice_engine = 'pipeline'; other stored values ('realtime',
// 'grok') belonged to engines that are gone and mean the default.
const VOICE_ENGINE = process.env.VOICE_ENGINE || 'consecutive';

/** The consecutive interpreter needs a voice mode, no rollback switch, and a pair it tells apart by alphabet. */
function wantsConsecutive(pageMode: string, ctx: TranslatorCtx): boolean {
  if (pageMode === 'stealth') return false;
  if (VOICE_ENGINE === 'pipeline' || ctx.voiceEngine === 'pipeline') return false;
  return isCrossScriptPair(ctx.myLanguage, ctx.targetLanguage);
}

/** Build a translator instance for the given page mode. */
async function buildTranslator(pageMode: string, ctx: TranslatorCtx, carryover?: any, cascade = false) {
  if (!cascade && wantsConsecutive(pageMode, ctx)) {
    const { ConsecutiveTranslator } = await import('../../services/consecutive/translator.js');
    return new ConsecutiveTranslator({
      callId: ctx.callId, workspaceId: ctx.workspaceId,
      myLanguage: ctx.myLanguage, targetLanguage: ctx.targetLanguage,
      socket: ctx.socket, streamSid: ctx.streamSid,
      oneWay: pageMode === 'unidirectional',
      ttsVoiceId: ctx.ttsVoiceId,
      tone: ctx.tone,
      personalContext: ctx.personalContext,
      greetingText: ctx.greetingText,
      greetingDelaySeconds: ctx.greetingDelaySeconds,
      carryover,
    });
  }

  // Stealth (silent text), same-script pairs and the rollback switch run on the
  // Deepgram cascade; it speaks in the voice modes.
  const isStealth = pageMode === 'stealth';
  const { StealthTranslator } = await import('../../services/stealth-translator.js');
  return new StealthTranslator({
    callId: ctx.callId, workspaceId: ctx.workspaceId,
    myLanguage: ctx.myLanguage, targetLanguage: ctx.targetLanguage,
    socket: ctx.socket, streamSid: ctx.streamSid,
    speak: !isStealth, // voice modes speak the translation; stealth stays silent
    oneWay: pageMode === 'unidirectional',
    greetingText: ctx.greetingText,
    greetingDelaySeconds: ctx.greetingDelaySeconds,
    ttsVoiceId: ctx.ttsVoiceId,
    tone: ctx.tone,
    carryover,
  });
}

/**
 * Build and start a translator. When the consecutive interpreter cannot come up (voice
 * detector or transcription session), the call falls back to the cascade instead of
 * failing: a translated call beats a dropped one.
 */
async function startTranslator(pageMode: string, ctx: TranslatorCtx, carryover?: any) {
  const translator = await buildTranslator(pageMode, ctx, carryover);
  try {
    await translator.start();
    return translator;
  } catch (err) {
    if ((translator as { impl?: string }).impl !== 'consecutive') throw err;
    logger.error({ err, callId: ctx.callId }, 'Consecutive translator did not start — falling back to the cascade');
    const fallback = await buildTranslator(pageMode, ctx, carryover, true);
    await fallback.start();
    return fallback;
  }
}
```

Импорт вверху файла: `import { isCrossScriptPair } from '../../services/consecutive/policy.js';`

- [ ] **Step 3: Смена режима и языков** — `setTranslatorMode`: после `if (!ctx || !current) return;`
вписать `ctx.pageMode = pageMode;`; строки `const neu = await buildTranslator(pageMode, ctx, carryover); await neu.start();`
заменить на `const neu = await startTranslator(pageMode, ctx, carryover);`. После функции добавить:

```ts
/**
 * Change the language pair mid-call. The consecutive interpreter only runs a pair with two
 * alphabets, so a change across that line swaps the engine the way a mode change does;
 * otherwise the running engine updates in place.
 */
export async function setTranslatorLanguages(callId: string, myLanguage: string, targetLanguage: string): Promise<void> {
  const ctx = translatorContexts.get(callId);
  const current = activeConferenceTranslators.get(callId);
  if (!ctx || !current) return;
  ctx.myLanguage = myLanguage;
  ctx.targetLanguage = targetLanguage;
  if (wantsConsecutive(ctx.pageMode, ctx) === (current.impl === 'consecutive')) {
    current.updateLanguages(myLanguage, targetLanguage);
    return;
  }
  const carryover = current.detach();
  const neu = await startTranslator(ctx.pageMode, ctx, carryover);
  ctx.socket.__conferenceTranslator = neu;
  activeConferenceTranslators.set(callId, neu);
  logger.info({ callId, myLanguage, targetLanguage, to: neu.impl ?? neu.engine }, 'Translator engine swapped for a new language pair');
}
```

- [ ] **Step 4: Старт звонка** — в сборке `ctx` (около строки 706) добавить `pageMode,` после `callId,`;
`const translator = await buildTranslator(pageMode, ctx); await translator.start();` заменить на
`const translator = await startTranslator(pageMode, ctx);`. Комментарии на строках ~867 и ~1000
(`see conference-translator.ts`) → `see CLAUDE.md, Realtime: Socket.IO is long-polling only`.

- [ ] **Step 5: socket-server.ts** — обработчик `translator:set-languages`:

```ts
    socket.on('translator:set-languages', async ({ call_id, my_language, target_language }: { call_id?: string; my_language: string; target_language: string }) => {
      try {
        const id = resolveCallId(call_id);
        if (!id || !await authorizeCallAccess(id)) return;
        // May swap engines: the consecutive interpreter needs a pair with two alphabets.
        const { setTranslatorLanguages } = await import('../routes/webhooks/media-stream.js');
        await setTranslatorLanguages(id, my_language, target_language);
      } catch (err) { log.error({ err, call_id }, 'translator socket event failed'); }
    });
```

- [ ] **Step 6: Удаление и комментарии**

```bash
cd /Users/vskorokhod/caller && $G rm packages/backend/src/services/realtime-translator.ts packages/backend/src/services/conference-translator.ts
```

`sandbox-session.service.ts:11-12` — ссылку «see conference-translator.ts» заменить сутью, которая
жила там:

```ts
// Pinned Grok Voice Agent model. We used to pass an undocumented slug that xAI silently
// mapped to its default; around 2026-06 the default drifted to the "think" flagship, a
// reasoning model that answers utterances and appends helper phrases instead of
// translating. The non-thinking grok-voice-fast-1.0 translates verbatim — version-pinned
// so xAI churn cannot change behaviour again. The model must go in ?model=: without it
// the realtime endpoint falls back to a text-only stub that never speaks.
const GROK_VOICE_MODEL = process.env.GROK_VOICE_MODEL || 'grok-voice-fast-1.0';
```

Остальные: упоминания `ConferenceTranslator` / `conference-translator.ts` в комментариях
`stealth-translator.ts`, `sandbox-session.service.ts:39,121`, `translate-text.ts`,
`session-finalizer.service.ts`, `config/languages.ts`, `lib/lang-direction.ts` → «the former
Grok voice translator» или имя живого модуля (`services/consecutive/translator.ts`);
`dashboard/page.tsx:41` → `Keep in sync with DEFAULT_GREETING in backend config/languages.ts.`
Проверка: `grep -rn "conference-translator\|ConferenceTranslator\|realtime-translator\|RealtimeTranslator" packages/*/src` → пусто.

- [ ] **Step 7: docker-compose.yml**

```yaml
      VOICE_ENGINE: ${VOICE_ENGINE:-consecutive}
      VOICE_TTS_PROVIDER: ${VOICE_TTS_PROVIDER:-xai}
```

(строка `REALTIME_TRANSLATE_MODEL` удаляется.)

- [ ] **Step 8:** `cd packages/backend && npx tsc --noEmit` → чисто; `npm test` → зелёное.
- [ ] **Step 9: Commit** — `feat(translator): consecutive interpreter is the voice engine; realtime and Grok engines removed`.

---

### Task 14: Админка — карточка «Translator» и метрики сессии

**Files:**
- Modify: `packages/backend/src/routes/admin/index.ts:546-557`
- Modify: `packages/frontend/src/app/admin/_lib/types.ts:159-168, 334-338`
- Modify: `packages/frontend/src/app/admin/settings/page.tsx` (новая карточка + рендер в `AdminSettingsPage`)
- Modify: `packages/frontend/src/app/admin/sessions/page.tsx` (блок метрик в раскрытой строке)

- [ ] **Step 1: Бэкенд**

```ts
import { CONSECUTIVE_SETTINGS_KEY, consecutiveSettingsSchema } from '../../services/consecutive/settings.js';
// …
  const settingsBodySchema = z.object({
    default_greeting: z.string().max(500).optional(),
    pricing: pricingOverridesSchema.optional(),
    translator_consecutive: consecutiveSettingsSchema.optional(),
  }).strict();

  app.get('/settings', async () => {
    const keys = ['default_greeting', 'pricing', CONSECUTIVE_SETTINGS_KEY];
```

`/sessions` уже отдаёт все колонки — `metrics` придёт сам.

- [ ] **Step 2: Типы фронтенда**

```ts
export interface ConsecutiveMetrics {
  engine: 'consecutive';
  languages: string[];
  model: string;
  voice: string;
  settings: Record<string, number>;
  utterances: number;
  counts: Record<string, number>;
  latency_ms: { p50: number | null; p90: number | null; n: number };
  release_ms: { p50: number | null; p90: number | null };
  judge_ms: { p50: number | null; p90: number | null; n: number };
  barge_ms: number[];
  played_s: number;
  echo: { present: boolean; correlation: number | null; return_db: number | null };
  engine_usage: Record<string, number>;
  events: Array<[number, string, string]>;
  costs: Record<string, number>;
  cost_usd: number;
}
```

В `Session` добавить `metrics?: ConsecutiveMetrics | null;`; в `PlatformSettings` —
`translator_consecutive?: Record<string, unknown>;`.

- [ ] **Step 3: Карточка настроек** — в `settings/page.tsx` перед `// ─── Provider pricing card`:

```tsx
// ─── Translator card ───────────────────────────────────────────────────────

const TRANSLATOR_DEFAULTS: Record<string, number | string> = {
  model: 'gpt-6-luna', end_silence_ms: 700, hard_end_ms: 2200, semantic_threshold: 0.8, barge_in_words: 5,
};

const TRANSLATOR_FIELDS = [
  { key: 'end_silence_ms', label: 'End-of-thought pause (ms)', hint: 'Silence after which a finished thought is translated. 300–3000.', step: '50', min: 300, max: 3000, int: true },
  { key: 'hard_end_ms', label: 'Hard limit (ms)', hint: 'Translated after this much silence even when the thought seems unfinished. 800–8000.', step: '100', min: 800, max: 8000, int: true },
  { key: 'semantic_threshold', label: 'Judge confidence', hint: 'How sure the judge must be that the thought is complete. 0.5–0.99.', step: '0.01', min: 0.5, max: 0.99, int: false },
  { key: 'barge_in_words', label: 'Words to interrupt', hint: 'Real words over a playing translation before the judge decides whether to stop it. 1–15.', step: '1', min: 1, max: 15, int: true },
] as const;

function TranslatorCard() {
  const { data, loading, error, refetch } = useAdminQuery<{ settings: PlatformSettings }>(
    () => api.get<{ settings: PlatformSettings }>('/admin/settings'),
  );
  const [model, setModel] = useState(String(TRANSLATOR_DEFAULTS.model));
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!data) return;
    const stored = (data.settings?.translator_consecutive ?? {}) as Record<string, unknown>;
    setModel(typeof stored.model === 'string' ? stored.model : String(TRANSLATOR_DEFAULTS.model));
    const next: Record<string, string> = {};
    for (const f of TRANSLATOR_FIELDS) {
      const v = stored[f.key];
      next[f.key] = String(typeof v === 'number' ? v : TRANSLATOR_DEFAULTS[f.key]);
    }
    setValues(next);
  }, [data]);

  async function save() {
    setBusy(true); setErr(''); setSaved(false);
    try {
      const body: Record<string, string | number> = { model };
      for (const f of TRANSLATOR_FIELDS) {
        const raw = parseFloat(values[f.key]);
        const v = f.int ? Math.round(raw) : raw;
        if (!Number.isFinite(v) || v < f.min || v > f.max) throw new Error(`${f.label}: ${f.min}–${f.max}`);
        body[f.key] = v;
      }
      await api.put('/admin/settings', { translator_consecutive: body });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      refetch();
    } catch (e: any) { setErr(e.message || 'Failed'); }
    setBusy(false);
  }

  return (
    <div className="rounded-xl p-4 md:p-5 space-y-4" style={cardStyle}>
      <div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--th-text)' }}>Translator</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--th-text-muted)' }}>
          Consecutive interpreter: when a thought counts as finished and when speech over a translation stops it. Applies from the next call.
        </p>
      </div>
      {loading ? (
        <div className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--th-surface)' }} />
      ) : error ? (
        <AdminErrorState error={error} onRetry={refetch} />
      ) : (
        <>
          <AdminFormField label="Translation model">
            <select value={model} onChange={e => setModel(e.target.value)} className={adminInputClass}>
              <option value="gpt-6-luna">GPT-6 Luna — fast and cheap (default)</option>
              <option value="gpt-6-sol">GPT-6 Sol — stronger, 20× the price</option>
            </select>
          </AdminFormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {TRANSLATOR_FIELDS.map(f => (
              <AdminFormField key={f.key} label={f.label}>
                <input
                  type="number" step={f.step} min={f.min} max={f.max}
                  value={values[f.key] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                  className={adminInputClass}
                />
                <p className="text-[11px] mt-1" style={{ color: 'var(--th-text-muted)' }}>{f.hint}</p>
              </AdminFormField>
            ))}
          </div>
          {err && <p className="text-xs" style={{ color: 'var(--th-error-text)' }}>{err}</p>}
          <SaveButton busy={busy} saved={saved} onClick={save} />
        </>
      )}
    </div>
  );
}
```

В `AdminSettingsPage` после `<GreetingCard />` — `<TranslatorCard />`.

- [ ] **Step 4: Блок метрик** — в `sessions/page.tsx` компонент и его вызов под транскриптом в
раскрытой строке (`{session.metrics?.engine === 'consecutive' && <MetricsBlock m={session.metrics} />}`):

```tsx
const RELEASE_KEYS = ['semantic', 'punctuation', 'hard', 'yield'] as const;
const FLOOR_KEYS = ['interrupted', 'restarted', 'paused', 'merged', 'reopened', 'stop_phrase'] as const;
const fmtS = (ms: number | null | undefined) => (ms == null ? '—' : `${(ms / 1000).toFixed(2)} s`);

function MetricsBlock({ m }: { m: ConsecutiveMetrics }) {
  const c = m.counts ?? {};
  const drops = Object.entries(c).filter(([k]) => k.startsWith('drop_')).map(([k, v]) => `${k.slice(5)} ${v}`);
  const echo = m.echo.correlation == null
    ? 'not measured'
    : m.echo.present ? `present (r=${m.echo.correlation}, ${m.echo.return_db ?? '—'} dB)` : `none (r=${m.echo.correlation})`;
  const row = (label: string, value: string) => (
    <div className="flex gap-3 text-xs">
      <span className="w-44 shrink-0" style={{ color: 'var(--th-text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--th-text)' }}>{value}</span>
    </div>
  );
  return (
    <div className="px-4 py-3 mb-2 mx-2 rounded-lg space-y-1.5" style={{ background: 'var(--th-surface)', border: '1px solid var(--th-border)' }}>
      <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--th-text-muted)', letterSpacing: '0.5px' }}>
        Consecutive translation
      </div>
      {row('Model · voice · pair', `${m.model} · ${m.voice} · ${m.languages.join(' ↔ ')}`)}
      {row('End of speech → sound', `p50 ${fmtS(m.latency_ms.p50)} · p90 ${fmtS(m.latency_ms.p90)} (n=${m.latency_ms.n})`)}
      {row('Released by', `${RELEASE_KEYS.map(k => `${k} ${c[`release_${k}`] ?? 0}`).join(' · ')} · p50 ${fmtS(m.release_ms.p50)}`)}
      {row('Judge', `p50 ${fmtS(m.judge_ms.p50)} · p90 ${fmtS(m.judge_ms.p90)} (n=${m.judge_ms.n})`)}
      {row('Floor', FLOOR_KEYS.map(k => `${k} ${c[k] ?? 0}`).join(' · '))}
      {row('Dropped', drops.length ? drops.join(' · ') : '—')}
      {row('Echo', echo)}
      {row('Cost', `${Object.entries(m.costs).map(([k, v]) => `${k} $${v.toFixed(4)}`).join(' · ')} = $${m.cost_usd.toFixed(4)}`)}
      <details className="text-xs pt-1">
        <summary className="cursor-pointer" style={{ color: 'var(--th-text-muted)' }}>Timeline ({m.events.length})</summary>
        <pre className="mt-2 max-h-64 overflow-y-auto text-[11px] leading-relaxed" style={{ color: 'var(--th-text-secondary)' }}>
          {m.events.map(([t, kind, detail]) => `${t.toFixed(2).padStart(7)}  ${kind.padEnd(9)} ${detail}`).join('\n')}
        </pre>
      </details>
    </div>
  );
}
```

- [ ] **Step 5:** `cd packages/backend && npx tsc --noEmit`; `cd packages/frontend && npx tsc --noEmit` → чисто.
- [ ] **Step 6: Commit** — `feat(admin): translator thresholds and per-call consecutive metrics`.

---

### Task 15: Сцена прогона без звонка

**Files:** Create `packages/backend/src/scripts/consecutive-smoke.ts`. Эталон:
`scripts/consecutive_smoke.py` (`9e4b1eb`).

- [ ] **Step 1: Реализация** — порт сцены: `SCENE`, `LONG_RU`, `VOICES = { A: 'ash', B: 'marin' }`
(A — русский, абонент; B — английский) и триггеры (`start` / `prev_end` / `playing` / `played`,
`TRIGGER_TIMEOUT_S = 25`) — как в Python. Отличия:

```ts
// Twilio instead of LiveKit: the translator writes µ-law to a fake stream socket. Twilio
// plays what it receives after what is already queued, and `clear` drops the rest — the
// mixer does the same, so the recording is what the people would hear.
const socket = {
  readyState: 1,
  send(data: string) {
    const msg = JSON.parse(data);
    if (msg.event === 'media') mixer.our(mulawToPcm(Buffer.from(msg.media.payload, 'base64')));
    else if (msg.event === 'clear') mixer.clear();
  },
};
const translator = new ConsecutiveTranslator({
  callId: 'smoke', workspaceId: 'smoke', myLanguage: 'ru', targetLanguage: 'en',
  socket, streamSid: 'MZsmoke', ttsVoiceId: 'marin',
  greetingText: "Hi, I'm the interpreter. Здравствуйте, я переводчик.", greetingDelaySeconds: 0,
  parts: { apiKey, persist: false },
});
```

- `Mixer` на 8 кГц (`FRAME_SAMPLES = 160`); `our(pcm)` ставит кадр на курсор проигрывания
  `max(playout, pos)`, эхо — на `+ECHO_DELAY_S` с усилением `10^(echoDb/20)`; `clear()` выбрасывает
  ещё не сыгранное (начало ≥ `pos`) и сбрасывает курсор; `wav(path)` — стерео 8 кГц (слева линия,
  справа мы), заголовок WAV пишется вручную (44 байта).
- Линия: цикл каждые 20 мс с поправкой на дрейф — `translator.sendAudio(pcmToMulaw(mixer.nextFrame()))`.
- Озвучка сцены: `client.audio.speech.create({ model: 'gpt-4o-mini-tts', voice, input, response_format: 'pcm' })`
  → `trim` (|x| > 300, запас ±2400 отсчётов при 24 кГц) → `new Downsampler3().push(...)`.
- Ключ: `process.env.OPENAI_API_KEY` или `getAdminWorkspaceId()` + `resolveCredentials(ws, 'openai')`
  через `await import('../services/credential-resolver.service.js')`; ключ не выводится.
- Аргументы: `--out` (по умолчанию `/tmp/consecutive-smoke`), `--echo-db`, `--format pcm24|pcmu`
  (→ `parts.transcribeFormat`; проверка, принимает ли `gpt-live-transcribe` µ-law Twilio напрямую).
- Итог: `translator.summary()` до `translator.finalize()`; строки реплик
  `{id, lang, state, release, text, eos_to_sound_ms, translation: translator.translationOf(id)}`;
  `smoke.json` = `{summary, utterances, scene_log}`; отчёт в stdout как `report()` в Python;
  в конце `process.exit(0)` (пул БД держит процесс).

- [ ] **Step 2:** `cd packages/backend && npx tsc --noEmit` → чисто; `npm run build` → есть `dist/scripts/consecutive-smoke.js`.
- [ ] **Step 3: Commit** — `feat(translator): smoke scene for the consecutive interpreter (port of consecutive_smoke.py)`.

---

### Task 16: CLAUDE.md

**Files:** Modify `CLAUDE.md` (разделы «Three Call Modes» #2, «Backend Layout» Translator,
«Tech Stack», «Translator Architecture», «Translator debug — useful log markers», «Commands»).

- [ ] **Step 1:** «Translator Architecture» — оставить абзац про single-leg speakerphone (первые
три пункта), дальше заменить текстом:

```markdown
Voice modes run the **consecutive interpreter** ported from aidispatch
(`services/consecutive/`, reference `~/aidispatch` @ 9e4b1eb, release 2.29.0):

- Silero VAD (onnxruntime-web) → `gpt-live-transcribe` (both languages, delay=low) → turn-taking
  core `floor.ts` → text translation GPT-6 Luna, streamed sentence by sentence while the person
  still talks → `gpt-4o-mini-tts` → playback one utterance at a time → Twilio (400 ms lead, `clear`).
- A translation plays when the thought is finished: pause ≥ 700 ms and the judge (`gpt-4.1-mini`)
  says "complete"; a short phrase by its final punctuation; otherwise the 2.2 s hard limit.
  Thresholds: admin → Settings → Translator (`platform_settings.translator_consecutive`).
- Who spoke is decided by the alphabet of the transcribed text, so the engine needs a cross-script
  pair (ru↔en, en↔zh, ru↔ar…). Same-script pairs (en↔es, ru↔uk, zh↔ja) and stealth run on the
  Deepgram cascade (`stealth-translator.ts`), which is also the rollback:
  `VOICE_ENGINE=pipeline` (env) or `translator_defaults.voice_engine='pipeline'` (workspace).
- "uh-huh" over a translation does not stop it; "stop / wait" does at once; ≥ 5 words → intent
  judge. The same speaker going on is merged into the same reply (restart within 3 s of playback,
  else pause and resume from the phrase start).
- Echo: `echo.ts` measures whether the line repeats our voice (envelope correlation ≥ 0.7); only
  then the text echo filter runs.
- Per-call metrics: `translator_sessions.metrics` (admin → Sessions) — latency p50/p90, release
  reasons, interruptions, echo, cost by part, event timeline.
- Smoke scene without a call:
  `docker compose exec -T backend node dist/scripts/consecutive-smoke.js --out /tmp/smoke [--echo-db -30]`.

The Grok Voice Agent remains only in the sandbox trainer (`sandbox-session.service.ts`); the
"Known upstream issue" note below applies to it.
```

«Three Call Modes» #2: Pipeline → «consecutive interpreter (see Translator Architecture)»,
Core → `services/consecutive/translator.ts`. Таблица Backend Layout, строка Translator →
`consecutive/*`, `stealth-translator`, `live-translate.service`. Tech Stack →
`onnxruntime-web@1.30` (Silero VAD). Лог-маркеры: заменить маркеры Grok на `consecutive_turn`
(по реплике: задержка, причина выпуска), `consecutive_settled` (итог звонка),
`Consecutive translator did not start — falling back to the cascade`,
`Consecutive: voice detector stopped`, `transcribe leg …`. Commands → `npm test -w @caller/backend`.

- [ ] **Step 2: Commit** — `docs: CLAUDE.md describes the consecutive interpreter`.

---

### Task 17: Проверка, прогон на живом API и выкладка

- [ ] **Step 1: Локально**

```bash
cd /Users/vskorokhod/caller/packages/backend && npx tsc --noEmit && npm test && npm run build
cd /Users/vskorokhod/caller/packages/frontend && npx tsc --noEmit
```

Expected: без ошибок, все тесты зелёные.

- [ ] **Step 2: Ревью** — `superpowers:requesting-code-review` по диффу ветки; исправить найденное.

- [ ] **Step 3: Слияние и пуш**

```bash
cd /Users/vskorokhod/caller && $G checkout main && $G merge --ff-only feat/consecutive-translator && $G push origin main
```

- [ ] **Step 4: Сборка на Mac mini (старый контейнер продолжает работать)**

```bash
ssh macmini 'cd ~/caller && git checkout main && git pull && git rev-parse --short HEAD && docker compose build backend frontend'
```

- [ ] **Step 5: Проверка API и сцена прогона — нужен явный OK Славы** (скрипт читает ключ OpenAI
внутри контейнера; прошлую попытку классификатор остановил как чтение прода):

```bash
ssh macmini 'cd ~/caller && docker compose run --rm --no-deps -T backend node dist/scripts/consecutive-smoke.js --out /tmp/smoke'
ssh macmini 'cd ~/caller && docker compose run --rm --no-deps -T backend node dist/scripts/consecutive-smoke.js --out /tmp/smoke-echo --echo-db -30'
```

Критерии: сцена доходит до конца без таймаутов триггеров; все реплики переведены; монолог — одна
реплика; «Yeah.» не обрывает перевод, «Stop.» обрывает; p50 «конец речи → звук» ≤ 1,5 с; на
`--echo-db -30` эхо найдено (`echo.present: true`) и перевод сам себя не переводит. Если модель
недоступна на ключе (ошибка 404/403 в логе сцены) — стоп, решение со Славой.

Третий прогон — `--format pcmu --out /tmp/smoke-pcmu`: если сессия расшифровки приняла µ-law и
реплики те же, `TRANSCRIBE_FORMAT` переключается на `'pcmu'` отдельным коммитом (меньше работы на
звонок); если сессия отвергла формат — остаётся `'pcm24'`.

- [ ] **Step 6: Миграция и выкладка**

```bash
ssh macmini 'cd ~/caller && docker compose run --rm --no-deps -T backend node dist/migrate.js && sed -i "" "s/^VOICE_ENGINE=pipeline$/VOICE_ENGINE=consecutive/" .env && grep "^VOICE_ENGINE" .env && docker compose up -d backend frontend && sleep 8 && docker compose ps backend frontend && docker compose exec -T backend printenv VOICE_ENGINE'
```

Expected: миграция `00055` применена, `VOICE_ENGINE=consecutive`, контейнеры `Up`.

- [ ] **Step 7: Смок прода** — `curl -s -o /dev/null -w '%{http_code}' https://lingoline.net/` → 200;
логи backend без ошибок старта: `ssh macmini 'cd ~/caller && docker compose logs --since 2m backend | tail -50'`.
Живой звонок делает Слава; после него — `SELECT metrics->'latency_ms', metrics->'counts' FROM translator_sessions ORDER BY created_at DESC LIMIT 1;`.

- [ ] **Step 8: Память** — обновить `project_voice_engine_pipeline_prod.md` (прод теперь
`consecutive`, pipeline — откат) и `project_realtime_translation_variant_b.md` (заменён), добавить
`project_consecutive_translator.md` (эталон aidispatch 9e4b1eb, где пороги, откат, сцена прогона),
строки в `MEMORY.md`.
