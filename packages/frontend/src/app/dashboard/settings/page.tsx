export default function SettingsPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Workspace */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Workspace</h2>
        <div className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-white p-6">
          <Field label="Workspace Name" placeholder="My Company" />
          <Field label="Industry" placeholder="appliance_repair" />
          <Field label="Timezone" placeholder="America/New_York" />
        </div>
      </section>

      {/* Telephony */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Telephony (Twilio)</h2>
        <div className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-white p-6">
          <Field label="Account SID" placeholder="AC..." type="password" />
          <Field label="Auth Token" placeholder="..." type="password" />
          <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
            Verify Connection
          </button>
        </div>
      </section>

      {/* AI Providers */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">AI Providers</h2>
        <div className="mt-4 space-y-6">
          <ProviderCard name="Anthropic (Claude)" field="API Key" />
          <ProviderCard name="OpenAI" field="API Key" />
          <ProviderCard name="Deepgram" field="API Key" />
          <ProviderCard name="ElevenLabs" field="API Key" />
        </div>
      </section>

      {/* Conversation Ownership */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Conversation Ownership</h2>
        <div className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-white p-6">
          <div>
            <label className="text-sm font-medium text-gray-700">Default Conversation Owner</label>
            <select className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="internal">Internal Platform Agent</option>
              <option value="external">External Calling Agent</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="ext-handoff" className="h-4 w-4 rounded border-gray-300" />
            <label htmlFor="ext-handoff" className="text-sm text-gray-700">
              Allow Inbound Calls To External Agent
            </label>
          </div>
        </div>
      </section>

      {/* API Keys */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">API Keys</h2>
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-500">
            MCP API keys allow external agents (Claude, ChatGPT) to use your phone system.
          </p>
          <button className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
            Create API Key
          </button>
        </div>
      </section>

      {/* Compliance */}
      <section className="mt-8 mb-12">
        <h2 className="text-lg font-semibold">Compliance</h2>
        <div className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-3">
            <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-gray-300" />
            <label className="text-sm text-gray-700">Call recording disclosure (announce recording at call start)</label>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-gray-300" />
            <label className="text-sm text-gray-700">AI disclosure (identify as AI assistant)</label>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, placeholder, type = 'text' }: { label: string; placeholder: string; type?: string }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
      />
    </div>
  );
}

function ProviderCard({ name, field }: { name: string; field: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="font-medium">{name}</h3>
      <div className="mt-3">
        <Field label={field} placeholder="sk-..." type="password" />
      </div>
      <button className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
        Save & Verify
      </button>
    </div>
  );
}
