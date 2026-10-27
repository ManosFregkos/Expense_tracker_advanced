import { useEffect, useRef, useState } from 'react'
import { JARVIS_AUDIO_MAX_BYTES } from '@family-expense-tracker/shared'

export function useCommandRecording(
  onRecording: (audio: Blob, isCurrent: () => boolean) => Promise<void>,
  onError: (error: unknown) => void,
) {
  const [stage, setStage] = useState<'idle' | 'requesting' | 'recording' | 'transcribing'>('idle')
  const state = useRef(stage)
  const generation = useRef(0)
  const cleanup = useRef<() => void>(() => undefined)
  const recorder = useRef<MediaRecorder | null>(null)
  const callbacks = useRef({ onRecording, onError })
  callbacks.current = { onRecording, onError }
  const supported = Boolean(
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined',
  )
  const update = (next: typeof stage) => {
    state.current = next
    setStage(next)
  }
  const cancel = () => {
    generation.current += 1
    cleanup.current()
    recorder.current = null
    update('idle')
  }
  const finish = () => {
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }
  const start = async () => {
    if (state.current !== 'idle') return
    if (!supported) {
      callbacks.current.onError(
        new Error('Audio recording is unavailable in this browser. You can still type.'),
      )
      return
    }
    const version = ++generation.current
    update('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      if (version !== generation.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      )
      let current: MediaRecorder
      try {
        current = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      } catch (error) {
        stream.getTracks().forEach((track) => track.stop())
        throw error
      }
      recorder.current = current
      const chunks: Blob[] = []
      let size = 0
      const timeout: { id?: ReturnType<typeof setTimeout> } = {}
      cleanup.current = () => {
        clearTimeout(timeout.id)
        current.ondataavailable = null
        current.onstop = null
        current.onerror = null
        if (current.state !== 'inactive') current.stop()
        stream.getTracks().forEach((track) => track.stop())
        chunks.length = 0
      }
      current.ondataavailable = (event) => {
        if (version !== generation.current || !event.data.size) return
        size += event.data.size
        if (size > JARVIS_AUDIO_MAX_BYTES) {
          cancel()
          callbacks.current.onError(new Error('Recording is too large. Try a shorter command.'))
          return
        }
        chunks.push(event.data)
      }
      current.onerror = () => {
        cancel()
        callbacks.current.onError(
          new Error('Recording failed. Check the microphone and try again.'),
        )
      }
      current.onstop = () => {
        clearTimeout(timeout.id)
        stream.getTracks().forEach((track) => track.stop())
        if (version !== generation.current) return
        const blob = new Blob(chunks, { type: current.mimeType.split(';')[0] || 'audio/webm' })
        chunks.length = 0
        if (!blob.size) {
          update('idle')
          callbacks.current.onError(new Error('No audio was recorded. Try again.'))
          return
        }
        update('transcribing')
        void callbacks.current
          .onRecording(blob, () => version === generation.current)
          .catch((error: unknown) => {
            if (version === generation.current) callbacks.current.onError(error)
          })
          .finally(() => {
            if (version === generation.current) update('idle')
          })
      }
      current.start(250)
      update('recording')
      timeout.id = setTimeout(() => {
        if (current.state === 'recording') current.stop()
      }, 30_000)
    } catch (error) {
      if (version !== generation.current) return
      cleanup.current()
      update('idle')
      callbacks.current.onError(error)
    }
  }
  useEffect(
    () => () => {
      generation.current += 1
      cleanup.current()
    },
    [],
  )
  return { stage, busy: stage !== 'idle', supported, start, finish, cancel }
}

export function audioToBase64(audio: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result.slice(reader.result.indexOf(',') + 1))
        : reject(new Error('Could not read the recording.'))
    reader.onerror = () => reject(new Error('Could not read the recording.'))
    reader.readAsDataURL(audio)
  })
}
