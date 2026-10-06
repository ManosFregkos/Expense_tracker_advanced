import { describe, expect, it } from 'vitest'
import {
  createNote,
  initialLibrary,
  librarySchema,
  mergeLibrary,
  noteTasks,
  safeUrl,
  scheduleCard,
  toggleTask,
  filterNotes,
} from './notes-lib'

describe('notes library integrity', () => {
  it('rejects corrupt backups, duplicates, missing notebooks and orphan review cards', () => {
    const library = initialLibrary()
    const note = createNote('personal')
    expect(librarySchema.safeParse({ ...library, notebooks: [] }).success).toBe(false)
    expect(librarySchema.safeParse({ ...library, notes: [note, note] }).success).toBe(false)
    expect(
      librarySchema.safeParse({ ...library, notes: [{ ...note, notebookId: 'missing' }] }).success,
    ).toBe(false)
    expect(
      librarySchema.safeParse({
        ...library,
        cards: [
          {
            id: 'c',
            noteId: 'missing',
            question: 'Q',
            answer: 'A',
            interval: 0,
            reviews: 0,
            dueAt: 0,
          },
        ],
      }).success,
    ).toBe(false)
  })
  it('merges backups without replacing existing notes and remaps all references', () => {
    const library = initialLibrary()
    const note = createNote('personal')
    const source = {
      ...library,
      notes: [note],
      cards: [
        {
          id: 'card',
          noteId: note.id,
          question: 'Q',
          answer: 'A',
          interval: 0,
          reviews: 0,
          dueAt: 0,
        },
      ],
    }
    const result = mergeLibrary(source, source)
    expect(result.notes).toHaveLength(2)
    expect(result.notes[0]).toEqual(note)
    expect(result.notes[1]!.notebookId).toBe(result.notebooks[1]!.id)
    expect(result.cards[1]!.noteId).toBe(result.notes[1]!.id)
    expect(librarySchema.safeParse(result).success).toBe(true)
  })
  it('tracks actionable checkboxes but ignores code examples and changes only the selected line', () => {
    const body = '- [ ] Buy milk\n```md\n- [ ] Example\n```\n- [X] Learn'
    expect(noteTasks(body)).toEqual([
      { line: 0, done: false, text: 'Buy milk' },
      { line: 4, done: true, text: 'Learn' },
    ])
    expect(toggleTask(body, 0)).toBe(body.replace('- [ ] Buy', '- [x] Buy'))
  })
  it('searches all terms, filters tags, and keeps pinned notes first', () => {
    const a = {
      ...createNote('personal'),
      title: 'React hooks',
      tags: ['course'],
      body: 'State and effects',
    }
    const b = { ...createNote('personal'), title: 'React patterns', pinned: true }
    expect(filterNotes([a, b], 'react effects', 'course', 'recent')).toEqual([a])
    expect(filterNotes([a, b], 'react', '', 'title')[0]).toEqual(b)
  })
  it('schedules failed recall in ten minutes and increases successful review intervals', () => {
    const card = {
      id: 'c',
      noteId: 'n',
      question: 'Q',
      answer: 'A',
      interval: 0,
      reviews: 0,
      dueAt: 0,
    }
    expect(scheduleCard(card, 'again', 1000).dueAt).toBe(601000)
    const good = scheduleCard(card, 'good', 1000)
    expect(good.interval).toBe(1)
    expect(scheduleCard(good, 'good', 1000).interval).toBe(2)
    expect(scheduleCard(card, 'easy', 1000).interval).toBe(3)
    expect(scheduleCard({ ...card, interval: 300 }, 'easy', 1000).interval).toBe(365)
  })
  it('rejects executable and local resource links', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('data:text/html,test')).toBeNull()
    expect(safeUrl('file:///etc/passwd')).toBeNull()
    expect(safeUrl('https://www.udemy.com/course/test')).toContain('udemy.com')
  })
})
