import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Modal, Select, TextInput, Textarea, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useSearchParams } from 'react-router-dom'
import {
  IconBook2,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconArrowRight,
  IconArrowUpRight,
  IconNotes,
  IconCards,
  IconTopologyStar3,
  IconLayoutDashboard,
  IconSettings,
  IconCheck,
  IconClock,
  IconStar,
  IconDownload,
  IconUpload,
  IconExternalLink,
  IconBrain,
  IconCode,
  IconRobot,
  IconEdit,
  IconTrash,
  IconBulb,
  IconArrowLeft,
} from '@tabler/icons-react'
import {
  studyLibrarySchema,
  studyCardSchema,
  type StudyCourse,
  type StudyNote,
  type StudyCard,
  type StudyAnswer,
  type GeneratedStudyNotes,
} from '@family-expense-tracker/shared'
import { useAuth } from '../auth/AuthProvider'
import { useStudyLibrary } from './useStudyLibrary'
import {
  id,
  newNote,
  minutes,
  retrieve,
  topicGroups,
  safeUrl,
  exportFile,
  scheduleCard,
  starterLibrary,
} from './study-lib'
import { CourseEditor, StudyEditor } from './StudyEditor'
import { StudyReader } from './StudyReader'
import { Markdown } from './Markdown'
import { askNotes, aiError } from './study-api'
import './study.css'

type Tab = 'overview' | 'courses' | 'notes' | 'review' | 'map' | 'settings'
const tabs = [
  { key: 'overview', label: 'Overview', icon: IconLayoutDashboard },
  { key: 'courses', label: 'My courses', icon: IconBook2 },
  { key: 'notes', label: 'Notebook', icon: IconNotes },
  { key: 'review', label: 'Review cards', icon: IconCards },
  { key: 'map', label: 'Knowledge map', icon: IconTopologyStar3 },
] as const

export function StudyPage() {
  const { user } = useAuth()
  return user ? (
    <StudyWorkspace
      key={user.uid}
      uid={user.uid}
      name={user.displayName?.split(' ')[0] ?? 'there'}
    />
  ) : null
}
function StudyWorkspace({ uid, name }: { uid: string; name: string }) {
  const { library, error, commit, key } = useStudyLibrary(uid)
  const [params, setParams] = useSearchParams()
  const activeTab = params.get('tab') ?? 'overview'
  const tab: Tab = ['overview', 'courses', 'notes', 'review', 'map', 'settings'].includes(activeTab)
    ? (activeTab as Tab)
    : 'overview'
  const courseId = params.get('course') ?? ''
  const noteId = params.get('note') ?? ''
  const selected = library.notes.find((n) => n.id === noteId)
  const selectedCourse = library.courses.find((c) => c.id === courseId)
  const [query, setQuery] = useState('')
  const [topic, setTopic] = useState('')
  const [onlyStarred, setOnlyStarred] = useState(false)
  const [sort, setSort] = useState('recent')
  const [editor, setEditor] = useState<{
    note: StudyNote
    transcript: boolean
    existing?: boolean
  } | null>(null)
  const [courseEditor, setCourseEditor] = useState<{ initial?: StudyCourse } | null>(null)
  const [cardNote, setCardNote] = useState<string | null>(null)
  const [askOpen, setAskOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const backupRef = useRef<HTMLInputElement>(null)
  const [backupError, setBackupError] = useState('')
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
  function navigate(next: Tab, course = '', note = '') {
    const value: Record<string, string> = { tab: next }
    if (course) value.course = course
    if (note) value.note = note
    setParams(value)
    setTopic('')
  }
  function openNote(value: string) {
    navigate('notes', '', value)
  }
  function createNote(transcript = false) {
    const course = selectedCourse ?? library.courses[0]
    if (!course) {
      setCourseEditor({})
      return
    }
    setEditor({ note: newNote(course.id), transcript })
  }
  function notify(message: string) {
    notifications.show({ title: 'Study Studio', message, color: 'violet' })
  }
  function saveNote(note: StudyNote, generated: GeneratedStudyNotes['flashcards']) {
    const success = commit((current) => {
      const existing = current.notes.find((n) => n.id === note.id)
      if (existing && editor && existing.updatedAt !== editor.note.updatedAt)
        throw new Error(
          'This note changed in another tab. Copy your draft, close this editor, and reopen the latest note before saving.',
        )
      if (editor?.existing && !existing)
        throw new Error('This note was removed in another tab. Copy your draft into a new lesson.')
      const questions = new Set(
        current.cards
          .filter((c) => c.noteId === note.id)
          .map((c) => c.question.trim().toLowerCase()),
      )
      const cards: StudyCard[] = generated
        .filter((c) => {
          const question = c.question.trim().toLowerCase()
          if (questions.has(question)) return false
          questions.add(question)
          return true
        })
        .map((c) => ({
          ...c,
          id: id(),
          noteId: note.id,
          dueAt: Date.now(),
          interval: 0,
          reviews: 0,
        }))
      return {
        ...current,
        notes: [...current.notes.filter((n) => n.id !== note.id), note],
        cards: [...current.cards, ...cards],
      }
    })
    if (success) {
      openNote(note.id)
      notify('Lesson saved on this device.')
    }
    return success
  }
  function updateNote(note: StudyNote, patch: Partial<StudyNote>) {
    commit((current) => ({
      ...current,
      notes: current.notes.map((n) =>
        n.id === note.id ? { ...n, ...patch, updatedAt: Date.now() } : n,
      ),
    }))
  }
  function deleteNote(note: StudyNote) {
    if (!window.confirm(`Delete “${note.title}” and its review cards?`)) return
    const savedCards = library.cards.filter((c) => c.noteId === note.id)
    if (
      commit((current) => ({
        ...current,
        notes: current.notes.filter((n) => n.id !== note.id),
        cards: current.cards.filter((c) => c.noteId !== note.id),
      }))
    ) {
      notifications.show({
        title: 'Lesson removed',
        message: (
          <Button
            variant="subtle"
            color="violet"
            size="xs"
            onClick={() =>
              commit((current) => ({
                ...current,
                notes: [...current.notes.filter((n) => n.id !== note.id), note],
                cards: [...current.cards.filter((c) => c.noteId !== note.id), ...savedCards],
              }))
            }
          >
            Undo deletion
          </Button>
        ),
        autoClose: 10000,
      })
    }
  }
  async function restore(file: File | undefined) {
    if (!file) return
    try {
      if (file.size > 20000000) throw new Error('This backup is too large (maximum 20 MB).')
      const parsed = studyLibrarySchema.safeParse(JSON.parse(await file.text()))
      if (!parsed.success)
        throw new Error(
          'This is not a valid Study Studio backup. Your current library has not changed.',
        )
      if (
        !window.confirm(
          `Replace this device’s library with ${parsed.data.courses.length} courses, ${parsed.data.notes.length} notes, and ${parsed.data.cards.length} cards? Export your current library first if you want to keep it.`,
        )
      )
        return
      if (commit(() => parsed.data, true)) {
        notify('Library restored.')
        setBackupError('')
        navigate('overview')
      }
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'This backup could not be read.')
    }
    if (backupRef.current) backupRef.current.value = ''
  }
  const due = library.cards.filter(
    (c) =>
      c.dueAt <= now &&
      (!courseId || library.notes.some((n) => n.id === c.noteId && n.courseId === courseId)),
  )
  const completed = library.notes.filter((n) => n.completed).length
  const recent = [...library.notes].sort((a, b) => b.updatedAt - a.updatedAt)
  const next = recent.find((n) => !n.completed) ?? recent[0]
  const filtered = (
    query.trim() ? retrieve(library.notes, query).map((r) => r.note) : [...library.notes]
  )
    .filter(
      (n) =>
        (!courseId || n.courseId === courseId) &&
        (!onlyStarred || n.starred) &&
        (!topic || n.tags.some((t) => t.toLowerCase() === topic.toLowerCase())),
    )
    .sort((a, b) =>
      query.trim()
        ? 0
        : sort === 'title'
          ? a.title.localeCompare(b.title)
          : sort === 'oldest'
            ? a.createdAt - b.createdAt
            : b.updatedAt - a.updatedAt,
    )
  return (
    <div className="st-workspace">
      <header className="st-header">
        <div>
          <span className="st-eyebrow">YOUR PERSONAL LEARNING SPACE</span>
          <h1>
            <span className="st-brand-icon">
              <IconBook2 size={25} />
            </span>
            Study Studio<span className="st-beta">LEARN BY DOING</span>
          </h1>
        </div>
        <div className="st-header-right">
          <div className="st-search">
            <IconSearch size={17} />
            <input
              ref={searchRef}
              aria-label="Search study notes"
              placeholder="Search your knowledge…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                if (tab !== 'notes' || noteId) navigate('notes')
              }}
            />
            <kbd>⌘ K</kbd>
          </div>
          <Tooltip label="Library settings">
            <button
              className="st-icon-button"
              aria-label="Library settings"
              onClick={() => navigate('settings')}
            >
              <IconSettings size={20} />
            </button>
          </Tooltip>
        </div>
      </header>
      <nav className="st-nav" aria-label="Study Studio">
        <div>
          {tabs.map((item) => (
            <button
              key={item.key}
              className={tab === item.key ? 'active' : ''}
              onClick={() => {
                navigate(item.key)
                setQuery('')
              }}
              aria-current={tab === item.key ? 'page' : undefined}
            >
              <item.icon size={18} />
              {item.label}
              {item.key === 'review' && due.length > 0 && <span>{due.length}</span>}
            </button>
          ))}
        </div>
        <button className="st-ask-button" onClick={() => setAskOpen(true)}>
          <IconSparkles size={17} /> Ask my notes
        </button>
      </nav>
      {error && (
        <Alert color="red" role="alert" mb="md">
          {error}
          <Button variant="subtle" size="xs" onClick={() => navigate('settings')}>
            Open Library settings
          </Button>
        </Alert>
      )}
      {selected ? (
        <StudyReader
          key={selected.id}
          note={selected}
          course={library.courses.find((c) => c.id === selected.courseId)}
          related={library.notes.filter(
            (n) =>
              n.id !== selected.id &&
              n.tags.some((tag) =>
                selected.tags.some((t) => t.toLowerCase() === tag.toLowerCase()),
              ),
          )}
          onBack={() => navigate('notes')}
          onEdit={() => setEditor({ note: selected, transcript: false, existing: true })}
          onUpdate={(patch) => updateNote(selected, patch)}
          onOpen={openNote}
          onCard={() => setCardNote(selected.id)}
        />
      ) : noteId ? (
        <Empty
          icon={<IconNotes />}
          title="This note is not in your library"
          text="This link may refer to another device’s library, or the note may have been removed."
          action={<Button onClick={() => navigate('notes')}>Open notebook</Button>}
        />
      ) : (
        <>
          {tab === 'overview' && (
            <>
              <section className="st-hero">
                <div>
                  <span className="st-hero-eyebrow">
                    <span />A LITTLE LEARNING, EVERY DAY
                  </span>
                  <h2>
                    Less watching.
                    <br />
                    More understanding.
                  </h2>
                  <p>
                    Hey {name}, turn your courses into knowledge that stays.
                    <br className="st-desktop" /> Capture the ideas. Connect the dots. Build
                    something.
                  </p>
                  <div className="st-hero-actions">
                    <Button
                      color="violet"
                      size="md"
                      leftSection={<IconSparkles size={18} />}
                      onClick={() => createNote(true)}
                    >
                      Capture a lesson
                    </Button>
                    <button onClick={() => navigate('notes')}>
                      Explore your notebook <IconArrowRight size={17} />
                    </button>
                  </div>
                </div>
                <div className="st-hero-art" aria-hidden="true">
                  <div className="st-orbit st-orbit-one" />
                  <div className="st-orbit st-orbit-two" />
                  <div className="st-art-center">
                    <IconBrain size={52} stroke={1.3} />
                  </div>
                  <div className="st-art-node st-art-code">
                    <IconCode size={26} />
                    <span>Understand</span>
                  </div>
                  <div className="st-art-node st-art-notes">
                    <IconNotes size={25} />
                    <span>Connect</span>
                  </div>
                  <div className="st-art-node st-art-bulb">
                    <IconBulb size={26} />
                    <span>Remember</span>
                  </div>
                  <span className="st-art-dot dot-one" />
                  <span className="st-art-dot dot-two" />
                </div>
              </section>
              <div className="st-stats">
                <Stat
                  icon={<IconBook2 size={21} />}
                  color="violet"
                  value={library.courses.length}
                  label="Courses in your library"
                />
                <Stat
                  icon={<IconNotes size={21} />}
                  color="teal"
                  value={library.notes.length}
                  label="Lessons captured"
                />
                <Stat
                  icon={<IconCheck size={21} />}
                  color="blue"
                  value={`${completed}/${library.notes.length}`}
                  label="Lessons read"
                />
                <Stat
                  icon={<IconCards size={21} />}
                  color="amber"
                  value={due.length}
                  label="Cards ready to review"
                  onClick={() => navigate('review')}
                />
              </div>
              <div className="st-section-title">
                <div>
                  <h2>
                    Your learning paths <span>{library.courses.length}</span>
                  </h2>
                  <p>One place for every course, one idea at a time.</p>
                </div>
                <button className="st-text-button" onClick={() => setCourseEditor({})}>
                  <IconPlus size={16} />
                  Add course
                </button>
              </div>
              <div className="st-course-grid">
                {library.courses.slice(0, 4).map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    notes={library.notes.filter((n) => n.courseId === course.id)}
                    onOpen={() => {
                      navigate('notes', course.id)
                      setQuery('')
                    }}
                    onEdit={() => setCourseEditor({ initial: course })}
                  />
                ))}
                {!library.courses.length && (
                  <Empty
                    icon={<IconBook2 />}
                    title="Your next chapter starts here"
                    text="Add one of your Udemy courses, then capture your first lesson."
                    action={
                      <Button color="violet" onClick={() => setCourseEditor({})}>
                        Add a course
                      </Button>
                    }
                  />
                )}
              </div>
              <div className="st-overview-bottom">
                <section className="st-panel">
                  <div className="st-section-title">
                    <h2>Pick up where you left off</h2>
                    <IconClock size={19} />
                  </div>
                  {next ? (
                    <button className="st-continue" onClick={() => openNote(next.id)}>
                      <span
                        className={`st-icon ${library.courses.find((c) => c.id === next.courseId)?.color ?? 'violet'}`}
                      >
                        <IconNotes size={23} />
                      </span>
                      <div>
                        <span>{library.courses.find((c) => c.id === next.courseId)?.title}</span>
                        <h3>{next.title}</h3>
                        <p>
                          {minutes(next.body)} min read ·{' '}
                          {next.completed ? 'Read it again' : 'Ready for reading'}
                        </p>
                      </div>
                      <IconArrowRight size={22} />
                    </button>
                  ) : (
                    <p>Capture your first lesson to start reading.</p>
                  )}
                  <div className="st-small-note">
                    <IconBulb size={17} />
                    After reading, try explaining one idea without looking.
                  </div>
                </section>
                <section className="st-review-callout">
                  <span className="st-icon amber">
                    <IconCards size={24} />
                  </span>
                  <h3>A few minutes. A stronger memory.</h3>
                  <p>
                    {due.length
                      ? `${due.length} cards are ready. A quick review helps these ideas stay with you.`
                      : 'You’re caught up. Create cards from your lessons for your next review.'}
                  </p>
                  <button onClick={() => navigate('review')}>
                    {due.length ? 'Start a quick review' : 'Open review cards'}
                    <IconArrowRight size={17} />
                  </button>
                </section>
              </div>
              <div className="st-section-title">
                <div>
                  <h2>Put your knowledge to work</h2>
                  <p>Small projects that connect your courses.</p>
                </div>
                <span className="st-pill">PROJECT IDEAS</span>
              </div>
              <div className="st-project-grid">
                {[
                  {
                    title: 'Build a tiny RAG assistant',
                    text: 'Retrieve evidence from three notes and answer with sources.',
                    icon: IconSearch,
                    topic: 'RAG',
                    course: 'rag',
                  },
                  {
                    title: 'Give an agent two tools',
                    text: 'Let it search a notebook and open the right source.',
                    icon: IconRobot,
                    topic: 'agents',
                    course: 'agents',
                  },
                  {
                    title: 'Create an evaluation lab',
                    text: 'Test prompts on questions with known answers and missing evidence.',
                    icon: IconCode,
                    topic: 'evaluation',
                    course: 'ai',
                  },
                ].map((project) => (
                  <button
                    className="st-project"
                    key={project.title}
                    onClick={() => {
                      const course =
                        library.courses.find((c) => c.id === project.course) ?? library.courses[0]
                      if (!course) {
                        setCourseEditor({})
                        return
                      }
                      setEditor({
                        transcript: false,
                        note: {
                          ...newNote(course.id),
                          title: project.title,
                          tags: [project.topic, 'project'],
                          body: `## Goal\n\n${project.text}\n\n## Plan\n\n1. Pick a small set of your lesson notes.\n2. Define a concrete input and expected result.\n3. Build the smallest version that works.\n4. Inspect its failures and improve one thing.\n\n## My implementation\n\nDescribe your approach and add code here.\n\n## Evaluation\n\nWhat worked? What failed? What evidence supports your conclusions?\n\n## Next experiment\n\nWhat will you try next?`,
                        },
                      })
                    }}
                  >
                    <project.icon size={24} />
                    <h3>{project.title}</h3>
                    <p>{project.text}</p>
                    <span>
                      Create project notebook <IconArrowUpRight size={16} />
                    </span>
                  </button>
                ))}
              </div>
              <p className="st-starter-label">
                The initial AI, agents, and RAG collections are editable starter examples—not
                content from your purchased courses.
              </p>
            </>
          )}
          {tab === 'courses' && (
            <>
              <div className="st-section-title">
                <div>
                  <h2>My courses</h2>
                  <p>Your courses, organized around what you’re learning.</p>
                </div>
                <Button
                  color="violet"
                  leftSection={<IconPlus size={17} />}
                  onClick={() => setCourseEditor({})}
                >
                  Add course
                </Button>
              </div>
              <div className="st-course-grid">
                {library.courses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    notes={library.notes.filter((n) => n.courseId === course.id)}
                    onOpen={() => navigate('notes', course.id)}
                    onEdit={() => setCourseEditor({ initial: course })}
                  />
                ))}
              </div>
              {!library.courses.length && (
                <Empty
                  icon={<IconBook2 />}
                  title="Add your first course"
                  text="Give it a title, link it to Udemy, and start capturing lessons."
                />
              )}
            </>
          )}
          {tab === 'notes' && (
            <>
              <div className="st-section-title">
                <div>
                  {selectedCourse && (
                    <button className="st-text-button" onClick={() => navigate('notes')}>
                      <IconArrowLeft size={15} />
                      All courses
                    </button>
                  )}
                  <h2>{selectedCourse?.title ?? 'Your notebook'}</h2>
                  <p>
                    {selectedCourse?.description ??
                      'Ideas, explanations, and code—all ready for reading.'}
                  </p>
                </div>
                <div className="st-button-group">
                  <Button
                    variant="default"
                    leftSection={<IconPlus size={16} />}
                    onClick={() => createNote()}
                  >
                    Write a note
                  </Button>
                  <Button
                    color="violet"
                    leftSection={<IconSparkles size={17} />}
                    onClick={() => createNote(true)}
                  >
                    Import lesson
                  </Button>
                </div>
              </div>
              <div className="st-note-filters">
                <Select
                  aria-label="Filter by course"
                  placeholder="All courses"
                  value={courseId || null}
                  data={library.courses.map((c) => ({ value: c.id, label: c.title }))}
                  onChange={(v) => navigate('notes', v ?? '')}
                  clearable
                />
                <Select
                  aria-label="Sort notes"
                  data={[
                    { value: 'recent', label: 'Recently updated' },
                    { value: 'oldest', label: 'Oldest first' },
                    { value: 'title', label: 'Title A–Z' },
                  ]}
                  value={sort}
                  onChange={(v) => setSort(v ?? 'recent')}
                />
                <button
                  className={`st-filter-button ${onlyStarred ? 'active' : ''}`}
                  onClick={() => setOnlyStarred(!onlyStarred)}
                  aria-pressed={onlyStarred}
                >
                  <IconStar size={16} />
                  Bookmarked
                </button>
                {topic && (
                  <button className="st-filter-button active" onClick={() => setTopic('')}>
                    {topic} ×
                  </button>
                )}
                <span>
                  {filtered.length} {filtered.length === 1 ? 'lesson' : 'lessons'}
                </span>
              </div>
              <div className="st-note-grid">
                {filtered.map((note) => (
                  <div className="st-note-card" key={note.id}>
                    <button className="st-note-card-main" onClick={() => openNote(note.id)}>
                      <span
                        className={`st-course-label ${library.courses.find((c) => c.id === note.courseId)?.color ?? 'violet'}`}
                      >
                        {library.courses.find((c) => c.id === note.courseId)?.title}
                      </span>
                      <h3>{note.title}</h3>
                      <p>{note.summary || note.body.replace(/[#*`>]/g, '').slice(0, 155)}</p>
                      <div className="st-tags">
                        {note.tags.slice(0, 3).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    </button>
                    <div className="st-note-card-footer">
                      <span>
                        {note.completed ? <IconCheck size={15} /> : <IconClock size={15} />}
                        {note.completed ? 'Read' : `${minutes(note.body)} min read`}
                      </span>
                      <div>
                        <button
                          aria-label={`Bookmark ${note.title}`}
                          className={note.starred ? 'is-starred' : ''}
                          onClick={() => updateNote(note, { starred: !note.starred })}
                        >
                          <IconStar size={17} fill={note.starred ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          aria-label={`Edit ${note.title}`}
                          onClick={() => setEditor({ note, transcript: false, existing: true })}
                        >
                          <IconEdit size={17} />
                        </button>
                        <button
                          aria-label={`Delete ${note.title}`}
                          onClick={() => deleteNote(note)}
                        >
                          <IconTrash size={17} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {!filtered.length && (
                <Empty
                  icon={<IconSearch />}
                  title={query ? 'No matching notes yet' : 'A clean page, a new idea'}
                  text={
                    query
                      ? 'Try a different keyword or course filter.'
                      : 'Capture a lesson or write your first note for this course.'
                  }
                  action={
                    <Button color="violet" onClick={() => createNote()}>
                      Write a note
                    </Button>
                  }
                />
              )}
            </>
          )}
          {tab === 'review' && (
            <>
              <div className="st-section-title">
                <div>
                  <h2>Make the ideas stick</h2>
                  <p>Recall first. Reveal second. Review at the right time.</p>
                </div>
                <Button
                  variant="default"
                  leftSection={<IconPlus size={16} />}
                  disabled={!library.notes.length}
                  onClick={() => setCardNote(library.notes[0]?.id ?? null)}
                >
                  Create a card
                </Button>
              </div>
              <div className="st-review-top">
                <Select
                  aria-label="Review course"
                  placeholder="All courses"
                  data={library.courses.map((c) => ({ value: c.id, label: c.title }))}
                  value={courseId || null}
                  onChange={(v) => navigate('review', v ?? '')}
                  clearable
                />
                <span>
                  {due.length} due · {library.cards.length} total ·{' '}
                  {library.cards.reduce((sum, c) => sum + c.reviews, 0)} reviews completed
                </span>
              </div>
              {due[0] ? (
                <ReviewCard
                  key={due[0].id}
                  card={due[0]}
                  note={library.notes.find((n) => n.id === due[0]?.noteId)}
                  onOpen={openNote}
                  onRate={(rating) => {
                    const card = due[0]
                    if (card)
                      commit((current) => ({
                        ...current,
                        cards: current.cards.map((c) =>
                          c.id === card.id ? scheduleCard(c, rating) : c,
                        ),
                      }))
                    setNow(Date.now())
                  }}
                />
              ) : (
                <Empty
                  icon={<IconCheck size={36} />}
                  title="You’re all caught up"
                  text={
                    library.cards.length
                      ? 'Your next review will appear when a card is due. Keep learning or create a new card.'
                      : 'Generate cards from a transcript, or create your own question and answer.'
                  }
                  action={
                    <Button color="violet" onClick={() => navigate('notes')}>
                      Read a lesson
                    </Button>
                  }
                />
              )}
              <p className="st-review-explainer">
                Again: 10 minutes · Got it: 1 day at first, then doubles · Easy: 4 days at first,
                then triples. Intervals are capped at one year.
              </p>
              <details className="st-all-cards">
                <summary>Manage all cards ({library.cards.length})</summary>
                {library.cards
                  .filter(
                    (c) =>
                      !courseId ||
                      library.notes.some((n) => n.id === c.noteId && n.courseId === courseId),
                  )
                  .map((card) => (
                    <div key={card.id}>
                      <div>
                        <strong>{card.question}</strong>
                        <p>{card.answer}</p>
                        <span>Next review: {new Date(card.dueAt).toLocaleString()}</span>
                      </div>
                      <button
                        className="st-icon-button"
                        aria-label={`Delete card ${card.question}`}
                        onClick={() => {
                          if (window.confirm('Delete this review card?'))
                            commit((current) => ({
                              ...current,
                              cards: current.cards.filter((c) => c.id !== card.id),
                            }))
                        }}
                      >
                        <IconTrash size={17} />
                      </button>
                    </div>
                  ))}
              </details>
            </>
          )}
          {tab === 'map' && (
            <KnowledgeMap notes={library.notes} courses={library.courses} onOpen={openNote} />
          )}
          {tab === 'settings' && (
            <>
              <div className="st-section-title">
                <div>
                  <h2>Library settings</h2>
                  <p>Keep your knowledge portable and your AI connection ready.</p>
                </div>
              </div>
              <div className="st-settings-grid">
                <section className="st-panel">
                  <span className="st-icon violet">
                    <IconDownload size={25} />
                  </span>
                  <h3>Your library, on this device</h3>
                  <p>
                    Notes, original transcripts, and cards are saved in this browser for your
                    signed-in account. They are not synced between devices. Export a backup before
                    clearing browser data.
                  </p>
                  <p>
                    {library.courses.length} courses · {library.notes.length} lessons ·{' '}
                    {library.cards.length} cards
                  </p>
                  <div className="st-button-group">
                    <Button
                      color="violet"
                      leftSection={<IconDownload size={16} />}
                      onClick={() =>
                        exportFile(
                          `study-studio-${new Date().toISOString().slice(0, 10)}.json`,
                          JSON.stringify(library, null, 2),
                          'application/json',
                        )
                      }
                    >
                      Export backup
                    </Button>
                    <Button
                      variant="default"
                      leftSection={<IconUpload size={16} />}
                      onClick={() => backupRef.current?.click()}
                    >
                      Restore backup
                    </Button>
                  </div>
                  {error && (
                    <Button
                      mt="sm"
                      variant="light"
                      color="red"
                      onClick={() => {
                        try {
                          exportFile('study-studio-recovery.txt', localStorage.getItem(key) ?? '')
                        } catch {
                          setBackupError('Stored data could not be accessed.')
                        }
                      }}
                    >
                      Export stored data for recovery
                    </Button>
                  )}
                  <input
                    hidden
                    ref={backupRef}
                    type="file"
                    accept=".json"
                    onChange={(e) => void restore(e.target.files?.[0])}
                  />
                  {backupError && (
                    <Alert color="red" role="alert" mt="sm">
                      {backupError}
                    </Alert>
                  )}
                  <Button
                    mt="lg"
                    variant="subtle"
                    color="gray"
                    onClick={() => {
                      if (
                        window.confirm(
                          'Replace this device’s library with the starter examples? Export your current library first to keep it.',
                        )
                      )
                        commit(() => starterLibrary(), true)
                    }}
                  >
                    Restore starter examples
                  </Button>
                </section>
                <section className="st-panel">
                  <span className="st-icon teal">
                    <IconSparkles size={25} />
                  </span>
                  <h3>Connect your AI service</h3>
                  <p>
                    Transcript processing and “Ask my notes” use OpenAI through authenticated
                    Firebase Functions. API keys stay on the server.
                  </p>
                  <ol>
                    <li>
                      Set the Firebase secret <code>STUDY_OPENAI_API_KEY</code>.
                    </li>
                    <li>
                      Optionally configure <code>STUDY_AI_MODEL</code> (default: gpt-4.1-mini).
                    </li>
                    <li>
                      Deploy <code>processStudyTranscript</code> and <code>askStudyNotes</code>.
                    </li>
                  </ol>
                  <p>
                    Complete setup and emulator instructions: <code>docs/STUDY_STUDIO.md</code>.
                  </p>
                  <p className="st-fine">
                    AI requests send the transcript or retrieved note passages to the provider.
                    Responses are reviewed before saving. Up to 40 requests per user each day,
                    resetting at midnight UTC.
                  </p>
                  <a
                    className="st-text-button"
                    href="https://developers.openai.com/api/docs/guides/structured-outputs"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    OpenAI API documentation
                    <IconExternalLink size={15} />
                  </a>
                </section>
              </div>
            </>
          )}
        </>
      )}
      <footer className="st-footer">
        <span>
          <span /> Saved on this device · private to your account
        </span>
        <span>Learn. Connect. Remember.</span>
      </footer>
      {editor && (
        <StudyEditor
          initial={editor.note}
          courses={library.courses}
          transcriptMode={editor.transcript}
          onClose={() => setEditor(null)}
          onSave={saveNote}
        />
      )}
      {courseEditor && (
        <CourseEditor
          {...(courseEditor.initial ? { initial: courseEditor.initial } : {})}
          onClose={() => setCourseEditor(null)}
          onSave={(course) =>
            commit((current) => ({
              ...current,
              courses: [...current.courses.filter((c) => c.id !== course.id), course],
            }))
          }
        />
      )}
      {cardNote && (
        <CardEditor
          noteId={cardNote}
          notes={library.notes}
          onClose={() => setCardNote(null)}
          onSave={(card) => commit((current) => ({ ...current, cards: [...current.cards, card] }))}
        />
      )}
      {askOpen && (
        <AskLibrary
          notes={library.notes}
          onClose={() => setAskOpen(false)}
          onOpen={(value) => {
            setAskOpen(false)
            openNote(value)
          }}
        />
      )}
    </div>
  )
}
function Stat({
  icon,
  color,
  value,
  label,
  onClick,
}: {
  icon: React.ReactNode
  color: string
  value: string | number
  label: string
  onClick?: () => void
}) {
  const content = (
    <>
      <span className={`st-icon ${color}`}>{icon}</span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
      {onClick && <IconArrowUpRight size={18} />}
    </>
  )
  return onClick ? (
    <button className="st-stat" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="st-stat">{content}</div>
  )
}
function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode
  title: string
  text: string
  action?: React.ReactNode
}) {
  return (
    <div className="st-empty">
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}
function CourseCard({
  course,
  notes,
  onOpen,
  onEdit,
}: {
  course: StudyCourse
  notes: StudyNote[]
  onOpen: () => void
  onEdit: () => void
}) {
  const read = notes.filter((n) => n.completed).length
  const progress = notes.length ? Math.round((read / notes.length) * 100) : 0
  const Icon =
    course.color === 'teal' ? IconRobot : course.color === 'amber' ? IconTopologyStar3 : IconBrain
  const url = safeUrl(course.url)
  return (
    <article className={`st-course-card ${course.color}`}>
      <div className="st-course-card-top">
        <span className={`st-icon ${course.color}`}>
          <Icon size={26} stroke={1.5} />
        </span>
        <div>
          {url && (
            <Tooltip label="Open course">
              <a
                href={url}
                aria-label={`Open ${course.title} on Udemy`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <IconExternalLink size={17} />
              </a>
            </Tooltip>
          )}
          <button aria-label={`Edit course ${course.title}`} onClick={onEdit}>
            <IconEdit size={17} />
          </button>
        </div>
      </div>
      <button className="st-course-card-main" onClick={onOpen}>
        <span className="st-eyebrow">{course.instructor || 'MY COURSE'}</span>
        <h3>{course.title}</h3>
        <p>{course.description || 'Capture lessons and make this knowledge your own.'}</p>
      </button>
      <div className="st-course-progress">
        <div>
          <span>
            {notes.length} lessons · {read} read
          </span>
          <strong>{progress}%</strong>
        </div>
        <div
          className="st-progress-track"
          role="progressbar"
          aria-label={`${course.title} reading progress`}
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
      <button className="st-course-open" onClick={onOpen}>
        Open course
        <IconArrowRight size={17} />
      </button>
    </article>
  )
}
function ReviewCard({
  card,
  note,
  onRate,
  onOpen,
}: {
  card: StudyCard
  note: StudyNote | undefined
  onRate: (rating: 'again' | 'good' | 'easy') => void
  onOpen: (id: string) => void
}) {
  const [flipped, setFlipped] = useState(false)
  const good = scheduleCard(card, 'good').interval,
    easy = scheduleCard(card, 'easy').interval
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName) ||
        (e.target as HTMLElement).closest('[role="dialog"]')
      )
        return
      if (e.code === 'Space') {
        e.preventDefault()
        setFlipped(true)
      }
      if (flipped && e.key === '1') onRate('again')
      if (flipped && e.key === '2') onRate('good')
      if (flipped && e.key === '3') onRate('easy')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [flipped, onRate])
  return (
    <section className="st-flashcard">
      <span className="st-eyebrow">
        {flipped ? 'CHECK YOUR RECALL' : 'THINK BEFORE YOU REVEAL'}
      </span>
      <h3>{card.question}</h3>
      {flipped ? (
        <>
          <div className="st-card-answer">
            <Markdown text={card.answer} />
          </div>
          <div className="st-rating-buttons">
            <button onClick={() => onRate('again')}>
              <span>Again</span>
              <small>10 minutes · 1</small>
            </button>
            <button onClick={() => onRate('good')}>
              <span>Got it</span>
              <small>
                {good} {good === 1 ? 'day' : 'days'} · 2
              </small>
            </button>
            <button onClick={() => onRate('easy')}>
              <span>Easy</span>
              <small>{easy} days · 3</small>
            </button>
          </div>
        </>
      ) : (
        <>
          <p>Try answering in your own words.</p>
          <Button color="violet" size="md" onClick={() => setFlipped(true)}>
            Reveal answer <span className="st-key-hint">SPACE</span>
          </Button>
        </>
      )}
      {note && (
        <button className="st-card-source" onClick={() => onOpen(note.id)}>
          <IconBook2 size={15} />
          From: {note.title}
          <IconArrowUpRight size={15} />
        </button>
      )}
    </section>
  )
}
function CardEditor({
  noteId,
  notes,
  onSave,
  onClose,
}: {
  noteId: string
  notes: StudyNote[]
  onSave: (card: StudyCard) => boolean
  onClose: () => void
}) {
  const [selected, setSelected] = useState(noteId),
    [question, setQuestion] = useState(''),
    [answer, setAnswer] = useState(''),
    [error, setError] = useState('')
  return (
    <Modal opened onClose={onClose} title="Create a review card" className="st-modal">
      <div className="st-form-stack">
        <Select
          label="Source lesson"
          value={selected}
          data={notes.map((n) => ({ value: n.id, label: n.title }))}
          onChange={(v) => setSelected(v ?? noteId)}
          allowDeselect={false}
        />
        <Textarea
          label="Question"
          value={question}
          maxLength={1000}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask one clear question…"
          minRows={2}
        />
        <Textarea
          label="Answer"
          value={answer}
          maxLength={4000}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Keep it short and specific."
          minRows={3}
        />
        {error && <Alert color="red">{error}</Alert>}
        <Button
          color="violet"
          onClick={() => {
            const parsed = studyCardSchema.safeParse({
              id: id(),
              noteId: selected,
              question,
              answer,
              interval: 0,
              reviews: 0,
              dueAt: Date.now(),
            })
            if (!parsed.success) {
              setError('Add a question and an answer.')
              return
            }
            if (onSave(parsed.data)) onClose()
          }}
        >
          Save review card
        </Button>
      </div>
    </Modal>
  )
}
function AskLibrary({
  notes,
  onClose,
  onOpen,
}: {
  notes: StudyNote[]
  onClose: () => void
  onOpen: (id: string) => void
}) {
  const [question, setQuestion] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [result, setResult] = useState<{
    answer: StudyAnswer
    sources: ReturnType<typeof retrieve>
    question: string
  } | null>(null)
  async function ask(value = question) {
    if (value.trim().length < 3) {
      setError('Ask a question with at least three characters.')
      return
    }
    const sources = retrieve(notes, value).slice(0, 8)
    if (!sources.length) {
      setError(
        'No matching passages were found. Try using a topic from your notes, or add a lesson with the answer.',
      )
      setResult(null)
      return
    }
    setBusy(true)
    setError('')
    setQuestion(value)
    try {
      const answer = await askNotes({
        question: value,
        passages: sources.map((s) => ({ id: s.note.id, title: s.note.title, text: s.excerpt })),
      })
      if (answer.sourceIds.some((sourceId) => !sources.some((s) => s.note.id === sourceId)))
        throw new Error('The AI returned an invalid source. Please try again.')
      setResult({ answer, sources, question: value })
    } catch (err) {
      setError(aiError(err))
      setResult(null)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      opened
      onClose={onClose}
      title={
        <span className="st-modal-title">
          <IconSparkles size={21} />
          Ask my notes
        </span>
      }
      size="800px"
      withCloseButton={!busy}
      closeOnEscape={!busy}
      closeOnClickOutside={!busy}
      className="st-modal"
    >
      <div className="st-ask-intro">
        <h3>Your courses can talk to each other.</h3>
        <p>
          Find connections, revisit a concept, or get an explanation grounded in your saved notes.
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void ask()
        }}
      >
        <TextInput
          label="Your question"
          placeholder="How do embeddings fit into a RAG pipeline?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={1000}
          disabled={busy}
          autoFocus
        />
        <div className="st-ask-submit">
          <span>Keyword retrieval → AI explanation → sources</span>
          <Button
            type="submit"
            color="violet"
            leftSection={<IconSparkles size={16} />}
            loading={busy}
            disabled={!notes.length}
          >
            Ask my library
          </Button>
        </div>
      </form>
      {!result && !busy && (
        <div className="st-suggestions">
          {[
            'What is a RAG pipeline?',
            'How does an agent use tools?',
            'Why does chunking matter?',
          ].map((q) => (
            <button key={q} onClick={() => void ask(q)}>
              {q}
              <IconArrowUpRight size={14} />
            </button>
          ))}
        </div>
      )}
      {busy && (
        <div className="st-ai-loading">
          <IconSparkles size={24} />
          <strong>Reading the relevant passages…</strong>
          <p>Your answer will link back to the lessons it uses.</p>
        </div>
      )}
      {error && (
        <Alert color="red" role="alert" my="md">
          {error}
        </Alert>
      )}
      {result && (
        <div className="st-answer">
          <span className="st-eyebrow">ANSWER FROM YOUR LIBRARY</span>
          <h3>{result.question}</h3>
          <Markdown text={result.answer.answer} />
          <div className="st-answer-sources">
            <span className="st-eyebrow">SUPPORTING LESSONS</span>
            {result.answer.sourceIds.map((sourceId, index) => {
              const source = result.sources.find((s) => s.note.id === sourceId)
              return source ? (
                <details key={sourceId}>
                  <summary>
                    <span>{index + 1}</span>
                    {source.note.title}
                  </summary>
                  <p>{source.excerpt.replace(/[#*`]/g, '').slice(0, 800)}</p>
                  <button className="st-text-button" onClick={() => onOpen(sourceId)}>
                    Read full lesson
                    <IconArrowRight size={15} />
                  </button>
                </details>
              ) : null
            })}
            {!result.answer.sourceIds.length && (
              <p>No supporting sources were cited. The supplied evidence may be insufficient.</p>
            )}
          </div>
        </div>
      )}
      <p className="st-fine">
        Only the retrieved passages and your question are sent to the AI provider. Check the linked
        sources when accuracy matters.
      </p>
    </Modal>
  )
}
function KnowledgeMap({
  notes,
  courses,
  onOpen,
}: {
  notes: StudyNote[]
  courses: StudyCourse[]
  onOpen: (id: string) => void
}) {
  const topics = topicGroups(notes)
  const [selected, setSelected] = useState('')
  const selectedTopic = topics.find((t) => t.label.toLowerCase() === selected.toLowerCase())
  const crossCourse = topics.filter((t) => new Set(t.notes.map((n) => n.courseId)).size > 1)
  const mapped = (crossCourse.length ? crossCourse : topics).slice(0, 7)
  return (
    <>
      <div className="st-section-title">
        <div>
          <h2>Connect the dots</h2>
          <p>Shared topics reveal how ideas connect across your courses.</p>
        </div>
        <span className="st-pill">
          {topics.length} TOPICS · {crossCourse.length} CROSS-COURSE LINKS
        </span>
      </div>
      {!topics.length ? (
        <Empty
          icon={<IconTopologyStar3 />}
          title="Your map grows with your notes"
          text="Add topic tags to your lessons to start finding connections."
        />
      ) : (
        <>
          <div className="st-knowledge-board">
            <div className="st-map-center">
              <IconBrain size={31} />
              <strong>Your knowledge</strong>
              <span>{notes.length} captured lessons</span>
            </div>
            <svg viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true">
              {mapped.map((t, i) => (
                <path
                  key={t.label}
                  d={`M500 130 Q500 230 ${((i + 0.5) * 1000) / mapped.length} 265`}
                />
              ))}
            </svg>
            <div className="st-map-topics">
              {mapped.map((t) => (
                <button
                  key={t.label}
                  className={selected === t.label ? 'active' : ''}
                  onClick={() => setSelected(selected === t.label ? '' : t.label)}
                >
                  <IconTopologyStar3 size={20} />
                  <strong>{t.label}</strong>
                  <span>
                    {t.notes.length} lessons · {new Set(t.notes.map((n) => n.courseId)).size}{' '}
                    courses
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="st-topic-browser">
            <span className="st-eyebrow">EXPLORE A TOPIC</span>
            <div className="st-tags">
              {topics.map((t) => (
                <button
                  key={t.label}
                  className={selected === t.label ? 'active' : ''}
                  onClick={() => setSelected(selected === t.label ? '' : t.label)}
                >
                  {t.label}
                  <span>{t.notes.length}</span>
                </button>
              ))}
            </div>
          </div>
          <section className="st-panel">
            <div className="st-section-title">
              <h2>
                {selectedTopic
                  ? `Connected by “${selectedTopic.label}”`
                  : 'Ideas that bridge your courses'}
              </h2>
            </div>
            {(selectedTopic
              ? selectedTopic.notes
              : [...new Map(crossCourse.flatMap((t) => t.notes).map((n) => [n.id, n])).values()]
            ).map((n) => (
              <button className="st-connection-row" key={n.id} onClick={() => onOpen(n.id)}>
                <span
                  className={`st-icon ${courses.find((c) => c.id === n.courseId)?.color ?? 'violet'}`}
                >
                  <IconNotes size={19} />
                </span>
                <div>
                  <strong>{n.title}</strong>
                  <span>{courses.find((c) => c.id === n.courseId)?.title}</span>
                </div>
                <IconArrowRight size={18} />
              </button>
            ))}
            {!selectedTopic && !crossCourse.length && (
              <p>
                Select a topic above to see its lessons. Reuse topic names in different courses to
                build bridges.
              </p>
            )}
          </section>
        </>
      )}
    </>
  )
}
