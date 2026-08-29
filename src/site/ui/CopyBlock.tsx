import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  label: string
  code: string
  /** Rendered under the header, before the code. */
  note?: string
}

/** A code block with a copy button that degrades on browsers without the clipboard API. */
export function CopyBlock({ label, code, note }: Props) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    [],
  )

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      // No clipboard API in insecure contexts; fall back to the old selection trick.
      const ta = document.createElement('textarea')
      ta.value = code
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setCopied(false), 1600)
  }, [code])

  return (
    <div className="code-block">
      <div className="code-head">
        <span className="code-label">{label}</span>
        <button type="button" className={`copy-btn${copied ? ' is-copied' : ''}`} onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {note && <p className="code-note">{note}</p>}
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}
