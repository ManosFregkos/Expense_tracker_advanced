import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { headings, NoteMarkdown } from './NoteMarkdown'

describe('safe note reading', () => {
  it('shows HTML as text, prevents unsafe links, and preserves code as code', () => {
    const { container } = render(
      <NoteMarkdown
        body={
          '<img src=x onerror=alert(1)>\n[unsafe](javascript:alert)\n[safe](https://example.com)\n```html\n<script>alert(1)</script>\n```'
        }
        onTask={vi.fn()}
        onLink={vi.fn()}
      />,
    )
    expect(container.querySelector('img,script')).toBeNull()
    expect(screen.queryByRole('link', { name: 'unsafe' })).toBeNull()
    expect(screen.getByRole('link', { name: 'safe' })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(container.querySelector('pre code')).toHaveTextContent('<script>alert(1)</script>')
  })
  it('connects wiki links and invokes checkboxes using source line positions', () => {
    const onTask = vi.fn()
    const onLink = vi.fn()
    render(
      <NoteMarkdown
        body={'## Tasks\n\n- [ ] Build a counter\n\nSee [[Understanding hooks]]'}
        onTask={onTask}
        onLink={onLink}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Build a counter' }))
    expect(onTask).toHaveBeenCalledWith(2)
    fireEvent.click(screen.getByRole('button', { name: 'Understanding hooks' }))
    expect(onLink).toHaveBeenCalledWith('Understanding hooks')
  })
  it('excludes headings in code blocks from the reading outline', () => {
    expect(headings('## Real\n```md\n## Example\n```\n### Next')).toEqual([
      { id: 'heading-0', title: 'Real', depth: 2 },
      { id: 'heading-4', title: 'Next', depth: 3 },
    ])
  })
})
