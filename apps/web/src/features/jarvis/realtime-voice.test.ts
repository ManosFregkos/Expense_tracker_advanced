import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JarvisRealtimeVoice } from './realtime-voice'
import type { JarvisReply } from '@family-expense-tracker/shared'

class Channel {
  readyState = 'connecting'
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  events: Array<Record<string, unknown>> = []
  send(data: string) {
    this.events.push(JSON.parse(data) as Record<string, unknown>)
  }
  close = vi.fn(() => {
    this.readyState = 'closed'
  })
  emit(event: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(event) })
  }
}
class Peer {
  static latest: Peer
  channel = new Channel()
  connectionState = 'connected'
  iceGatheringState = 'complete'
  localDescription: { sdp: string } | null = null
  ontrack: ((event: { streams: unknown[]; track?: unknown }) => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  addTrack = vi.fn()
  close = vi.fn()
  constructor() {
    Peer.latest = this
  }
  createDataChannel() {
    return this.channel
  }
  createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'v=0\r\noffer' }))
  async setLocalDescription(offer: { sdp: string }) {
    this.localDescription = offer
  }
  async setRemoteDescription() {
    this.channel.readyState = 'open'
    this.channel.onopen?.()
  }
}
class AudioPlayer {
  static latest: AudioPlayer
  autoplay = false
  srcObject: unknown = null
  play = vi.fn(async () => undefined)
  pause = vi.fn()
  setAttribute = vi.fn()
  constructor() {
    AudioPlayer.latest = this
  }
}
const track = { enabled: true, stop: vi.fn() }
const stream = { getTracks: () => [track], getAudioTracks: () => [track] }
let getUserMedia: ReturnType<typeof vi.fn>
let live: JarvisRealtimeVoice
function setup() {
  const callbacks = {
    connect: vi.fn(async () => ({ sdp: 'v=0\r\nanswer', model: 'gpt-realtime-2.1-mini' })),
    transcript: vi.fn(),
    answer: vi.fn(),
    tool: vi.fn(async (_question: string): Promise<JarvisReply> => ({
      reply: '€25',
      draft: null,
      sources: [],
    })),
    state: vi.fn(),
    error: vi.fn(),
    playbackBlocked: vi.fn(),
    interrupted: vi.fn(),
  }
  live = new JarvisRealtimeVoice(callbacks)
  return callbacks
}
beforeEach(() => {
  track.enabled = true
  track.stop.mockClear()
  getUserMedia = vi.fn(async () => stream)
  vi.stubGlobal('RTCPeerConnection', Peer)
  vi.stubGlobal('Audio', AudioPlayer)
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
})
afterEach(() => {
  live?.stop()
  vi.unstubAllGlobals()
})
describe('Realtime voice lifecycle', () => {
  it('keeps successful confirmation context without requesting a model response or closing live voice', async () => {
    setup()
    await live.start()
    live.setAwake(true)
    live.addAppResult('Task created: Buy milk.')
    expect(Peer.latest.channel.events.at(-1)).toEqual({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Task created: Buy milk.' }],
      },
    })
    expect(Peer.latest.channel.events.some((event) => event.type === 'response.create')).toBe(false)
    expect(live.ready).toBe(true)
    expect(track.stop).not.toHaveBeenCalled()
  })
  it('streams audio after an authenticated handshake but waits for activation before responding', async () => {
    const callbacks = setup()
    await live.start()
    expect(callbacks.connect).toHaveBeenCalledWith('v=0\r\noffer')
    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ audio: expect.objectContaining({ echoCancellation: true }) }),
    )
    expect(Peer.latest.addTrack).toHaveBeenCalledWith(track, stream)
    live.respond('Ambient speech')
    expect(Peer.latest.channel.events).toEqual([])
    Peer.latest.channel.emit({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'wake',
      transcript: 'Χέλο Τζάρβις',
    })
    expect(callbacks.transcript).toHaveBeenCalledWith('Χέλο Τζάρβις')
    expect(Peer.latest.channel.events).toContainEqual({
      type: 'conversation.item.delete',
      item_id: 'wake',
    })
    live.setAwake(true)
    live.respond()
    expect(Peer.latest.channel.events.at(-1)).toEqual({ type: 'response.create' })
    Peer.latest.channel.emit({ type: 'response.created', response: { id: 'r1' } })
    Peer.latest.ontrack?.({ streams: [stream] })
    Peer.latest.channel.emit({ type: 'output_audio_buffer.started', response_id: 'r1' })
    expect(AudioPlayer.latest.srcObject).toBe(stream)
    expect(callbacks.state).toHaveBeenLastCalledWith('speaking')
    Peer.latest.channel.emit({
      type: 'response.output_audio_transcript.done',
      response_id: 'r1',
      transcript: 'Good evening, Sir.',
    })
    expect(callbacks.answer).toHaveBeenCalledWith('Good evening, Sir.')
  })
  it('interrupts spoken answers and recognizes stop from partial Greek transcription', async () => {
    const callbacks = setup()
    await live.start()
    live.setAwake(true)
    live.respond()
    Peer.latest.channel.emit({ type: 'response.created', response: { id: 'old' } })
    Peer.latest.channel.emit({ type: 'input_audio_buffer.speech_started' })
    expect(callbacks.interrupted).toHaveBeenCalledOnce()
    Peer.latest.channel.emit({
      type: 'response.output_audio_transcript.done',
      response_id: 'old',
      transcript: 'Stale answer',
    })
    expect(callbacks.answer).not.toHaveBeenCalled()
    Peer.latest.channel.emit({
      type: 'conversation.item.input_audio_transcription.delta',
      item_id: 'stop',
      delta: 'Τζάρβις ',
    })
    Peer.latest.channel.emit({
      type: 'conversation.item.input_audio_transcription.delta',
      item_id: 'stop',
      delta: 'στοπ',
    })
    expect(callbacks.transcript).toHaveBeenCalledWith('Jarvis stop')
    live.setAwake(false)
    Peer.latest.channel.emit({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'stop',
      transcript: 'Τζάρβις στοπ',
    })
    expect(callbacks.transcript).toHaveBeenCalledTimes(1)
    expect(live.ready).toBe(true)
    expect(track.stop).not.toHaveBeenCalled()
  })
  it('delegates household tools and discards a result if interrupted during the lookup', async () => {
    const callbacks = setup()
    await live.start()
    live.setAwake(true)
    live.respond()
    let resolve: ((result: JarvisReply) => void) | undefined
    callbacks.tool.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    Peer.latest.channel.emit({
      type: 'response.done',
      response: {
        status: 'completed',
        output: [
          {
            type: 'function_call',
            name: 'ask_app_assistant',
            call_id: 'c1',
            arguments: '{"question":"How much did I spend?"}',
          },
        ],
      },
    })
    expect(callbacks.tool).toHaveBeenCalledWith('How much did I spend?')
    live.setAwake(false)
    resolve?.({ reply: 'Late finance answer', draft: null, sources: [] })
    await Promise.resolve()
    await Promise.resolve()
    expect(
      Peer.latest.channel.events.some(
        (event) => (event.item as { type?: string } | undefined)?.type === 'function_call_output',
      ),
    ).toBe(false)
  })
  it('returns successful app results to the voice model without creating another chat or speech request', async () => {
    const callbacks = setup()
    await live.start()
    live.setAwake(true)
    live.respond()
    Peer.latest.channel.emit({
      type: 'response.done',
      response: {
        status: 'completed',
        output: [
          {
            type: 'function_call',
            name: 'ask_app_assistant',
            call_id: 'c1',
            arguments: '{"question":"My spending?"}',
          },
        ],
      },
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(callbacks.tool).toHaveBeenCalledOnce()
    expect(Peer.latest.channel.events).toContainEqual({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: 'c1',
        output: JSON.stringify({ reply: '€25', draft: null, sources: [] }),
      },
    })
    expect(Peer.latest.channel.events.at(-1)).toEqual({ type: 'response.create' })
  })
  it('releases the microphone and connection on stop, including a late permission result', async () => {
    setup()
    await live.start()
    const pc = Peer.latest
    live.stop()
    expect(pc.close).toHaveBeenCalledOnce()
    expect(pc.channel.close).toHaveBeenCalledOnce()
    expect(track.stop).toHaveBeenCalledOnce()
    let resolve: ((value: typeof stream) => void) | undefined
    getUserMedia.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const pending = live.start()
    live.stop()
    resolve?.(stream)
    await pending
    expect(track.stop).toHaveBeenCalledTimes(2)
    expect(live.ready).toBe(false)
  })
  it('reports denied permissions and lets the user retry blocked audio playback', async () => {
    const callbacks = setup()
    getUserMedia.mockRejectedValueOnce(new Error('Permission denied'))
    await live.start()
    expect(callbacks.error).toHaveBeenCalledWith('Permission denied')
    await live.start()
    AudioPlayer.latest.play.mockRejectedValueOnce(new Error('Autoplay blocked'))
    await live.playAudio()
    expect(callbacks.playbackBlocked).toHaveBeenLastCalledWith(true)
    await live.playAudio()
    expect(callbacks.playbackBlocked).toHaveBeenLastCalledWith(false)
  })
})
