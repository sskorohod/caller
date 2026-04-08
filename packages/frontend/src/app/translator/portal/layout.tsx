export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: '#0e131f' }}>
      {/* Logo */}
      <div className="pt-8 pb-4 text-center">
        <div className="inline-flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #adc6ff, #4d8eff)' }}>
            <svg className="w-4 h-4 text-[#0e131f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
            </svg>
          </div>
          <span className="text-lg font-bold" style={{ color: '#dde2f3' }}>Caller Translator</span>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 pb-12">
        {children}
      </div>
    </div>
  );
}
