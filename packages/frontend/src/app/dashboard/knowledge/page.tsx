export default function KnowledgePage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Knowledge Base</h1>
        <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
          Create Knowledge Base
        </button>
      </div>

      <p className="mt-2 text-sm text-gray-500">
        Upload documents, FAQs, policies, and pricing info that your AI agents can reference during calls.
      </p>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-400">
          No knowledge bases yet. Create one and upload documents to give your agents business knowledge.
        </p>
      </div>
    </div>
  );
}
