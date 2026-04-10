import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service — Caller',
  description: 'Caller platform terms of service and conditions of use.',
};

export default function TermsPage() {
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
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/acceptable-use" className="hover:text-white transition-colors">Acceptable Use</Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="font-headline text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm mb-12" style={{ color: 'rgba(194,198,214,0.4)' }}>Last updated: April 9, 2026</p>

        <div className="space-y-10 text-sm leading-relaxed" style={{ color: 'rgba(194,198,214,0.7)' }}>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Agreement to Terms</h2>
            <p>By accessing or using the Caller platform (&quot;Service&quot;), operated by Caller (&quot;Company,&quot; &quot;we,&quot; &quot;us&quot;), you (&quot;Customer,&quot; &quot;you&quot;) agree to be bound by these Terms of Service (&quot;Terms&quot;), our <Link href="/privacy" className="underline text-blue-400">Privacy Policy</Link>, and our <Link href="/acceptable-use" className="underline text-blue-400">Acceptable Use Policy</Link>. If you do not agree, do not use the Service.</p>
            <p className="mt-2">You represent that you have the legal authority to bind the entity on whose behalf you are using the Service. The Service is intended for business use (B2B) and is not directed at consumers under 18 years of age.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Description of Service</h2>
            <p>Caller provides an AI-powered phone calling platform that enables businesses to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Make and receive phone calls using AI agents</li>
              <li>Record phone calls and generate transcripts</li>
              <li>Provide live real-time translation during phone calls</li>
              <li>Integrate with external systems via MCP (Model Context Protocol) API</li>
              <li>Manage AI agent configurations, knowledge bases, and workflows</li>
            </ul>
            <p className="mt-2">The Service uses third-party providers including Twilio (telephony), Deepgram and OpenAI (speech recognition), Anthropic and OpenAI (language models), ElevenLabs (text-to-speech), xAI (voice agent), and Stripe (payment processing).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. TCPA and Telephony Compliance</h2>
            <p className="font-semibold text-yellow-300">THIS IS A CRITICAL SECTION. PLEASE READ CAREFULLY.</p>
            <p className="mt-2">The Service enables automated and AI-generated phone calls that are subject to the Telephone Consumer Protection Act (TCPA), Federal Communications Commission (FCC) regulations, and applicable state laws.</p>
            <p className="mt-2"><strong className="text-white">Customer Obligations:</strong></p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Prior Express Written Consent:</strong> You must obtain prior express written consent from each individual before making any outbound AI call to their phone number, as required by the TCPA (47 U.S.C. &sect; 227). You must maintain records of all consents obtained.</li>
              <li><strong>Do Not Call Compliance:</strong> You must scrub your call lists against the National Do Not Call Registry and maintain your own internal do-not-call list. You must honor all opt-out requests immediately.</li>
              <li><strong>Calling Hours:</strong> You must not initiate calls before 8:00 AM or after 9:00 PM in the called party&apos;s local time zone.</li>
              <li><strong>Caller ID:</strong> You must provide accurate caller ID information. Spoofing caller ID is prohibited under the Truth in Caller ID Act.</li>
              <li><strong>AI Disclosure:</strong> You must ensure that all AI-generated calls clearly disclose the use of AI at the beginning of each call, as required by California Civil Code &sect; 17941 (SB 1001) and FCC regulations.</li>
              <li><strong>Recording Consent:</strong> You must comply with all applicable call recording laws, including two-party consent states such as California (Penal Code &sect; 632). The Service provides configurable disclosure messages; you are responsible for ensuring they are enabled and adequate for your jurisdiction.</li>
            </ul>
            <p className="mt-3 p-3 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <strong className="text-red-400">Warning:</strong> Violations of the TCPA carry statutory damages of $500 to $1,500 per call. You are solely responsible for your compliance with all applicable telephony laws. The Company does not verify your consent records and is not responsible for any TCPA violations arising from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Account and Workspace</h2>
            <p>You must create an account to use the Service. You are responsible for maintaining the confidentiality of your account credentials and API keys. You must notify us immediately of any unauthorized access. The Company is not liable for losses arising from unauthorized use of your account.</p>
            <p className="mt-2">Each workspace is isolated. You may invite team members with different roles (owner, admin, operator, analyst). You are responsible for the actions of all users in your workspace.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Billing and Payments</h2>
            <p><strong className="text-white">Deposit Model:</strong> The Service operates on a prepaid deposit model. You add funds to your workspace balance, and usage costs are deducted automatically. Platform provider costs are marked up (currently 3x) to cover infrastructure, support, and margin.</p>
            <p className="mt-2"><strong className="text-white">Subscriptions:</strong> Certain plans (Agents, Agents + MCP) require a monthly subscription in addition to usage-based charges. Subscriptions auto-renew unless canceled before the end of the billing period.</p>
            <p className="mt-2"><strong className="text-white">Refunds:</strong> Unused deposit balances may be refunded at the Company&apos;s discretion. Subscription fees are non-refundable except where required by law. We reserve the right to issue prorated refunds for service outages exceeding 24 consecutive hours.</p>
            <p className="mt-2"><strong className="text-white">Own Keys:</strong> If you provide your own API keys for third-party providers (e.g., Twilio, Deepgram), you are billed at cost or not billed for that provider. You are responsible for your own provider agreements and costs.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. AI-Generated Content Disclaimer</h2>
            <p>The Service uses artificial intelligence to generate spoken responses, transcripts, summaries, and other outputs. AI-generated content may be inaccurate, incomplete, or inappropriate. You acknowledge that:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>AI outputs are generated automatically and are not reviewed by humans</li>
              <li>The Company does not guarantee the accuracy, completeness, or suitability of any AI-generated content</li>
              <li>You are solely responsible for reviewing and verifying AI outputs before relying on them</li>
              <li>The Company is not liable for any decisions made or actions taken based on AI-generated content</li>
            </ul>

            <h3 className="font-semibold text-white mt-5 mb-2">6.1 Live Translation — Medical, Legal, and Critical-Context Disclaimer</h3>
            <p className="p-3 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <strong className="text-red-400">Critical Warning:</strong> The Live Translator feature is a general-purpose AI translation tool. It is <strong className="text-white">NOT a substitute for a certified, qualified human interpreter</strong> in any context where miscommunication could lead to harm, including but not limited to:
            </p>
            <ul className="list-disc list-inside mt-3 space-y-1">
              <li><strong>Medical settings:</strong> Diagnoses, treatment instructions, medication dosages, surgical consent, insurance claims. AI may mistranslate medical terminology, numbers, drug names, or dosage instructions.</li>
              <li><strong>Legal settings:</strong> Court proceedings, contracts, immigration hearings, police interactions, legal rights advisements</li>
              <li><strong>Emergency situations:</strong> 911 calls, safety-critical communications, emergency evacuations</li>
              <li><strong>Financial settings:</strong> Loan terms, insurance coverage details, tax obligations</li>
            </ul>
            <p className="mt-3">You acknowledge and agree that:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>AI translation may contain errors including mistranslated numbers, names, medical terms, and legal terminology</li>
              <li>You should always request a qualified human interpreter from your healthcare provider, legal representative, or government agency for critical matters — they are required by law to provide one (Section 1557 of the Affordable Care Act; Title VI of the Civil Rights Act)</li>
              <li>You use the Live Translator at your own risk for any medical, legal, financial, or safety-critical communication</li>
              <li>The Company is not liable for any harm, injury, financial loss, legal consequence, or adverse outcome resulting from reliance on AI-translated content</li>
              <li>The Live Translator is intended to help with everyday communication and should be used as a convenience tool, not as a sole means of communication in critical situations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Data and Recordings</h2>
            <p><strong className="text-white">Ownership:</strong> You retain ownership of all data you upload, call recordings, transcripts, and other content generated in connection with your use of the Service (&quot;Customer Data&quot;).</p>
            <p className="mt-2"><strong className="text-white">License:</strong> You grant the Company a limited, non-exclusive license to process, store, and transmit Customer Data solely to provide and improve the Service.</p>
            <p className="mt-2"><strong className="text-white">Retention:</strong> Call recordings are retained according to your workspace settings (default: 90 days). Transcripts and summaries are retained for the life of your account unless you delete them. Upon account termination, all Customer Data is deleted within 30 days, except as required by law.</p>
            <p className="mt-2"><strong className="text-white">Third-Party Processing:</strong> Customer Data may be processed by our third-party providers (listed in Section 2) solely to deliver the Service. We maintain data processing agreements with all providers. Audio data sent to AI providers is not used by them to train their models (subject to each provider&apos;s API terms).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Prohibited Uses</h2>
            <p>You must comply with our <Link href="/acceptable-use" className="underline text-blue-400">Acceptable Use Policy</Link>. In addition, you must not:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Use the Service for any illegal purpose or in violation of any applicable law</li>
              <li>Make unsolicited calls (spam), harassing calls, or threatening calls</li>
              <li>Use AI voice cloning to impersonate real individuals without their explicit written consent</li>
              <li>Circumvent or disable AI disclosure or recording consent mechanisms</li>
              <li>If you are a HIPAA-covered entity or business associate (healthcare provider, health plan, healthcare clearinghouse, or their contractor), use the Service to process protected health information (PHI) without a separate Business Associate Agreement. This restriction applies to organizational use; individual consumers using the Service for their own personal healthcare communications (e.g., calling their doctor with the Live Translator) are not subject to this restriction, but should review the medical disclaimer in Section 6.1.</li>
              <li>Attempt to access other workspaces or circumvent security controls</li>
              <li>Resell or sublicense the Service without written authorization</li>
              <li>Use the Service in a manner that degrades performance for other users</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Indemnification</h2>
            <p><strong className="text-white">By Customer:</strong> You agree to indemnify, defend, and hold harmless the Company, its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including reasonable attorney&apos;s fees) arising from: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any TCPA, recording consent, or other telephony law; (d) the content of your calls and communications; (e) any claim by a third party related to calls made through your workspace.</p>
            <p className="mt-2"><strong className="text-white">By Company:</strong> The Company will indemnify you against third-party claims alleging that the Service itself (excluding your content and configuration) infringes a valid U.S. patent or copyright, and against claims arising from a data breach caused solely by the Company&apos;s negligence.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Limitation of Liability</h2>
            <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>THE COMPANY&apos;S TOTAL AGGREGATE LIABILITY ARISING FROM OR RELATED TO THESE TERMS SHALL NOT EXCEED THE AMOUNTS PAID BY YOU TO THE COMPANY IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.</li>
              <li>IN NO EVENT SHALL THE COMPANY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, BUSINESS OPPORTUNITIES, OR GOODWILL, REGARDLESS OF THE THEORY OF LIABILITY.</li>
              <li>THE COMPANY IS NOT LIABLE FOR DAMAGES ARISING FROM: (i) AI-GENERATED CONTENT OR ITS ACCURACY; (ii) YOUR TCPA OR RECORDING LAW COMPLIANCE; (iii) ACTIONS OF THIRD-PARTY PROVIDERS; (iv) UNAUTHORIZED ACCESS TO YOUR ACCOUNT CAUSED BY YOUR FAILURE TO SECURE CREDENTIALS.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Disclaimer of Warranties</h2>
            <p>THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. THE COMPANY DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT AI-GENERATED CONTENT WILL BE ACCURATE OR SUITABLE FOR ANY PURPOSE.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">12. Suspension and Termination</h2>
            <p>The Company may suspend or terminate your access immediately if: (a) you violate these Terms or the Acceptable Use Policy; (b) your account is past due for more than 15 days; (c) we receive a valid legal complaint related to your use; (d) continued use would expose the Company to legal liability. We will attempt to notify you before or promptly after suspension, except where prohibited by law.</p>
            <p className="mt-2">You may terminate your account at any time. Upon termination, your access ceases immediately. Remaining deposit balances may be refunded at the Company&apos;s discretion, minus any outstanding charges.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">13. Governing Law and Disputes</h2>
            <p>These Terms are governed by the laws of the State of California, without regard to conflict of law principles. Any dispute arising from these Terms shall be resolved exclusively in the state or federal courts located in Los Angeles County, California. You consent to personal jurisdiction in these courts.</p>
            <p className="mt-2">Before filing any claim, you agree to attempt good-faith resolution by contacting us at legal@caller.com for at least 30 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">14. Changes to Terms</h2>
            <p>We may update these Terms from time to time. We will notify you of material changes by email or by posting a notice on the Service at least 30 days before the changes take effect. Your continued use of the Service after the effective date constitutes acceptance of the updated Terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">15. Contact</h2>
            <p>For questions about these Terms, contact us at:</p>
            <p className="mt-2 text-white">Caller<br />Email: legal@caller.com</p>
          </section>
        </div>
      </main>
    </div>
  );
}
