import { Fragment, useState, type ReactNode } from 'react'
import { IconCheck, IconCopy } from '@tabler/icons-react'
import { safeUrl } from './study-lib'

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
    if (link) {
      const href = safeUrl(link[2] ?? '')
      return href ? (
        <a key={i} href={href} target="_blank" rel="noopener noreferrer">
          {link[1]}
        </a>
      ) : (
        <Fragment key={i}>{link[1]}</Fragment>
      )
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="st-code">
      <div>
        <span>{language || 'code'}</span>
        <button type="button" onClick={() => void copy()} aria-label="Copy code">
          {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}
export function headings(markdown: string) {
  let fenced = false
  return markdown.split('\n').flatMap((line, index) => {
    if (line.startsWith('```')) {
      fenced = !fenced
      return []
    }
    const match = !fenced ? /^(#{1,3})\s+(.+)$/.exec(line) : null
    return match
      ? [{ id: `section-${index}`, text: match[2] ?? '', level: match[1]?.length ?? 2 }]
      : []
  })
}
// React escapes all source text. Raw HTML, images, and non-HTTP links are never rendered.
export function Markdown({ text }: { text: string }) {
  const lines = text.split('\n'),
    blocks: ReactNode[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index] ?? '',
      start = index
    if (!line.trim()) {
      index++
      continue
    }
    if (line.startsWith('```')) {
      const language = line.slice(3).trim(),
        code: string[] = []
      index++
      while (index < lines.length && !lines[index]?.startsWith('```'))
        code.push(lines[index++] ?? '')
      index++
      blocks.push(<CodeBlock key={start} language={language} code={code.join('\n')} />)
      continue
    }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line)
    if (heading) {
      const content = inline(heading[2] ?? ''),
        anchor = `section-${start}`
      blocks.push(
        heading[1]?.length === 1 ? (
          <h1 key={start} id={anchor}>
            {content}
          </h1>
        ) : heading[1]?.length === 2 ? (
          <h2 key={start} id={anchor}>
            {content}
          </h2>
        ) : (
          <h3 key={start} id={anchor}>
            {content}
          </h3>
        ),
      )
      index++
      continue
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = []
      while (index < lines.length && /^>/.test(lines[index] ?? ''))
        quote.push((lines[index++] ?? '').replace(/^>\s?/, ''))
      blocks.push(<blockquote key={start}>{inline(quote.join(' '))}</blockquote>)
      continue
    }
    if (/^\s*([-*]|\d+\.)\s/.test(line)) {
      const ordered = /^\s*\d+\./.test(line),
        items: ReactNode[] = []
      while (
        index < lines.length &&
        (ordered ? /^\s*\d+\.\s/ : /^\s*[-*]\s/).test(lines[index] ?? '')
      ) {
        items.push(
          <li key={index}>{inline((lines[index++] ?? '').replace(/^\s*([-*]|\d+\.)\s+/, ''))}</li>,
        )
      }
      blocks.push(ordered ? <ol key={start}>{items}</ol> : <ul key={start}>{items}</ul>)
      continue
    }
    if (line.startsWith('|') && /^\|?[\s:|-]+\|$/.test(lines[index + 1] ?? '')) {
      const cells = (value: string) =>
        value
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((s) => s.trim())
      const header = cells(line),
        rows: string[][] = []
      index += 2
      while (index < lines.length && lines[index]?.startsWith('|'))
        rows.push(cells(lines[index++] ?? ''))
      blocks.push(
        <div className="st-table-wrap" key={start}>
          <table>
            <thead>
              <tr>
                {header.map((cell, i) => (
                  <th key={i}>{inline(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{inline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }
    if (/^[-*_]{3,}$/.test(line.trim())) {
      blocks.push(<hr key={start} />)
      index++
      continue
    }
    const paragraph: string[] = [line]
    index++
    while (
      index < lines.length &&
      lines[index]?.trim() &&
      !/^(#{1,4}\s|```|>|\s*([-*]|\d+\.)\s|\|)/.test(lines[index] ?? '')
    )
      paragraph.push(lines[index++] ?? '')
    blocks.push(<p key={start}>{inline(paragraph.join('\n'))}</p>)
  }
  return <div className="st-markdown">{blocks}</div>
}
