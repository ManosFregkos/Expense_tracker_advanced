import {
  studyLibrarySchema,
  type StudyLibrary,
  type StudyNote,
  type StudyCard,
  type StudyCourse,
} from '@family-expense-tracker/shared'

export const DAY = 86400000
export function id() {
  return crypto.randomUUID()
}
export function storageKey(uid: string) {
  return `study-studio.v1.${uid}`
}
export function readLibrary(key: string): { library: StudyLibrary; error: string | null } {
  try {
    const raw = localStorage.getItem(key)
    return {
      library: raw ? studyLibrarySchema.parse(JSON.parse(raw)) : starterLibrary(),
      error: null,
    }
  } catch {
    return {
      library: { version: 1, courses: [], notes: [], cards: [] },
      error:
        'Your saved library could not be read. It has not been overwritten. Export the stored data in Library settings before restoring a backup.',
    }
  }
}
export function scheduleCard(
  card: StudyCard,
  rating: 'again' | 'good' | 'easy',
  now = Date.now(),
): StudyCard {
  const interval =
    rating === 'again'
      ? 0
      : rating === 'good'
        ? Math.min(365, Math.max(1, Math.round(card.interval * 2)))
        : Math.min(365, Math.max(4, Math.round(card.interval * 3)))
  return {
    ...card,
    interval,
    dueAt: now + (rating === 'again' ? 600000 : interval * DAY),
    reviews: card.reviews + 1,
  }
}
export function cleanTranscript(text: string) {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/^WEBVTT[^\n]*\n/i, '')
    .replace(/^\s*\d+\s*$/gm, '')
    .replace(/^.*\d{2}:\d{2}[.,]\d{3}\s*-->.*$/gm, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
export function words(body: string) {
  return body.trim().split(/\s+/).filter(Boolean).length
}
export function minutes(body: string) {
  return Math.max(1, Math.ceil(words(body) / 200))
}
export function safeUrl(url: string) {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null
  } catch {
    return null
  }
}
export function exportFile(name: string, content: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function noteMarkdown(note: StudyNote, course?: StudyCourse) {
  return `# ${note.title}\n\n${course ? `Course: ${course.title}\n\n` : ''}${note.source ? `Source: ${note.source}\n\n` : ''}${note.tags.length ? `Tags: ${note.tags.join(', ')}\n\n` : ''}${note.body}\n`
}
const stops = new Set([
  'the',
  'what',
  'how',
  'does',
  'and',
  'for',
  'with',
  'are',
  'can',
  'explain',
  'about',
  'is',
  'to',
  'of',
  'in',
  'my',
  'a',
  'an',
  'me',
])
export function retrieve(notes: StudyNote[], query: string) {
  const terms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])].filter(
    (t) => t.length > 1 && !stops.has(t),
  )
  if (!terms.length) return []
  return notes
    .map((note) => {
      const title = note.title.toLowerCase(),
        body = note.body.toLowerCase(),
        tags = note.tags.join(' ').toLowerCase()
      const hits = terms.filter((t) => title.includes(t) || body.includes(t) || tags.includes(t))
      const score =
        (hits.reduce(
          (sum, t) =>
            sum +
            (title.includes(t) ? 6 : 0) +
            (tags.includes(t) ? 4 : 0) +
            (body.includes(t) ? 1 : 0),
          0,
        ) *
          hits.length) /
        terms.length
      const paragraphs = note.body
        .split(/\n\s*\n/)
        .map((p, index) => ({
          text: p,
          index,
          score: terms.filter((t) => p.toLowerCase().includes(t)).length,
        }))
        .filter((p) => p.text.trim())
      const best = paragraphs
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .sort((a, b) => a.index - b.index)
      return {
        note,
        score,
        excerpt: best
          .map((p) => p.text)
          .join('\n\n')
          .slice(0, 4000),
      }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
}
export function topicGroups(notes: StudyNote[]) {
  const topics = new Map<string, { label: string; notes: StudyNote[] }>()
  notes.forEach((note) =>
    [...new Set(note.tags.map((tag) => tag.toLowerCase().trim()))].forEach((key) => {
      const existing = topics.get(key)
      if (existing) existing.notes.push(note)
      else
        topics.set(key, {
          label: note.tags.find((t) => t.toLowerCase().trim() === key) ?? key,
          notes: [note],
        })
    }),
  )
  return [...topics.values()].sort((a, b) => b.notes.length - a.notes.length)
}
export function newNote(courseId: string): StudyNote {
  const now = Date.now()
  return {
    id: id(),
    courseId,
    title: '',
    body: '',
    transcript: '',
    summary: '',
    tags: [],
    source: '',
    completed: false,
    starred: false,
    createdAt: now,
    updatedAt: now,
  }
}
export function starterLibrary(): StudyLibrary {
  const now = Date.now()
  const note = (
    noteId: string,
    courseId: string,
    title: string,
    tags: string[],
    body: string,
    completed = false,
  ): StudyNote => ({
    ...newNote(courseId),
    id: noteId,
    title,
    tags,
    body,
    completed,
    starred: noteId === 'rag-pipeline',
    summary: body.split('\n\n')[1] ?? '',
    source: 'Starter example — replace with your own course notes',
    createdAt: now - DAY,
    updatedAt: now - DAY,
  })
  return {
    version: 1,
    courses: [
      {
        id: 'ai',
        title: 'AI Engineering Foundations',
        description: 'From language models to useful applications.',
        color: 'violet',
        instructor: 'Starter collection',
        url: '',
        createdAt: now,
      },
      {
        id: 'agents',
        title: 'Building AI Agents',
        description: 'Tools, workflows, memory, and orchestration.',
        color: 'teal',
        instructor: 'Starter collection',
        url: '',
        createdAt: now,
      },
      {
        id: 'rag',
        title: 'RAG from the Ground Up',
        description: 'Give your models the right context.',
        color: 'amber',
        instructor: 'Starter collection',
        url: '',
        createdAt: now,
      },
    ],
    notes: [
      note(
        'rag-pipeline',
        'rag',
        'The anatomy of a RAG pipeline',
        ['RAG', 'retrieval', 'embeddings'],
        `## The big idea

Retrieval-augmented generation supplies relevant source material to a language model before it answers. The goal is to ground the answer in a specific knowledge collection.

## The pipeline, step by step

1. **Ingest** documents and preserve source metadata.
2. **Chunk** documents into useful, self-contained passages.
3. **Embed** each chunk and index its vector.
4. **Retrieve** passages relevant to the question.
5. **Rerank** candidates when more precise context is needed.
6. **Generate** an answer with source references.

> Retrieval quality sets a ceiling on answer quality. If the right context never arrives, even a strong model may struggle.

## A useful starting pattern

\`\`\`python
# Illustrative pseudocode; functions depend on your stack.
query_vector = embed(question)
chunks = index.search(query_vector, top_k=5)
context = format_with_sources(chunks)
answer = generate(question=question, context=context)
\`\`\`

## What to evaluate

- **Retrieval:** Did the relevant passage reach the model?
- **Grounding:** Does the answer stay within the evidence?
- **Usefulness:** Did it answer the actual question?
- **Latency and cost:** Is it practical for the application?

## Suggested practice

Build a tiny retrieval pipeline using three of your own lesson notes. Ask a question whose answer appears in just one note. Inspect the retrieved passages before inspecting the final answer.

## My takeaway

Measure retrieval and generation separately. A polished answer does not prove the retrieval worked.`,
      ),
      note(
        'chunking',
        'rag',
        'Chunking: keeping context intact',
        ['RAG', 'retrieval', 'chunking'],
        `## Why chunking matters

Chunking controls the units of knowledge a retrieval system can find. A passage that is too small can lose context; one that is too large can mix unrelated ideas.

## Three approaches

- **Fixed size:** Split by a token or character budget.
- **Structure aware:** Split at headings, paragraphs, or code blocks.
- **Semantic:** Group content by meaning, with additional computation.

## Overlap is a tradeoff

Overlap can preserve ideas across boundaries, but creates duplicate content and increases index size.

## Suggested practice

Compare two chunk sizes on the same notes and query set. Check whether each result contains enough context to answer.`,
        true,
      ),
      note(
        'embeddings',
        'ai',
        'Embeddings and semantic similarity',
        ['embeddings', 'retrieval'],
        `## A representation of meaning

An embedding is a numerical vector representing an input, such as a passage of text. Vector similarity helps retrieve related passages even when their wording differs.

## Similarity is not truth

A nearby vector indicates relatedness within that representation. It does not establish that a statement is correct, current, or sufficient.

## Practical checklist

- Use compatible embeddings for documents and queries.
- Preserve source metadata alongside every vector.
- Reindex when changing the embedding model.
- Evaluate on realistic questions.`,
        true,
      ),
      note(
        'prompting',
        'ai',
        'Writing prompts you can evaluate',
        ['prompts', 'evaluation'],
        `## Start with a task

State the desired result, provide relevant context, and define a useful output format. A concrete example often communicates expectations better than a long list of adjectives.

## Build an evaluation set

Collect typical inputs, difficult inputs, and cases where the model should ask for more information. Decide what a good result looks like before changing the prompt.

> Change one meaningful thing at a time and compare on the same examples.

## Suggested practice

Write five test questions for your course assistant. Include one whose answer is missing from your notes.`,
      ),
      note(
        'agent-loop',
        'agents',
        'Inside the agent loop',
        ['agents', 'tools', 'evaluation'],
        `## A loop with a stopping condition

An agent uses a model to choose actions, observes the results, and decides what to do next. A useful system has explicit tool boundaries, a step budget, and a clear way to stop.

## The core loop

1. Read the task and context.
2. Decide whether to answer or call a tool.
3. Validate the requested tool arguments.
4. Execute the permitted action.
5. Add the result to the context.
6. Continue until the task is complete or the budget is reached.

## Tools are contracts

Give each tool a narrow purpose, clear inputs, and predictable results.

## Suggested practice

Build a study assistant with two tools: search your notes and open a source. Record tool calls so you can understand the answer.`,
      ),
      note(
        'memory',
        'agents',
        'What should an agent remember?',
        ['agents', 'memory', 'retrieval'],
        `## Three kinds of state

- **Working context:** Information needed for the current task.
- **Session history:** Previous steps in a conversation.
- **Persistent memory:** Selected facts or preferences that outlive a session.

## Retrieval can support memory

Stored memories can be retrieved when relevant. The system still needs rules for what to retain, update, and remove.

## Questions to ask

Does the memory have a source? Can the user inspect and delete it? What happens when it becomes outdated?`,
      ),
    ],
    cards: [
      {
        id: 'card-rag',
        noteId: 'rag-pipeline',
        question: 'What two components should you evaluate separately in RAG?',
        answer:
          'Retrieval (finding relevant evidence) and generation (using that evidence correctly).',
        dueAt: now,
        interval: 0,
        reviews: 0,
      },
      {
        id: 'card-embedding',
        noteId: 'embeddings',
        question: 'Does high embedding similarity prove a passage is correct?',
        answer: 'No. It suggests relatedness, not truth, freshness, or sufficiency.',
        dueAt: now,
        interval: 0,
        reviews: 0,
      },
      {
        id: 'card-agent',
        noteId: 'agent-loop',
        question: 'What keeps an agent loop bounded?',
        answer:
          'Explicit tool permissions, validated inputs, a step or cost budget, and a clear stopping condition.',
        dueAt: now,
        interval: 0,
        reviews: 0,
      },
    ],
  }
}
