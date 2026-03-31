export default function CallsPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calls</h1>
        <div className="flex gap-2">
          <select className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
            <option value="">All directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
          <select className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
            <option value="">All statuses</option>
            <option value="completed">Completed</option>
            <option value="in_progress">In Progress</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Direction</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Owner</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Duration</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                No calls yet. Start by creating an agent and making your first call.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
