import { z } from 'zod'

const id = z.string().min(1).max(100)
const timestamp = z.number().finite().nonnegative()
const revisionSchema = z.object({
  body: z.string().max(200000),
  title: z.string().max(200),
  at: timestamp,
})
export const noteSchema = z.object({
  id,
  notebookId: id,
  title: z.string().max(200),
  body: z.string().max(200000),
  tags: z.array(z.string().max(40)).max(20),
  pinned: z.boolean(),
  status: z.enum(['active', 'archived', 'trash']),
  completed: z.boolean(),
  source: z.string().max(2000),
  lesson: z.string().max(100),
  reviewDate: z.string().refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v)),
  createdAt: timestamp,
  updatedAt: timestamp,
  revisions: z.array(revisionSchema).max(12),
})
export const notebookSchema = z.object({
  id,
  title: z.string().trim().min(1).max(100),
  kind: z.enum(['personal', 'course']),
  color: z.enum(['teal', 'violet', 'orange', 'blue', 'pink']),
  source: z.string().max(2000),
  instructor: z.string().max(200),
  lessons: z.number().int().min(0).max(10000),
  createdAt: timestamp,
})
const cardSchema = z.object({
  id,
  noteId: id,
  question: z.string().trim().min(1).max(2000),
  answer: z.string().trim().min(1).max(10000),
  dueAt: timestamp,
  interval: z.number().int().min(0).max(365),
  reviews: z.number().int().nonnegative(),
})
export const librarySchema = z
  .object({
    version: z.literal(1),
    notebooks: z.array(notebookSchema).min(1).max(500),
    notes: z.array(noteSchema).max(10000),
    cards: z.array(cardSchema).max(50000),
  })
  .superRefine((library, ctx) => {
    for (const items of [library.notebooks, library.notes, library.cards]) {
      if (new Set(items.map((item) => item.id)).size !== items.length)
        ctx.addIssue({ code: 'custom', message: 'Duplicate identifiers' })
    }
    const notebooks = new Set(library.notebooks.map((n) => n.id))
    const notes = new Set(library.notes.map((n) => n.id))
    if (
      library.notes.some((n) => !notebooks.has(n.notebookId)) ||
      library.cards.some((c) => !notes.has(c.noteId))
    )
      ctx.addIssue({ code: 'custom', message: 'Missing notebook or note references' })
  })
export type Note = z.infer<typeof noteSchema>
export type Notebook = z.infer<typeof notebookSchema>
export type ReviewCard = z.infer<typeof cardSchema>
export type NotesLibrary = z.infer<typeof librarySchema>
export type Template = 'blank' | 'daily' | 'lesson' | 'meeting' | 'reading'
export const templates: { value: Template; title: string; description: string; body: string }[] = [
  { value: 'blank', title: 'Blank note', description: 'Make room for a new idea.', body: '' },
  {
    value: 'daily',
    title: 'Daily journal',
    description: 'A little clarity for your day.',
    body: '## Today’s focus\n\nWhat matters most today?\n\n## To do\n\n- [ ] My first priority\n- [ ] Make time to learn\n\n## Things to remember\n\n\n## Reflection\n\nWhat went well? What could be better?',
  },
  {
    value: 'lesson',
    title: 'Course lesson',
    description: 'Capture, practise, and remember.',
    body: '## Key idea\n\nExplain the concept in your own words.\n\n## Lesson notes\n\n\n## Example\n\n```\nAdd a worked example here\n```\n\n## Put it into practice\n\n- [ ] Try the example myself\n- [ ] Explain it without looking\n\n## Questions to revisit\n\n\n## My takeaway\n\n',
  },
  {
    value: 'meeting',
    title: 'Meeting notes',
    description: 'Decisions with clear next steps.',
    body: '## Context\n\nDate, attendees, and purpose.\n\n## Discussion\n\n\n## Decisions\n\n\n## Next steps\n\n- [ ] Action · owner · deadline',
  },
  {
    value: 'reading',
    title: 'Reading notes',
    description: 'Keep the ideas that stay with you.',
    body: '## What I’m reading\n\nBook, article, or chapter.\n\n## Ideas worth keeping\n\n\n## A passage to remember\n\n> Add a quote and its page or source.\n\n## My thoughts\n\n\n## Apply this\n\n- [ ] Turn one idea into action',
  },
]
export function localDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
export function createNote(notebookId: string, template: Template = 'blank'): Note {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    notebookId,
    title:
      template === 'blank'
        ? 'Untitled note'
        : template === 'daily'
          ? `Daily · ${localDate()}`
          : templates.find((t) => t.value === template)!.title,
    body: templates.find((t) => t.value === template)!.body,
    tags: template === 'daily' ? ['daily'] : [],
    pinned: false,
    status: 'active',
    completed: false,
    source: '',
    lesson: '',
    reviewDate: '',
    createdAt: now,
    updatedAt: now,
    revisions: [],
  }
}
export function initialLibrary(): NotesLibrary {
  return {
    version: 1,
    notebooks: [
      {
        id: 'personal',
        title: 'Personal',
        kind: 'personal',
        color: 'teal',
        source: '',
        instructor: '',
        lessons: 0,
        createdAt: Date.now(),
      },
    ],
    notes: [],
    cards: [],
  }
}
export function safeUrl(value: string) {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}
export function noteTasks(body: string) {
  let code = false
  return body.split('\n').flatMap((line, index) => {
    if (line.startsWith('```')) {
      code = !code
      return []
    }
    if (code) return []
    const match = line.match(/^\s*[-*] \[([ xX])\] (.+)$/)
    return match ? [{ line: index, done: match[1]!.toLowerCase() === 'x', text: match[2]! }] : []
  })
}
export function toggleTask(body: string, index: number) {
  return body
    .split('\n')
    .map((line, i) =>
      i === index
        ? line.replace(/\[([ xX])\]/, (_, mark: string) => (mark === ' ' ? '[x]' : '[ ]'))
        : line,
    )
    .join('\n')
}
export function linkedTitles(body: string) {
  return [...body.matchAll(/\[\[([^\]\n]+)\]\]/g)].map((match) => match[1]!.trim().toLowerCase())
}
export function plainText(body: string) {
  return body
    .replace(/```[\s\S]*?```/g, ' [code] ')
    .replace(/[#*`>[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
export function normalizeTags(tags: string[]) {
  return [
    ...new Set(
      tags
        .flatMap((tag) => tag.split(','))
        .map((tag) => tag.trim().replace(/^#+/, '').trim().slice(0, 40))
        .filter(Boolean),
    ),
  ].slice(0, 20)
}
export function filterNotes(notes: Note[], query: string, tag: string, sort: string) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  return notes
    .filter(
      (note) =>
        (!tag || note.tags.includes(tag)) &&
        terms.every((term) =>
          `${note.title} ${note.body} ${note.tags.join(' ')} ${note.lesson} ${note.source}`
            .toLowerCase()
            .includes(term),
        ),
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        (sort === 'title'
          ? a.title.localeCompare(b.title)
          : sort === 'oldest'
            ? a.createdAt - b.createdAt
            : b.updatedAt - a.updatedAt),
    )
}
export function scheduleCard(
  card: ReviewCard,
  rating: 'again' | 'good' | 'easy',
  now = Date.now(),
): ReviewCard {
  const interval =
    rating === 'again'
      ? 0
      : Math.min(
          365,
          Math.max(rating === 'easy' ? 3 : 1, card.interval * (rating === 'easy' ? 3 : 2)),
        )
  return {
    ...card,
    interval,
    reviews: card.reviews + 1,
    dueAt: now + (rating === 'again' ? 10 * 60000 : interval * 86400000),
  }
}
export function mergeLibrary(current: NotesLibrary, imported: NotesLibrary): NotesLibrary {
  const remap = new Map<string, string>()
  const notebooks = imported.notebooks.map((n) => {
    const newId = crypto.randomUUID()
    remap.set(n.id, newId)
    return { ...n, id: newId }
  })
  const noteIds = new Map<string, string>()
  const notes = imported.notes.map((n) => {
    const newId = crypto.randomUUID()
    noteIds.set(n.id, newId)
    return { ...n, id: newId, notebookId: remap.get(n.notebookId)! }
  })
  return librarySchema.parse({
    version: 1,
    notebooks: [...current.notebooks, ...notebooks],
    notes: [...current.notes, ...notes],
    cards: [
      ...current.cards,
      ...imported.cards.map((c) => ({
        ...c,
        id: crypto.randomUUID(),
        noteId: noteIds.get(c.noteId)!,
      })),
    ],
  })
}
export function downloadFile(name: string, contents: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
