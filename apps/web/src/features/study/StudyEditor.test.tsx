import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CourseEditor, StudyEditor } from './StudyEditor'
import { Markdown } from './Markdown'
import { newNote, starterLibrary } from './study-lib'
import { processTranscript } from './study-api'
// Test editor state with native controls; the E2E suite covers Mantine's dialogs and widgets.
vi.mock('@mantine/core', () => ({
  Modal: ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div>,
  Button: ({
    children,
    onClick,
    disabled,
    loading,
  }: React.ComponentProps<'button'> & { loading?: boolean }) => (
    <button onClick={onClick} disabled={disabled || loading}>
      {children}
    </button>
  ),
  Alert: ({ children }: { children: React.ReactNode }) => <div role="alert">{children}</div>,
  TextInput: ({ label, value, onChange }: React.ComponentProps<'input'> & { label: string }) => (
    <label>
      {label}
      <input value={value} onChange={onChange} />
    </label>
  ),
  Textarea: ({ label, value, onChange }: React.ComponentProps<'textarea'> & { label: string }) => (
    <label>
      {label}
      <textarea value={value} onChange={onChange} />
    </label>
  ),
  Select: ({
    label,
    value,
    onChange,
    data,
  }: {
    label?: string
    value: string
    onChange: (value: string) => void
    data: Array<string | { value: string; label: string }>
  }) => (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {data.map((item) =>
          typeof item === 'string' ? (
            <option key={item}>{item}</option>
          ) : (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ),
        )}
      </select>
    </label>
  ),
}))
vi.mock('./study-api', () => ({
  processTranscript: vi.fn(),
  aiError: (error: Error) => error.message,
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
const wrapper = ({ children }: { children: React.ReactNode }) => <>{children}</>

describe('study editor', () => {
  it('preserves the transcript and never saves automatically after a failed AI request', async () => {
    vi.mocked(processTranscript).mockRejectedValue(new Error('AI key is not configured'))
    const onSave = vi.fn(),
      onClose = vi.fn()
    const transcript = 'This is a lesson about vector embeddings and retrieval. '.repeat(4)
    render(
      <StudyEditor
        initial={newNote('ai')}
        courses={starterLibrary().courses}
        transcriptMode
        onSave={onSave}
        onClose={onClose}
      />,
      { wrapper },
    )
    fireEvent.change(screen.getByLabelText('Lesson transcript'), { target: { value: transcript } })
    fireEvent.click(screen.getByText('Generate study notes'))
    await screen.findByText('AI key is not configured')
    expect(screen.getByLabelText('Lesson transcript')).toHaveValue(transcript)
    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
  it('makes AI output an editable draft until explicit save', async () => {
    vi.mocked(processTranscript).mockResolvedValue({
      title: 'Embeddings',
      summary: 'A vector representation.',
      markdown: '## Meaning\n\nVectors represent text.',
      tags: ['embeddings'],
      flashcards: [{ question: 'What is an embedding?', answer: 'A vector representation.' }],
    })
    const onSave = vi.fn().mockReturnValue(true),
      onClose = vi.fn()
    render(
      <StudyEditor
        initial={newNote('ai')}
        courses={starterLibrary().courses}
        transcriptMode
        onSave={onSave}
        onClose={onClose}
      />,
      { wrapper },
    )
    fireEvent.change(screen.getByLabelText('Lesson transcript'), {
      target: { value: 'Embeddings represent text as numerical vectors. '.repeat(4) },
    })
    fireEvent.click(screen.getByText('Generate study notes'))
    await waitFor(() =>
      expect(screen.getByText('Reading preview')).toHaveAttribute('aria-selected', 'true'),
    )
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Lesson title'), {
      target: { value: 'My edited lesson' },
    })
    fireEvent.click(screen.getByText('Save lesson + 1 cards'))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'My edited lesson',
        body: '## Meaning\n\nVectors represent text.',
      }),
      expect.arrayContaining([expect.objectContaining({ question: 'What is an embedding?' })]),
    )
    expect(onClose).toHaveBeenCalledOnce()
  })
  it('renders hostile source content as text rather than executable HTML or links', () => {
    const { container } = render(
      <Markdown
        text={
          '<img src=x onerror=alert(1)>\n\n[unsafe](javascript:alert(1))\n\n```html\n<script>alert(1)</script>\n```'
        }
      />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('a')).toBeNull()
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeVisible()
  })
  it('does not invent a course when the title is blank', () => {
    const onSave = vi.fn()
    render(<CourseEditor onSave={onSave} onClose={vi.fn()} />, { wrapper })
    fireEvent.click(screen.getByText('Save course'))
    expect(screen.getByText('Give your course a title.')).toBeVisible()
    expect(onSave).not.toHaveBeenCalled()
  })
})
