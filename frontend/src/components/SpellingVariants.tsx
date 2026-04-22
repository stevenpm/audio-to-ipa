import { useEffect, useRef, useState, type MouseEvent, type ChangeEvent } from 'react'
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

function selKey(language: string, spelling: string) {
  return `${language}:${spelling}`
}

function CopyBtn({ text, small }: { text: string; small?: boolean }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function handleCopy(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    await navigator.clipboard.writeText(text)
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      className={small ? styles.copyBtnSm : styles.copyBtn}
      onClick={handleCopy}
      title="Copy to clipboard"
    >
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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkCopied, setBulkCopied] = useState(false)
  const bulkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status === 'done' && wrapperRef.current) {
      const top = wrapperRef.current.getBoundingClientRect().top + window.scrollY - 16
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }, [status])

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
    if (altsByLang[language]) return

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

  function toggleSelected(language: string, spelling: string, e: ChangeEvent<HTMLInputElement>) {
    e.stopPropagation()
    const key = selKey(language, spelling)
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // Determine parent checkbox state: checked / indeterminate / unchecked
  function parentCheckState(v: Variant): { checked: boolean; indeterminate: boolean } {
    const parentChecked = selected.has(selKey(v.language, v.spelling))
    const alt = altsByLang[v.language]
    const childKeys = alt?.status === 'done' ? alt.data.map(a => selKey(v.language, a.spelling)) : []
    const checkedChildren = childKeys.filter(k => selected.has(k))

    if (parentChecked && checkedChildren.length === 0) return { checked: true, indeterminate: false }
    if (!parentChecked && checkedChildren.length === 0) return { checked: false, indeterminate: false }
    // Some mix — show indeterminate
    return { checked: false, indeterminate: true }
  }

  // Toggle parent: check/uncheck the parent spelling + all loaded children
  function toggleParent(v: Variant, e: ChangeEvent<HTMLInputElement>) {
    e.stopPropagation()
    const { checked, indeterminate } = parentCheckState(v)
    const shouldSelect = !checked && !indeterminate // if anything selected, deselect all; else select all
    const alt = altsByLang[v.language]
    const childKeys = alt?.status === 'done' ? alt.data.map(a => selKey(v.language, a.spelling)) : []
    const parentKey = selKey(v.language, v.spelling)
    const allKeys = [parentKey, ...childKeys]

    setSelected(prev => {
      const next = new Set(prev)
      if (shouldSelect) {
        allKeys.forEach(k => next.add(k))
      } else {
        allKeys.forEach(k => next.delete(k))
      }
      return next
    })
  }

  async function copySelected() {
    const spellings = [...selected].map(k => k.split(':').slice(1).join(':'))
    await navigator.clipboard.writeText(spellings.join('\n'))
    setBulkCopied(true)
    if (bulkTimer.current) clearTimeout(bulkTimer.current)
    bulkTimer.current = setTimeout(() => setBulkCopied(false), 2000)
  }

  function clearSelection() {
    setSelected(new Set())
  }

  if (status === 'idle') {
    return (
      <div ref={wrapperRef} className={styles.wrapper}>
        <button className={styles.trigger} onClick={fetchVariants}>
          <span className={styles.globe}>🌐</span>
          Show spelling variants by language
        </button>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div ref={wrapperRef} className={styles.wrapper}>
        <div className={styles.loading}>
          <span className={styles.spinner} />
          Generating spelling variants…
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div ref={wrapperRef} className={styles.wrapper}>
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

      {selected.size > 0 && (
        <div className={styles.selectionBar}>
          <span className={styles.selectionCount}>{selected.size} selected</span>
          <button className={styles.copySelectedBtn} onClick={copySelected}>
            {bulkCopied ? '✓ Copied!' : `Copy ${selected.size}`}
          </button>
          <button className={styles.clearBtn} onClick={clearSelection}>Clear</button>
        </div>
      )}

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.checkCol}></th>
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
              const { checked, indeterminate } = parentCheckState(v)
              return (
                <>
                  <tr
                    key={v.language}
                    className={`${styles.variantRow} ${isExpanded ? styles.expanded : ''}`}
                    onClick={() => handleRowClick(v.language)}
                  >
                    <td
                      className={styles.checkCell}
                      onClick={e => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={checked}
                        ref={el => { if (el) el.indeterminate = indeterminate }}
                        onChange={e => toggleParent(v, e)}
                      />
                    </td>
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
                      <td colSpan={5} className={styles.altCell}>
                        {!alt || alt.status === 'loading' ? (
                          <div className={styles.altLoading}>
                            <span className={styles.spinner} /> Loading alternatives…
                          </div>
                        ) : alt.status === 'error' ? (
                          <p className={styles.altError}>⚠ {alt.error}</p>
                        ) : (
                          <ul className={styles.altList}>
                            {alt.data.map((a, i) => {
                              const childKey = selKey(v.language, a.spelling)
                              return (
                                <li key={i} className={styles.altItem}>
                                  <input
                                    type="checkbox"
                                    className={styles.checkbox}
                                    checked={selected.has(childKey)}
                                    onChange={e => toggleSelected(v.language, a.spelling, e)}
                                  />
                                  <span className={styles.altSpelling}>{a.spelling}</span>
                                  <span className={styles.altNotes}>{a.notes}</span>
                                  <CopyBtn text={a.spelling} small />
                                </li>
                              )
                            })}
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
