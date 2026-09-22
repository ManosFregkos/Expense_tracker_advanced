import { describe, expect, it } from 'vitest'
import { mapTVKey, nextTVFocus } from './tv'

describe('TV navigation', () => {
  it('maps standard and common TV back keys centrally', () => {
    expect(mapTVKey({ key: 'Enter', keyCode: 13 } as KeyboardEvent)).toBe('activate')
    expect(mapTVKey({ key: 'Escape', keyCode: 27 } as KeyboardEvent)).toBe('back')
    expect(mapTVKey({ key: 'Unidentified', keyCode: 10009 } as KeyboardEvent)).toBe('back')
  })
  it('skips hidden focus targets', () => {
    const current = document.createElement('button'),
      visible = document.createElement('button'),
      hidden = document.createElement('button')
    document.body.append(current, visible, hidden)
    Object.defineProperty(current, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 50, height: 50 }),
    })
    Object.defineProperty(visible, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 0, width: 50, height: 50 }),
    })
    Object.defineProperty(hidden, 'getBoundingClientRect', {
      value: () => ({ left: 60, top: 0, width: 50, height: 50 }),
    })
    Object.defineProperty(visible, 'getClientRects', { value: () => [{}] })
    Object.defineProperty(hidden, 'getClientRects', { value: () => [], configurable: true })
    expect(nextTVFocus(current, [hidden, visible], 'right')).toBe(visible)
    hidden.style.visibility = 'hidden'
    Object.defineProperty(hidden, 'getClientRects', { value: () => [{}] })
    expect(nextTVFocus(current, [hidden, visible], 'right')).toBe(visible)
    current.remove()
    visible.remove()
    hidden.remove()
  })
})
