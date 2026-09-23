import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TVCardGrid } from './TVCardGrid'
import { TVFocusProvider, useTVFocusable } from './TVFocusProvider'

function FocusButton({ label, rect }: { label: string; rect: Partial<DOMRect> }) {
  const focusable = useTVFocusable()
  return (
    <button
      type="button"
      aria-label={label}
      ref={(node) => {
        if (!node) return
        const box = {
          left: 0,
          top: 0,
          width: 100,
          height: 100,
          right: 100,
          bottom: 100,
          x: 0,
          y: 0,
          toJSON: () => ({}),
          ...rect,
        } as DOMRect
        vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(box)
        vi.spyOn(node, 'getClientRects').mockReturnValue({
          0: box,
          length: 1,
          item: () => box,
        } as unknown as DOMRectList)
      }}
      {...focusable}
    >
      {label}
    </button>
  )
}

describe('TVCardGrid and focus navigation', () => {
  it('keeps the requested layout count and moves focus by physical geometry', async () => {
    render(
      <TVFocusProvider>
        <div data-tv-focus-root="true">
          <TVCardGrid>
            <FocusButton label="one" rect={{ left: 0, right: 100 }} />
            <FocusButton label="two" rect={{ left: 200, right: 300 }} />
            <FocusButton label="three" rect={{ left: 0, right: 100, top: 200, bottom: 300 }} />
            <FocusButton label="four" rect={{ left: 200, right: 300, top: 200, bottom: 300 }} />
          </TVCardGrid>
        </div>
      </TVFocusProvider>,
    )
    const one = screen.getByRole('button', { name: 'one' })
    await waitFor(() => expect(one).toHaveFocus())
    fireEvent.keyDown(one, { key: 'ArrowRight' })
    expect(screen.getByRole('button', { name: 'two' })).toHaveFocus()
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(screen.getByRole('button', { name: 'four' })).toHaveFocus()
    expect(one.closest('.tv-card-grid')).toHaveAttribute('data-count', '4')
  })
})
