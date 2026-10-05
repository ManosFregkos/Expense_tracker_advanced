import { describe, expect, it } from 'vitest'
import { studyLibrarySchema, processStudyTranscriptSchema } from '@family-expense-tracker/shared'
import {
  cleanTranscript,
  DAY,
  retrieve,
  scheduleCard,
  starterLibrary,
  storageKey,
  topicGroups,
  safeUrl,
  readLibrary,
} from './study-lib'

describe('study library', () => {
  it('validates backups and rejects dangling references and duplicate IDs', () => {
    const library = starterLibrary()
    expect(studyLibrarySchema.safeParse(library).success).toBe(true)
    expect(
      studyLibrarySchema.safeParse({ ...library, notes: [...library.notes, library.notes[0]] })
        .success,
    ).toBe(false)
    expect(studyLibrarySchema.safeParse({ ...library, courses: [] }).success).toBe(false)
    expect(studyLibrarySchema.safeParse({ ...library, notes: [] }).success).toBe(false)
  })
  it('does not overwrite corrupt data on load', () => {
    const key = storageKey('alice')
    localStorage.setItem(key, '{broken')
    expect(readLibrary(key).error).toContain('not been overwritten')
    expect(localStorage.getItem(key)).toBe('{broken')
    localStorage.removeItem(key)
    expect(storageKey('alice')).not.toBe(storageKey('bob'))
  })
  it('retrieves relevant actual passages and does not fabricate empty results', () => {
    const notes = starterLibrary().notes
    const results = retrieve(notes, 'What is a RAG pipeline?')
    expect(results[0]?.note.id).toBe('rag-pipeline')
    expect(results[0]?.excerpt).toContain('Retrieval-augmented generation')
    expect(retrieve(notes, 'unicorn-steganography')).toEqual([])
    expect(retrieve(notes, 'the and of')).toEqual([])
  })
  it('cleans subtitle timestamps without deleting meaningful numbered lists in Markdown', () => {
    const subtitle =
      'WEBVTT\n\n1\n00:00:00.000 --> 00:00:03.000\n<v speaker>Hello there.</v>\n\n2\n00:00:03.000 --> 00:00:05.000\nRAG finds context.'
    expect(cleanTranscript(subtitle)).toBe('Hello there.\n\nRAG finds context.')
    expect(cleanTranscript('1. Ingest\n2. Retrieve')).toBe('1. Ingest\n2. Retrieve')
  })
  it('schedules recall without immediately repeating a failed card', () => {
    const card = starterLibrary().cards[0]!
    const now = 1000000
    expect(scheduleCard(card, 'again', now).dueAt).toBe(now + 600000)
    expect(scheduleCard(card, 'good', now).dueAt).toBe(now + DAY)
    expect(scheduleCard(card, 'easy', now).interval).toBe(4)
    expect(scheduleCard({ ...card, interval: 200 }, 'easy', now).interval).toBe(365)
    expect(scheduleCard(card, 'good', now).reviews).toBe(1)
  })
  it('deduplicates topic names by case and links across courses', () => {
    const notes = starterLibrary().notes
    const groups = topicGroups(notes)
    const retrieval = groups.find((g) => g.label === 'retrieval')!
    expect(new Set(retrieval.notes.map((n) => n.courseId)).size).toBeGreaterThan(1)
    expect(topicGroups([{ ...notes[0]!, tags: ['RAG', 'rag'] }])[0]?.notes).toHaveLength(1)
  })
  it('rejects unsafe links and oversized transcripts', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('data:text/html,hello')).toBeNull()
    expect(safeUrl('https://www.udemy.com/course/example')).toContain('udemy.com')
    expect(
      processStudyTranscriptSchema.safeParse({
        transcript: 'x'.repeat(60001),
        courseTitle: 'RAG',
        lessonTitle: '',
        style: 'detailed',
      }).success,
    ).toBe(false)
  })
})
