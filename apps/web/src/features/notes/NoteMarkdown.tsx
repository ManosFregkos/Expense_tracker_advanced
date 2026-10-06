import { Fragment, useState, type ReactNode } from 'react'
import { safeUrl } from './notes-lib'

function Inline({ text, onLink }: { text: string; onLink: (title: string) => void }) {
  const tokens = text.split(
    /(\[\[[^\]\n]+\]\]|\[[^\]\n]+\]\([^\s)]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g,
  )
  return (
    <>
      {tokens.map((token, i) => {
        if (token.startsWith('[['))
          return (
            <button key={i} className="nt-wikilink" onClick={() => onLink(token.slice(2, -2))}>
              {token.slice(2, -2)}
            </button>
          )
        const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
        if (link) {
          const url = safeUrl(link[2]!)
          return url ? (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
              {link[1]}
            </a>
          ) : (
            <Fragment key={i}>{link[1]}</Fragment>
          )
        }
        if (token.startsWith('**')) return <strong key={i}>{token.slice(2, -2)}</strong>
        if (token.startsWith('`')) return <code key={i}>{token.slice(1, -1)}</code>
        if (token.startsWith('*')) return <em key={i}>{token.slice(1, -1)}</em>
        return <Fragment key={i}>{token}</Fragment>
      })}
    </>
  )
}
function Code({ value, language }: { value: string; language: string }) {
  const [status, setStatus] = useState('Copy')
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setStatus('Copied')
    } catch {
      setStatus('Copy unavailable')
    }
  }
  return (
    <div className="nt-code">
      <div>
        <span>{language || 'code'}</span>
        <button onClick={() => void copy()}>{status}</button>
      </div>
      <pre>
        <code>{value}</code>
      </pre>
    </div>
  )
}
export function headings(body: string) {
  let code = false
  return body.split('\n').flatMap((line, i) => {
    if (line.startsWith('```')) {
      code = !code
      return []
    }
    const match = !code && line.match(/^(#{1,3})\s+(.+)$/)
    return match ? [{ id: `heading-${i}`, title: match[2]!, depth: match[1]!.length }] : []
  })
}
export function NoteMarkdown({
  body,
  onTask,
  onLink,
}: {
  body: string
  onTask: (line: number) => void
  onLink: (title: string) => void
}) {
  const lines = body.split('\n')
  const blocks: ReactNode[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.startsWith('```')) {
      const start = i
      const language = line.slice(3)
      const code: string[] = []
      while (++i < lines.length && !lines[i]!.startsWith('```')) code.push(lines[i]!)
      blocks.push(<Code key={start} value={code.join('\n')} language={language} />)
      continue
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      const Tag = `h${heading[1]!.length}` as 'h1' | 'h2' | 'h3'
      blocks.push(
        <Tag key={i} id={`heading-${i}`}>
          <Inline text={heading[2]!} onLink={onLink} />
        </Tag>,
      )
      continue
    }
    const task = line.match(/^\s*[-*] \[([ xX])\] (.+)$/)
    if (task) {
      const index = i
      blocks.push(
        <label className="nt-task" key={i}>
          <input type="checkbox" checked={task[1] !== ' '} onChange={() => onTask(index)} />
          <span>
            <Inline text={task[2]!} onLink={onLink} />
          </span>
        </label>,
      )
      continue
    }
    if (line.startsWith('> ')) {
      blocks.push(
        <blockquote key={i}>
          <Inline text={line.slice(2)} onLink={onLink} />
        </blockquote>,
      )
      continue
    }
    if (/^([-*_])\1{2,}$/.test(line.trim())) {
      blocks.push(<hr key={i} />)
      continue
    }
    const bullet = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/)
    if (bullet) {
      blocks.push(
        <div className="nt-bullet" key={i}>
          • <Inline text={bullet[1]!} onLink={onLink} />
        </div>,
      )
      continue
    }
    if (line.trim())
      blocks.push(
        <p key={i}>
          <Inline text={line} onLink={onLink} />
        </p>,
      )
  }
  return (
    <div className="nt-markdown">
      {blocks.length ? (
        blocks
      ) : (
        <p className="nt-muted">Your next idea starts here. Switch to Write to add notes.</p>
      )}
    </div>
  )
}
