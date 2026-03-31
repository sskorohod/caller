export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-gray-500">Overview of your AI phone system</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Calls" value="—" />
        <StatCard label="Active Agents" value="—" />
        <StatCard label="Minutes Used" value="—" />
        <StatCard label="Avg. Quality" value="—" />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">Recent Calls</h2>
        <p className="mt-2 text-sm text-gray-400">
          Connect your Twilio account and create an agent to start making calls.
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
