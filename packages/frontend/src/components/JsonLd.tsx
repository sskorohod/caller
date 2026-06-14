/**
 * Server component that emits a JSON-LD <script> for structured data / GEO.
 *
 * Render it inside any server component (layout or a page server-wrapper).
 * Payloads must be plain product FACTS only — no imperative text, no
 * "instructions"-style strings, no URLs in unexpected fields — so the markup
 * cannot be abused as an indirect-prompt-injection vector when an LLM ingests it.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
