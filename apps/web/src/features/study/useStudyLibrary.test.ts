import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useStudyLibrary } from './useStudyLibrary'
import { newNote, starterLibrary, storageKey } from './study-lib'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})
describe('study persistence', () => {
  it('keeps accounts isolated and preserves the library across reloads', () => {
    const alice = renderHook(() => useStudyLibrary('alice'))
    const note = { ...newNote('ai'), title: 'Private lesson', body: 'My personal note.' }
    act(() => {
      expect(alice.result.current.commit((l) => ({ ...l, notes: [...l.notes, note] }))).toBe(true)
    })
    const bob = renderHook(() => useStudyLibrary('bob'))
    expect(bob.result.current.library.notes.some((n) => n.id === note.id)).toBe(false)
    alice.unmount()
    const reopened = renderHook(() => useStudyLibrary('alice'))
    expect(reopened.result.current.library.notes.find((n) => n.id === note.id)?.body).toBe(
      'My personal note.',
    )
  })
  it('uses the latest stored library before a write so another tab’s note is preserved', () => {
    const hook = renderHook(() => useStudyLibrary('alice'))
    const other = starterLibrary()
    const note = { ...newNote('rag'), title: 'Other tab note', body: 'Saved elsewhere.' }
    localStorage.setItem(
      storageKey('alice'),
      JSON.stringify({ ...other, notes: [...other.notes, note] }),
    )
    act(() => {
      hook.result.current.commit((l) => ({
        ...l,
        courses: l.courses.map((c) => (c.id === 'ai' ? { ...c, title: 'Updated course' } : c)),
      }))
    })
    expect(hook.result.current.library.notes.some((n) => n.id === note.id)).toBe(true)
  })
  it('blocks corrupt data until an explicit recovery operation', () => {
    localStorage.setItem(storageKey('alice'), 'broken')
    const hook = renderHook(() => useStudyLibrary('alice'))
    act(() => {
      expect(hook.result.current.commit(() => starterLibrary())).toBe(false)
    })
    expect(localStorage.getItem(storageKey('alice'))).toBe('broken')
    act(() => {
      expect(hook.result.current.commit(() => starterLibrary(), true)).toBe(true)
    })
    expect(hook.result.current.error).toBeNull()
  })
  it('preserves the last saved library when storage fills up, and permits retry', () => {
    const hook = renderHook(() => useStudyLibrary('alice'))
    act(() => {
      hook.result.current.commit((l) => l)
    })
    const before = localStorage.getItem(storageKey('alice'))
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('Full', 'QuotaExceededError')
    })
    act(() => {
      expect(hook.result.current.commit((l) => ({ ...l, notes: [], cards: [] }))).toBe(false)
    })
    expect(localStorage.getItem(storageKey('alice'))).toBe(before)
    expect(hook.result.current.error).toContain('could not be saved')
    act(() => {
      expect(hook.result.current.commit((l) => l)).toBe(true)
    })
    expect(hook.result.current.error).toBeNull()
  })
})
