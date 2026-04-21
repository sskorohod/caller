# Wiki Schema

This file defines the structure, conventions, and workflows for the LLM-maintained wiki.
The LLM (Claude) owns this layer — it creates pages, updates them when new sources arrive,
maintains cross-references, and keeps everything consistent. The human reads it; the LLM writes it.

---

## Directory Structure

```
wiki/
  WIKI.md           # This file — schema and conventions
  index.md          # Content catalog: every page listed with summary
  log.md            # Chronological record of operations
  raw/              # Raw source documents (IMMUTABLE — never modify)
    assets/         # Images, PDFs, attachments
  pages/            # LLM-generated wiki pages
    overview.md     # High-level overview of the knowledge base
    entities/       # Entity pages (people, companies, products, projects)
    concepts/       # Concept pages (ideas, patterns, technologies)
    sources/        # Source summaries (one per ingested source)
    analyses/       # Filed queries, comparisons, research
```

## Page Format

Every wiki page uses this structure:

```markdown
---
title: Page Title
type: entity | concept | source | analysis | overview
created: YYYY-MM-DD
updated: YYYY-MM-DD
tags: [tag1, tag2]
sources: [source-file-1.md, source-file-2.md]
---

# Page Title

Brief description (1-2 sentences).

## Content

Main content organized with headers.

## Cross-References

- [[Related Page 1]] — how it relates
- [[Related Page 2]] — how it relates

## Sources

- `raw/source-file.md` — what was extracted from it
```

### Conventions

- Use `[[wikilinks]]` for internal cross-references (Obsidian-compatible)
- File names: kebab-case, descriptive (`llm-wiki-pattern.md`, not `page1.md`)
- Tags in frontmatter: lowercase, hyphenated (`machine-learning`, not `ML`)
- Dates: ISO 8601 (`2026-04-16`)
- All pages in `pages/` subdirectories — never at wiki root
- Source summaries go in `pages/sources/`, named after the source

## Operations

### 1. Ingest

When the human adds a new source to `raw/`:

1. **Read** the source completely
2. **Discuss** key takeaways with the human
3. **Create** a source summary page in `pages/sources/`
4. **Update** relevant entity and concept pages across the wiki
   - Create new entity/concept pages if they don't exist
   - Update existing pages with new information
   - Note contradictions explicitly: `> **Contradiction:** Source X says A, but Source Y says B.`
5. **Update** `index.md` — add new pages, update summaries of modified pages
6. **Append** to `log.md` — record what was ingested and what pages were touched
7. **Update** `pages/overview.md` if the new source materially changes the big picture

### 2. Query

When the human asks a question:

1. **Read** `index.md` to find relevant pages
2. **Read** the relevant pages
3. **Synthesize** an answer with `[[wikilinks]]` citations
4. **Offer to file** the answer as a new analysis page if it contains novel synthesis
5. If filed, **update** `index.md` and **append** to `log.md`

### 3. Lint

Periodic health check (do when asked, or suggest after ~10 ingests):

1. **Contradictions** — pages that disagree with each other
2. **Stale claims** — superseded by newer sources
3. **Orphan pages** — no inbound links from other pages
4. **Missing pages** — concepts mentioned in `[[wikilinks]]` but no page exists
5. **Missing cross-references** — pages that should link to each other but don't
6. **Data gaps** — important questions the wiki can't answer yet
7. Report findings and fix what can be fixed automatically

## Index Format (`index.md`)

```markdown
## Entities
| Page | Summary | Sources | Updated |
|------|---------|---------|---------|
| [[entity-name]] | One-line description | 3 | 2026-04-16 |

## Concepts
(same table format)

## Sources
(same table format)

## Analyses
(same table format)
```

## Log Format (`log.md`)

Each entry starts with a parseable header:

```markdown
## [2026-04-16] ingest | Source Title
- Created: `pages/sources/source-title.md`
- Updated: `pages/entities/entity-a.md`, `pages/concepts/concept-b.md`
- New pages: `pages/entities/entity-c.md`
- Notes: Key insight about X contradicts previous understanding

## [2026-04-16] query | "What is the relationship between X and Y?"
- Filed as: `pages/analyses/x-and-y-relationship.md`
- Referenced: 5 pages

## [2026-04-16] lint
- Fixed: 3 missing cross-references
- Flagged: 1 contradiction between page A and page B
- Suggested: 2 new sources to investigate
```

## Principles

1. **Sources are immutable.** Never modify files in `raw/`. The wiki interprets them.
2. **The wiki is the LLM's artifact.** The human reads and guides; the LLM writes and maintains.
3. **Contradictions are features.** Don't hide them — flag them explicitly with blockquotes.
4. **Cross-references compound.** Every page should link to related pages. The graph is the value.
5. **File valuable queries.** Good analysis shouldn't disappear into chat history.
6. **Incremental updates.** When a new source arrives, update existing pages — don't create duplicates.
7. **The human curates sources and asks questions.** The LLM does everything else.
