import { z } from 'zod'

export const studyCourseSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(180),
  description: z.string().max(2000),
  instructor: z.string().max(180),
  url: z.string().max(2000),
  color: z.enum(['violet', 'teal', 'amber', 'blue']),
  createdAt: z.number().finite(),
})
export const studyNoteSchema = z.object({
  id: z.string().min(1).max(100),
  courseId: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(240),
  body: z.string().max(150000),
  transcript: z.string().max(60000),
  summary: z.string().max(4000),
  tags: z.array(z.string().trim().min(1).max(80)).max(20),
  source: z.string().max(2000),
  completed: z.boolean(),
  starred: z.boolean(),
  createdAt: z.number().finite(),
  updatedAt: z.number().finite(),
})
export const studyCardSchema = z.object({
  id: z.string().min(1).max(100),
  noteId: z.string().min(1).max(100),
  question: z.string().trim().min(1).max(1000),
  answer: z.string().trim().min(1).max(4000),
  dueAt: z.number().finite(),
  interval: z.number().min(0).max(365),
  reviews: z.number().int().nonnegative(),
})
export const studyLibrarySchema = z
  .object({
    version: z.literal(1),
    courses: z.array(studyCourseSchema).max(200),
    notes: z.array(studyNoteSchema).max(2000),
    cards: z.array(studyCardSchema).max(10000),
  })
  .superRefine((library, ctx) => {
    const courses = new Set(library.courses.map((c) => c.id))
    const notes = new Set(library.notes.map((n) => n.id))
    const cards = new Set(library.cards.map((c) => c.id))
    if (
      courses.size !== library.courses.length ||
      notes.size !== library.notes.length ||
      cards.size !== library.cards.length
    )
      ctx.addIssue({ code: 'custom', message: 'Backup contains duplicate identifiers.' })
    if (
      library.notes.some((n) => !courses.has(n.courseId)) ||
      library.cards.some((c) => !notes.has(c.noteId))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Backup contains missing course or note references.',
      })
  })
export const processStudyTranscriptSchema = z.object({
  transcript: z.string().trim().min(100).max(60000),
  courseTitle: z.string().trim().min(1).max(180),
  lessonTitle: z.string().max(240),
  style: z.enum(['detailed', 'concise']),
})
export const generatedStudyNotesSchema = z.object({
  title: z.string().trim().min(1).max(240),
  summary: z.string().min(1).max(4000),
  markdown: z.string().min(1).max(40000),
  tags: z.array(z.string().min(1).max(80)).max(12),
  flashcards: z
    .array(z.object({ question: z.string().min(1).max(1000), answer: z.string().min(1).max(4000) }))
    .max(12),
})
export const askStudyNotesSchema = z.object({
  question: z.string().trim().min(3).max(1000),
  passages: z
    .array(
      z.object({
        id: z.string().max(100),
        title: z.string().max(240),
        text: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(8),
})
export const studyAnswerSchema = z.object({
  answer: z.string().min(1).max(12000),
  sourceIds: z.array(z.string().max(100)).max(8),
})
export type StudyCourse = z.infer<typeof studyCourseSchema>
export type StudyNote = z.infer<typeof studyNoteSchema>
export type StudyCard = z.infer<typeof studyCardSchema>
export type StudyLibrary = z.infer<typeof studyLibrarySchema>
export type ProcessStudyTranscriptInput = z.infer<typeof processStudyTranscriptSchema>
export type GeneratedStudyNotes = z.infer<typeof generatedStudyNotesSchema>
export type AskStudyNotesInput = z.infer<typeof askStudyNotesSchema>
export type StudyAnswer = z.infer<typeof studyAnswerSchema>
