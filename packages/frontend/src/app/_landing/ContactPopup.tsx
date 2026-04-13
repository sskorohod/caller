'use client';
import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function newChallenge() {
  return { a: randomInt(2, 9), b: randomInt(2, 9) };
}

export default function ContactPopup() {
  const [open, setOpen] = useState(false);
  const [challenge, setChallenge] = useState({ a: 0, b: 0 });

  // Form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [honeypot, setHoneypot] = useState('');

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setChallenge(newChallenge());
  }, []);

  const handleOpen = useCallback(() => {
    setOpen(true);
    setChallenge(newChallenge());
    setError('');
    setSuccess(false);
    setName('');
    setEmail('');
    setSubject('');
    setMessage('');
    setCaptcha('');
    setHoneypot('');
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (message.trim().length < 10) {
      setError('Message must be at least 10 characters.');
      return;
    }

    const answer = parseInt(captcha, 10);
    if (isNaN(answer)) {
      setError('Please solve the verification question.');
      return;
    }
    if (answer !== challenge.a + challenge.b) {
      setError('Incorrect answer. Please try again.');
      setChallenge(newChallenge());
      setCaptcha('');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
          website: honeypot,
          challenge_answer: answer,
          challenge_expected: challenge.a + challenge.b,
        }),
      });

      if (res.status === 429) {
        setError('Too many messages. Please try again in a minute.');
        return;
      }
      if (res.status === 400) {
        const data = await res.json();
        setError(data.error || 'Invalid input. Please check your details.');
        setChallenge(newChallenge());
        setCaptcha('');
        return;
      }
      if (!res.ok) {
        setError('Something went wrong. Please try again later.');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
      }, 3000);
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(26, 32, 44, 0.6)',
    border: '1px solid rgba(140, 144, 159, 0.15)',
    color: '#dde2f3',
    borderRadius: '12px',
    padding: '10px 14px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    fontFamily: 'inherit',
  };

  return (
    <>
      <style>{`
        .contact-fab {
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 4px 24px rgba(77,142,255,0.3);
        }
        .contact-fab:hover {
          transform: scale(1.08);
          box-shadow: 0 6px 32px rgba(77,142,255,0.5), 0 0 60px rgba(77,142,255,0.15);
        }
        .contact-fab:active { transform: scale(0.95); }
        .contact-popup {
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .contact-popup[data-open="false"] {
          opacity: 0;
          transform: scale(0.92) translateY(8px);
          pointer-events: none;
        }
        .contact-popup[data-open="true"] {
          opacity: 1;
          transform: scale(1) translateY(0);
          pointer-events: auto;
        }
        .contact-input:focus {
          border-color: #818cf8 !important;
        }
      `}</style>

      {/* Floating button */}
      <button
        onClick={open ? handleClose : handleOpen}
        className="contact-fab fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center cursor-pointer"
        style={{
          background: 'linear-gradient(135deg, #818cf8, #4d8eff)',
          border: 'none',
          color: '#fff',
        }}
        aria-label={open ? 'Close contact form' : 'Contact us'}
      >
        <span
          className="material-symbols-outlined text-2xl"
          style={{
            fontVariationSettings: "'FILL' 1",
            transition: 'transform 0.3s ease',
            transform: open ? 'rotate(45deg)' : 'none',
          }}
        >
          {open ? 'close' : 'chat_bubble'}
        </span>
      </button>

      {/* Popup panel */}
      <div
        className="contact-popup fixed z-50"
        data-open={open ? 'true' : 'false'}
        style={{
          bottom: '88px',
          right: '24px',
          width: 'min(380px, calc(100vw - 48px))',
        }}
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(15, 19, 32, 0.97)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(140, 144, 159, 0.15)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 40px rgba(77,142,255,0.08)',
          }}
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold" style={{ color: '#dde2f3' }}>Contact Us</h3>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(194,198,214,0.5)' }}>
                We&apos;ll get back to you shortly
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: 'rgba(140,144,159,0.08)' }}
            >
              <span className="material-symbols-outlined text-lg" style={{ color: 'rgba(194,198,214,0.5)' }}>close</span>
            </button>
          </div>

          <div className="px-5 pb-5">
            {success ? (
              /* Success state */
              <div
                className="flex flex-col items-center justify-center py-8 rounded-xl"
                style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)' }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                  style={{ background: 'rgba(74,222,128,0.15)' }}
                >
                  <span className="material-symbols-outlined text-2xl" style={{ color: '#4ade80', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                </div>
                <p className="text-sm font-semibold" style={{ color: '#4ade80' }}>Message Sent!</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(194,198,214,0.5)' }}>We&apos;ll respond as soon as possible.</p>
              </div>
            ) : (
              /* Form */
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Honeypot — invisible to real users */}
                <div style={{ position: 'absolute', opacity: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }} aria-hidden="true">
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={e => setHoneypot(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(194,198,214,0.6)' }}>Name</label>
                  <input
                    type="text"
                    className="contact-input"
                    style={inputStyle}
                    placeholder="Your name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(194,198,214,0.6)' }}>Email</label>
                  <input
                    type="email"
                    className="contact-input"
                    style={inputStyle}
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    maxLength={200}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(194,198,214,0.6)' }}>Subject</label>
                  <input
                    type="text"
                    className="contact-input"
                    style={inputStyle}
                    placeholder="What's this about?"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    required
                    maxLength={200}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(194,198,214,0.6)' }}>Message</label>
                  <textarea
                    className="contact-input"
                    style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                    placeholder="Your message (at least 10 characters)"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    required
                    maxLength={5000}
                  />
                </div>

                {/* Math captcha */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(194,198,214,0.6)' }}>
                    Verification: What is {challenge.a} + {challenge.b}?
                  </label>
                  <input
                    type="number"
                    className="contact-input"
                    style={{ ...inputStyle, width: '120px' }}
                    placeholder="?"
                    value={captcha}
                    onChange={e => setCaptcha(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <p className="text-xs py-2 px-3 rounded-lg" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={{
                    background: loading ? 'rgba(129,140,248,0.3)' : 'linear-gradient(135deg, #818cf8, #4d8eff)',
                    color: '#fff',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                      Sending...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-base">send</span>
                      Send Message
                    </span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
