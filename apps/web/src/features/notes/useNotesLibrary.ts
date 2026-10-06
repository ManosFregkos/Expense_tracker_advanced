import { useCallback, useEffect, useRef, useState } from 'react'
import { initialLibrary, librarySchema, type NotesLibrary } from './notes-lib'

export function storageKey(uid: string) {
  return `everyday-notes.v1.${uid}`
}
function read(key: string): { library: NotesLibrary; error: string } {
  try {
    const raw = localStorage.getItem(key)
    return { library: raw ? librarySchema.parse(JSON.parse(raw)) : initialLibrary(), error: '' }
  } catch {
    return {
      library: initialLibrary(),
      error:
        'Your saved library could not be opened. Download the recovery file before importing a backup. Editing is paused to protect your data.',
    }
  }
}
export function useNotesLibrary(uid: string) {
  const key = storageKey(uid)
  const [state, setState] = useState(() => read(key))
  const current = useRef(state)
  const [saveError, setSaveError] = useState('')
  useEffect(() => {
    const refresh = () => {
      const next = read(key)
      current.current = next
      setState(next)
    }
    refresh()
    const handler = (event: StorageEvent) => {
      if (event.key === key || event.key === null) refresh()
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [key])
  const commit = useCallback(
    (update: (library: NotesLibrary) => NotesLibrary, recover = false) => {
      const latest = read(key)
      if (latest.error && !recover) {
        current.current = latest
        setState(latest)
        return false
      }
      try {
        const next = librarySchema.parse(update(latest.library))
        localStorage.setItem(key, JSON.stringify(next))
        current.current = { library: next, error: '' }
        setState(current.current)
        setSaveError('')
        return true
      } catch {
        setSaveError(
          'This change could not be saved. Your last saved version is intact. Export a backup, free browser storage, and try again.',
        )
        return false
      }
    },
    [key],
  )
  return {
    library: state.library,
    error: state.error || saveError,
    blocked: Boolean(state.error),
    commit,
    key,
  }
}
