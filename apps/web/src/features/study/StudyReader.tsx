import { useEffect, useState } from 'react'
import { Button, Tooltip } from '@mantine/core'
import {
  IconArrowLeft,
  IconCheck,
  IconEdit,
  IconStar,
  IconDownload,
  IconMaximize,
  IconMinimize,
  IconPlus,
  IconClock,
  IconPlayerPause,
  IconPlayerPlay,
  IconRefresh,
  IconExternalLink,
} from '@tabler/icons-react'
import type { StudyNote, StudyCourse } from '@family-expense-tracker/shared'
import { Markdown, headings } from './Markdown'
import { exportFile, minutes, noteMarkdown, safeUrl } from './study-lib'

function FocusTimer() {
  const [remaining, setRemaining] = useState(25 * 60)
  const [deadline, setDeadline] = useState<number | null>(null)
  useEffect(() => {
    if (!deadline) return
    const tick = () => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setRemaining(next)
      if (!next) setDeadline(null)
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [deadline])
  return (
    <div className="st-timer">
      <IconClock size={16} />
      <span aria-live={remaining === 0 ? 'polite' : 'off'}>
        {remaining === 0
          ? 'Session complete!'
          : `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`}
      </span>
      <button
        aria-label={deadline ? 'Pause focus timer' : 'Start focus timer'}
        onClick={() =>
          deadline ? setDeadline(null) : setDeadline(Date.now() + (remaining || 1500) * 1000)
        }
      >
        {deadline ? <IconPlayerPause size={15} /> : <IconPlayerPlay size={15} />}
      </button>
      <button
        aria-label="Reset focus timer"
        onClick={() => {
          setDeadline(null)
          setRemaining(1500)
        }}
      >
        <IconRefresh size={15} />
      </button>
    </div>
  )
}
export function StudyReader({
  note,
  course,
  related,
  onBack,
  onEdit,
  onUpdate,
  onOpen,
  onCard,
}: {
  note: StudyNote
  course: StudyCourse | undefined
  related: StudyNote[]
  onBack: () => void
  onEdit: () => void
  onUpdate: (patch: Partial<StudyNote>) => void
  onOpen: (id: string) => void
  onCard: () => void
}) {
  const [focus, setFocus] = useState(false)
  const [fontSize, setFontSize] = useState(17)
  const toc = headings(note.body)
  const sourceUrl = safeUrl(note.source)
  useEffect(() => {
    if (!focus) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocus(false)
    }
    window.addEventListener('keydown', escape, true)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', escape, true)
    }
  }, [focus])
  return (
    <div className={`st-reader ${focus ? 'is-focused' : ''}`}>
      <div className="st-reader-toolbar">
        <button className="st-text-button" onClick={onBack}>
          <IconArrowLeft size={17} /> All notes
        </button>
        <FocusTimer />
        <div className="st-reader-actions">
          <Tooltip label="Smaller text">
            <button
              aria-label="Smaller text"
              onClick={() => setFontSize((n) => Math.max(14, n - 1))}
            >
              A−
            </button>
          </Tooltip>
          <Tooltip label="Larger text">
            <button
              aria-label="Larger text"
              onClick={() => setFontSize((n) => Math.min(23, n + 1))}
            >
              A+
            </button>
          </Tooltip>
          <Tooltip label={focus ? 'Exit focus mode' : 'Focus mode'}>
            <button
              aria-label={focus ? 'Exit focus mode' : 'Focus mode'}
              onClick={() => setFocus(!focus)}
            >
              {focus ? <IconMinimize size={19} /> : <IconMaximize size={19} />}
            </button>
          </Tooltip>
          <Tooltip label="Export Markdown">
            <button
              aria-label="Export Markdown"
              onClick={() =>
                exportFile(
                  `${note.title.replace(/[^\p{L}\p{N} -]/gu, '') || 'lesson'}.md`,
                  noteMarkdown(note, course),
                  'text/markdown',
                )
              }
            >
              <IconDownload size={19} />
            </button>
          </Tooltip>
          <Button
            variant="light"
            color="violet"
            size="xs"
            leftSection={<IconEdit size={15} />}
            onClick={onEdit}
          >
            Edit
          </Button>
        </div>
      </div>
      <div className="st-reader-grid">
        <aside className="st-reader-toc">
          <span className="st-eyebrow">IN THIS LESSON</span>
          {toc.map((h) => (
            <a key={h.id} href={`#${h.id}`} style={{ paddingLeft: h.level > 2 ? 16 : 0 }}>
              {h.text.replace(/\*\*/g, '')}
            </a>
          ))}
          {!toc.length && <p>Add Markdown headings to organize your lesson.</p>}
        </aside>
        <article className="st-reader-article" style={{ fontSize }}>
          <div className={`st-course-label ${course?.color ?? 'violet'}`}>{course?.title}</div>
          <h1>{note.title}</h1>
          <div className="st-reader-meta">
            <span>
              <IconClock size={15} />
              {minutes(note.body)} min read
            </span>
            <span>
              Updated{' '}
              {new Date(note.updatedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </span>
            <button
              className={note.starred ? 'is-starred' : ''}
              onClick={() => onUpdate({ starred: !note.starred })}
              aria-label={note.starred ? 'Remove bookmark' : 'Bookmark note'}
            >
              <IconStar size={16} fill={note.starred ? 'currentColor' : 'none'} />
              {note.starred ? 'Bookmarked' : 'Bookmark'}
            </button>
          </div>
          {note.summary && (
            <div className="st-summary">
              <span className="st-eyebrow">AT A GLANCE</span>
              <p>{note.summary}</p>
            </div>
          )}
          <Markdown text={note.body} />
          <div className="st-reader-end">
            <p>Make it stick.</p>
            <span>Close the notes and explain the big idea in your own words.</span>
            <div>
              <Button
                color="violet"
                variant={note.completed ? 'light' : 'filled'}
                leftSection={<IconCheck size={17} />}
                onClick={() => onUpdate({ completed: !note.completed })}
              >
                {note.completed ? 'Read · mark unread' : 'Mark as read'}
              </Button>
              <Button variant="default" leftSection={<IconPlus size={16} />} onClick={onCard}>
                Make a review card
              </Button>
            </div>
          </div>
          {note.transcript && (
            <details className="st-transcript">
              <summary>Original transcript</summary>
              <pre>{note.transcript}</pre>
            </details>
          )}
          <div className="st-source">
            Source:{' '}
            {sourceUrl ? (
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                Open lesson <IconExternalLink size={13} />
              </a>
            ) : (
              note.source || 'Personal notes'
            )}
          </div>
        </article>
        <aside className="st-reader-related">
          <span className="st-eyebrow">TOPICS</span>
          <div className="st-tags">
            {note.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <span className="st-eyebrow">CONNECTED NOTES</span>
          {related.slice(0, 5).map((n) => (
            <button key={n.id} onClick={() => onOpen(n.id)}>
              {n.title}
              <span>{minutes(n.body)} min read →</span>
            </button>
          ))}
          {!related.length && <p>Add matching topic tags to connect lessons across courses.</p>}
        </aside>
      </div>
    </div>
  )
}
