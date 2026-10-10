import type {
  JarvisMessage,
  JarvisReply,
  JarvisRealtimeSession,
} from '@family-expense-tracker/shared'
import { parseJarvisCommand } from './commands'

export type RealtimeState = 'off' | 'connecting' | 'listening' | 'thinking' | 'speaking'
interface Callbacks {
  connect(sdp: string): Promise<JarvisRealtimeSession>
  transcript(text: string): void
  answer(text: string): void
  tool(question: string): Promise<JarvisReply>
  state(state: RealtimeState): void
  error(message: string): void
  playbackBlocked(blocked: boolean): void
  interrupted?(): void
}

// Audio travels on WebRTC media tracks. The data channel carries captions and tool results.
// App tools still run through authenticated Firebase callables; no database credentials are here.
export class JarvisRealtimeVoice {
  private pc: RTCPeerConnection | null = null
  private channel: RTCDataChannel | null = null
  private stream: MediaStream | null = null
  private audio: HTMLAudioElement | null = null
  private generation = 0
  private turn = 0
  private active = false
  private muted = false
  private responding = false
  private responseId = ''
  private cancelled = new Set<string>()
  private toolRounds = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private deltas = new Map<string, string>()
  private handled = new Set<string>()
  private pendingReady: (() => void) | null = null

  constructor(private callbacks: Callbacks) {}
  get ready() {
    return this.channel?.readyState === 'open'
  }

  async start(history: JarvisMessage[] = [], active = false) {
    this.stop()
    this.active = active
    const token = this.generation
    this.callbacks.state('connecting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      })
      if (token !== this.generation) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      this.stream = stream
      this.mute(this.muted)
      const pc = new RTCPeerConnection()
      this.pc = pc
      const audio = new Audio()
      audio.autoplay = true
      audio.setAttribute('playsinline', '')
      this.audio = audio
      pc.ontrack = (event) => {
        if (token !== this.generation) return
        audio.srcObject = event.streams[0] ?? new MediaStream([event.track])
        void this.playAudio()
      }
      pc.onconnectionstatechange = () => {
        if (token !== this.generation) return
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed')
          this.fail('Live voice disconnected. Enable the microphone again or use text.')
      }
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))
      const channel = pc.createDataChannel('oai-events')
      this.channel = channel
      channel.onmessage = (event) => {
        if (token === this.generation) this.receive(event.data)
      }
      channel.onclose = () => {
        if (token === this.generation) this.fail('Live voice ended. Enable the microphone again.')
      }
      channel.onerror = () => {
        if (token === this.generation)
          this.fail('The live voice connection failed. Please try again.')
      }
      // Resolve on cancellation as well, so a late backend result cannot reopen a stopped session.
      const opened = new Promise<void>((resolve) => {
        this.pendingReady = resolve
        channel.onopen = () => resolve()
      })
      this.timer = setTimeout(() => {
        if (token === this.generation)
          this.fail('Live voice took too long to connect. Please try again.')
      }, 20_000)
      const offer = await pc.createOffer()
      if (token !== this.generation) return
      await pc.setLocalDescription(offer)
      await this.gatherIce(pc)
      if (token !== this.generation) return
      const sdp = pc.localDescription?.sdp
      if (!sdp) throw new Error('Could not prepare the microphone connection.')
      const answer = await this.callbacks.connect(sdp)
      if (token !== this.generation) return
      await pc.setRemoteDescription({ type: 'answer', sdp: answer.sdp })
      await opened
      if (token !== this.generation) return
      if (this.timer) clearTimeout(this.timer)
      this.timer = null
      this.pendingReady = null
      // Preserve recent text context without replaying wake/stop greetings.
      for (const message of history.slice(-20)) {
        if (
          parseJarvisCommand(message.content, false).type !== 'ignore' ||
          message.content === 'Hello Sir' ||
          message.content === 'Goodbye sir' ||
          message.content === 'Γεια σας, κύριε' ||
          message.content === 'Αντίο, κύριε'
        )
          continue
        this.send({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: message.role,
            content: [
              { type: message.role === 'user' ? 'input_text' : 'text', text: message.content },
            ],
          },
        })
      }
      this.callbacks.state('listening')
    } catch (reason) {
      if (token !== this.generation) return
      this.fail(reason instanceof Error ? reason.message : 'Could not start live voice.')
    }
  }

  private gatherIce(pc: RTCPeerConnection) {
    if (pc.iceGatheringState === 'complete') return Promise.resolve()
    return new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(timeout)
        pc.removeEventListener('icegatheringstatechange', changed)
        resolve()
      }
      const changed = () => {
        if (pc.iceGatheringState === 'complete') finish()
      }
      const timeout = setTimeout(finish, 1500)
      pc.addEventListener('icegatheringstatechange', changed)
    })
  }

  setAwake(active: boolean) {
    this.active = active
    if (!active) this.interrupt()
  }
  mute(muted: boolean) {
    this.muted = muted
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted
    })
  }
  async playAudio() {
    const token = this.generation
    try {
      await this.audio?.play()
      if (token === this.generation) this.callbacks.playbackBlocked(false)
    } catch {
      if (token === this.generation) this.callbacks.playbackBlocked(true)
    }
  }
  interrupt() {
    this.turn++
    if (this.responseId) this.cancelled.add(this.responseId)
    if (this.responding) this.send({ type: 'response.cancel' })
    this.responding = false
    this.send({ type: 'output_audio_buffer.clear' })
    this.callbacks.state(this.ready ? 'listening' : this.pc ? 'connecting' : 'off')
  }
  respond(question?: string) {
    if (!this.ready || !this.active) return
    this.interrupt()
    this.toolRounds = 0
    if (question)
      this.send({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: question }],
        },
      })
    this.responding = true
    this.callbacks.state('thinking')
    this.send({ type: 'response.create' })
  }
  addAppResult(text: string) {
    this.interrupt()
    this.send({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'assistant', content: [{ type: 'text', text }] },
    })
  }
  private send(event: Record<string, unknown>) {
    if (this.ready) this.channel?.send(JSON.stringify(event))
  }
  private receive(data: unknown) {
    if (typeof data !== 'string') return
    let event: Record<string, unknown>
    try {
      event = JSON.parse(data) as Record<string, unknown>
    } catch {
      return
    }
    if (!event || typeof event.type !== 'string') return
    if (typeof event.response_id === 'string' && this.cancelled.has(event.response_id)) return
    const id = typeof event.item_id === 'string' ? event.item_id : ''
    switch (event.type) {
      case 'input_audio_buffer.speech_started':
        // Server VAD cancels and truncates generated speech when the user interrupts.
        this.turn++
        if (this.responseId) this.cancelled.add(this.responseId)
        this.responding = false
        this.callbacks.interrupted?.()
        this.callbacks.state('listening')
        break
      case 'conversation.item.input_audio_transcription.delta': {
        const text =
          (this.deltas.get(id) ?? '') + (typeof event.delta === 'string' ? event.delta : '')
        this.deltas.set(id, text)
        if (parseJarvisCommand(text, false).type === 'stop' && !this.handled.has(id)) {
          this.handled.add(id)
          this.callbacks.transcript(text)
        }
        break
      }
      case 'conversation.item.input_audio_transcription.completed': {
        this.deltas.delete(id)
        const text = typeof event.transcript === 'string' ? event.transcript.trim() : ''
        const command = parseJarvisCommand(text, this.active)
        if (command.type !== 'question' && id)
          this.send({ type: 'conversation.item.delete', item_id: id })
        if (text && !this.handled.has(id)) {
          this.handled.add(id)
          this.callbacks.transcript(text)
        }
        // Bound local bookkeeping for long foreground sessions.
        if (this.handled.size > 200) this.handled.delete(this.handled.values().next().value!)
        break
      }
      case 'conversation.item.input_audio_transcription.failed':
        this.callbacks.error('Could not understand that question. Please repeat it or type it.')
        this.callbacks.state('listening')
        break
      case 'response.created': {
        const response = event.response as { id?: string } | undefined
        this.responseId = response?.id ?? ''
        this.responding = true
        this.callbacks.state('thinking')
        break
      }
      case 'output_audio_buffer.started':
        this.callbacks.state('speaking')
        void this.playAudio()
        break
      case 'output_audio_buffer.stopped':
      case 'output_audio_buffer.cleared':
        this.callbacks.state('listening')
        break
      case 'response.output_audio_transcript.done':
        if (this.active && typeof event.transcript === 'string')
          this.callbacks.answer(event.transcript)
        break
      case 'response.done': {
        const response = event.response as
          { id?: string; status?: string; output?: Array<Record<string, unknown>> } | undefined
        if (response?.id && this.cancelled.has(response.id)) break
        this.responding = false
        if (response?.status === 'failed' || response?.status === 'incomplete') {
          this.callbacks.error('Jarvis could not finish that answer. Please try again.')
          this.callbacks.state('listening')
          break
        }
        const calls = response?.output?.filter((item) => item.type === 'function_call') ?? []
        if (calls.length && this.active) void this.executeTools(calls)
        break
      }
      case 'error': {
        const error = event.error as { code?: string } | undefined
        if (error?.code === 'response_cancel_not_active') break
        this.callbacks.error('Live voice reported an error. Try your question again or reconnect.')
        this.responding = false
        this.callbacks.state('listening')
        break
      }
    }
  }

  private async executeTools(calls: Array<Record<string, unknown>>) {
    const token = this.generation
    const turn = this.turn
    this.callbacks.state('thinking')
    if (++this.toolRounds > 4) {
      this.callbacks.error('Please ask a simpler question so Jarvis can finish.')
      this.callbacks.state('listening')
      return
    }
    for (const call of calls) {
      if (typeof call.call_id !== 'string') continue
      let output: unknown
      try {
        const args = JSON.parse(String(call.arguments)) as { question?: unknown }
        if (
          call.name !== 'ask_app_assistant' ||
          typeof args.question !== 'string' ||
          !args.question.trim() ||
          args.question.length > 4000
        )
          throw new Error('Invalid tool')
        output = await this.callbacks.tool(args.question.trim())
      } catch {
        output = { error: 'The app lookup failed. Ask the user to retry; do not invent an answer.' }
      }
      if (token !== this.generation || turn !== this.turn || !this.active) return
      this.send({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify(output),
        },
      })
    }
    if (token === this.generation && turn === this.turn && this.active) {
      this.responding = true
      this.send({ type: 'response.create' })
    }
  }
  private fail(message: string) {
    this.stop()
    this.callbacks.error(message)
  }
  stop() {
    this.generation++
    this.turn++
    this.active = false
    this.responding = false
    this.pendingReady?.()
    this.pendingReady = null
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (this.channel) {
      this.channel.onclose = null
      this.channel.onerror = null
      this.channel.onmessage = null
      this.channel.close()
    }
    this.channel = null
    if (this.pc) {
      this.pc.ontrack = null
      this.pc.onconnectionstatechange = null
      this.pc.close()
    }
    this.pc = null
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    if (this.audio) {
      this.audio.pause()
      this.audio.srcObject = null
    }
    this.audio = null
    this.deltas.clear()
    this.handled.clear()
    this.cancelled.clear()
    this.responseId = ''
    this.callbacks.state('off')
    this.callbacks.playbackBlocked(false)
  }
}
