import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Menu,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  TagsInput,
} from '@mantine/core'
import {
  IconArrowLeft,
  IconArrowUpRight,
  IconBook2,
  IconCheck,
  IconChecklist,
  IconClock,
  IconDownload,
  IconDots,
  IconFileText,
  IconFocus2,
  IconFolder,
  IconHistory,
  IconNotebook,
  IconPin,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import {
  createNote,
  downloadFile,
  filterNotes,
  librarySchema,
  linkedTitles,
  localDate,
  mergeLibrary,
  normalizeTags,
  notebookSchema,
  noteTasks,
  plainText,
  safeUrl,
  scheduleCard,
  templates,
  toggleTask,
  type Note,
  type Notebook,
  type NotesLibrary,
  type ReviewCard,
  type Template,
} from './notes-lib'
import { headings, NoteMarkdown } from './NoteMarkdown'
import { useNotesLibrary } from './useNotesLibrary'
import './notes.css'

type View = 'all' | 'pinned' | 'courses' | 'tasks' | 'review' | 'archived' | 'trash'
const views: { value: View; label: string; icon: typeof IconNotebook }[] = [
  { value: 'all', label: 'All notes', icon: IconNotebook },
  { value: 'pinned', label: 'Pinned', icon: IconPin },
  { value: 'courses', label: 'Courses', icon: IconBook2 },
  { value: 'tasks', label: 'Checklists', icon: IconChecklist },
  { value: 'review', label: 'Review', icon: IconSparkles },
  { value: 'archived', label: 'Archive', icon: IconFolder },
  { value: 'trash', label: 'Trash', icon: IconTrash },
]
const formatDate = (at: number) =>
  new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export function NotesPage() {
  const { user } = useAuth()
  return user ? <NotesWorkspace key={user.uid} uid={user.uid} /> : null
}
function NotesWorkspace({ uid }: { uid: string }) {
  const { library, error, blocked, commit, key } = useNotesLibrary(uid)
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [params])
  const view: View = views.some((v) => v.value === params.get('view'))
    ? (params.get('view') as View)
    : 'all'
  const notebookId = params.get('book') ?? ''
  const selected = library.notes.find((n) => n.id === params.get('note'))
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [sort, setSort] = useState('recent')
  const [newNote, setNewNote] = useState(false)
  const [bookEditor, setBookEditor] = useState<Notebook | 'new' | null>(null)
  const [settings, setSettings] = useState(false)
  const [notice, updateNotice] = useState('')
  const [undo, setUndo] = useState<{ id: string; status: Note['status'] } | null>(null)
  const [deleting, setDeleting] = useState<Note | null>(null)
  function setNotice(message: string) {
    updateNotice(message)
    setUndo(null)
  }
  const [importError, setImportError] = useState('')
  const [imported, setImported] = useState<NotesLibrary | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const unsavedDrafts = useRef(new Map<string, { title: string; body: string }>())
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (unsavedDrafts.current.size) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])
  const active = library.notes.filter((n) => n.status === 'active')
  const dueCards = library.cards.filter(
    (c) => c.dueAt <= Date.now() && active.some((n) => n.id === c.noteId),
  )
  const dueNotes = active.filter((n) => n.reviewDate && n.reviewDate <= localDate())
  const openTasks = active.reduce(
    (sum, n) => sum + noteTasks(n.body).filter((t) => !t.done).length,
    0,
  )
  const currentBook = library.notebooks.find((n) => n.id === notebookId)
  const available = library.notes.filter(
    (n) =>
      (view === 'trash'
        ? n.status === 'trash'
        : view === 'archived'
          ? n.status === 'archived'
          : n.status === 'active') &&
      (!notebookId || n.notebookId === notebookId) &&
      (view !== 'pinned' || n.pinned) &&
      (view !== 'courses' ||
        library.notebooks.find((b) => b.id === n.notebookId)?.kind === 'course'),
  )
  const filtered = filterNotes(available, query, tag, sort)
  const tags = [...new Set(available.flatMap((n) => n.tags))].sort()
  const hasSelectedTag = !tag || tags.includes(tag)
  const checklistNotes = available.filter((n) => noteTasks(n.body).length)
  useEffect(() => {
    if (!hasSelectedTag) setTag('')
  }, [hasSelectedTag])
  function navigate(nextView: View, book = '', note = '') {
    setParams({
      ...(nextView !== 'all' ? { view: nextView } : {}),
      ...(book ? { book } : {}),
      ...(note ? { note } : {}),
    })
    setTag('')
    setQuery('')
  }
  function open(note: Note) {
    const nextView =
      note.status === 'trash'
        ? 'trash'
        : note.status === 'archived'
          ? 'archived'
          : ['trash', 'archived'].includes(view)
            ? 'all'
            : view
    const book = notebookId === note.notebookId ? notebookId : ''
    setParams({
      ...(nextView !== 'all' ? { view: nextView } : {}),
      ...(book ? { book } : {}),
      note: note.id,
    })
  }
  function patch(id: string, changes: Partial<Note>) {
    return commit((l) => ({
      ...l,
      notes: l.notes.map((n) => (n.id === id ? { ...n, ...changes, updatedAt: Date.now() } : n)),
    }))
  }
  function changeStatus(note: Note, status: Note['status']) {
    if (unsavedDrafts.current.has(note.id)) {
      setNotice('Open this note and save or export its unsaved draft before moving it.')
      return false
    }
    if (!patch(note.id, { status })) return false
    setNotice(
      `“${note.title || 'Untitled note'}” ${status === 'trash' ? 'moved to Trash' : status === 'archived' ? 'archived' : 'restored'}.`,
    )
    setUndo({ id: note.id, status: note.status })
    return true
  }
  function backToList() {
    const next = new URLSearchParams(params)
    next.delete('note')
    setParams(next)
  }
  function add(template: Template, book = notebookId || library.notebooks[0]!.id) {
    if (template === 'daily') {
      const existing = active.find(
        (n) => n.tags.includes('daily') && n.title === `Daily · ${localDate()}`,
      )
      if (existing) {
        open(existing)
        setNewNote(false)
        return
      }
    }
    const note = createNote(book, template)
    if (commit((l) => ({ ...l, notes: [...l.notes, note] }))) {
      setQuery('')
      setNewNote(false)
      open(note)
    }
  }
  function follow(title: string) {
    const target = active.find((n) => n.title.trim().toLowerCase() === title.trim().toLowerCase())
    if (target) open(target)
    else setNotice(`No note named “${title}” yet. Create one with that title to connect it.`)
  }
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])
  async function importFile(file: File | undefined) {
    if (!file) return
    setImportError('')
    try {
      if (file.size > 20000000) throw new Error('large')
      setImported(librarySchema.parse(JSON.parse(await file.text())))
    } catch {
      setImportError(
        'This is not a valid Notes backup, or the file exceeds 20 MB. Your library has not changed.',
      )
    }
  }
  const navCounts: Record<View, number> = {
    all: active.length,
    pinned: active.filter((n) => n.pinned).length,
    courses: library.notebooks.filter((n) => n.kind === 'course').length,
    tasks: openTasks,
    review: dueCards.length + dueNotes.length,
    archived: library.notes.filter((n) => n.status === 'archived').length,
    trash: library.notes.filter((n) => n.status === 'trash').length,
  }
  return (
    <div className={`notes-page ${selected ? 'is-editing' : ''}`}>
      <header className="nt-header">
        <div>
          <div className="nt-eyebrow">YOUR EVERYDAY COMPANION</div>
          <h1>
            Notes<span className="nt-header-dot">.</span>
          </h1>
          <p>A home for your thoughts. A little space to grow.</p>
        </div>
        <Group gap="xs">
          <Button
            variant="default"
            leftSection={<IconDownload size={16} />}
            onClick={() => setSettings(true)}
          >
            Library & backup
          </Button>
          <Button
            leftSection={<IconPlus size={17} />}
            onClick={() => setNewNote(true)}
            disabled={blocked}
          >
            New note
          </Button>
        </Group>
      </header>
      {error && (
        <Alert color="red" title="Library needs attention" mb="md">
          {error}
          <Button variant="light" color="red" size="xs" ml="sm" onClick={() => setSettings(true)}>
            Open recovery & backup
          </Button>
        </Alert>
      )}
      {notice && (
        <Alert
          withCloseButton
          closeButtonLabel="Close"
          onClose={() => {
            setNotice('')
            setUndo(null)
          }}
          mb="md"
        >
          {notice}
          {undo && (
            <Button
              variant="light"
              size="xs"
              ml="sm"
              disabled={blocked}
              onClick={() => {
                if (patch(undo.id, { status: undo.status })) {
                  setUndo(null)
                  setNotice('Change undone.')
                }
              }}
            >
              Undo
            </Button>
          )}
        </Alert>
      )}
      <div className="nt-workspace">
        <aside className="nt-sidebar">
          <button className="nt-daily" onClick={() => add('daily')} disabled={blocked}>
            <span className="nt-daily-icon">
              <IconFileText size={21} />
            </span>
            <span>
              <strong>Today’s page</strong>
              <small>
                {new Date().toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </small>
            </span>
            <IconPlus size={16} />
          </button>
          <div className="nt-eyebrow nt-side-label">MY LIBRARY</div>
          <nav aria-label="Notes library">
            {views
              .filter((v) => ['all', 'pinned', 'tasks'].includes(v.value))
              .map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  className={`nt-nav ${view === value && !notebookId ? 'is-active' : ''}`}
                  aria-current={view === value && !notebookId ? 'page' : undefined}
                  onClick={() => navigate(value)}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  <small>{navCounts[value]}</small>
                </button>
              ))}
          </nav>
          {[
            { label: 'Learning', values: ['courses', 'review'] },
            { label: 'Archive & Trash', values: ['archived', 'trash'] },
          ].map((group) => (
            <details
              className="nt-nav-group"
              key={group.label}
              open={group.values.includes(view) || undefined}
            >
              <summary>{group.label}</summary>
              <nav aria-label={group.label}>
                {views
                  .filter((v) => group.values.includes(v.value))
                  .map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      className={`nt-nav ${view === value && !notebookId ? 'is-active' : ''}`}
                      aria-current={view === value && !notebookId ? 'page' : undefined}
                      onClick={() => navigate(value)}
                    >
                      <Icon size={18} />
                      <span>{label}</span>
                      <small>{navCounts[value]}</small>
                    </button>
                  ))}
              </nav>
            </details>
          ))}
          <div className="nt-book-label">
            <span className="nt-eyebrow">NOTEBOOKS</span>
            <button
              aria-label="Add notebook"
              onClick={() => setBookEditor('new')}
              disabled={blocked}
            >
              <IconPlus size={17} />
            </button>
          </div>
          <div className="nt-notebooks">
            {library.notebooks.map((b) => (
              <button
                key={b.id}
                className={`nt-nav ${notebookId === b.id ? 'is-active' : ''}`}
                onClick={() => navigate('all', b.id)}
              >
                <span className={`nt-book-dot nt-${b.color}`} />
                <span>{b.title}</span>
                <small>{active.filter((n) => n.notebookId === b.id).length}</small>
              </button>
            ))}
          </div>
          <div className="nt-side-footer">
            <span className="nt-status-dot" />
            Saved on this device<small>Private to your account · export to take it with you.</small>
          </div>
        </aside>
        <main className="nt-main">
          {selected ? (
            <NoteEditor
              key={selected.id}
              note={selected}
              library={library}
              blocked={blocked}
              patch={patch}
              commit={commit}
              onBack={backToList}
              backLabel={currentBook?.title ?? views.find((v) => v.value === view)!.label}
              onStatus={changeStatus}
              onDelete={() => setDeleting(selected)}
              onLink={follow}
              onOpen={open}
              onNotice={setNotice}
              recoveredDraft={unsavedDrafts.current.get(selected.id)}
              onDraft={(draft) => {
                if (draft) unsavedDrafts.current.set(selected.id, draft)
                else unsavedDrafts.current.delete(selected.id)
              }}
            />
          ) : (
            <>
              <section className="nt-welcome">
                <div>
                  <h2>
                    {currentBook
                      ? currentBook.title
                      : view === 'all'
                        ? 'All notes'
                        : views.find((v) => v.value === view)!.label}
                  </h2>
                  <p>
                    {currentBook?.kind === 'course'
                      ? `${currentBook.instructor ? `With ${currentBook.instructor} · ` : ''}Your lessons, examples, and discoveries, together.`
                      : view === 'trash'
                        ? 'Restore deleted notes or remove them permanently.'
                        : view === 'archived'
                          ? 'Notes you’ve set aside. Restore them whenever you need them.'
                          : `${available.length} notes · Saved on this device`}
                  </p>
                  {currentBook && (
                    <Group gap="xs" mt="sm">
                      <Button
                        size="xs"
                        variant="default"
                        onClick={() => setBookEditor(currentBook)}
                      >
                        Edit notebook
                      </Button>
                      {safeUrl(currentBook.source) && (
                        <Button
                          size="xs"
                          variant="light"
                          component="a"
                          href={safeUrl(currentBook.source)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          rightSection={<IconArrowUpRight size={14} />}
                        >
                          Open course
                        </Button>
                      )}
                    </Group>
                  )}
                </div>
              </section>
              {view === 'review' ? (
                <ReviewPanel
                  cards={dueCards}
                  notes={dueNotes}
                  library={library}
                  commit={commit}
                  onOpen={open}
                />
              ) : view === 'tasks' ? (
                <div className="nt-task-board">
                  {checklistNotes.map((n) => (
                    <section className="nt-task-card" key={n.id}>
                      <button className="nt-text-link" onClick={() => open(n)}>
                        {n.title || 'Untitled note'} <IconArrowUpRight size={15} />
                      </button>
                      {noteTasks(n.body).map((t) => (
                        <label className="nt-task" key={t.line}>
                          <input
                            type="checkbox"
                            checked={t.done}
                            disabled={blocked}
                            onChange={() => patch(n.id, { body: toggleTask(n.body, t.line) })}
                          />
                          <span>{t.text}</span>
                        </label>
                      ))}
                    </section>
                  ))}
                  {!checklistNotes.length && (
                    <Empty
                      title="A little less to keep in your head"
                      text="Write - [ ] in any note to make a checklist. You can tick items here or in the reading view."
                      action={() => add('daily')}
                      label="Start today’s page"
                    />
                  )}
                </div>
              ) : (
                <>
                  {view === 'courses' && (
                    <div className="nt-course-grid">
                      {library.notebooks
                        .filter((b) => b.kind === 'course')
                        .map((b) => {
                          const notes = active.filter((n) => n.notebookId === b.id)
                          const done = notes.filter((n) => n.completed).length
                          const total = Math.max(b.lessons, notes.length)
                          const progress = total ? Math.round((done / total) * 100) : 0
                          return (
                            <button
                              className="nt-course-card"
                              key={b.id}
                              onClick={() => navigate('all', b.id)}
                            >
                              <span className={`nt-course-icon nt-${b.color}`}>
                                <IconBook2 size={22} />
                              </span>
                              <h3>{b.title}</h3>
                              <p>{b.instructor || 'Self-paced learning'}</p>
                              <div className="nt-progress">
                                <span style={{ width: `${progress}%` }} />
                              </div>
                              <small>
                                {done} / {total} lessons completed <strong>{progress}%</strong>
                              </small>
                            </button>
                          )
                        })}
                      <button
                        className="nt-course-card nt-add-course"
                        onClick={() =>
                          setBookEditor({
                            id: crypto.randomUUID(),
                            title: '',
                            kind: 'course',
                            color: 'violet',
                            source: '',
                            instructor: '',
                            lessons: 0,
                            createdAt: Date.now(),
                          })
                        }
                      >
                        <IconPlus size={24} />
                        <strong>Add a course</strong>
                        <small>Udemy, books, or anything you’re learning.</small>
                      </button>
                    </div>
                  )}
                  <div className="nt-list-heading">
                    <h3>
                      {currentBook
                        ? 'Notebook pages'
                        : view === 'all'
                          ? 'Your notes'
                          : view === 'courses'
                            ? 'Course notes'
                            : views.find((v) => v.value === view)!.label}
                      <span>{filtered.length}</span>
                    </h3>
                    <Group gap="xs">
                      <Select
                        aria-label="Filter by tag"
                        placeholder="All tags"
                        value={tag || null}
                        clearable
                        onChange={(v) => setTag(v ?? '')}
                        data={tags}
                        searchable
                        nothingFoundMessage="Add tags inside a note to filter by them"
                        w={140}
                      />
                      <Select
                        aria-label="Sort notes"
                        value={sort}
                        onChange={(v) => setSort(v ?? 'recent')}
                        data={[
                          { value: 'recent', label: 'Last edited' },
                          { value: 'title', label: 'Title A–Z' },
                          { value: 'oldest', label: 'Oldest first' },
                        ]}
                        w={140}
                      />
                    </Group>
                  </div>
                  <TextInput
                    ref={searchRef}
                    aria-label="Search notes"
                    placeholder="Search titles, ideas, tags, or lesson names…"
                    leftSection={<IconSearch size={17} />}
                    rightSection={<span className="nt-search-key">⌘K</span>}
                    value={query}
                    onChange={(e) => setQuery(e.currentTarget.value)}
                    className="nt-search"
                  />
                  <div className="nt-note-grid">
                    {filtered.map((n) => (
                      <article className="nt-note-card" key={n.id}>
                        <div className="nt-note-top">
                          <span
                            className={`nt-book-dot nt-${library.notebooks.find((b) => b.id === n.notebookId)?.color ?? 'teal'}`}
                          />
                          <span>{library.notebooks.find((b) => b.id === n.notebookId)?.title}</span>
                          {n.pinned && <IconPin size={15} />}
                          {n.completed && <IconCheck size={15} />}
                          <NoteActions
                            note={n}
                            disabled={blocked}
                            onPin={() => patch(n.id, { pinned: !n.pinned })}
                            onStatus={(status) => changeStatus(n, status)}
                            onDelete={() => setDeleting(n)}
                          />
                        </div>
                        <button
                          className="nt-note-open"
                          aria-label={`Open note: ${n.title || 'Untitled note'}`}
                          onClick={() => open(n)}
                        >
                          <h4>{n.title || 'Untitled note'}</h4>
                          <p>
                            {plainText(n.body).slice(0, 145) ||
                              'A fresh page, ready for your thoughts.'}
                          </p>
                          <div className="nt-card-tags">
                            {n.tags.slice(0, 3).map((t) => (
                              <span key={t}>#{t}</span>
                            ))}
                          </div>
                          <footer>
                            <span>{formatDate(n.updatedAt)}</span>
                            <span>
                              {noteTasks(n.body).length
                                ? `${noteTasks(n.body).filter((t) => t.done).length}/${noteTasks(n.body).length} tasks`
                                : `${Math.max(1, Math.ceil(n.body.split(/\s+/).length / 200))} min read`}
                              <IconArrowUpRight size={15} />
                            </span>
                          </footer>
                        </button>
                      </article>
                    ))}
                  </div>
                  {!filtered.length && (
                    <Empty
                      title={
                        query || tag
                          ? 'No matching notes'
                          : view === 'trash'
                            ? 'Nothing in the trash'
                            : view === 'archived'
                              ? 'A clear archive'
                              : 'Start with one small thought'
                      }
                      text={
                        query || tag
                          ? 'Try another word or clear your tag filter.'
                          : view === 'trash'
                            ? 'Deleted notes stay here until you choose to remove them permanently.'
                            : 'Capture your day, take a lesson note, or write something just for you.'
                      }
                      action={
                        query || tag
                          ? () => {
                              setQuery('')
                              setTag('')
                            }
                          : () => setNewNote(true)
                      }
                      label={query || tag ? 'Clear filters' : 'Create a note'}
                    />
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
      <Modal
        closeButtonProps={{ 'aria-label': 'Close' }}
        opened={newNote}
        onClose={() => setNewNote(false)}
        title="What would you like to capture?"
        size="lg"
      >
        <TemplatePicker
          notebooks={library.notebooks}
          defaultBook={notebookId || library.notebooks[0]!.id}
          onSelect={add}
        />
      </Modal>
      <Modal
        closeButtonProps={{ 'aria-label': 'Close' }}
        opened={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Permanently delete this note?"
      >
        <Text size="sm" mb="md">
          “{deleting?.title || 'Untitled note'}” and its review cards will be removed. This cannot
          be undone.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setDeleting(null)}>
            Keep note
          </Button>
          <Button
            color="red"
            disabled={blocked}
            onClick={() => {
              if (!deleting) return
              if (unsavedDrafts.current.has(deleting.id)) {
                setDeleting(null)
                setNotice('Open this note and save or export its unsaved draft before deleting it.')
                return
              }
              if (
                commit((l) => ({
                  ...l,
                  notes: l.notes.filter((n) => n.id !== deleting.id),
                  cards: l.cards.filter((c) => c.noteId !== deleting.id),
                }))
              ) {
                if (selected?.id === deleting.id) backToList()
                setDeleting(null)
                setUndo(null)
                setNotice('Note permanently deleted.')
              }
            }}
          >
            Delete note permanently
          </Button>
        </Group>
      </Modal>
      <Modal
        closeButtonProps={{ 'aria-label': 'Close' }}
        opened={bookEditor !== null}
        onClose={() => setBookEditor(null)}
        title={bookEditor === 'new' ? 'New notebook' : 'Notebook details'}
      >
        {bookEditor && (
          <NotebookEditor
            key={bookEditor === 'new' ? 'new' : bookEditor.id}
            initial={bookEditor === 'new' ? null : bookEditor}
            onSave={(book) => {
              if (
                commit((l) => ({
                  ...l,
                  notebooks: [...l.notebooks.filter((b) => b.id !== book.id), book],
                }))
              )
                setBookEditor(null)
            }}
          />
        )}
      </Modal>
      <Modal
        closeButtonProps={{ 'aria-label': 'Close' }}
        opened={settings}
        onClose={() => setSettings(false)}
        title="Your library, wherever you go"
        size="lg"
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Notes are saved automatically in this browser for your signed-in account. Export a
            backup to keep a copy or move to another device.
          </Text>
          <Text size="sm">
            {library.notebooks.length} notebooks · {library.notes.length} notes ·{' '}
            {library.cards.length} review cards
          </Text>
          <Button
            leftSection={<IconDownload size={17} />}
            onClick={() =>
              downloadFile(`notes-backup-${localDate()}.json`, JSON.stringify(library, null, 2))
            }
          >
            Export library backup
          </Button>
          <label className="nt-import-label">
            Import a Notes backup
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                void importFile(e.currentTarget.files?.[0])
                e.currentTarget.value = ''
              }}
            />
          </label>
          {importError && <Alert color="red">{importError}</Alert>}
          {blocked && (
            <Button
              variant="light"
              color="orange"
              onClick={() =>
                downloadFile('notes-recovery.txt', localStorage.getItem(key) ?? '', 'text/plain')
              }
            >
              Download original recovery file
            </Button>
          )}
          <Text size="xs" c="dimmed">
            Imports can be merged with your library. Replacing a library downloads your current
            backup first. Notes in trash are included in backups.
          </Text>
        </Stack>
      </Modal>
      <Modal
        closeButtonProps={{ 'aria-label': 'Close' }}
        opened={Boolean(imported)}
        onClose={() => setImported(null)}
        title="Import your notes"
      >
        <Stack>
          <Text>
            {imported?.notebooks.length} notebooks, {imported?.notes.length} notes, and{' '}
            {imported?.cards.length} review cards.
          </Text>
          <Button
            disabled={blocked}
            onClick={() => {
              if (imported && commit((l) => mergeLibrary(l, imported))) {
                setImported(null)
                setSettings(false)
                navigate('all')
                setNotice('Backup merged. Your existing notes are still here.')
              }
            }}
          >
            Merge with my library
          </Button>
          <Button
            color="orange"
            variant="light"
            onClick={() => {
              if (!imported) return
              try {
                downloadFile(
                  `notes-before-restore-${localDate()}.json`,
                  blocked ? (localStorage.getItem(key) ?? '') : JSON.stringify(library, null, 2),
                )
                if (commit(() => imported, true)) {
                  setImported(null)
                  setSettings(false)
                  navigate('all')
                  setNotice('Library restored. Your previous library was downloaded first.')
                }
              } catch {
                setImportError('Could not download the safety backup. Restore was cancelled.')
              }
            }}
          >
            Back up current library & replace
          </Button>
        </Stack>
      </Modal>
    </div>
  )
}
function Empty({
  title,
  text,
  action,
  label,
}: {
  title: string
  text: string
  action: () => void
  label: string
}) {
  return (
    <div className="nt-empty">
      <span>
        <IconNotebook size={30} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      <Button variant="light" onClick={action}>
        {label}
      </Button>
    </div>
  )
}
function TemplatePicker({
  notebooks,
  defaultBook,
  onSelect,
}: {
  notebooks: Notebook[]
  defaultBook: string
  onSelect: (template: Template, book: string) => void
}) {
  const [book, setBook] = useState(defaultBook)
  return (
    <Stack>
      <Select
        label="Notebook"
        value={book}
        onChange={(v) => setBook(v || defaultBook)}
        data={notebooks.map((b) => ({ value: b.id, label: b.title }))}
      />
      <div className="nt-template-grid">
        {templates.map((t) => (
          <button key={t.value} onClick={() => onSelect(t.value, book)}>
            <IconFileText size={23} />
            <strong>{t.title}</strong>
            <small>{t.description}</small>
          </button>
        ))}
      </div>
    </Stack>
  )
}
function NotebookEditor({
  initial,
  onSave,
}: {
  initial: Notebook | null
  onSave: (book: Notebook) => void
}) {
  const [book, setBook] = useState<Notebook>(
    initial ?? {
      id: crypto.randomUUID(),
      title: '',
      kind: 'personal',
      color: 'teal',
      source: '',
      instructor: '',
      lessons: 0,
      createdAt: Date.now(),
    },
  )
  const [error, setError] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const result = notebookSchema.safeParse(book)
        if (result.success) onSave(result.data)
        else setError('Give this notebook a title and check the field lengths.')
      }}
    >
      <Stack>
        <TextInput
          label="Notebook title"
          required
          maxLength={100}
          value={book.title}
          onChange={(e) => setBook({ ...book, title: e.currentTarget.value })}
        />
        <Select
          label="Notebook type"
          value={book.kind}
          onChange={(v) => setBook({ ...book, kind: v as Notebook['kind'] })}
          data={[
            { value: 'personal', label: 'Everyday notes' },
            { value: 'course', label: 'Course / learning' },
          ]}
        />
        <Select
          label="Notebook color"
          value={book.color}
          onChange={(v) => setBook({ ...book, color: v as Notebook['color'] })}
          data={['teal', 'violet', 'orange', 'blue', 'pink']}
        />
        {book.kind === 'course' && (
          <>
            <TextInput
              label="Course URL"
              placeholder="https://www.udemy.com/course/…"
              value={book.source}
              maxLength={2000}
              onChange={(e) => setBook({ ...book, source: e.currentTarget.value })}
            />
            <TextInput
              label="Instructor / author"
              value={book.instructor}
              maxLength={200}
              onChange={(e) => setBook({ ...book, instructor: e.currentTarget.value })}
            />
            <NumberInput
              label="Total lessons"
              description="Used to track course completion. Leave at 0 to use captured notes."
              min={0}
              max={10000}
              allowDecimal={false}
              value={book.lessons}
              onChange={(v) => setBook({ ...book, lessons: Number(v) || 0 })}
            />
          </>
        )}
        {error && <Alert color="red">{error}</Alert>}
        <Button type="submit">Save notebook</Button>
      </Stack>
    </form>
  )
}

type Commit = (update: (l: NotesLibrary) => NotesLibrary, recover?: boolean) => boolean
function NoteActions({
  note,
  disabled,
  onPin,
  onStatus,
  onDelete,
}: {
  note: Note
  disabled: boolean
  onPin: () => void
  onStatus: (status: Note['status']) => void
  onDelete: () => void
}) {
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Button
          variant="subtle"
          size="compact-sm"
          aria-label={`Actions for ${note.title || 'Untitled note'}`}
          disabled={disabled}
        >
          <IconDots size={18} />
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {note.status === 'active' ? (
          <>
            <Menu.Item leftSection={<IconPin size={16} />} onClick={onPin}>
              {note.pinned ? 'Unpin note' : 'Pin note'}
            </Menu.Item>
            <Menu.Item leftSection={<IconFolder size={16} />} onClick={() => onStatus('archived')}>
              Archive note
            </Menu.Item>
          </>
        ) : (
          <Menu.Item leftSection={<IconArrowLeft size={16} />} onClick={() => onStatus('active')}>
            Restore note
          </Menu.Item>
        )}
        {note.status === 'trash' ? (
          <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={onDelete}>
            Delete permanently
          </Menu.Item>
        ) : (
          <Menu.Item
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={() => onStatus('trash')}
          >
            Move to trash
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  )
}
function NoteEditor({
  note,
  library,
  blocked,
  patch,
  commit,
  onBack,
  backLabel,
  onStatus,
  onDelete,
  onLink,
  onOpen,
  onNotice,
  recoveredDraft,
  onDraft,
}: {
  note: Note
  library: NotesLibrary
  blocked: boolean
  patch: (id: string, changes: Partial<Note>) => boolean
  commit: Commit
  onBack: () => void
  backLabel: string
  onStatus: (note: Note, status: Note['status']) => boolean
  onDelete: () => void
  onLink: (title: string) => void
  onOpen: (note: Note) => void
  onNotice: (message: string) => void
  recoveredDraft: { title: string; body: string } | undefined
  onDraft: (draft: { title: string; body: string } | null) => void
}) {
  const [mode, setMode] = useState<'write' | 'read' | 'split'>(note.body ? 'read' : 'write')
  const [focus, setFocus] = useState(false)
  const [history, setHistory] = useState(false)
  const [details, setDetails] = useState(false)
  const [cardModal, setCardModal] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [draft, setDraft] = useState(recoveredDraft ?? { title: note.title, body: note.body })
  const latest = useRef(draft)
  latest.current = draft
  const snapshot = useRef({ title: note.title, body: note.body })
  const textarea = useRef<HTMLTextAreaElement>(null)
  const notebook = library.notebooks.find((b) => b.id === note.notebookId)!
  const locked = blocked || note.status !== 'active'
  const backlinkNotes = library.notes.filter(
    (n) =>
      n.status === 'active' &&
      n.id !== note.id &&
      linkedTitles(n.body).includes(note.title.trim().toLowerCase()),
  )
  const [saveFailed, setSaveFailed] = useState(Boolean(recoveredDraft))
  useEffect(() => {
    if (!saveFailed) setDraft({ title: note.title, body: note.body })
  }, [note.title, note.body, saveFailed])
  useEffect(() => {
    function escape(e: KeyboardEvent) {
      if (e.key === 'Escape') setFocus(false)
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [])
  function save(changes: Partial<typeof draft>) {
    const next = { ...latest.current, ...changes }
    latest.current = next
    setDraft(next)
    const ok = patch(note.id, next)
    setSaveFailed(!ok)
    onDraft(ok ? null : next)
    return ok
  }
  function checkpoint() {
    if (saveFailed) return
    const previous = snapshot.current
    if (previous.title === latest.current.title && previous.body === latest.current.body) return
    if (
      commit((l) => ({
        ...l,
        notes: l.notes.map((n) =>
          n.id === note.id
            ? { ...n, revisions: [{ ...previous, at: Date.now() }, ...n.revisions].slice(0, 12) }
            : n,
        ),
      }))
    )
      snapshot.current = { ...latest.current }
  }
  function insert(before: string, after = '') {
    const area = textarea.current
    if (!area) {
      setMode('write')
      return
    }
    const start = area.selectionStart
    const end = area.selectionEnd
    save({
      body:
        draft.body.slice(0, start) +
        before +
        draft.body.slice(start, end) +
        after +
        draft.body.slice(end),
    })
    requestAnimationFrame(() => {
      area.focus()
      area.setSelectionRange(start + before.length, end + before.length)
    })
  }
  function leave() {
    checkpoint()
    if (saveFailed) {
      onNotice(
        'Your editor has an unsaved draft. Retry saving or export the Markdown before leaving.',
      )
      return
    }
    onBack()
  }
  const toc = headings(draft.body)
  const words = draft.body.trim().split(/\s+/).filter(Boolean).length
  return (
    <article className={`nt-editor ${focus ? 'is-focused' : ''}`}>
      <div className="nt-editor-top">
        <button className="nt-text-link" onClick={leave}>
          <IconArrowLeft size={16} />
          Back to {backLabel}
        </button>
        <Group gap="xs">
          <span className={`nt-save-state ${saveFailed ? 'is-error' : ''}`}>
            <IconCheck size={14} />
            {saveFailed ? 'Unsaved draft' : 'Saved on this device'}
          </span>
          <button
            className="nt-icon-button"
            aria-label={focus ? 'Exit focus mode' : 'Focus mode'}
            onClick={() => setFocus(!focus)}
          >
            {focus ? <IconX size={19} /> : <IconFocus2 size={19} />}
          </button>
        </Group>
      </div>
      {saveFailed && (
        <Alert color="red" mb="md">
          Your draft is still in the editor.
          <Button size="xs" ml="sm" onClick={() => save({})}>
            Retry save
          </Button>
          <Button
            size="xs"
            variant="light"
            ml="sm"
            onClick={() =>
              downloadFile('unsaved-note.md', `# ${draft.title}\n\n${draft.body}`, 'text/markdown')
            }
          >
            Export draft
          </Button>
        </Alert>
      )}
      {note.status !== 'active' && (
        <Alert mb="md" color={note.status === 'trash' ? 'orange' : 'gray'}>
          {note.status === 'trash' ? 'This note is in the trash.' : 'This note is archived.'}
          <Button
            size="xs"
            variant="light"
            ml="sm"
            disabled={blocked}
            onClick={() => onStatus(note, 'active')}
          >
            Restore note
          </Button>
          {note.status === 'trash' && (
            <Button
              size="xs"
              color="red"
              variant="subtle"
              ml="sm"
              disabled={blocked}
              onClick={onDelete}
            >
              Delete permanently
            </Button>
          )}
        </Alert>
      )}
      <div className="nt-editor-context">
        <Badge variant="light" color={notebook.color}>
          {notebook.title}
        </Badge>
        {note.lesson && <span>{note.lesson}</span>}
        <span>Edited {formatDate(note.updatedAt)}</span>
      </div>
      <input
        className="nt-title-input"
        aria-label="Note title"
        value={draft.title}
        maxLength={200}
        disabled={locked}
        onChange={(e) => save({ title: e.currentTarget.value })}
        onBlur={checkpoint}
        placeholder="Untitled note"
      />
      <div className="nt-editor-actions">
        <div className="nt-mode" aria-label="Editor mode">
          {(['write', 'read', 'split'] as const).map((v) => (
            <button
              key={v}
              aria-pressed={mode === v}
              onClick={() => {
                checkpoint()
                setMode(v)
              }}
            >
              {v === 'write' ? 'Write' : v === 'read' ? 'Read' : 'Split view'}
            </button>
          ))}
        </div>
        <Group gap={6}>
          <button
            className={`nt-action ${note.pinned ? 'is-active' : ''}`}
            aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
            disabled={locked}
            onClick={() => patch(note.id, { pinned: !note.pinned })}
          >
            <IconPin size={16} />
          </button>
          <button
            className="nt-action"
            onClick={() => setDetails(!details)}
            aria-expanded={details}
          >
            Details
          </button>
          <button className="nt-action" aria-label="Note history" onClick={() => setHistory(true)}>
            <IconHistory size={17} />
          </button>
          <button
            className="nt-action"
            aria-label="Export Markdown"
            onClick={() =>
              downloadFile(
                `${draft.title.replace(/[^\p{L}\p{N}\s_-]/gu, '').slice(0, 80) || 'note'}.md`,
                `# ${draft.title}\n\n${draft.body}`,
                'text/markdown',
              )
            }
          >
            <IconDownload size={17} />
          </button>
          <NoteActions
            note={note}
            disabled={blocked || saveFailed}
            onPin={() => patch(note.id, { pinned: !note.pinned })}
            onStatus={(status) => {
              checkpoint()
              if (!saveFailed && onStatus(note, status)) onBack()
            }}
            onDelete={onDelete}
          />
        </Group>
      </div>
      <TagsInput
        className="nt-editor-tags"
        label="Tags"
        description="Type a tag and press Enter or comma. Reuse existing tags from the suggestions."
        placeholder="Add tags…"
        data={[...new Set(library.notes.flatMap((n) => n.tags))].sort()}
        value={note.tags}
        maxTags={20}
        maxLength={40}
        disabled={locked}
        onChange={(tags) => patch(note.id, { tags: normalizeTags(tags) })}
      />
      {details && (
        <section className="nt-note-details">
          <Select
            label="Move to notebook"
            disabled={locked}
            value={note.notebookId}
            data={library.notebooks.map((b) => ({ value: b.id, label: b.title }))}
            onChange={(v) => v && patch(note.id, { notebookId: v })}
          />
          {notebook.kind === 'course' && (
            <TextInput
              label="Lesson / chapter"
              disabled={locked}
              value={note.lesson}
              maxLength={100}
              onChange={(e) => patch(note.id, { lesson: e.currentTarget.value })}
            />
          )}
          <TextInput
            label="Source URL or reference"
            disabled={locked}
            value={note.source}
            maxLength={2000}
            onChange={(e) => patch(note.id, { source: e.currentTarget.value })}
          />
          <TextInput
            type="date"
            label="Revisit on"
            disabled={locked}
            value={note.reviewDate}
            onChange={(e) => patch(note.id, { reviewDate: e.currentTarget.value })}
          />
        </section>
      )}
      {notebook.kind === 'course' && (
        <div className="nt-lesson-banner">
          <span>
            <IconBook2 size={18} />
            One lesson, one step forward.
          </span>
          <Button
            variant={note.completed ? 'light' : 'default'}
            size="xs"
            disabled={locked}
            leftSection={note.completed ? <IconCheck size={14} /> : null}
            onClick={() => patch(note.id, { completed: !note.completed })}
          >
            {note.completed ? 'Completed · mark incomplete' : 'Mark lesson complete'}
          </Button>
        </div>
      )}
      <div className={`nt-editor-content nt-${mode}`}>
        {mode !== 'read' && (
          <div className="nt-write-pane">
            <div className="nt-format-bar">
              <button disabled={locked} onClick={() => insert('**', '**')} aria-label="Insert bold">
                <strong>B</strong>
              </button>
              <button disabled={locked} onClick={() => insert('*', '*')} aria-label="Insert italic">
                <em>I</em>
              </button>
              <button disabled={locked} onClick={() => insert('\n## ')} aria-label="Insert heading">
                H2
              </button>
              <button
                disabled={locked}
                onClick={() => insert('\n- [ ] ')}
                aria-label="Insert checklist"
              >
                <IconChecklist size={16} />
              </button>
              <button
                disabled={locked}
                onClick={() => insert('\n```\n', '\n```')}
                aria-label="Insert code block"
              >
                &lt;/&gt;
              </button>
              <button
                disabled={locked}
                onClick={() => insert('[[', ']]')}
                aria-label="Insert note link"
              >
                [[↗]]
              </button>
              <span>Markdown</span>
            </div>
            <textarea
              ref={textarea}
              aria-label="Note body"
              value={draft.body}
              disabled={locked}
              maxLength={200000}
              onChange={(e) => save({ body: e.currentTarget.value })}
              onBlur={checkpoint}
              placeholder="Write something worth remembering…\n\nUse ## for headings, - [ ] for checklists, and [[Note title]] to connect ideas."
            />
          </div>
        )}
        {mode !== 'write' && (
          <div className="nt-read-pane">
            {toc.length > 2 && (
              <details className="nt-toc">
                <summary>On this page · {toc.length} sections</summary>
                {toc.map((h) => (
                  <a key={h.id} href={`#${h.id}`} style={{ paddingLeft: (h.depth - 1) * 12 }}>
                    {h.title}
                  </a>
                ))}
              </details>
            )}
            <NoteMarkdown
              body={draft.body}
              onLink={onLink}
              onTask={(line) => {
                if (!locked) save({ body: toggleTask(draft.body, line) })
              }}
            />
          </div>
        )}
      </div>
      <footer className="nt-editor-footer">
        <span>
          {words} words · {Math.max(1, Math.ceil(words / 200))} min read
        </span>
        <span>{note.tags.map((t) => `#${t}`).join('  ')}</span>
      </footer>
      <details className="nt-learning-section" open={notebook.kind === 'course' || undefined}>
        <summary>Learning tools · review cards & focus timer</summary>
        <section className="nt-learning-tools">
          <div>
            <IconSparkles size={22} />
            <h3>Make it stick.</h3>
            <p>Turn an idea into a question. Come back and see what you remember.</p>
            <Button variant="light" size="sm" disabled={locked} onClick={() => setCardModal(true)}>
              Add review card
            </Button>
          </div>
          <FocusTimer />
        </section>
      </details>
      {safeUrl(note.source) && (
        <a
          className="nt-source-link"
          href={safeUrl(note.source)!}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open original source <IconArrowUpRight size={15} />
        </a>
      )}
      {backlinkNotes.length > 0 && (
        <section className="nt-backlinks">
          <h3>Notes that link here</h3>
          {backlinkNotes.map((n) => (
            <button key={n.id} onClick={() => onOpen(n)}>
              {n.title}
              <IconArrowUpRight size={15} />
            </button>
          ))}
        </section>
      )}
      <Modal
        closeButtonProps={{ 'aria-label': 'Close' }}
        opened={history}
        onClose={() => setHistory(false)}
        title="Previous versions"
        size="lg"
      >
        <Text size="sm" c="dimmed" mb="md">
          The last 12 editing checkpoints. Restoring saves your current version first.
        </Text>
        {!note.revisions.length && (
          <Text size="sm">Versions appear after you edit and leave a field.</Text>
        )}
        {note.revisions.map((r, i) => (
          <div className="nt-revision" key={`${r.at}-${i}`}>
            <strong>{r.title || 'Untitled note'}</strong>
            <small>{new Date(r.at).toLocaleString()}</small>
            <p>{plainText(r.body).slice(0, 140)}</p>
            <Button
              size="xs"
              variant="light"
              disabled={locked}
              onClick={() => {
                if (
                  commit((l) => ({
                    ...l,
                    notes: l.notes.map((n) =>
                      n.id === note.id
                        ? {
                            ...n,
                            title: r.title,
                            body: r.body,
                            updatedAt: Date.now(),
                            revisions: [
                              { title: draft.title, body: draft.body, at: Date.now() },
                              ...n.revisions,
                            ].slice(0, 12),
                          }
                        : n,
                    ),
                  }))
                ) {
                  setDraft({ title: r.title, body: r.body })
                  setSaveFailed(false)
                  onDraft(null)
                  snapshot.current = { title: r.title, body: r.body }
                  setHistory(false)
                }
              }}
            >
              Restore this version
            </Button>
          </div>
        ))}
      </Modal>
      <Modal
        closeButtonProps={{ 'aria-label': 'Close' }}
        opened={cardModal}
        onClose={() => setCardModal(false)}
        title="A question for your future self"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!question.trim() || !answer.trim()) return
            const card: ReviewCard = {
              id: crypto.randomUUID(),
              noteId: note.id,
              question: question.trim(),
              answer: answer.trim(),
              dueAt: Date.now(),
              interval: 0,
              reviews: 0,
            }
            if (commit((l) => ({ ...l, cards: [...l.cards, card] }))) {
              setQuestion('')
              setAnswer('')
              setCardModal(false)
              onNotice('Review card added. Find it in Review when you’re ready.')
            }
          }}
        >
          <Stack>
            <Textarea
              label="Question"
              required
              maxLength={2000}
              value={question}
              onChange={(e) => setQuestion(e.currentTarget.value)}
              autosize
              minRows={2}
            />
            <Textarea
              label="Answer"
              required
              maxLength={10000}
              value={answer}
              onChange={(e) => setAnswer(e.currentTarget.value)}
              autosize
              minRows={3}
            />
            <Button type="submit">Save review card</Button>
          </Stack>
        </form>
      </Modal>
    </article>
  )
}
function FocusTimer() {
  const [remaining, setRemaining] = useState(25 * 60)
  const [deadline, setDeadline] = useState<number | null>(null)
  useEffect(() => {
    if (!deadline) return
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setRemaining(seconds)
      if (!seconds) setDeadline(null)
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [deadline])
  return (
    <div className="nt-timer">
      <span>
        <IconClock size={16} />A little focused time
      </span>
      <strong aria-live={remaining === 0 ? 'polite' : 'off'}>
        {Math.floor(remaining / 60)
          .toString()
          .padStart(2, '0')}
        :{(remaining % 60).toString().padStart(2, '0')}
      </strong>
      <small>
        {remaining
          ? 'One thing at a time. You’ve got this.'
          : 'Session complete. Take a short break.'}
      </small>
      <Group gap="xs">
        <Button
          size="xs"
          variant="default"
          onClick={() => {
            if (deadline) {
              setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
              setDeadline(null)
            } else {
              const duration = remaining || 25 * 60
              setRemaining(duration)
              setDeadline(Date.now() + duration * 1000)
            }
          }}
        >
          {deadline ? 'Pause timer' : 'Start focus timer'}
        </Button>
        <Button
          size="xs"
          variant="subtle"
          onClick={() => {
            setDeadline(null)
            setRemaining(25 * 60)
          }}
        >
          Reset
        </Button>
      </Group>
    </div>
  )
}
function ReviewPanel({
  cards,
  notes,
  library,
  commit,
  onOpen,
}: {
  cards: ReviewCard[]
  notes: Note[]
  library: NotesLibrary
  commit: Commit
  onOpen: (note: Note) => void
}) {
  const [revealed, setRevealed] = useState<string | null>(null)
  const [reviewed, setReviewed] = useState(0)
  const card = cards[0]
  const [manage, setManage] = useState(false)
  const allCards = library.cards.filter((c) =>
    library.notes.some((n) => n.id === c.noteId && n.status === 'active'),
  )
  return (
    <div className="nt-review-panel">
      <div className="nt-list-heading">
        <h3>Practice remembering</h3>
        <Button variant="subtle" size="xs" onClick={() => setManage(!manage)}>
          {manage ? 'Close card library' : `Manage cards (${allCards.length})`}
        </Button>
      </div>
      {manage && (
        <div className="nt-card-library">
          {allCards.map((c) => (
            <div key={c.id}>
              <strong>{c.question}</strong>
              <small>
                Due {formatDate(c.dueAt)} · {c.reviews} reviews
              </small>
              <Button
                variant="subtle"
                size="xs"
                color="red"
                onClick={() =>
                  commit((l) => ({ ...l, cards: l.cards.filter((item) => item.id !== c.id) }))
                }
              >
                Remove card
              </Button>
            </div>
          ))}
        </div>
      )}
      {card ? (
        <section className="nt-review-card">
          <span className="nt-eyebrow">{cards.length} CARDS READY · ACTIVE RECALL</span>
          <h3>{card.question}</h3>
          <p className="nt-muted">{library.notes.find((n) => n.id === card.noteId)?.title}</p>
          {revealed === card.id ? (
            <>
              <div className="nt-review-answer">{card.answer}</div>
              <p>How well did you remember?</p>
              <Group justify="center">
                <Button color="orange" variant="light" onClick={() => rate('again')}>
                  Again · 10 min
                </Button>
                <Button variant="light" onClick={() => rate('good')}>
                  Got it
                </Button>
                <Button onClick={() => rate('easy')}>Easy</Button>
              </Group>
            </>
          ) : (
            <Button onClick={() => setRevealed(card.id)}>Reveal answer</Button>
          )}
        </section>
      ) : (
        <Empty
          title="You’re all caught up"
          text="Add a review card from any note. Cards return after 1 or 3 days, then at longer intervals as you learn."
          action={() => {
            const n = library.notes.find((n) => n.status === 'active')
            if (n) onOpen(n)
          }}
          label="Open a note to add a card"
        />
      )}
      <p className="nt-muted">{reviewed} cards reviewed this session</p>
      {notes.length > 0 && (
        <section>
          <h3>Notes to revisit</h3>
          {notes.map((n) => (
            <div className="nt-due-note" key={n.id}>
              <button onClick={() => onOpen(n)}>
                {n.title}
                <small>Revisit {n.reviewDate}</small>
              </button>
              <Button
                variant="light"
                size="xs"
                onClick={() =>
                  commit((l) => ({
                    ...l,
                    notes: l.notes.map((item) =>
                      item.id === n.id ? { ...item, reviewDate: '', updatedAt: Date.now() } : item,
                    ),
                  }))
                }
              >
                Done
              </Button>
            </div>
          ))}
        </section>
      )}
    </div>
  )
  function rate(rating: 'again' | 'good' | 'easy') {
    if (!card) return
    if (
      commit((l) => ({
        ...l,
        cards: l.cards.map((c) => (c.id === card.id ? scheduleCard(c, rating) : c)),
      }))
    ) {
      setRevealed(null)
      setReviewed(reviewed + 1)
    }
  }
}
