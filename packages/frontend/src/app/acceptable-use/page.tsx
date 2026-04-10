import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Acceptable Use Policy — Caller',
  description: 'Caller platform acceptable use policy. Rules for using our AI phone calling service.',
};

export default function AcceptableUsePage() {
  return (
    <div className="min-h-screen" style={{ background: '#0e131f', color: '#dde2f3', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');
        .font-headline { font-family: 'Manrope', sans-serif; }
      `}</style>

      <header className="border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="font-headline font-bold text-lg">Caller</Link>
          <div className="flex gap-4 text-xs" style={{ color: 'rgba(194,198,214,0.5)' }}>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="font-headline text-3xl font-bold mb-2">Acceptable Use Policy</h1>
        <p className="text-sm mb-12" style={{ color: 'rgba(194,198,214,0.4)' }}>Last updated: April 9, 2026</p>

        <div className="space-y-10 text-sm leading-relaxed" style={{ color: 'rgba(194,198,214,0.7)' }}>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Purpose</h2>
            <p>This Acceptable Use Policy (&quot;AUP&quot;) governs your use of the Caller platform. It is designed to protect our users, called parties, and the integrity of the telecommunications network. This AUP is incorporated into and forms part of our <Link href="/terms" className="underline text-blue-400">Terms of Service</Link>.</p>
            <p className="mt-2">Violations of this AUP may result in immediate suspension or termination of your account without notice or refund.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Prohibited Activities</h2>
            <p>You must not use the Service to:</p>

            <h3 className="font-semibold text-white mt-4 mb-2">2.1 Illegal and Harmful Communications</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Make unsolicited calls (spam/robocalls) without proper consent as required by the TCPA</li>
              <li>Make harassing, threatening, abusive, or intimidating calls</li>
              <li>Engage in fraud, phishing, scams, or social engineering</li>
              <li>Impersonate law enforcement, government agencies, or emergency services</li>
              <li>Make calls for debt collection in violation of the Fair Debt Collection Practices Act (FDCPA)</li>
              <li>Call numbers on the National Do Not Call Registry without an applicable exemption</li>
              <li>Call outside permitted hours (before 8 AM or after 9 PM in the called party&apos;s local time)</li>
            </ul>

            <h3 className="font-semibold text-white mt-4 mb-2">2.2 AI and Voice Misuse</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Use AI voice cloning to impersonate real individuals without their explicit written consent</li>
              <li>Disable, circumvent, or modify the AI disclosure message that identifies the caller as an AI</li>
              <li>Disable or circumvent call recording consent disclosures in two-party consent jurisdictions</li>
              <li>Generate deepfake audio or synthetic voices designed to deceive</li>
              <li>Use the Service to generate content that is sexually explicit, promotes violence, or targets minors</li>
            </ul>

            <h3 className="font-semibold text-white mt-4 mb-2">2.3 Technical Abuse</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Attempt to access data belonging to other workspaces or users</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
              <li>Use automated tools to abuse the API beyond published rate limits</li>
              <li>Introduce malicious code, viruses, or other harmful content</li>
              <li>Interfere with or disrupt the Service infrastructure</li>
              <li>Share or transfer API keys to unauthorized third parties</li>
            </ul>

            <h3 className="font-semibold text-white mt-4 mb-2">2.4 Regulated Industries</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Process protected health information (PHI) under HIPAA without a separate Business Associate Agreement</li>
              <li>Conduct financial transactions or provide financial advice in violation of applicable regulations</li>
              <li>Use the Service for political campaigns without complying with FCC and FEC regulations for AI-generated political communications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Consent and Compliance Requirements</h2>
            <p>When using the Service for outbound calls, you must:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Maintain records of prior express written consent for each phone number you call</li>
              <li>Provide these records to us upon request within 5 business days</li>
              <li>Scrub your call lists against the National DNC Registry at least every 31 days</li>
              <li>Maintain and honor your own internal do-not-call list</li>
              <li>Immediately stop calling any number upon receiving an opt-out request</li>
              <li>Comply with all applicable state telemarketing registration requirements</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Content Standards</h2>
            <p>All content transmitted through the Service (agent prompts, greetings, knowledge base documents) must not:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Contain false, misleading, or deceptive statements</li>
              <li>Infringe on third-party intellectual property rights</li>
              <li>Contain hate speech or discriminatory content based on race, religion, gender, sexual orientation, disability, or other protected characteristics</li>
              <li>Promote illegal activities or substances</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Volume and Rate Limits</h2>
            <p>The Service enforces rate limits to ensure fair usage and prevent abuse:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>API requests: 100 per minute per workspace (default)</li>
              <li>Concurrent calls: Limited by your plan and telephony connections</li>
              <li>We reserve the right to throttle or limit usage that degrades the experience for other users</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Monitoring and Enforcement</h2>
            <p>We may monitor usage patterns to detect violations of this AUP. We reserve the right to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Investigate suspected violations</li>
              <li>Suspend or terminate accounts that violate this AUP</li>
              <li>Remove or disable content that violates this AUP</li>
              <li>Report illegal activities to law enforcement</li>
              <li>Cooperate with regulatory investigations</li>
            </ul>
            <p className="mt-2">We will attempt to notify you of violations and provide an opportunity to remediate before termination, except in cases of egregious or illegal conduct.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Reporting Violations</h2>
            <p>If you believe someone is using the Service in violation of this AUP, please report it to:</p>
            <p className="mt-2 text-white">Email: abuse@caller.com</p>
            <p className="mt-2">We take all reports seriously and will investigate promptly. Reports can be made anonymously.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Changes to This Policy</h2>
            <p>We may update this AUP from time to time. Material changes will be communicated via email or notice on the Service at least 15 days before taking effect.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
