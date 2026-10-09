import { describe, expect, it } from 'vitest'
import { parseJarvisCommand } from './commands'

describe('Jarvis commands', () => {
  it('accepts natural Greek wake and stop variants, with Greek follow-up questions', () => {
    for (const phrase of [
      'Γεια σου Τζάρβις',
      'Γεια σας Τζάρβις',
      'Καλημέρα Τζάρβις',
      'Τζάρβις ξύπνα',
      'Ξύπνα Τζάρβις',
    ])
      expect(parseJarvisCommand(phrase, false)).toEqual({ type: 'wake', question: '' })
    expect(parseJarvisCommand('Καλημέρα, Τζάρβις! Δώσε μου την πρωινή ενημέρωση.', false)).toEqual({
      type: 'wake',
      question: 'Δώσε μου την πρωινή ενημέρωση',
    })
    for (const phrase of [
      'Τζάρβις σταμάτα',
      'Σταμάτα Τζάρβις',
      'Τζάρβις σταμάτησε',
      'Τζάρβις παύση',
      'Τζάρβις τέλος',
    ])
      expect(parseJarvisCommand(phrase.normalize('NFD'), true)).toEqual({ type: 'stop' })
    expect(parseJarvisCommand('Γεια σου Τζάρβισον', false)).toEqual({ type: 'ignore' })
  })
  it('recognizes Greek transcription of English wake and stop phrases', () => {
    expect(parseJarvisCommand('Χέλο Τζάρβις', false)).toEqual({ type: 'wake', question: '' })
    expect(parseJarvisCommand('Γεια σου Τζάρβις τι μέρα είναι σήμερα;', false)).toEqual({
      type: 'wake',
      question: 'τι μέρα είναι σήμερα',
    })
    expect(parseJarvisCommand('Τζάρβις στοπ!', true)).toEqual({ type: 'stop' })
    expect(parseJarvisCommand('Τζάρβις σταμάτα', true)).toEqual({ type: 'stop' })
    expect(parseJarvisCommand('hello Jervis', false)).toEqual({ type: 'wake', question: '' })
  })
  it('ignores everyday speech until woken and accepts a question with the greeting', () => {
    expect(parseJarvisCommand('What can I cook?', false)).toEqual({ type: 'ignore' })
    expect(parseJarvisCommand('Hello, JARVIS! What can I cook?', false)).toEqual({
      type: 'wake',
      question: 'What can I cook',
    })
    expect(parseJarvisCommand('What can I cook?', true)).toEqual({
      type: 'question',
      question: 'What can I cook?',
    })
  })
  it('gives stop precedence and does not confuse similarly named words', () => {
    expect(parseJarvisCommand('Hello Jarvis, Jarvis stop!', true)).toEqual({ type: 'stop' })
    expect(parseJarvisCommand('hello jarvison', false)).toEqual({ type: 'ignore' })
    expect(parseJarvisCommand('Jarvis stopped', false)).toEqual({ type: 'ignore' })
    expect(parseJarvisCommand('   ', true)).toEqual({ type: 'ignore' })
  })
})
