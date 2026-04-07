import pino from 'pino';

const log = pino({ name: 'email' });

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const FROM_EMAIL = process.env.EMAIL_FROM ?? 'Caller <onboarding@resend.dev>';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  if (!RESEND_API_KEY) {
    log.warn('RESEND_API_KEY not configured, skipping email send');
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      log.error({ status: res.status, err, to: params.to }, 'Failed to send email');
      return false;
    }

    log.info({ to: params.to, subject: params.subject }, 'Email sent');
    return true;
  } catch (err) {
    log.error({ err, to: params.to }, 'Email send error');
    return false;
  }
}

export function buildMagicLinkEmail(magicLink: string): { subject: string; html: string } {
  return {
    subject: 'Sign in to Caller',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0e131f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e131f;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#1a202c;border-radius:16px;border:1px solid rgba(140,144,159,0.15);overflow:hidden;">
        <!-- Header -->
        <tr><td style="padding:32px 32px 0;">
          <div style="font-size:20px;font-weight:800;color:#dde2f3;letter-spacing:-0.5px;">
            <span style="color:#adc6ff;">&#9679;</span> Caller
          </div>
        </td></tr>
        <!-- Content -->
        <tr><td style="padding:24px 32px;">
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#dde2f3;">Sign in to Caller</h1>
          <p style="margin:0 0 24px;font-size:14px;color:#c2c6d6;line-height:1.6;">
            Click the button below to sign in. This link expires in 15 minutes.
          </p>
          <a href="${magicLink}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#adc6ff,#4d8eff);color:#0e131f;font-size:14px;font-weight:700;text-decoration:none;border-radius:12px;">
            Sign In
          </a>
          <p style="margin:24px 0 0;font-size:12px;color:rgba(194,198,214,0.5);line-height:1.5;">
            If you didn't request this, you can safely ignore this email.<br>
            Link: <a href="${magicLink}" style="color:#adc6ff;word-break:break-all;">${magicLink}</a>
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px 24px;border-top:1px solid rgba(140,144,159,0.1);">
          <p style="margin:0;font-size:11px;color:rgba(194,198,214,0.3);">
            Caller &mdash; AI Phone Agents & Live Translator
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

export function isEmailConfigured(): boolean {
  return !!RESEND_API_KEY;
}
