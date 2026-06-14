export interface DocSection {
  id: string;
  title: string;
  icon: string;
  articles: DocArticle[];
}

export interface DocArticle {
  id: string;
  title: string;
  content: string;
}

export const DOC_SECTIONS: DocSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: 'rocket_launch',
    articles: [
      {
        id: 'quick-start',
        title: 'Quick Start',
        content: `# Quick Start

**LingoLine is an AI live phone interpreter.** You merge it into an ordinary phone call (or put it on speakerphone) and it translates both sides out loud, in real time. There is no app to install, it works from any phone, and you pay only for the minutes you use.

## How it works in one line

You get your own LingoLine phone number. During a call where you and the other person don't share a language, you add that number to the call — the AI joins, listens, and speaks each side's words in the other language.

## Set up in 3 steps

1. **Sign up** at lingoline.net. You get **$2 in free credit** — no credit card required.
2. **Save your LingoLine number** in your phone contacts (call it "Translator").
3. **On your next call**, tap your phone's *merge / add call* button and add the Translator. It introduces itself and starts translating.

## What you need

- Any phone — mobile or landline. No special hardware.
- A LingoLine account with some balance (the free credit is enough for your first calls).
- That's it. The other person needs nothing — for them it's a normal call.

> **Tip:** Try the AI trainer (practice mode) in your dashboard first to hear how the translation sounds before a real call.
`,
      },
      {
        id: 'creating-your-account',
        title: 'Creating Your Account',
        content: `# Creating Your Account

Getting started takes under two minutes.

## Sign up

1. Go to **lingoline.net** and choose **Sign Up**.
2. Register with your email (or a supported social login).
3. You're in — your workspace and a personal LingoLine translator number are created automatically.

## Free credit

Every new account gets **$2 in free credit**. You can make real translated calls with it before adding any payment method — no credit card is required to start.

## Your dashboard

After signing in you'll see:

- Your **LingoLine translator number** — the number you merge into calls.
- Your **balance** and recent call history.
- **Settings** — voice, tone, and Telegram notifications.
- The **AI trainer** — a safe practice mode to hear the translator before a live call.
`,
      },
      {
        id: 'save-your-number',
        title: 'Save Your Translator Number',
        content: `# Save Your Translator Number

The single most useful setup step: **save your LingoLine number in your phone contacts** as "Translator". When you're mid-call and need it, it's one tap away.

## Why save it

LingoLine works by being *added to a live call*. Most phones let you add a contact to a call far faster than typing a number. Saving it removes all friction at the moment you need it.

## How to save it

1. Open your LingoLine dashboard and copy your translator number.
2. In your phone, create a new contact named **Translator** (or **LingoLine**).
3. Paste the number and save.

Now, on any call, you can merge the Translator in seconds.
`,
      },
      {
        id: 'first-call',
        title: 'Your First Translated Call',
        content: `# Your First Translated Call

Here's exactly what a translated call looks like.

## Step by step

1. **Call the person as usual** (or answer their call) — for example, a clinic, a bank, or a relative abroad.
2. Tap your phone's **Add call / Merge calls** button.
3. Dial or pick your saved **Translator** contact.
4. When it connects, tap **Merge** so everyone is on one call.
5. The translator briefly **introduces itself**, then translates each side into the other language.

## Talking tips

- **Take turns and pause briefly** after each sentence so the translator can finish speaking before the other side talks.
- Speak naturally — full sentences translate better than single words.
- The **direction is detected automatically**; you don't pick "from/to".

## After the call

When you hang up, the per-minute cost is deducted from your balance, and a **transcript** (and optional Telegram summary) is available in your dashboard.
`,
      },
    ],
  },
  {
    id: 'using-translator',
    title: 'Using the Translator',
    icon: 'translate',
    articles: [
      {
        id: 'how-merging-works',
        title: 'How Merging Works',
        content: `# How Merging Works

LingoLine joins your call as an extra participant using your phone's standard **conference / merge** feature — the same one you'd use to add a third person to a call.

## The flow

1. You're on a call with the other person.
2. You **add a second call** to your LingoLine number.
3. You **merge** the two calls into one.
4. LingoLine now hears both sides and speaks the translation out loud to everyone on the line.

## Why this design

- **No app** — it's just a phone call, so it works on any device and any carrier.
- **The other person needs nothing** — they don't install anything or sign up.
- **Works with landlines, switchboards, and IVRs** — because it's an ordinary call.

> Direction (who said what, in which language) is detected automatically from the speech, so you never have to configure language pairs.
`,
      },
      {
        id: 'speakerphone-mode',
        title: 'Speakerphone Mode',
        content: `# Speakerphone Mode

If both people are **in the same room**, you don't need to merge two calls — just use **speakerphone**.

## When to use it

- An in-person conversation across a language barrier (a doctor's visit, a store, a landlord).
- Any situation where both speakers are near the same phone.

## How it works

1. Call your LingoLine **Translator** number.
2. Put the phone on **speakerphone** between the two people.
3. Both voices arrive on the one line; the translator speaks each side's words in the other language.

This is the simplest mode — one call, no merging.
`,
      },
      {
        id: 'languages',
        title: 'Supported Languages',
        content: `# Supported Languages

LingoLine translates between **13 languages, in any direction**, with the direction detected automatically.

## The languages

- English
- Russian (Русский)
- Ukrainian (Українська)
- Spanish (Español)
- German (Deutsch)
- French (Français)
- Chinese (中文)
- Japanese (日本語)
- Korean (한국어)
- Arabic (العربية)
- Portuguese (Português)
- Italian (Italiano)
- Hindi (हिन्दी)

## Auto-detection

You don't select a "from" and "to" language. The translator listens to each speaker and translates into the other side's language automatically — so a single call can flow naturally in both directions.
`,
      },
      {
        id: 'voices-and-tones',
        title: 'Voices & Tones',
        content: `# Voices & Tones

The translation is spoken with **natural, lifelike AI voices** — not a robotic text-to-speech.

## Tones

You can pick a tone that fits the situation:

- **Professional** — neutral, business-appropriate.
- **Friendly** — warm and conversational.
- **Casual** — relaxed, everyday.
- **Formal** — polite and precise.
- **Medical** — careful, clear phrasing for clinical calls.
- **Legal** — precise phrasing for legal or official calls.

Set your default tone in **Settings**; you can change it any time.
`,
      },
      {
        id: 'live-transcript',
        title: 'Live Transcript',
        content: `# Live Transcript

Every translated call produces a **live text transcript** you can follow and revisit.

## During the call

The transcript updates in real time in your dashboard, showing each side's words and their translation — useful for confirming names, numbers, and details.

## After the call

The full transcript is saved to your call history. You can open it later to check what was said — handy for appointments, account numbers, or instructions you received on the call.
`,
      },
      {
        id: 'telegram-summaries',
        title: 'Telegram Summaries',
        content: `# Telegram Summaries

Connect Telegram to get a **summary of each call** delivered to you automatically.

## What you get

- A notification when a translated session starts and ends.
- A short **summary** of the conversation and key points.

## How to connect

1. Open **Settings → Telegram** in your dashboard.
2. Follow the prompt to link your Telegram account.
3. Future calls send their summaries to you on Telegram.
`,
      },
    ],
  },
  {
    id: 'billing',
    title: 'Billing & Balance',
    icon: 'account_balance_wallet',
    articles: [
      {
        id: 'how-the-balance-works',
        title: 'How the Balance Works',
        content: `# How the Balance Works

LingoLine is **pay-as-you-go**. You keep a prepaid balance and the cost of each call is deducted from it — there is **no subscription and no monthly fee**.

## The basics

- New accounts start with **$2 in free credit**.
- Each translated call costs about **$0.20 per minute**, charged only while you're talking.
- The cost is deducted **after you hang up**.
- When the balance runs low, you simply top it up again.

You're never billed a recurring fee, and you never pay for time you didn't use.
`,
      },
      {
        id: 'pricing',
        title: 'Pricing',
        content: `# Pricing

**About $0.20 per minute. No subscription. $2 free to start.**

## What you pay

| Item | Cost |
|---|---|
| Per minute of translation | ~$0.20 |
| Monthly fee | $0 |
| Free credit on signup | $2 |
| Cost when not on a call | $0 |

## How it adds up

You only pay for the minutes you're actually on a translated call. A ten-minute call to a clinic costs roughly **$2** — covered by your free starting credit. Top up whenever you like; unused balance stays on your account.
`,
      },
      {
        id: 'topping-up',
        title: 'Topping Up',
        content: `# Topping Up

Add to your balance by card whenever you need to.

## How to top up

1. Open **Billing** in your dashboard.
2. Choose an amount to add.
3. Pay securely by card via **Stripe**.

Your new balance is available immediately. There's no commitment — top up only when you want to, and only as much as you want.
`,
      },
    ],
  },
  {
    id: 'privacy-security',
    title: 'Privacy & Security',
    icon: 'shield',
    articles: [
      {
        id: 'your-data-and-recordings',
        title: 'Your Data & Recordings',
        content: `# Your Data & Recordings

LingoLine processes the audio of your call in real time to translate it, and stores the **transcript** so you can review it later.

## What's kept

- **Transcripts** of your translated calls, in your call history.
- **Call metadata** (time, duration, languages, cost).
- Any **recordings** are subject to the retention described in our Privacy Policy.

## Your control

You can review your call history in the dashboard. For full details on what we collect, how long it's kept, and your rights, see the [Privacy Policy](/privacy).

> For sensitive health, legal, or financial calls, review the accuracy and limitations note before relying on the translation.
`,
      },
      {
        id: 'security',
        title: 'Security',
        content: `# Security

LingoLine is built with standard production security practices.

## How your data is protected

- **Encryption in transit** (TLS) for all connections.
- **Encrypted storage** for sensitive data and credentials.
- **Workspace isolation** — your data is scoped to your account.
- **Rate limiting and audit logging** on sensitive actions.

Payments are handled by **Stripe**; LingoLine never stores your full card details.
`,
      },
      {
        id: 'accuracy-and-limitations',
        title: 'Accuracy & Limitations',
        content: `# Accuracy & Limitations

LingoLine uses high-quality AI translation that works well for everyday conversations — but it's important to understand its limits.

## Best practices

- **Take turns and pause** so each phrase finishes before the next speaker starts.
- Speak in **complete sentences**; avoid heavy slang or talking over each other.
- Confirm critical details (names, numbers, dates) out loud.

## Important disclaimer

AI translation is **not a substitute for a certified human interpreter** in high-stakes medical, legal, or emergency situations. For decisions where a mistranslation could cause harm, use a qualified professional interpreter. See our [Terms of Service](/terms) for the full disclaimer.
`,
      },
    ],
  },
];
