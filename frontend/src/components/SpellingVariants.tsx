import { useState } from 'react'
import type { TranscribeResponse } from '../types'
import styles from './SpellingVariants.module.css'

interface Variant {
  language: string
  spelling: string
  notes: string
}

interface Props {
  result: TranscribeResponse
}

type Status = 'idle' | 'loading' | 'done' | 'error'

export default function SpellingVariants({ result }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [variants, setVariants] = useState<Variant[]>([])
  const [error, setError] = useState<string | null>(null)

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
      <p className={styles.subheading}>IPA: {result.ipa}</p>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Language</th>
              <th>Spelling</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => (
              <tr key={v.language}>
                <td className={styles.lang}>{v.language}</td>
                <td className={styles.spelling}>{v.spelling}</td>
                <td className={styles.notes}>{v.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
