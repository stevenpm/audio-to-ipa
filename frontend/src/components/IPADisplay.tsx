import { useRef, useState } from 'react'
import type { AppStatus, TranscribeResponse } from '../types'
import SpellingVariants from './SpellingVariants'
import styles from './IPADisplay.module.css'

interface Props {
  result: TranscribeResponse | null
  status: AppStatus
  errorMessage: string | null
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button className={styles.copyBtn} onClick={handleCopy} title="Copy to clipboard">
      {copied ? '✓ Copied!' : 'Copy'}
    </button>
  )
}

function Panel({ label, content }: { label: string; content: string }) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelLabel}>{label}</span>
        <CopyButton text={content} />
      </div>
      <div className={label === 'IPA' ? styles.ipaText : styles.transcriptText}>
        {content}
      </div>
    </div>
  )
}

export default function IPADisplay({ result, status, errorMessage }: Props) {
  if (status === 'processing') {
    return (
      <div className={styles.skeleton}>
        <div className={styles.skeletonPanel} />
        <div className={styles.skeletonPanel} />
      </div>
    )
  }

  if (status === 'error' && errorMessage) {
    return (
      <div className={styles.errorBox}>
        <span className={styles.errorIcon}>⚠</span>
        {errorMessage}
      </div>
    )
  }

  if (!result) return null

  return (
    <div className={styles.wrapper}>
      <p className={styles.language}>
        Detected language: <strong>{result.language_name}</strong>
      </p>
      <div className={styles.panels}>
        <Panel label="Transcript" content={result.transcript} />
        <Panel label="IPA" content={result.ipa} />
      </div>
      <SpellingVariants result={result} />
    </div>
  )
}
