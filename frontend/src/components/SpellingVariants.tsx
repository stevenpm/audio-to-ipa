import { useRef, useState } from 'react'
import type { TranscribeResponse } from '../types'
import styles from './SpellingVariants.module.css'

interface Variant {
  language: string
  spelling: string
  notes: string
}

interface Alternative {
  spelling: string
  notes: string
}

type AltStatus = 'loading' | 'done' | 'error'

interface AltState {
  status: AltStatus
  data: Alternative[]
  error: string | null
}

interface Props {
  result: TranscribeResponse
}

type Status = 'idle' | 'loading' | 'done' | 'error'

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    await navigator.clipboard.writeText(text)
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button className={styles.copyBtn} onClick={handleCopy} title="Copy to clipboard">
      {copied ? '✓' : 'Copy'}
    </button>
  )
}

export default function SpellingVariants({ result }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [variants, setVariants] = useState<Variant[]>([])
  const [error, setError] = useState<string | null>(null)
  const [expandedLang, setExpandedLang] = useState<string | null>(null)
  const [altsByLang, setAltsByLang] = useState<Record<string, AltState>>({})

  async function fetchVariants() {
    setStatus('loading')
    setError(null)
    try {
      const res = await fetch('/api/spellings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ipa: result.ipa, transcript: result.transcript }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail ?? `Server error (${res.status})`)
      }
      const data = await res.json()
      setVariants(data.variants)
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate spellings.')
      setStatus('error')
    }
  }

  async function handleRowClick(language: string) {
    if (expandedLang === language) {
      setExpandedLang(null)
      return
    }
    setExpandedLang(language)

    if (altsByLang[language]) return // already fetched

    setAltsByLang(prev => ({ ...prev, [language]: { status: 'loading', data: [], error: null } }))
    try {
      const res = await fetch('/api/spellings/alternatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ipa: result.ipa, transcript: result.transcript, language }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail ?? `Server error (${res.status})`)
      }
      const data = await res.json()
      setAltsByLang(prev => ({ ...prev, [language]: { status: 'done', data: data.alternatives, error: null } }))
    } catch (err) {
      setAltsByLang(prev => ({
        ...prev,
        [language]: { status: 'error', data: [], error: err instanceof Error ? err.message : 'Failed.' },
      }))
    }
  }

  if (status === 'idle') {
    return (
      <div className={styles.wrapper}>
        <button className={styles.trigger} onClick={fetchVariants}>
          <span className={styles.globe}>🌐</span>
          Show spelling variants by language
        </button>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className={styles.wrapper}>
        <div className={styles.loading}>
          <span className={styles.spinner} />
          Generating spelling variants…
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={styles.wrapper}>
        <p className={styles.error}>⚠ {error}</p>
        <button className={styles.retry} onClick={fetchVariants}>Try again</button>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <h3 className={styles.heading}>
        <span className={styles.globe}>🌐</span>
        Spelling variants for "{result.transcript}"
      </h3>
      <p className={styles.subheading}>IPA: {result.ipa} · Click a row to see more alternatives</p>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Language</th>
              <th>Spelling</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => {
              const isExpanded = expandedLang === v.language
              const alt = altsByLang[v.language]
              return (
                <>
                  <tr
                    key={v.language}
                    className={`${styles.variantRow} ${isExpanded ? styles.expanded : ''}`}
                    onClick={() => handleRowClick(v.language)}
                  >
                    <td className={styles.lang}>
                      <span className={styles.chevron}>{isExpanded ? '▾' : '▸'}</span>
                      {v.language}
                    </td>
                    <td className={styles.spelling}>{v.spelling}</td>
                    <td className={styles.notes}>{v.notes}</td>
                    <td className={styles.copyCell}>
                      <CopyBtn text={v.spelling} />
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${v.language}-alts`} className={styles.altRow}>
                      <td colSpan={4} className={styles.altCell}>
                        {!alt || alt.status === 'loading' ? (
                          <div className={styles.altLoading}>
                            <span className={styles.spinner} /> Loading alternatives…
                          </div>
                        ) : alt.status === 'error' ? (
                          <p className={styles.altError}>⚠ {alt.error}</p>
                        ) : (
                          <ul className={styles.altList}>
                            {alt.data.map((a, i) => (
                              <li key={i} className={styles.altItem}>
                                <span className={styles.altSpelling}>{a.spelling}</span>
                                <span className={styles.altNotes}>{a.notes}</span>
                                <CopyBtn text={a.spelling} />
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
