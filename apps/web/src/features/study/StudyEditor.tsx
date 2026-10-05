import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Modal, Select, TextInput, Textarea } from '@mantine/core'
import { IconSparkles, IconUpload, IconBook2, IconCheck, IconFileText } from '@tabler/icons-react'
import {
  studyNoteSchema,
  type StudyNote,
  type StudyCourse,
  type GeneratedStudyNotes,
} from '@family-expense-tracker/shared'
import { cleanTranscript, id } from './study-lib'
import { processTranscript, aiError } from './study-api'
import { Markdown } from './Markdown'

export function StudyEditor({
  initial,
  courses,
  transcriptMode,
  onSave,
  onClose,
}: {
  initial: StudyNote
  courses: StudyCourse[]
  transcriptMode: boolean
  onSave: (note: StudyNote, cards: GeneratedStudyNotes['flashcards']) => boolean
  onClose: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const [tab, setTab] = useState<'write' | 'transcript' | 'preview'>(
    transcriptMode ? 'transcript' : 'write',
  )
  const [style, setStyle] = useState('detailed')
  const [tags, setTags] = useState(initial.tags.join(', '))
  const [cards, setCards] = useState<GeneratedStudyNotes['flashcards']>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const upload = useRef<HTMLInputElement>(null)
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(initial) ||
    tags !== initial.tags.join(', ') ||
    cards.length > 0
  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
  function close() {
    if (!busy && (!dirty || window.confirm('Discard this unsaved draft?'))) onClose()
  }
  async function importText(file: File | undefined) {
    if (!file) return
    try {
      if (!/\.(txt|md|srt|vtt)$/i.test(file.name))
        throw new Error('Choose a .txt, .md, .srt, or .vtt file.')
      if (file.size > 500000)
        throw new Error('This file is too large. Import one lesson at a time (up to 500 KB).')
      const text = await file.text()
      const content = /\.(srt|vtt)$/i.test(file.name) ? cleanTranscript(text) : text.trim()
      if (content.length > (tab === 'transcript' ? 60000 : 150000))
        throw new Error('This lesson is too long. Split it into smaller lessons before importing.')
      setDraft((d) => ({
        ...d,
        title: d.title || file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
        ...(tab === 'transcript' ? { transcript: content } : { body: content }),
        source: d.source || file.name,
      }))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The file could not be read.')
    }
    if (upload.current) upload.current.value = ''
  }
  async function generate() {
    const course = courses.find((c) => c.id === draft.courseId)
    const transcript = cleanTranscript(draft.transcript)
    if (!course || transcript.length < 100) {
      setError('Select a course and add at least 100 characters of transcript.')
      return
    }
    if (
      draft.body &&
      !window.confirm(
        'Replace the notes in this draft with AI-generated notes? Your saved note will stay intact until you save.',
      )
    )
      return
    setBusy(true)
    setError('')
    try {
      const result = await processTranscript({
        transcript,
        courseTitle: course.title,
        lessonTitle: draft.title,
        style: style === 'concise' ? 'concise' : 'detailed',
      })
      setDraft((d) => ({
        ...d,
        title: d.title || result.title,
        summary: result.summary,
        body: result.markdown,
        transcript,
      }))
      setTags(result.tags.join(', '))
      setCards(result.flashcards)
      setTab('preview')
    } catch (err) {
      setError(aiError(err))
    } finally {
      setBusy(false)
    }
  }
  function save() {
    const parsed = studyNoteSchema.safeParse({
      ...draft,
      tags: [
        ...new Set(
          tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        ),
      ],
      updatedAt: Date.now(),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the note fields.')
      return
    }
    if (!draft.body.trim()) {
      setError(
        'Add some notes before saving. You can also copy your transcript into the notes editor.',
      )
      return
    }
    if (
      onSave(
        parsed.data,
        cards.filter((c) => c.question.trim() && c.answer.trim()),
      )
    )
      onClose()
    else
      setError(
        'The draft could not be saved. Your changes are still here. Check the library error message and copy the draft before closing.',
      )
  }
  return (
    <Modal
      opened
      onClose={close}
      size="1000px"
      title={
        <span className="st-modal-title">
          <IconBook2 size={21} />
          {initial.title ? 'Edit lesson notes' : 'Capture a lesson'}
        </span>
      }
      closeOnClickOutside={!busy}
      closeOnEscape={!busy}
      withCloseButton={!busy}
      className="st-modal"
    >
      <div className="st-editor-fields">
        <TextInput
          label="Lesson title"
          placeholder="e.g. Understanding vector embeddings"
          value={draft.title}
          maxLength={240}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          disabled={busy}
        />
        <Select
          label="Course"
          data={courses.map((c) => ({ value: c.id, label: c.title }))}
          value={draft.courseId}
          onChange={(value) => value && setDraft({ ...draft, courseId: value })}
          disabled={busy}
          allowDeselect={false}
        />
      </div>
      <div className="st-editor-tabs" role="tablist" aria-label="Note editor">
        {(['write', 'transcript', 'preview'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? 'active' : ''}
            onClick={() => setTab(t)}
            disabled={busy}
          >
            {t === 'write'
              ? 'Write notes'
              : t === 'transcript'
                ? 'Transcript → notes'
                : 'Reading preview'}
          </button>
        ))}
        <Button
          variant="subtle"
          size="xs"
          leftSection={<IconUpload size={15} />}
          onClick={() => upload.current?.click()}
          disabled={busy || tab === 'preview'}
        >
          Import text
        </Button>
        <input
          hidden
          type="file"
          ref={upload}
          accept=".txt,.md,.srt,.vtt"
          onChange={(e) => void importText(e.target.files?.[0])}
        />
      </div>
      {error && (
        <Alert color="red" my="sm" role="alert">
          {error}
        </Alert>
      )}
      {tab === 'transcript' ? (
        <>
          <div className="st-ai-intro">
            <span className="st-icon violet">
              <IconSparkles size={23} />
            </span>
            <div>
              <strong>Turn a lesson into something worth keeping.</strong>
              <p>
                Paste your lesson transcript. AI will organize the concepts, keep useful examples,
                and create review cards.
              </p>
            </div>
          </div>
          <Textarea
            label="Lesson transcript"
            placeholder="Paste a transcript here, or import a .txt, .srt, or .vtt file…"
            value={draft.transcript}
            onChange={(e) => setDraft({ ...draft, transcript: e.target.value })}
            minRows={12}
            maxLength={60000}
            disabled={busy}
          />
          <div className="st-generate-row">
            <span>
              {draft.transcript.length.toLocaleString()} / 60,000 characters · one lesson at a time
            </span>
            <Select
              aria-label="Note detail"
              data={[
                { value: 'detailed', label: 'Detailed notes' },
                { value: 'concise', label: 'Concise notes' },
              ]}
              value={style}
              onChange={(v) => setStyle(v ?? 'detailed')}
              disabled={busy}
              w={160}
            />
            <Button
              color="violet"
              leftSection={<IconSparkles size={17} />}
              loading={busy}
              onClick={() => void generate()}
            >
              Generate study notes
            </Button>
          </div>
          <p className="st-fine">
            When you generate, this transcript is sent to the configured OpenAI service. Review the
            draft before saving. AI setup instructions are in Library settings.
          </p>
          <Button
            variant="subtle"
            leftSection={<IconFileText size={16} />}
            disabled={busy || !draft.transcript.trim()}
            onClick={() => {
              setDraft((d) => ({ ...d, body: d.transcript }))
              setTab('write')
            }}
          >
            Use transcript as notes
          </Button>
        </>
      ) : tab === 'write' ? (
        <Textarea
          label="Notes (Markdown)"
          placeholder={'## The big idea\n\nWhat did you learn?\n\n## Examples\n\n## My takeaway'}
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          minRows={16}
          maxLength={150000}
          className="st-markdown-input"
        />
      ) : (
        <div className="st-preview">
          {draft.body ? (
            <Markdown text={draft.body} />
          ) : (
            <p>Write notes or generate a draft to see your reading preview.</p>
          )}
        </div>
      )}
      {cards.length > 0 && (
        <details className="st-generated-cards">
          <summary>
            <IconCheck size={17} />
            {cards.length} review cards generated · click to edit
          </summary>
          {cards.map((card, index) => (
            <div key={index}>
              <TextInput
                label={`Question ${index + 1}`}
                value={card.question}
                maxLength={1000}
                onChange={(e) =>
                  setCards(
                    cards.map((c, i) => (i === index ? { ...c, question: e.target.value } : c)),
                  )
                }
              />
              <Textarea
                label="Answer"
                value={card.answer}
                maxLength={4000}
                onChange={(e) =>
                  setCards(
                    cards.map((c, i) => (i === index ? { ...c, answer: e.target.value } : c)),
                  )
                }
              />
              <button
                className="st-text-button"
                type="button"
                onClick={() => setCards(cards.filter((_, i) => i !== index))}
              >
                Remove card
              </button>
            </div>
          ))}
        </details>
      )}
      <div className="st-editor-fields st-editor-meta">
        <TextInput
          label="Topics"
          description="Separate topics with commas (up to 20)."
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="RAG, retrieval, embeddings"
          disabled={busy}
        />
        <TextInput
          label="Source / lesson link"
          value={draft.source}
          maxLength={2000}
          onChange={(e) => setDraft({ ...draft, source: e.target.value })}
          placeholder="Udemy lesson URL or source name"
          disabled={busy}
        />
      </div>
      <div className="st-modal-footer">
        <span>Drafts become part of your library when you save.</span>
        <Button variant="default" onClick={close} disabled={busy}>
          Cancel
        </Button>
        <Button color="violet" onClick={save} disabled={busy}>
          Save lesson{cards.length ? ` + ${cards.length} cards` : ''}
        </Button>
      </div>
    </Modal>
  )
}

export function CourseEditor({
  initial,
  onSave,
  onClose,
}: {
  initial?: StudyCourse
  onSave: (course: StudyCourse) => boolean
  onClose: () => void
}) {
  const [draft, setDraft] = useState<StudyCourse>(
    initial ?? {
      id: id(),
      title: '',
      description: '',
      instructor: '',
      url: '',
      color: 'violet',
      createdAt: Date.now(),
    },
  )
  const [error, setError] = useState('')
  return (
    <Modal
      opened
      onClose={onClose}
      title={initial ? 'Edit course' : 'Add a course'}
      size="md"
      className="st-modal"
    >
      <div className="st-form-stack">
        <TextInput
          label="Course title"
          autoFocus
          placeholder="Your Udemy course title"
          value={draft.title}
          maxLength={180}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          required
        />
        <TextInput
          label="Instructor"
          value={draft.instructor}
          maxLength={180}
          onChange={(e) => setDraft({ ...draft, instructor: e.target.value })}
        />
        <Textarea
          label="What do you want to learn?"
          value={draft.description}
          maxLength={2000}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
        <TextInput
          label="Course URL"
          value={draft.url}
          maxLength={2000}
          onChange={(e) => setDraft({ ...draft, url: e.target.value })}
          placeholder="https://www.udemy.com/course/…"
        />
        <Select
          label="Course color"
          value={draft.color}
          data={['violet', 'teal', 'amber', 'blue']}
          onChange={(value) => setDraft({ ...draft, color: value as StudyCourse['color'] })}
          allowDeselect={false}
        />
        {error && <Alert color="red">{error}</Alert>}
        <Button
          color="violet"
          onClick={() => {
            if (!draft.title.trim()) {
              setError('Give your course a title.')
              return
            }
            if (onSave({ ...draft, title: draft.title.trim() })) onClose()
          }}
        >
          Save course
        </Button>
      </div>
    </Modal>
  )
}
