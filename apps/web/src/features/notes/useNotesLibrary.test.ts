import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createNote, initialLibrary, librarySchema } from './notes-lib'
import { storageKey, useNotesLibrary } from './useNotesLibrary'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})
describe('private notes persistence', () => {
  it('persists across reopening and isolates accounts', () => {
    const alice = renderHook(() => useNotesLibrary('alice'))
    const note = createNote('personal')
    act(() => {
      expect(alice.result.current.commit((l) => ({ ...l, notes: [note] }))).toBe(true)
    })
    const bob = renderHook(() => useNotesLibrary('bob'))
    expect(bob.result.current.library.notes).toEqual([])
    const reopened = renderHook(() => useNotesLibrary('alice'))
    expect(reopened.result.current.library.notes[0]).toEqual(note)
  })
  it('reads the latest storage before a change so another tab’s notes survive', () => {
    const hook = renderHook(() => useNotesLibrary('alice'))
    const external = createNote('personal')
    localStorage.setItem(
      storageKey('alice'),
      JSON.stringify({ ...initialLibrary(), notes: [external] }),
    )
    const own = createNote('personal')
    act(() => {
      hook.result.current.commit((l) => ({ ...l, notes: [...l.notes, own] }))
    })
    expect(hook.result.current.library.notes).toHaveLength(2)
    const updated = {
      ...hook.result.current.library,
      notes: [{ ...external, title: 'External edit' }, own],
    }
    localStorage.setItem(storageKey('alice'), JSON.stringify(updated))
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: storageKey('alice') }))
    })
    expect(hook.result.current.library.notes[0]!.title).toBe('External edit')
  })
  it('protects corrupt saved data until explicit recovery', () => {
    localStorage.setItem(storageKey('alice'), '{broken')
    const hook = renderHook(() => useNotesLibrary('alice'))
    expect(hook.result.current.blocked).toBe(true)
    act(() => {
      expect(hook.result.current.commit(() => initialLibrary())).toBe(false)
    })
    expect(localStorage.getItem(storageKey('alice'))).toBe('{broken')
    act(() => {
      expect(hook.result.current.commit(() => initialLibrary(), true)).toBe(true)
    })
    expect(hook.result.current.blocked).toBe(false)
  })
  it('does not report a failed storage write as saved or discard the saved library', () => {
    const hook = renderHook(() => useNotesLibrary('alice'))
    const note = createNote('personal')
    act(() => {
      hook.result.current.commit((l) => ({ ...l, notes: [note] }))
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    act(() => {
      expect(hook.result.current.commit((l) => ({ ...l, notes: [] }))).toBe(false)
    })
    expect(hook.result.current.library.notes).toHaveLength(1)
    expect(hook.result.current.error).toContain('could not be saved')
    expect(
      librarySchema.parse(JSON.parse(localStorage.getItem(storageKey('alice'))!)).notes,
    ).toHaveLength(1)
  })
})
