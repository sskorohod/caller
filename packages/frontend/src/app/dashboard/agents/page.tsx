export default function AgentsPage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Agent Profiles</h1>
        <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
          Create Agent
        </button>
      </div>

      <p className="mt-2 text-sm text-gray-500">
        Configure AI phone agents for different business tasks.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="text-4xl">+</p>
          <p className="mt-2 text-sm text-gray-500">Create your first agent</p>
          <p className="mt-1 text-xs text-gray-400">
            Set up identity, voice, prompts, skills, and knowledge
          </p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">Prompt Packs</h2>
        <p className="mt-1 text-sm text-gray-400">Define how your agents speak and behave.</p>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold">Skill Packs</h2>
        <p className="mt-1 text-sm text-gray-400">Define task-specific behavior for business processes.</p>
      </div>
    </div>
  );
}
