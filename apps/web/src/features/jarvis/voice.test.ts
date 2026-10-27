import { describe, expect, it } from 'vitest'
import { parseVoiceCommand } from './voice'

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
