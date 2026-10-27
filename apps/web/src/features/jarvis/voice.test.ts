import { describe, expect, it } from 'vitest'
import { parseVoiceCommand, recognitionTranscript } from './voice'

describe('Jarvis voice controls', () => {
  it('ignores ambient speech until the wake phrase', () => {
    expect(parseVoiceCommand('add 30 euro supermarket', false)).toEqual({ type: 'ignore' })
  })
  it('handles the wake phrase alone and wake plus command in one utterance', () => {
    expect(parseVoiceCommand('Hey Jarvis!', false)).toEqual({ type: 'wake', message: '' })
    expect(parseVoiceCommand('Hey, Jarvis, add income 1500 euro salary', false)).toEqual({
      type: 'wake',
      message: 'add income 1500 euro salary',
    })
  })
  it.each(['Hey Jarivs', 'Hi Jervis', 'Hey Jarvice', 'Hey Javis'])(
    'recognizes the common name transcription %s',
    (text) => {
      expect(parseVoiceCommand(text, false)).toEqual({ type: 'wake', message: '' })
    },
  )
  it('does not send an unrelated wake-name transcription as a GPT question', () => {
    expect(parseVoiceCommand("hey Debbie's", true)).toEqual({ type: 'uncertain-wake' })
    expect(parseVoiceCommand('hey Debbie add thirty euro', false)).toEqual({ type: 'ignore' })
    expect(parseVoiceCommand('Hey Jarivs add 30 euro supermarket', false)).toEqual({
      type: 'wake',
      message: 'add 30 euro supermarket',
    })
  })
  it('uses alternate transcripts only to recover a standalone wake phrase', () => {
    expect(
      recognitionTranscript({
        isFinal: true,
        length: 2,
        0: { transcript: "hey Debbie's" },
        1: { transcript: 'Hey Jarvis' },
      }),
    ).toBe('Hey Jarvis')
    expect(
      recognitionTranscript({
        isFinal: true,
        length: 2,
        0: { transcript: 'Add 13 euro supermarket' },
        1: { transcript: 'Hey Jarvis add 30 euro supermarket' },
      }),
    ).toBe('Add 13 euro supermarket')
    expect(
      recognitionTranscript({
        isFinal: true,
        length: 2,
        0: { transcript: "hey Debbie's" },
        1: { transcript: 'Hey Jarvis add 30 euro supermarket' },
      }),
    ).toBe("hey Debbie's")
  })
  it('accepts follow-up conversation only after activation', () => {
    expect(parseVoiceCommand('Use cash', true)).toEqual({ type: 'message', message: 'Use cash' })
    expect(parseVoiceCommand('they said hey Jarvis in a movie', false)).toEqual({ type: 'ignore' })
  })
  it('stops while the assistant is speaking and ignores other speaker echo', () => {
    expect(parseVoiceCommand('Jarvis stop.', true, true)).toEqual({ type: 'stop' })
    expect(parseVoiceCommand('Hey Jarvis add 30 euro', true, true)).toEqual({ type: 'ignore' })
    expect(parseVoiceCommand('Add buy milk', true, true)).toEqual({ type: 'ignore' })
  })
})
