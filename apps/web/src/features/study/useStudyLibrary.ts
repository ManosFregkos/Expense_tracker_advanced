import { useEffect, useRef, useState } from 'react'
import { studyLibrarySchema, type StudyLibrary } from '@family-expense-tracker/shared'
import { readLibrary, storageKey } from './study-lib'

export function useStudyLibrary(uid: string) {
  const key = storageKey(uid)
  const [loaded, setLoaded] = useState(() => {
    const value = readLibrary(key)
    return { ...value, blocked: Boolean(value.error) }
  })
  const libraryRef = useRef(loaded.library)
  libraryRef.current = loaded.library
  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === key || event.key === null) {
        const value = readLibrary(key)
        setLoaded({ ...value, blocked: Boolean(value.error) })
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [key])
  function commit(update: (library: StudyLibrary) => StudyLibrary, recover = false) {
    let current = libraryRef.current
    let blocked = loaded.blocked
    try {
      if (blocked && !recover)
        throw new Error(
          'Restore a valid backup before changing this library. Export the unreadable stored data first.',
        )
      const raw = localStorage.getItem(key)
      if (raw && !recover) {
        try {
          current = studyLibrarySchema.parse(JSON.parse(raw))
        } catch {
          blocked = true
          throw new Error(
            'Stored data could not be read. Export it for recovery before restoring a valid backup.',
          )
        }
      }
      const next = studyLibrarySchema.parse(update(current))
      localStorage.setItem(key, JSON.stringify(next))
      libraryRef.current = next
      setLoaded({ library: next, error: null, blocked: false })
      return true
    } catch (error) {
      setLoaded({
        library: current,
        blocked,
        error:
          error instanceof Error && error.name !== 'QuotaExceededError' && error.name !== 'ZodError'
            ? error.message
            : 'Your changes could not be saved. Browser storage may be full or unavailable. Export a backup before trying again.',
      })
      return false
    }
  }
  return { ...loaded, key, commit }
}
